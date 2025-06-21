import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { spawn, ChildProcess } from "child_process";
import * as fileUtils from "../utils/FileUtils";
import { getQtPaths } from "../utils/QtUtils";

interface UpdateResult {
  file: string;
  success: boolean;
  message: string;
  details?: string;
  warnings?: string[];
}

interface QtPaths {
  lupdate: string;
}

interface UpdateTask {
  sourceDir: string;
  tsFile: string;
  displayName: string;
}

class TranslationUpdater {
  private runningProcesses: Map<string, ChildProcess> = new Map();

  constructor(private qtPaths: QtPaths) {}

  /**
   * 安全地引用路径（处理空格和特殊字符）
   */
  private quotePath(filePath: string): string {
    // 只对包含空格或特殊字符的路径加引号
    const needsQuoting = /[\s"'&<>|]/.test(filePath);
    if (!needsQuoting) {
      return filePath;
    }

    const isWindows = os.platform() === "win32";
    if (isWindows) {
      return `"${filePath.replace(/"/g, '\\"')}"`;
    } else {
      return `'${filePath.replace(/'/g, "\\'")}'`;
    }
  }

  /**
   * 构建 lupdate 命令
   */
  private buildLupdateCommand(sourceDir: string, tsFile: string): string {
    const quotedLupdate = this.quotePath(this.qtPaths.lupdate);
    const quotedSourceDir = this.quotePath(sourceDir);
    const quotedTsFile = this.quotePath(tsFile);

    return `${quotedLupdate} ${quotedSourceDir} -ts ${quotedTsFile}`;
  }

  /**
   * 解析 lupdate 输出，区分警告和错误
   */
  private parseLupdateOutput(
    stdout: string,
    stderr: string
  ): {
    warnings: string[];
    errors: string[];
    hasErrors: boolean;
  } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // 处理 stderr
    if (stderr) {
      const lines = stderr.split("\n").filter((line) => line.trim());
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes("warning") || lowerLine.includes("注意")) {
          warnings.push(line.trim());
        } else if (lowerLine.includes("error") || lowerLine.includes("错误")) {
          errors.push(line.trim());
        } else if (line.trim()) {
          // 其他非空行也视为潜在错误
          errors.push(line.trim());
        }
      }
    }

    // 处理 stdout 中的警告信息
    if (stdout) {
      const lines = stdout.split("\n").filter((line) => line.trim());
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes("warning") || lowerLine.includes("注意")) {
          warnings.push(line.trim());
        }
      }
    }

    return {
      warnings,
      errors,
      hasErrors: errors.length > 0,
    };
  }

  /**
   * 执行 lupdate 命令（异步）
   */
  /**
   * 执行 lupdate 命令（异步）- 修复内存泄漏版本
   */
  private async executeLupdate(
    command: string,
    taskId: string,
    token: vscode.CancellationToken
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const isWindows = os.platform() === "win32";
      const shell = isWindows ? "cmd" : "sh";
      const shellFlag = isWindows ? "/c" : "-c";

      const process = spawn(shell, [shellFlag, command], {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 60000, // 60秒超时
      });

      this.runningProcesses.set(taskId, process);

      let stdout = "";
      let stderr = "";
      let cancelListener: vscode.Disposable | undefined;
      let isResolved = false;

      // 统一的清理函数
      const cleanup = () => {
        // 清理进程记录
        this.runningProcesses.delete(taskId);

        // 清理取消监听器
        if (cancelListener) {
          cancelListener.dispose();
          cancelListener = undefined;
        }

        // 确保进程被终止
        if (process && !process.killed) {
          try {
            process.kill("SIGTERM");
          } catch (error) {
            // 忽略kill失败的错误，进程可能已经结束
            console.warn(`Failed to kill process ${taskId}:`, error);
          }
        }
      };

      // 统一的resolve函数，防止多次调用
      const safeResolve = (result: { stdout: string; stderr: string }) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve(result);
        }
      };

      // 统一的reject函数，防止多次调用
      const safeReject = (error: Error) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          reject(error);
        }
      };

      // 处理stdout数据
      process.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      // 处理stderr数据
      process.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      // 处理进程正常结束
      process.on("close", (code) => {
        if (code === 0) {
          safeResolve({ stdout, stderr });
        } else {
          safeReject(
            new Error(`lupdate 进程异常退出，退出码: ${code}\n${stderr}`)
          );
        }
      });

      // 处理进程错误
      process.on("error", (error) => {
        safeReject(new Error(`执行 lupdate 失败: ${error.message}`));
      });

      // 处理超时
      process.on("timeout", () => {
        safeReject(new Error(`lupdate 执行超时 (60秒)`));
      });

      // 处理取消请求
      cancelListener = token.onCancellationRequested(() => {
        safeReject(new Error("操作已被用户取消"));
      });

      // 处理进程意外退出
      process.on("exit", (code, signal) => {
        if (signal === "SIGTERM" || signal === "SIGKILL") {
          // 这是我们主动终止的，通过其他事件处理
          return;
        }

        if (!isResolved) {
          if (code === 0) {
            safeResolve({ stdout, stderr });
          } else {
            safeReject(
              new Error(
                `lupdate 进程意外退出，退出码: ${code}, 信号: ${signal}\n${stderr}`
              )
            );
          }
        }
      });
    });
  }
  /**
   * 准备更新任务
   */
  private async prepareUpdateTasks(files: vscode.Uri[]): Promise<UpdateTask[]> {
    const tasks: UpdateTask[] = [];

    for (const file of files) {
      try {
        const stats = await fs.promises.stat(file.fsPath);

        if (
          stats.isFile() &&
          file.fsPath.endsWith(".ts") &&
          !file.fsPath.endsWith(".d.ts")
        ) {
          // 直接选中的是 .ts 文件
          if (await this.isQtTranslationFile(file.fsPath)) {
            const sourceDir = path.dirname(file.fsPath);
            tasks.push({
              sourceDir,
              tsFile: file.fsPath,
              displayName: path.basename(file.fsPath),
            });
          }
        } else if (stats.isDirectory()) {
          // 选中的是目录，查找其中的 .ts 文件
          const tsFiles = await this.findTsFilesInDirectory(file.fsPath);
          for (const tsFile of tsFiles) {
            tasks.push({
              sourceDir: file.fsPath,
              tsFile,
              displayName: path.basename(tsFile),
            });
          }
        } else if (stats.isFile()) {
          // 选中的是源代码文件，在其目录中查找 .ts 文件
          const sourceDir = path.dirname(file.fsPath);
          const tsFiles = await this.findTsFilesInDirectory(sourceDir);
          for (const tsFile of tsFiles) {
            tasks.push({
              sourceDir,
              tsFile,
              displayName: `${path.basename(tsFile)} (from ${path.basename(
                file.fsPath
              )})`,
            });
          }
        }
      } catch (error) {
        console.warn(`准备任务时跳过文件 ${file.fsPath}:`, error);
      }
    }

    // 去除重复的任务（相同的 tsFile）
    const uniqueTasks = tasks.filter(
      (task, index, arr) =>
        arr.findIndex((t) => t.tsFile === task.tsFile) === index
    );

    return uniqueTasks;
  }

  /**
   * 在指定目录中查找 .ts 翻译文件
   */
  private async findTsFilesInDirectory(directory: string): Promise<string[]> {
    const tsFiles: string[] = [];

    try {
      const files = await fs.promises.readdir(directory);
      for (const file of files) {
        if (file.endsWith(".ts") && !file.endsWith(".d.ts")) {
          const fullPath = path.join(directory, file);
          // 验证是否为 Qt 翻译文件
          if (await this.isQtTranslationFile(fullPath)) {
            tsFiles.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`查找翻译文件失败 ${directory}:`, error);
    }

    return tsFiles;
  }

  /**
   * 简单验证是否为 Qt 翻译文件
   */
  private async isQtTranslationFile(filePath: string): Promise<boolean> {
    try {
      const content = await fs.promises.readFile(filePath, "utf8");
      // 检查文件头部是否包含 Qt 翻译文件的特征
      return (
        content.includes("<?xml") &&
        (content.includes("<TS") || content.includes("<!DOCTYPE TS>"))
      );
    } catch {
      return false;
    }
  }

  /**
   * 更新单个任务
   */
  private async updateSingleTask(
    task: UpdateTask,
    token: vscode.CancellationToken
  ): Promise<UpdateResult> {
    const taskId = `${task.tsFile}-${Date.now()}`;

    try {
      const command = this.buildLupdateCommand(task.sourceDir, task.tsFile);
      console.log(`执行命令: ${command}`);

      const { stdout, stderr } = await this.executeLupdate(
        command,
        taskId,
        token
      );

      const { warnings, errors, hasErrors } = this.parseLupdateOutput(
        stdout,
        stderr
      );

      if (hasErrors) {
        return {
          file: task.displayName,
          success: false,
          message: `更新失败: ${task.displayName}`,
          details: errors.join("\n"),
          warnings,
        };
      }

      return {
        file: task.displayName,
        success: true,
        message: `更新成功: ${task.displayName}`,
        details: stdout.trim() || "更新完成",
        warnings,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`更新任务失败 ${task.tsFile}:`, error);

      return {
        file: task.displayName,
        success: false,
        message: `更新失败: ${task.displayName}`,
        details: errorMessage,
      };
    }
  }

  /**
   * 执行更新操作
   */
  async update(
    files: vscode.Uri[],
    progress: vscode.Progress<{ increment?: number; message?: string }>,
    token: vscode.CancellationToken
  ): Promise<{ successful: number; failed: number; results: UpdateResult[] }> {
    const results: UpdateResult[] = [];

    try {
      // 准备更新任务
      progress.report({ message: "分析文件和准备任务..." });
      const tasks = await this.prepareUpdateTasks(files);

      if (tasks.length === 0) {
        throw new Error("没有找到有效的翻译更新任务");
      }

      console.log(`准备了 ${tasks.length} 个更新任务`);

      // 串行执行任务以避免资源冲突
      for (let i = 0; i < tasks.length; i++) {
        if (token.isCancellationRequested) {
          break;
        }

        const task = tasks[i];
        const progressPercent = (i / tasks.length) * 100;

        progress.report({
          increment:
            i === 0
              ? progressPercent
              : progressPercent - ((i - 1) / tasks.length) * 100,
          message: `更新 ${task.displayName} (${i + 1}/${tasks.length})`,
        });

        const result = await this.updateSingleTask(task, token);
        results.push(result);

        // 记录进度
        console.log(
          `任务 ${i + 1}/${tasks.length} 完成: ${
            result.success ? "成功" : "失败"
          }`
        );
      }
    } catch (error) {
      console.error("更新过程中发生错误:", error);
      results.push({
        file: "unknown",
        success: false,
        message: "更新过程异常",
        details: error instanceof Error ? error.message : String(error),
      });
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return { successful, failed, results };
  }

  /**
   * 清理运行中的进程
   */
  // cleanup(): void {
  //     for (const [taskId, process] of this.runningProcesses) {
  //         if (!process.killed) {
  //             console.log(`清理进程: ${taskId}`);
  //             process.kill('SIGTERM');
  //         }
  //     }
  //     this.runningProcesses.clear();
  // }

  /**
   * 清理运行中的进程 - 增强版本
   */
  cleanup(): void {
    console.log(`开始清理 ${this.runningProcesses.size} 个运行中的进程`);

    const cleanupPromises: Promise<void>[] = [];

    for (const [taskId, process] of this.runningProcesses) {
      if (!process.killed) {
        console.log(`清理进程: ${taskId}`);

        // 创建清理Promise
        const cleanupPromise = new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            // 如果进程在3秒内没有正常结束，强制kill
            if (!process.killed) {
              console.warn(`强制终止进程: ${taskId}`);
              try {
                process.kill("SIGKILL");
              } catch (error) {
                console.error(`强制终止进程失败 ${taskId}:`, error);
              }
            }
            resolve();
          }, 3000);

          // 监听进程结束
          const onExit = () => {
            clearTimeout(timeout);
            resolve();
          };

          process.once("exit", onExit);
          process.once("close", onExit);

          // 尝试优雅地终止进程
          try {
            process.kill("SIGTERM");
          } catch (error) {
            console.error(`终止进程失败 ${taskId}:`, error);
            clearTimeout(timeout);
            resolve();
          }
        });

        cleanupPromises.push(cleanupPromise);
      }
    }

    // 清空进程映射表
    this.runningProcesses.clear();

    // 等待所有进程清理完成（可选，如果需要同步清理）
    if (cleanupPromises.length > 0) {
      Promise.all(cleanupPromises)
        .then(() => {
          console.log("所有进程清理完成");
        })
        .catch((error) => {
          console.error("进程清理过程中发生错误:", error);
        });
    }
  }

  /**
   * 析构方法 - 确保资源清理
   */
  dispose(): void {
    this.cleanup();
  }

  /**
   * 获取当前运行的进程数量（用于调试）
   */
  getRunningProcessCount(): number {
    return this.runningProcesses.size;
  }
}

