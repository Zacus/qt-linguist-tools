import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as fileUtils from "../utils/FileUtils";
import { getQtPaths } from "../utils/QtUtils";

interface CompileResult {
  sourceFile: string;
  outputFile: string;
  success: boolean;
  message: string;
  size?: number; // QM文件大小
}

interface QtPaths {
  lrelease: string;
}

class QmFileGenerator {
  private readonly BATCH_SIZE = 8; // 编译操作通常更轻量，可以增加并发数
  private readonly COMPILE_TIMEOUT = 15000; // 15秒超时，编译通常较快

  constructor(private qtPaths: QtPaths) {}

  /**
   * 构建 lrelease 命令
   */
  private buildLreleaseCommand(
    tsFilePath: string,
    options?: {
      compress?: boolean;
      verbose?: boolean;
      outputDir?: string;
    }
  ): string {
    const isWindows = os.platform() === "win32";
    const quote = isWindows ? '"' : "'";

    let command = `${quote}${this.qtPaths.lrelease}${quote}`;

    // 添加选项
    if (options?.compress) {
      command += " -compress";
    }
    if (options?.verbose) {
      command += " -verbose";
    }

    // 输入文件
    command += ` ${quote}${tsFilePath}${quote}`;

    // 输出目录（如果指定）
    if (options?.outputDir) {
      const outputFile = path.join(
        options.outputDir,
        path.basename(tsFilePath).replace(".ts", ".qm")
      );
      command += ` -qm ${quote}${outputFile}${quote}`;
    }

    return command;
  }

  /**
   * 验证TS文件并获取输出路径
   */
  private async validateTsFile(filePath: string): Promise<{
    isValid: boolean;
    outputPath: string;
    error?: string;
  }> {
    try {
      // 检查文件是否存在且可读
      await fs.promises.access(filePath, fs.constants.R_OK);

      // 检查是否为.ts文件
      if (!filePath.toLowerCase().endsWith(".ts")) {
        return {
          isValid: false,
          outputPath: "",
          error: "不是有效的.ts翻译文件",
        };
      }

      // 检查文件内容是否为空
      const stats = await fs.promises.stat(filePath);
      if (stats.size === 0) {
        return {
          isValid: false,
          outputPath: "",
          error: "文件为空",
        };
      }

      const outputPath = filePath.replace(/\.ts$/i, ".qm");

      return {
        isValid: true,
        outputPath,
      };
    } catch (error) {
      return {
        isValid: false,
        outputPath: "",
        error: error instanceof Error ? error.message : "文件访问失败",
      };
    }
  }

  /**
   * 编译单个TS文件
   */
  private async compileSingleFile(
    filePath: string,
    options?: { compress?: boolean; verbose?: boolean }
  ): Promise<CompileResult> {
    const fileName = path.basename(filePath);

    try {
      // 验证输入文件
      const validation = await this.validateTsFile(filePath);
      if (!validation.isValid) {
        throw new Error(validation.error || "文件验证失败");
      }

      // 构建命令
      const command = this.buildLreleaseCommand(filePath, options);

      // 执行编译
      const { stdout, stderr } = await fileUtils.execAsync(command, {
        timeout: this.COMPILE_TIMEOUT,
        encoding: "utf8",
      });

      // 检查编译错误（忽略警告）
      if (stderr) {
        const lowerStderr = stderr.toLowerCase();
        if (
          !lowerStderr.includes("warning") &&
          !lowerStderr.includes("generated")
        ) {
          throw new Error(stderr);
        }
      }

      // 检查输出文件是否生成
      const outputFile = validation.outputPath;
      await fs.promises.access(outputFile, fs.constants.R_OK);

      // 获取输出文件大小
      const stats = await fs.promises.stat(outputFile);
      const size = stats.size;

      return {
        sourceFile: fileName,
        outputFile: path.basename(outputFile),
        success: true,
        message: `编译成功: ${fileName} → ${path.basename(outputFile)}`,
        size,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`编译 ${filePath} 失败:`, error);

      return {
        sourceFile: fileName,
        outputFile: "",
        success: false,
        message: `编译失败: ${fileName} - ${errorMessage}`,
      };
    }
  }

