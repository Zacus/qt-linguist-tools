import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as fileUtils from "../utils/FileUtils";
import { getQtPaths } from "../utils/QtUtils";

/**
 * 信号量类 - 控制并发数量
 */
/**
 * 修复后的信号量类 - 解决竞态条件问题
 */
class Semaphore {
  private permits: number;
  private readonly initialPermits: number;
  private tasks: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
    this.initialPermits = permits;
  }

  async acquire<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeTask = async () => {
        try {
          const result = await task();
          this.release();
          resolve(result);
        } catch (error) {
          this.release();
          reject(error);
        }
      };

      // 使用同步检查和递减，避免竞态条件
      if (this.permits > 0) {
        this.permits--;
        // 使用 setImmediate 避免潜在的堆栈溢出
        setImmediate(executeTask);
      } else {
        // 直接推入执行函数，而不是包装函数
        this.tasks.push(() => {
          this.permits--;
          setImmediate(executeTask);
        });
      }
    });
  }

  private release(): void {
    this.permits++;
    if (this.tasks.length > 0) {
      const nextTask = this.tasks.shift();
      if (nextTask) {
        nextTask(); // 这个会在执行时减少 permits
      }
    }
  }
  /**
   * 清理资源，用于取消操作时
   */
  public clear(): void {
    this.tasks = [];
    this.permits = this.initialPermits;
  }

  /**
   * 获取当前状态信息
   */
  public getStatus(): { permits: number; queueLength: number } {
    return {
      permits: this.permits,
      queueLength: this.tasks.length,
    };
  }
}

// 更新策略枚举
enum UpdateStrategy {
  BY_DIRECTORY = "byDirectory",
  INDIVIDUAL = "individual",
  FROM_PRO = "fromPro",
}

// 更新结果接口
interface UpdateResult {
  success: boolean;
  file: string;
  message: string;
  error?: string;
  duration?: number; // 处理耗时（毫秒）
}

// 增强的更新结果接口
interface EnhancedUpdateResult extends UpdateResult {
  // 基础信息保持不变
  success: boolean;
  file: string;
  message: string;
  error?: string;
  duration?: number;

  // 新增：目录详细信息
  directoryInfo?: {
    fullPath: string; // 完整目录路径
    totalFiles: number; // 目录中的文件总数
    processedFiles: string[]; // 成功处理的文件列表
    failedFiles: string[]; // 失败的文件列表（如果有的话）
    skippedFiles: string[]; // 跳过的文件列表
  };

  // 新增：统计信息
  stats?: {
    sourceStrings?: number; // 源字符串数量
    translatedStrings?: number; // 已翻译数量
    newStrings?: number; // 新增数量
    modifiedStrings?: number; // 修改数量
    warnings?: string[]; // 警告信息
  };
}

// 并发配置接口
interface ConcurrencyConfig {
  maxConcurrent: number;
  batchSize: number;
  delayBetweenBatches: number;
}

// 任务项接口
interface TaskItem<T> {
  data: T;
  index: number;
  name: string;
}

// 策略选项配置
const STRATEGY_OPTIONS = [
  {
    label: "$(file-directory) 按目录分组更新",
    description: "每个目录执行一次 lupdate，包含该目录下的所有 .ts 文件",
    value: UpdateStrategy.BY_DIRECTORY,
  },
  {
    label: "$(file) 逐个文件更新",
    description: "为每个 .ts 文件单独执行 lupdate",
    value: UpdateStrategy.INDIVIDUAL,
  },
  {
    label: "$(project) 从 .pro 文件更新",
    description: "查找 .pro 文件并使用它们来更新翻译文件",
    value: UpdateStrategy.FROM_PRO,
  },
] as const;

// 批量更新器类
// 修复后的批量更新器类中的关键方法
class TranslationUpdater {
  private concurrencyConfig: ConcurrencyConfig;
  private processedCount = 0;
  private totalCount = 0;
  private lastProgressValue = 0; // 追踪上次进度值