/**
 * 显示更新结果
 */
function showUpdateResults(results: UpdateResult[]): void {
  const successResults = results.filter((r) => r.success);
  const failedResults = results.filter((r) => !r.success);
  const warningResults = results.filter(
    (r) => r.warnings && r.warnings.length > 0
  );

  let content = "# 翻译文件更新结果\n\n";

  // 成功的文件
  if (successResults.length > 0) {
    content += `## ✅ 成功更新 (${successResults.length}个)\n\n`;
    for (const result of successResults) {
      content += `### ${result.file}\n`;
      if (result.details) {
        content += `\`\`\`\n${result.details}\n\`\`\`\n`;
      }
      if (result.warnings && result.warnings.length > 0) {
        content += `**警告:**\n`;
        for (const warning of result.warnings) {
          content += `- ${warning}\n`;
        }
      }
      content += "\n";
    }
  }

  // 失败的文件
  if (failedResults.length > 0) {
    content += `## ❌ 更新失败 (${failedResults.length}个)\n\n`;
    for (const result of failedResults) {
      content += `### ${result.file}\n`;
      content += `**错误:** ${result.message}\n`;
      if (result.details) {
        content += `\`\`\`\n${result.details}\n\`\`\`\n`;
      }
      content += "\n";
    }
  }

  // 警告汇总
  if (warningResults.length > 0) {
    content += `## ⚠️ 警告汇总\n\n`;
    const allWarnings = warningResults.flatMap((r) => r.warnings || []);
    const uniqueWarnings = [...new Set(allWarnings)];
    for (const warning of uniqueWarnings) {
      content += `- ${warning}\n`;
    }
    content += "\n";
  }

  // 创建结果文档
  vscode.workspace
    .openTextDocument({
      content,
      language: "markdown",
    })
    .then((doc) => {
      vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
    });
}

