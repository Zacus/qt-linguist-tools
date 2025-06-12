import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as fileUtils from '../utils/FileUtils'; 
import {getQtPaths} from '../utils/QtUtils'

interface UpdateResult {
    file: string;
    success: boolean;
    message: string;
}

interface QtPaths {
    lupdate: string;
}

class TranslationUpdater {
    private readonly BATCH_SIZE = 5; // 并发处理文件数量
    
    constructor(private qtPaths: QtPaths) {}

    /**
     * 构建 lupdate 命令
     */
    private buildLupdateCommand(targetPath: string, tsFiles: string[]): string {
        const isWindows = os.platform() === 'win32';
        const quote = isWindows ? '"' : "'";
        
        const quotedTarget = `${quote}${targetPath}${quote}`;
        const quotedTsFiles = tsFiles.map(f => `${quote}${f}${quote}`).join(' ');
        
        return `${quote}${this.qtPaths.lupdate}${quote} ${quotedTarget} -ts ${quotedTsFiles}`;
    }

    /**
     * 更新单个文件或目录
     */
    private async updateSingleFile(file: vscode.Uri, allTsFiles: string[]): Promise<UpdateResult> {
        const fileName = path.basename(file.fsPath);
        
        try {
            const stats = await fs.promises.stat(file.fsPath);
            const targetPath = stats.isDirectory() ? file.fsPath : path.dirname(file.fsPath);
            
            const command = this.buildLupdateCommand(targetPath, allTsFiles);
            const { stdout, stderr } = await fileUtils.execAsync(command, { timeout: 30000 }); // 30秒超时
            
            // 检查stderr中的错误（忽略警告）
            if (stderr && !stderr.toLowerCase().includes('warning')) {
                throw new Error(stderr);
            }
            
            return {
                file: fileName,
                success: true,
                message: `更新成功: ${fileName}`
            };
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`更新 ${file.fsPath} 失败:`, error);
            
            return {
                file: fileName,
                success: false,
                message: `更新失败: ${fileName} - ${errorMessage}`
            };
        }
    }

    /**
     * 批量更新文件
     */
    private async updateFiles(
        files: vscode.Uri[], 
        progress: vscode.Progress<{ increment?: number; message?: string }>,
        token: vscode.CancellationToken
    ): Promise<UpdateResult[]> {
        const results: UpdateResult[] = [];
        const allTsFiles = files.map(f => f.fsPath);
        const total = files.length;

        // 分批处理以控制并发
        for (let i = 0; i < files.length; i += this.BATCH_SIZE) {
            if (token.isCancellationRequested) break;

            const batch = files.slice(i, Math.min(i + this.BATCH_SIZE, files.length));
            const batchPromises = batch.map(file => this.updateSingleFile(file, allTsFiles));
            
            // 更新进度
            const progressPercent = (i / total) * 100;
            progress.report({
                increment: progressPercent - (results.length / total * 100),
                message: `处理批次 ${Math.floor(i / this.BATCH_SIZE) + 1} (${i + 1}-${Math.min(i + this.BATCH_SIZE, files.length)}/${total})`
            });

            try {
                const batchResults = await Promise.allSettled(batchPromises);
                
                for (const result of batchResults) {
                    if (result.status === 'fulfilled') {
                        results.push(result.value);
                    } else {
                        results.push({
                            file: 'unknown',
                            success: false,
                            message: `批处理失败: ${result.reason}`
                        });
                    }
                }
            } catch (error) {
                console.error('批处理错误:', error);
                // 继续处理下一批
            }
        }

        return results;
    }

    /**
     * 执行更新操作
     */
    async update(
        files: vscode.Uri[],
        progress: vscode.Progress<{ increment?: number; message?: string }>,
        token: vscode.CancellationToken
    ): Promise<{ successful: number; failed: number; results: UpdateResult[] }> {
        const results = await this.updateFiles(files, progress, token);
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        return { successful, failed, results };
    }
}

/**
 * 显示更新结果详情
 */
function showUpdateResults(results: UpdateResult[]): void {
    const successResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    let content = '';
    
    if (successResults.length > 0) {
        content += '**成功更新的文件:**\n';
        content += successResults.map(r => `✓ ${r.message}`).join('\n');
        content += '\n\n';
    }
    
    if (failedResults.length > 0) {
        content += '**更新失败的文件:**\n';
        content += failedResults.map(r => `✗ ${r.message}`).join('\n');
    }
    
    // 创建一个新的文档来显示结果
    vscode.workspace.openTextDocument({
        content,
        language: 'markdown'
    }).then(doc => {
        vscode.window.showTextDocument(doc);
    });
}

/**
 * 主要的更新翻译命令
 */
const updateTranslationCommand = vscode.commands.registerCommand(
    'qt-linguist.updateTranslation', 
    async (uri: vscode.Uri, uris?: vscode.Uri[]) => {
        try {
            // 获取选中的文件
            const selectedFiles = await fileUtils.getSelectedTranslationFiles(uri, uris);
            
            if (selectedFiles.length === 0) {
                vscode.window.showErrorMessage('请选择.ts项目文件或包含源代码的文件夹');
                return;
            }

            // 验证文件有效性
            const validFiles = await fileUtils.validateFiles(selectedFiles);
            if (validFiles.length === 0) {
                vscode.window.showErrorMessage('所选文件均无效或无法访问');
                return;
            }

            if (validFiles.length < selectedFiles.length) {
                const invalidCount = selectedFiles.length - validFiles.length;
                vscode.window.showWarningMessage(`已跳过 ${invalidCount} 个无效文件`);
            }

            // 获取Qt路径
            const qtPaths = await getQtPaths();
            if (!qtPaths?.lupdate) {
                throw new Error('未找到 lupdate 工具，请检查 Qt 安装路径配置');
            }

            // 验证lupdate工具是否存在
            try {
                await fs.promises.access(qtPaths.lupdate, fs.constants.X_OK);
            } catch {
                throw new Error(`lupdate 工具不存在或无执行权限: ${qtPaths.lupdate}`);
            }

            // 创建更新器实例
            const updater = new TranslationUpdater(qtPaths);

            // 执行更新操作
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "更新翻译文件",
                cancellable: true
            }, async (progress, token) => {
                progress.report({ increment: 0, message: "准备更新..." });

                const { successful, failed, results } = await updater.update(
                    validFiles, 
                    progress, 
                    token
                );

                progress.report({ increment: 100, message: "完成" });

                // 显示结果
                const wasCancelled = token.isCancellationRequested;
                const message = wasCancelled 
                    ? `更新已取消: 成功 ${successful} 个，失败 ${failed} 个`
                    : `更新完成: 成功 ${successful} 个，失败 ${failed} 个`;

                if (failed > 0) {
                    const action = await vscode.window.showWarningMessage(
                        message, 
                        '查看详情', 
                        '忽略'
                    );
                    
                    if (action === '查看详情') {
                        showUpdateResults(results);
                    }
                } else if (successful > 0) {
                    vscode.window.showInformationMessage(message);
                } else {
                    vscode.window.showWarningMessage('没有文件被成功更新');
                }
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('更新翻译文件失败:', error);
            vscode.window.showErrorMessage(`更新翻译文件失败: ${errorMessage}`);
        }
    }
);

export default updateTranslationCommand;