  constructor(
    private qtPaths: { lupdate: string },
    private progress: vscode.Progress<{ increment?: number; message?: string }>,
    private token: vscode.CancellationToken,
    concurrencyConfig?: Partial<ConcurrencyConfig>
  ) {
    // 更保守的默认并发配置
    const cpuCount = os.cpus().length;
    this.concurrencyConfig = {
      maxConcurrent: Math.max(1, Math.min(cpuCount * 0.5, 4)), // 更保守的并发数
      batchSize: Math.max(3, cpuCount), // 减小批次大小
      delayBetweenBatches: 200, // 增加批次间延迟
      ...concurrencyConfig,
    };
  }

  /**
   * 执行批量更新
   */
  async execute(
    strategy: UpdateStrategy,
    tsFiles: vscode.Uri[]
  ): Promise<UpdateResult[]> {
    switch (strategy) {
      case UpdateStrategy.FROM_PRO:
        return this.updateFromProFiles();
      case UpdateStrategy.BY_DIRECTORY:
        return this.updateByDirectory(tsFiles);
      case UpdateStrategy.INDIVIDUAL:
        return this.updateIndividualFiles(tsFiles);
      default:
        throw new Error(`未知的更新策略: ${strategy}`);
    }
  }

  /**
   * 增强的错误处理包装器
   */
  private async safeExecute<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`${context} 执行失败:`, error);
      throw new Error(`${context}: ${errorMessage}`);
    }
  }

  /**
   * 修复后的并发任务执行器 - 改进取消处理
   */
  private async executeConcurrentTasks<T>(
    tasks: TaskItem<T>[],
    processor: (task: TaskItem<T>) => Promise<UpdateResult>
  ): Promise<UpdateResult[]> {
    const results: UpdateResult[] = [];
    this.totalCount = tasks.length;
    this.processedCount = 0;
    this.lastProgressValue = 0;

    try {
      // 分批处理，每批内部并发执行
      for (let i = 0; i < tasks.length; i += this.concurrencyConfig.batchSize) {
        if (this.token.isCancellationRequested) {
          // 为剩余任务添加取消结果
          const remainingTasks = tasks.slice(i);
          const cancelledResults = remainingTasks.map(
            (task) =>
              ({
                success: false,
                file: task.name,
                message: "任务已取消",
              } as UpdateResult)
          );
          results.push(...cancelledResults);
          break;
        }

        const batch = tasks.slice(i, i + this.concurrencyConfig.batchSize);
        const batchResults = await this.processBatch(batch, processor);
        results.push(...batchResults);

        // 批次间短暂延迟，避免系统过载
        if (
          i + this.concurrencyConfig.batchSize < tasks.length &&
          !this.token.isCancellationRequested
        ) {
          await this.delay(this.concurrencyConfig.delayBetweenBatches);
        }
      }
    } catch (error) {
      // 处理整体执行错误
      console.error("并发任务执行出错:", error);
      throw error;
    }

    return results;
  }

  /**
   * 处理单个批次 - 内部使用信号量控制并发
   */
  /**
   * 修复后的批次处理 - 改进错误处理和资源清理
   */
  private async processBatch<T>(
    batch: TaskItem<T>[],
    processor: (task: TaskItem<T>) => Promise<UpdateResult>
  ): Promise<UpdateResult[]> {
    const semaphore = new Semaphore(this.concurrencyConfig.maxConcurrent);

    try {
      const promises = batch.map(async (task) => {
        return semaphore.acquire(async () => {
          // 检查取消状态
          if (this.token.isCancellationRequested) {
            return {
              success: false,
              file: task.name,
              message: "任务已取消",
            } as UpdateResult;
          }

          const startTime = Date.now();
          try {
            const result = await processor(task);
            result.duration = Date.now() - startTime;

            this.processedCount++;
            this.updateProgress();

            return result;
          } catch (error) {
            this.processedCount++;
            this.updateProgress();

            return {
              success: false,
              file: task.name,
              message: "处理失败",
              error: error instanceof Error ? error.message : String(error),
              duration: Date.now() - startTime,
            } as UpdateResult;
          }
        });
      });

      return await Promise.all(promises);
    } finally {
      // 确保资源被清理
      semaphore.clear();
    }
  }

  /**
   * 修复后的进度更新 - 使用增量而非总量
   */
  private updateProgress(): void {
    const currentPercentage = (this.processedCount / this.totalCount) * 100;
    const increment = currentPercentage - this.lastProgressValue;

    if (increment > 0) {
      this.progress.report({
        increment,
        message: `处理中... (${this.processedCount}/${this.totalCount}) [并发: ${this.concurrencyConfig.maxConcurrent}]`,
      });
      this.lastProgressValue = currentPercentage;
    }
  }

  /**
   * 延迟工具函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 从 .pro 文件更新 - 并发版本
   */
  private async updateFromProFiles(): Promise<UpdateResult[]> {
    const proFiles = await fileUtils.findProFiles();

    if (proFiles.length === 0) {
      throw new Error("未找到 .pro 文件，请选择其他更新策略");
    }

    const tasks: TaskItem<vscode.Uri>[] = proFiles.map((file, index) => ({
      data: file,
      index,
      name: path.basename(file.fsPath),
    }));

    return this.executeConcurrentTasks(tasks, (task) =>
      this.updateProFile(task.data)
    );
  }

  /**
   * 按目录分组更新 - 并发版本
   */
  private async updateByDirectory(
    tsFiles: vscode.Uri[]
  ): Promise<UpdateResult[]> {
    const dirGroups = this.groupFilesByDirectory(tsFiles);
    const tasks: TaskItem<[string, vscode.Uri[]]>[] = Array.from(
      dirGroups.entries()
    ).map(([dir, files], index) => ({
      data: [dir, files],
      index,
      name: path.basename(dir),
    }));

    return this.executeConcurrentTasks(tasks, (task) =>
      this.updateDirectoryEnhanced(task.data[0], task.data[1])
    );
  }

  /**
   * 逐个文件更新 - 并发版本
   */
  private async updateIndividualFiles(
    tsFiles: vscode.Uri[]
  ): Promise<UpdateResult[]> {
    const tasks: TaskItem<vscode.Uri>[] = tsFiles.map((file, index) => ({
      data: file,
      index,
      name: path.basename(file.fsPath),
    }));

    return this.executeConcurrentTasks(tasks, (task) =>
      this.updateSingleFile(task.data)
    );
  }

  /**
   * 通用文件处理器 - 保留用于兼容性，但推荐使用并发版本
   * @deprecated 使用 executeConcurrentTasks 代替
   */
  private async processFiles<T>(
    items: T[],
    processor: (item: T, index: number, total: number) => Promise<UpdateResult>
  ): Promise<UpdateResult[]> {
    console.warn(
      "processFiles is deprecated, use executeConcurrentTasks instead"
    );
    const results: UpdateResult[] = [];
    const total = items.length;

    for (let i = 0; i < items.length; i++) {
      if (this.token.isCancellationRequested) {
        break;
      }

      try {
        const result = await processor(items[i], i, total);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          file: this.getItemName(items[i]),
          message: "处理失败",
          error: String(error),
        });
      }
    }

    return results;
  }

  /**
   * 改进的单文件更新 - 增加错误处理
   */
  private async updateSingleFile(tsFile: vscode.Uri): Promise<UpdateResult> {
    const fileName = path.basename(tsFile.fsPath);
    let message = "";
    return this.safeExecute(async () => {
      const sourceDir = path.dirname(tsFile.fsPath);
      const command = this.buildCommand([sourceDir, "-ts", tsFile.fsPath]);
      message += command + "\n";
      const { stdout, stderr } = await fileUtils.execAsync(command);
      // 检查是否有警告或错误信息
      if (stderr && stderr.trim()) {
        console.warn(`lupdate 警告 (${fileName}):`, stderr);
      }

      return {
        success: true,
        file: fileName,
        message: this.extractLastLine(stdout) || "更新完成",
      };
    }, `更新翻译文件 ${fileName}`);

    this.showtestResults(message);
  }

  /**
     * 改进的目录更新 - 增加错误处理
    //  */
  private async updateDirectory(
    dir: string,
    files: vscode.Uri[]
  ): Promise<UpdateResult> {
    const dirName = path.basename(dir);

    return this.safeExecute(async () => {
      const tsFilePaths = files.map((f) => f.fsPath);
      const command = this.buildCommand([dir, "-ts", ...tsFilePaths]);

      const { stdout, stderr } = await fileUtils.execAsync(command);

      // 检查是否有警告或错误信息
      if (stderr && stderr.trim()) {
        console.warn(`lupdate 警告 (${dirName}):`, stderr);
      }

      return {
        success: true,
        file: dirName,
        message:
          this.extractLastLine(stdout) || `更新完成 (${files.length}个文件)`,
      };
    }, `更新目录 ${dirName}`);
  }

  private async updateDirectoryEnhanced(
    dir: string,
    files: vscode.Uri[]
  ): Promise<EnhancedUpdateResult> {
    const dirName = path.basename(dir);
    const startTime = Date.now();

    return this.safeExecute(async () => {
      const tsFilePaths = files.map((f) => f.fsPath);
      const command = this.buildCommand([dir, "-ts", ...tsFilePaths]);

      const { stdout, stderr } = await fileUtils.execAsync(command);
      const duration = Date.now() - startTime;

      // 解析输出获取详细信息
      const parseResult = LupdateOutputParser.parseDirectoryOutput(
        stdout,
        stderr,
        files
      );

      // 构建详细的成功消息
      const message = this.buildDirectorySuccessMessage(
        parseResult.processedFiles.length,
        parseResult.failedFiles.length,
        parseResult.skippedFiles.length,
        parseResult.stats
      );

      // 检查是否有警告或错误
      if (stderr && stderr.trim()) {
        console.warn(`lupdate 警告 (${dirName}):`, stderr);
      }

      const result: EnhancedUpdateResult = {
        success: true,
        file: dirName,
        message,
        duration,
        directoryInfo: {
          fullPath: dir,
          totalFiles: files.length,
          processedFiles: parseResult.processedFiles,
          failedFiles: parseResult.failedFiles,
          skippedFiles: parseResult.skippedFiles,
        },
        stats: parseResult.stats,
      };

      return result;
    }, `更新目录 ${dirName}`);
  }

  /**
   * 构建目录成功消息
   */
  private buildDirectorySuccessMessage(
    successCount: number,
    failedCount: number,
    skippedCount: number,
    stats?: EnhancedUpdateResult["stats"]
  ): string {
    const parts: string[] = [];

    // 基础文件处理信息
    if (successCount > 0) {
      parts.push(`成功 ${successCount} 个文件`);
    }
    if (failedCount > 0) {
      parts.push(`失败 ${failedCount} 个文件`);
    }
    if (skippedCount > 0) {
      parts.push(`跳过 ${skippedCount} 个文件`);
    }

    // 添加统计信息
    if (stats) {
      const statParts: string[] = [];
      if (stats.sourceStrings) {
        statParts.push(`源字符串 ${stats.sourceStrings}`);
      }
      if (stats.newStrings) {
        statParts.push(`新增 ${stats.newStrings}`);
      }
      if (stats.modifiedStrings) {
        statParts.push(`修改 ${stats.modifiedStrings}`);
      }
      if (stats.warnings && stats.warnings.length > 0) {
        statParts.push(`警告 ${stats.warnings.length}`);
      }

      if (statParts.length > 0) {
        parts.push(`[${statParts.join(", ")}]`);
      }
    }

    return parts.join(", ") || "处理完成";
  }

  /**
   * 改进的 Pro 文件更新 - 增加错误处理
   */
  private async updateProFile(proFile: vscode.Uri): Promise<UpdateResult> {
    const fileName = path.basename(proFile.fsPath);

    return this.safeExecute(async () => {
      const command = this.buildCommand([proFile.fsPath]);
      const { stdout, stderr } = await fileUtils.execAsync(command);

      // 检查是否有警告或错误信息
      if (stderr && stderr.trim()) {
        console.warn(`lupdate 警告 (${fileName}):`, stderr);
      }

      return {
        success: true,
        file: fileName,
        message: this.extractLastLine(stdout) || "更新完成",
      };
    }, `更新 Pro 文件 ${fileName}`);
  }

  /**
   * 改进的命令构建 - 更好的跨平台支持
   */
  private buildCommand(args: string[]): string {
    const isWindows = os.platform() === "win32";

    // 更安全的参数引用处理
    const escapeArg = (arg: string): string => {
      if (isWindows) {
        // Windows: 处理包含空格和特殊字符的路径
        if (arg.includes(" ") || arg.includes("&") || arg.includes("|")) {
          return `"${arg.replace(/"/g, '""')}"`;
        }
        return arg;
      } else {
        // Unix: 处理包含空格和特殊字符的路径
        if (
          arg.includes(" ") ||
          arg.includes("$") ||
          arg.includes("`") ||
          arg.includes("\\")
        ) {
          return `'${arg.replace(/'/g, "'\"'\"'")}'`;
        }
        return arg;
      }
    };

    const quotedArgs = args.map(escapeArg);
    const quotedLupdate = escapeArg(this.qtPaths.lupdate);

    return `${quotedLupdate} ${quotedArgs.join(" ")}`;
  }

  async showtestResults(outputContent: string): Promise<void> {
    // 创建并显示输出文档
    const doc = await vscode.workspace.openTextDocument({
      content: outputContent,
      language: "plaintext",
    });

    await vscode.window.showTextDocument(doc);
  }

  // // 修复版本2 - 更简洁但可靠的版本
  private groupFilesByDirectory(
    tsFiles: vscode.Uri[]
  ): Map<string, vscode.Uri[]> {
    const dirGroups = new Map<string, vscode.Uri[]>();

    for (const file of tsFiles) {
      // 使用绝对路径确保一致性
      const normalizedDir = fileUtils.getAbsoluteDir(file.fsPath);

      if (!dirGroups.has(normalizedDir)) {
        dirGroups.set(normalizedDir, []);
      }

      dirGroups.get(normalizedDir)!.push(file);
    }

    return dirGroups;
  }

  /**
   * 报告进度 - 保留用于兼容性
   * @deprecated 使用 updateProgress 代替
   */
  private reportProgress(
    current: number,
    total: number,
    message: string
  ): void {
    this.progress.report({
      increment: (current / total) * 100,
      message: `${message} (${current + 1}/${total})`,
    });
  }

  /**
   * 提取输出的最后一行
   */
  private extractLastLine(output: string): string | null {
    if (!output) return null;

    const lines = output.split("\n").filter((line) => line.trim());
    return lines.length > 0 ? lines[lines.length - 1] : null;
  }

  /**
   * 改进的类型安全的项目名称获取
   */
  private getItemName(
    item: vscode.Uri | [string, vscode.Uri[]] | unknown
  ): string {
    if (item instanceof vscode.Uri) {
      return path.basename(item.fsPath);
    }
    if (
      Array.isArray(item) &&
      item.length === 2 &&
      typeof item[0] === "string"
    ) {
      return path.basename(item[0]);
    }
    // 最后的回退
    return typeof item === "object" && item !== null && "toString" in item
      ? String(item)
      : "Unknown";
  }
}