/**
 * 主要的更新翻译命令
 */
const updateTranslationCommand = vscode.commands.registerCommand(
  "qt-linguist.updateTranslation",
  async (uri: vscode.Uri, uris?: vscode.Uri[]) => {
    let updater: TranslationUpdater | null = null;

    try {
      // 获取选中的文件
      const selectedFiles = await fileUtils.getSelectedTranslationFiles(
        uri,
        uris
      );

      if (selectedFiles.length === 0) {
        vscode.window.showErrorMessage("请选择包含源代码的文件或文件夹");
        return;
      }

      // 验证文件有效性
      const validFiles = await fileUtils.validateFiles(selectedFiles);
      if (validFiles.length === 0) {
        vscode.window.showErrorMessage("所选文件均无效或无法访问");
        return;
      }

      if (validFiles.length < selectedFiles.length) {
        const invalidCount = selectedFiles.length - validFiles.length;
        vscode.window.showWarningMessage(`已跳过 ${invalidCount} 个无效文件`);
      }

      // 获取Qt路径
      const qtPaths = await getQtPaths();
      if (!qtPaths?.lupdate) {
        vscode.window.showErrorMessage(
          "未找到 lupdate 工具，请检查 Qt 安装路径配置"
        );
        return;
      }

      // 验证lupdate工具
      try {
        await fs.promises.access(qtPaths.lupdate, fs.constants.F_OK);
      } catch {
        vscode.window.showErrorMessage(
          `lupdate 工具不存在: ${qtPaths.lupdate}`
        );
        return;
      }

      // 创建更新器实例
      updater = new TranslationUpdater(qtPaths);

      // 执行更新操作
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "更新翻译文件",
          cancellable: true,
        },
        async (progress, token) => {
          try {
            progress.report({ increment: 0, message: "初始化..." });

            const { successful, failed, results } = await updater!.update(
              validFiles,
              progress,
              token
            );

            if (token.isCancellationRequested) {
              vscode.window.showWarningMessage(
                `更新已取消 - 已处理: 成功 ${successful} 个，失败 ${failed} 个`
              );
              return;
            }

            progress.report({ increment: 100, message: "完成" });

            // 显示结果
            const totalWarnings = results.reduce(
              (sum, r) => sum + (r.warnings?.length || 0),
              0
            );
            const baseMessage = `更新完成: 成功 ${successful} 个，失败 ${failed} 个`;
            const warningMessage =
              totalWarnings > 0 ? `，警告 ${totalWarnings} 个` : "";
            const message = baseMessage + warningMessage;

            if (failed > 0 || totalWarnings > 0) {
              const action = await vscode.window.showWarningMessage(
                message,
                "查看详情",
                "关闭"
              );

              if (action === "查看详情") {
                showUpdateResults(results);
              }
            } else if (successful > 0) {
              vscode.window.showInformationMessage(message);
            } else {
              vscode.window.showWarningMessage("没有文件被更新");
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            console.error("更新过程中发生错误:", error);
            vscode.window.showErrorMessage(`更新失败: ${errorMessage}`);
          }
        }
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("更新翻译文件失败:", error);
      vscode.window.showErrorMessage(`更新翻译文件失败: ${errorMessage}`);
    } finally {
      // 清理资源
      if (updater) {
        updater.cleanup();
      }
    }
  }
);

export default updateTranslationCommand;