  /**
   * 批量编译文件
   */
  private async compileFiles(
    files: vscode.Uri[],
    progress: vscode.Progress<{ increment?: number; message?: string }>,
    token: vscode.CancellationToken,
    options?: { compress?: boolean; verbose?: boolean }
  ): Promise<CompileResult[]> {
    const results: CompileResult[] = [];
    const total = files.length;

    for (let i = 0; i < files.length; i += this.BATCH_SIZE) {
      if (token.isCancellationRequested) break;

      const batch = files.slice(i, Math.min(i + this.BATCH_SIZE, files.length));
      const batchPromises = batch.map((file) =>
        this.compileSingleFile(file.fsPath, options)
      );

      // 更新进度
      const currentProgress = (i / total) * 100;
      progress.report({
        increment: currentProgress - (results.length / total) * 100,
        message: `编译批次 ${Math.floor(i / this.BATCH_SIZE) + 1} (${
          i + 1
        }-${Math.min(i + this.BATCH_SIZE, files.length)}/${total})`,
      });

      try {
        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === "fulfilled") {
            results.push(result.value);
          } else {
            results.push({
              sourceFile: "unknown",
              outputFile: "",
              success: false,
              message: `批处理失败: ${result.reason}`,
            });
          }
        }
      } catch (error) {
        console.error("批处理错误:", error);
        // 继续处理下一批
      }
    }

    return results;
  }

  /**
   * 执行编译操作
   */
  async compile(
    files: vscode.Uri[],
    progress: vscode.Progress<{ increment?: number; message?: string }>,
    token: vscode.CancellationToken,
    options?: { compress?: boolean; verbose?: boolean }
  ): Promise<{ successful: number; failed: number; results: CompileResult[] }> {
    const results = await this.compileFiles(files, progress, token, options);

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return { successful, failed, results };
  }
}

/**
 * 显示编译结果详情
 */
function showCompileResults(results: CompileResult[]): void {
  const successResults = results.filter((r) => r.success);
  const failedResults = results.filter((r) => !r.success);

  let content = "# QM文件编译结果\n\n";

  if (successResults.length > 0) {
    content += "## ✅ 编译成功\n\n";

    // 计算总大小
    const totalSize = successResults.reduce((sum, r) => sum + (r.size || 0), 0);
    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    content += `**总计:** ${successResults.length} 个文件，${formatSize(
      totalSize
    )}\n\n`;

    successResults.forEach((r) => {
      const sizeInfo = r.size ? ` (${formatSize(r.size)})` : "";
      content += `- ✓ ${r.sourceFile} → ${r.outputFile}${sizeInfo}\n`;
    });
    content += "\n";
  }

  if (failedResults.length > 0) {
    content += "## ❌ 编译失败\n\n";
    failedResults.forEach((r) => {
      content += `- ✗ ${r.message}\n`;
    });
  }

  // 创建文档显示结果
  vscode.workspace
    .openTextDocument({
      content,
      language: "markdown",
    })
    .then((doc) => {
      vscode.window.showTextDocument(doc);
    });
}

/**
 * 获取用户编译选项
 */
async function getCompileOptions(): Promise<
  | {
      compress: boolean;
      verbose: boolean;
    }
  | undefined
> {
  const options = await vscode.window.showQuickPick(
    [
      {
        label: "$(zap) 标准编译",
        description: "使用默认设置编译",
        compress: false,
        verbose: false,
      },
      {
        label: "$(package) 压缩编译",
        description: "编译时压缩QM文件以减小文件大小",
        compress: true,
        verbose: false,
      },
      {
        label: "$(output) 详细输出",
        description: "显示详细的编译信息",
        compress: false,
        verbose: true,
      },
      {
        label: "$(package) 压缩 + 详细输出",
        description: "压缩编译并显示详细信息",
        compress: true,
        verbose: true,
      },
    ],
    {
      placeHolder: "选择编译选项",
      ignoreFocusOut: true,
    }
  );

  return options
    ? {
        compress: options.compress,
        verbose: options.verbose,
      }
    : undefined;
}