// 输出解析器 - 解析 lupdate 输出获取详细信息
class LupdateOutputParser {
  /**
   * 解析 lupdate 输出，提取文件处理信息和统计数据
   */
  static parseDirectoryOutput(
    stdout: string,
    stderr: string,
    inputFiles: vscode.Uri[]
  ): {
    processedFiles: string[];
    failedFiles: string[];
    skippedFiles: string[];
    stats: EnhancedUpdateResult["stats"];
  } {
    const output = stdout + "\n" + stderr;
    const result = {
      processedFiles: [] as string[],
      failedFiles: [] as string[],
      skippedFiles: [] as string[],
      stats: {
        sourceStrings: 0,
        translatedStrings: 0,
        newStrings: 0,
        modifiedStrings: 0,
        warnings: [] as string[],
      },
    };

    // 解析统计信息
    const statPatterns = {
      sourceStrings: /Found (\d+) source text/i,
      translatedStrings: /(\d+) translated/i,
      newStrings: /(\d+) new/i,
      modifiedStrings: /(\d+) modified/i,
    };

    Object.entries(statPatterns).forEach(([key, pattern]) => {
      const match = output.match(pattern);
      if (match && match[1]) {
        (result.stats as any)[key] = parseInt(match[1], 10);
      }
    });

    // 解析警告信息
    const warningLines = output
      .split("\n")
      .filter(
        (line) =>
          line.toLowerCase().includes("warning") ||
          line.toLowerCase().includes("注意") ||
          line.toLowerCase().includes("cannot") ||
          line.toLowerCase().includes("无法")
      );

    result.stats.warnings = warningLines.filter(
      (line) => line.trim().length > 0
    );

    // 解析处理的文件
    // lupdate 通常会输出 "Updating 'filename'" 或 "Scanning filename"
    const updatingPattern = /(?:Updating|Scanning)\s+['"]?([^'"]+)['"]?/gi;
    let match;
    const mentionedFiles = new Set<string>();

    while ((match = updatingPattern.exec(output)) !== null) {
      const filePath = match[1];
      mentionedFiles.add(path.basename(filePath));
    }

    // 根据输入文件列表和输出信息确定处理状态
    inputFiles.forEach((file) => {
      const fileName = path.basename(file.fsPath);
      const relativePath = path.relative(process.cwd(), file.fsPath);

      // 检查是否在输出中被提及
      const wasProcessed =
        mentionedFiles.has(fileName) ||
        output.includes(fileName) ||
        output.includes(relativePath);

      if (wasProcessed) {
        result.processedFiles.push(fileName);
      } else {
        // 如果没有错误信息，可能是被跳过的文件
        if (!stderr.includes(fileName)) {
          result.skippedFiles.push(fileName);
        } else {
          result.failedFiles.push(fileName);
        }
      }
    });

    // 如果没有明确的处理信息，假设所有文件都被处理了（lupdate 的默认行为）
    if (
      result.processedFiles.length === 0 &&
      result.failedFiles.length === 0 &&
      !stderr.trim()
    ) {
      result.processedFiles = inputFiles.map((f) => path.basename(f.fsPath));
    }

    return result;
  }
}

/**
 * 结果统计器
 */
/**
 * 改进的结果分析器 - 增加更多统计信息
 */
class ResultAnalyzer {
  constructor(private results: UpdateResult[]) {}

  get successCount(): number {
    return this.results.filter((r) => r.success).length;
  }

  get failureCount(): number {
    return this.results.filter((r) => !r.success).length;
  }

  get cancelledCount(): number {
    return this.results.filter((r) => !r.success && r.message === "任务已取消")
      .length;
  }

  get hasFailures(): boolean {
    return this.failureCount > 0;
  }

  get averageDuration(): number {
    const durationsResults = this.results.filter(
      (r) => r.success && r.duration
    );
    if (durationsResults.length === 0) return 0;

    return (
      durationsResults.reduce((sum, r) => sum + (r.duration || 0), 0) /
      durationsResults.length
    );
  }

  getSummaryMessage(cancelled: boolean): string {
    const prefix = cancelled ? "批量更新已取消" : "批量更新完成";
    const cancelInfo =
      this.cancelledCount > 0 ? `，取消 ${this.cancelledCount} 个` : "";
    return `${prefix}: 成功 ${this.successCount} 个，失败 ${this.failureCount} 个${cancelInfo}`;
  }

  formatResults(): string {
    const header = `Qt Linguist 批量更新结果\n${"=".repeat(50)}\n\n`;

    // 性能统计
    const avgDuration = this.averageDuration;
    const performanceInfo =
      avgDuration > 0
        ? `平均处理时间: ${avgDuration.toFixed(0)}ms\n总处理数量: ${
            this.results.length
          }\n成功率: ${(
            (this.successCount / this.results.length) *
            100
          ).toFixed(1)}%\n\n`
        : `总处理数量: ${this.results.length}\n成功率: ${(
            (this.successCount / this.results.length) *
            100
          ).toFixed(1)}%\n\n`;

    // 分组显示结果
    const successResults = this.results.filter((r) => r.success);
    const failureResults = this.results.filter((r) => !r.success);

    let resultContent = "";

    if (successResults.length > 0) {
      resultContent += `成功 (${successResults.length}):\n${"-".repeat(20)}\n`;
      successResults.forEach((result) => {
        const durationInfo = result.duration ? ` (${result.duration}ms)` : "";
        resultContent += `✓ ${result.file}: ${result.message}${durationInfo}\n`;
      });
      resultContent += "\n";
    }

    if (failureResults.length > 0) {
      resultContent += `失败 (${failureResults.length}):\n${"-".repeat(20)}\n`;
      failureResults.forEach((result) => {
        const errorInfo = result.error ? ` - ${result.error}` : "";
        const durationInfo = result.duration ? ` (${result.duration}ms)` : "";
        resultContent += `✗ ${result.file}: ${result.message}${errorInfo}${durationInfo}\n`;
      });
    }

    return header + performanceInfo + resultContent;
  }
}