/**
 * 主要的QM文件生成命令
 */
const generateQmCommand = vscode.commands.registerCommand(
  "qt-linguist.generateQm",
  async (uri: vscode.Uri, uris?: vscode.Uri[]) => {
    try {
      // 获取选中的文件
      const selectedFiles = await fileUtils.getSelectedTranslationFiles(
        uri,
        uris
      );

      if (selectedFiles.length === 0) {
        vscode.window.showErrorMessage(
          "请选择 .ts 翻译文件或包含翻译文件的文件夹"
        );
        return;
      }

      // 过滤有效的TS文件
      const { validFiles, invalidFiles } = await fileUtils.filterTsFiles(
        selectedFiles
      );

      if (validFiles.length === 0) {
        vscode.window.showErrorMessage("未找到有效的 .ts 翻译文件");
        return;
      }

      // 显示无效文件警告
      if (invalidFiles.length > 0) {
        vscode.window.showWarningMessage(
          `已跳过 ${invalidFiles.length} 个无效文件: ${invalidFiles
            .slice(0, 3)
            .join(", ")}${invalidFiles.length > 3 ? "..." : ""}`
        );
      }

      // 获取Qt路径
      const qtPaths = await getQtPaths();
      if (!qtPaths?.lrelease) {
        throw new Error("未找到 lrelease 工具，请检查 Qt 安装路径配置");
      }

      // 验证lrelease工具
      try {
        await fs.promises.access(qtPaths.lrelease, fs.constants.X_OK);
      } catch {
        throw new Error(`lrelease 工具不存在或无执行权限: ${qtPaths.lrelease}`);
      }

      // 获取编译选项
      const compileOptions = await getCompileOptions();
      if (!compileOptions) {
        return; // 用户取消了选择
      }

      // 创建编译器实例
      const generator = new QmFileGenerator(qtPaths);

      // 执行编译
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "编译翻译文件",
          cancellable: true,
        },
        async (progress, token) => {
          progress.report({ increment: 0, message: "准备编译..." });

          const { successful, failed, results } = await generator.compile(
            validFiles,
            progress,
            token,
            compileOptions
          );

          progress.report({ increment: 100, message: "完成" });

          // 显示结果
          const wasCancelled = token.isCancellationRequested;
          const message = wasCancelled
            ? `编译已取消: 成功 ${successful} 个，失败 ${failed} 个`
            : `编译完成: 成功 ${successful} 个，失败 ${failed} 个`;

          if (failed > 0) {
            const action = await vscode.window.showWarningMessage(
              message,
              "查看详情",
              "打开输出目录",
              "忽略"
            );

            if (action === "查看详情") {
              showCompileResults(results);
            } else if (
              action === "打开输出目录" &&
              results.some((r) => r.success)
            ) {
              // 打开第一个成功编译文件的目录
              const firstSuccess = results.find((r) => r.success);
              if (firstSuccess) {
                const outputDir = path.dirname(validFiles[0].fsPath);
                vscode.env.openExternal(vscode.Uri.file(outputDir));
              }
            }
          } else if (successful > 0) {
            const action = await vscode.window.showInformationMessage(
              message,
              "打开输出目录"
            );

            if (action === "打开输出目录") {
              const outputDir = path.dirname(validFiles[0].fsPath);
              vscode.env.openExternal(vscode.Uri.file(outputDir));
            }
          } else {
            vscode.window.showWarningMessage("没有文件被成功编译");
          }
        }
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("编译翻译文件失败:", error);
      vscode.window.showErrorMessage(`编译翻译文件失败: ${errorMessage}`);
    }
  }
);

export default generateQmCommand;