// 增强的结果分析器
class EnhancedResultAnalyzer {
  constructor(private results: EnhancedUpdateResult[]) {}

  get successCount(): number {
    return this.results.filter((r) => r.success).length;
  }

  get failureCount(): number {
    return this.results.filter((r) => !r.success).length;
  }

  get totalProcessedFiles(): number {
    return this.results.reduce((sum, result) => {
      if (result.directoryInfo) {
        return sum + result.directoryInfo.processedFiles.length;
      }
      return sum + (result.success ? 1 : 0);
    }, 0);
  }

  get totalFailedFiles(): number {
    return this.results.reduce((sum, result) => {
      if (result.directoryInfo) {
        return sum + result.directoryInfo.failedFiles.length;
      }
      return sum + (result.success ? 0 : 1);
    }, 0);
  }

  /**
   * 格式化详细结果 - 按目录分组显示
   */
  formatDetailedResults(): string {
    const header = `Qt Linguist 批量更新结果\n${"=".repeat(50)}\n\n`;

    // 总体统计
    const totalFiles = this.totalProcessedFiles + this.totalFailedFiles;
    const summary =
      `总体统计:\n` +
      `- 处理目录: ${this.results.length} 个\n` +
      `- 总文件数: ${totalFiles} 个\n` +
      `- 成功文件: ${this.totalProcessedFiles} 个\n` +
      `- 失败文件: ${this.totalFailedFiles} 个\n` +
      `- 成功率: ${
        totalFiles > 0
          ? ((this.totalProcessedFiles / totalFiles) * 100).toFixed(1)
          : 0
      }%\n\n`;

    // 详细结果
    let detailContent = "详细结果:\n" + "-".repeat(30) + "\n\n";

    this.results.forEach((result, index) => {
      const status = result.success ? "✓" : "✗";
      const duration = result.duration ? ` (${result.duration}ms)` : "";

      detailContent += `${status} 目录 ${index + 1}: ${
        result.file
      }${duration}\n`;

      if (result.directoryInfo) {
        const info = result.directoryInfo;
        detailContent += `   路径: ${info.fullPath}\n`;
        detailContent += `   总文件: ${info.totalFiles} 个\n`;

        if (info.processedFiles.length > 0) {
          detailContent += `   成功 (${
            info.processedFiles.length
          }): ${info.processedFiles.join(", ")}\n`;
        }

        if (info.failedFiles.length > 0) {
          detailContent += `   失败 (${
            info.failedFiles.length
          }): ${info.failedFiles.join(", ")}\n`;
        }

        if (info.skippedFiles.length > 0) {
          detailContent += `   跳过 (${
            info.skippedFiles.length
          }): ${info.skippedFiles.join(", ")}\n`;
        }
      }

      // 显示统计信息
      if (result.stats) {
        const stats = result.stats;
        const statInfo: string[] = [];
        if (stats.sourceStrings)
          statInfo.push(`源字符串: ${stats.sourceStrings}`);
        if (stats.newStrings) statInfo.push(`新增: ${stats.newStrings}`);
        if (stats.modifiedStrings)
          statInfo.push(`修改: ${stats.modifiedStrings}`);

        if (statInfo.length > 0) {
          detailContent += `   统计: ${statInfo.join(", ")}\n`;
        }

        if (stats.warnings && stats.warnings.length > 0) {
          detailContent += `   警告: ${stats.warnings.length} 个\n`;
        }
      }

      detailContent += `   消息: ${result.message}\n`;

      if (result.error) {
        detailContent += `   错误: ${result.error}\n`;
      }

      detailContent += "\n";
    });

    return header + summary + detailContent;
  }

  /**
   * 获取简化的汇总消息
   */
  getSummaryMessage(): string {
    const totalFiles = this.totalProcessedFiles + this.totalFailedFiles;
    return (
      `批量更新完成: ${this.results.length} 个目录, ` +
      `${this.totalProcessedFiles}/${totalFiles} 个文件成功`
    );
  }
}
/**
 * 显示更新结果
 */
async function showUpdateResults(results: UpdateResult[]): Promise<void> {
  if (results.length === 0) {
    vscode.window.showInformationMessage("没有更新结果信息");
    return;
  }

  const analyzer = new ResultAnalyzer(results);
  const doc = await vscode.workspace.openTextDocument({
    content: analyzer.formatResults(),
    language: "plaintext",
  });

  await vscode.window.showTextDocument(doc);
}

/**
 * 查找翻译文件
 */
async function findTranslationFiles(): Promise<vscode.Uri[]> {
  const tsFiles = await vscode.workspace.findFiles(
    "**/*.ts",
    "**/node_modules/**"
  );

  if (tsFiles.length === 0) {
    throw new Error("未找到任何 .ts 翻译文件");
  }

  return tsFiles;
}

/**
 * 获取用户选择的更新策略和并发配置
 */
async function getUserStrategyAndConfig(): Promise<
  { strategy: UpdateStrategy; config?: Partial<ConcurrencyConfig> } | undefined
> {
  const selection = await vscode.window.showQuickPick(STRATEGY_OPTIONS, {
    placeHolder: "选择批量更新策略",
  });

  if (!selection) return undefined;

  // 询问是否需要自定义并发配置
  const customizeConfig = await vscode.window.showQuickPick(
    [
      {
        label: "$(zap) 使用默认并发设置",
        description: `自动根据系统配置 (CPU核心数: ${os.cpus().length})`,
        value: false,
      },
      {
        label: "$(gear) 自定义并发设置",
        description: "手动配置并发数和批次大小",
        value: true,
      },
    ],
    {
      placeHolder: "选择并发配置",
    }
  );

  if (!customizeConfig) return undefined;

  let config: Partial<ConcurrencyConfig> | undefined;

  if (customizeConfig.value) {
    // 获取自定义并发配置
    const maxConcurrentStr = await vscode.window.showInputBox({
      prompt: "输入最大并发数 (1-16)",
      value: Math.max(2, Math.min(os.cpus().length, 8)).toString(),
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 1 || num > 16) {
          return "请输入1-16之间的数字";
        }
        return null;
      },
    });

    if (!maxConcurrentStr) return undefined;

    const batchSizeStr = await vscode.window.showInputBox({
      prompt: "输入批次大小 (1-50)",
      value: Math.max(5, os.cpus().length * 2).toString(),
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 1 || num > 50) {
          return "请输入1-50之间的数字";
        }
        return null;
      },
    });

    if (!batchSizeStr) return undefined;

    config = {
      maxConcurrent: parseInt(maxConcurrentStr),
      batchSize: parseInt(batchSizeStr),
    };
  }

  return { strategy: selection.value, config };
}

/**
 * 主命令处理函数
 */
async function handleUpdateAllCommand(): Promise<void> {
  try {
    // 验证 Qt 工具
    const qtPaths = await getQtPaths();
    if (!qtPaths.lupdate) {
      throw new Error("未找到 lupdate 工具，请检查 Qt 安装");
    }

    // 查找翻译文件
    const tsFiles = await findTranslationFiles();

    // 获取用户策略和并发配置
    const userChoice = await getUserStrategyAndConfig();
    if (!userChoice) return;

    const { strategy, config } = userChoice;

    // 执行批量更新
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "批量更新翻译文件",
        cancellable: true,
      },
      async (progress, token) => {
        const startTime = Date.now();
        const updater = new TranslationUpdater(
          qtPaths,
          progress,
          token,
          config
        );
        const results = await updater.execute(strategy, tsFiles);
        const totalTime = Date.now() - startTime;

        progress.report({ increment: 100, message: "完成" });

        // 分析并显示结果
        const analyzer = new ResultAnalyzer(results);
        const message = `${analyzer.getSummaryMessage(
          token.isCancellationRequested
        )} (耗时: ${(totalTime / 1000).toFixed(1)}s)`;

        const showResultsAction = "查看详情";
        const messageHandler = analyzer.hasFailures
          ? vscode.window.showWarningMessage
          : vscode.window.showInformationMessage;

        const selection = await messageHandler(message, showResultsAction);
        if (selection === showResultsAction) {
          await showUpdateResults(results);
        }
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(`批量更新翻译文件失败: ${error}`);
  }
}

// 注册命令
const updateAllCommand = vscode.commands.registerCommand(
  "qt-linguist.updateAll",
  handleUpdateAllCommand
);

export default updateAllCommand;
