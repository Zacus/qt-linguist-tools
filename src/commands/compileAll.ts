
/*
 * @Author: zs
 * @Date: 2025-06-12 23:44:27
 * @LastEditors: zs
 * @LastEditTime: 2025-06-13 01:33:34
 * @FilePath: /qt-linguist-tools/qt-linguist/src/commands/compileAll.ts
 * @Description: 批量编译Qt翻译文件命令
 * 
 * Copyright (c) 2025 by zs, All Rights Reserved. 
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fileUtils from '../utils/FileUtils'; 
import { getQtPaths } from '../utils/QtUtils';

interface CompileResult {
    success: boolean;
    file: string;
    error?: string;
}

interface CompileOptions {
    maxConcurrency?: number;
    excludePattern?: string;
}

/**
 * 批量编译单个文件
 */
async function compileSingleFile(
    lreleasePath: string, 
    tsFile: vscode.Uri
): Promise<CompileResult> {
    try {
        const command = os.platform() === 'win32' 
            ? `"${lreleasePath}" "${tsFile.fsPath}"` 
            : `'${lreleasePath}' '${tsFile.fsPath}'`;
        
        await fileUtils.execAsync(command);
        return { success: true, file: tsFile.fsPath };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`编译 ${tsFile.fsPath} 失败:`, error);
        return { 
            success: false, 
            file: tsFile.fsPath, 
            error: errorMessage 
        };
    }
}

/**
 * 并发编译文件（控制并发数量）
 */
async function compileFilesWithConcurrency(
    lreleasePath: string,
    tsFiles: vscode.Uri[],
    maxConcurrency: number,
    progressCallback: (completed: number, total: number, currentFile: string) => void
): Promise<CompileResult[]> {
    const results: CompileResult[] = [];
    let completed = 0;
    
    // 分批处理，控制并发数量
    for (let i = 0; i < tsFiles.length; i += maxConcurrency) {
        const batch = tsFiles.slice(i, i + maxConcurrency);
        
        // 并发执行当前批次
        const batchPromises = batch.map(async (tsFile) => {
            progressCallback(completed, tsFiles.length, path.basename(tsFile.fsPath));
            const result = await compileSingleFile(lreleasePath, tsFile);
            completed++;
            return result;
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
    }
    
    return results;
}

/**
 * 获取编译配置
 */
function getCompileOptions(): CompileOptions {
    const config = vscode.workspace.getConfiguration('qt-linguist');
    return {
        maxConcurrency: config.get('compile.maxConcurrency', 3),
        excludePattern: config.get('compile.excludePattern', '**/node_modules/**')
    };
}

/**
 * 显示编译结果摘要
 */
function showCompileResults(results: CompileResult[]): void {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    if (failed.length === 0) {
        vscode.window.showInformationMessage(
            `✅ 批量编译完成: ${successful.length} 个文件编译成功`
        );
    } else {
        const message = `⚠️ 批量编译完成: ${successful.length} 成功, ${failed.length} 失败`;
        vscode.window.showWarningMessage(message, '查看详情').then(selection => {
            if (selection === '查看详情') {
                showFailedFiles(failed);
            }
        });
    }
}

/**
 * 显示失败文件列表
 */
function showFailedFiles(failedResults: CompileResult[]): void {
    const failedFiles = failedResults.map(r => 
        `• ${path.basename(r.file)}: ${r.error || '未知错误'}`
    ).join('\n');
    
    vscode.window.showErrorMessage(
        `编译失败的文件:\n${failedFiles}`,
        { modal: false }
    );
}

/**
 * 主编译命令
 */
const compileAllCommand = vscode.commands.registerCommand(
    'qt-linguist.compileAll', 
    async () => {
        try {
            // 1. 验证Qt工具
            const qtPaths = await getQtPaths();
            if (!qtPaths.lrelease) {
                throw new Error('未找到 lrelease 工具，请检查 Qt 安装路径配置');
            }
            
            // 2. 获取编译选项
            const options = getCompileOptions();
            
            // 3. 查找翻译文件
            const tsFiles = await vscode.workspace.findFiles(
                '**/*.ts', 
                options.excludePattern
            );
            
            if (tsFiles.length === 0) {
                vscode.window.showInformationMessage('未找到任何 .ts 翻译文件');
                return;
            }
            
            // 4. 确认编译
            const proceed = await vscode.window.showQuickPick(
                ['是', '否'],
                {
                    placeHolder: `找到 ${tsFiles.length} 个翻译文件，是否开始批量编译？`,
                    canPickMany: false
                }
            );
            
            if (proceed !== '是') return;
            
            // 5. 执行编译
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "批量编译翻译文件",
                cancellable: false
            }, async (progress) => {
                const results = await compileFilesWithConcurrency(
                    qtPaths.lrelease,
                    tsFiles,
                    options.maxConcurrency || 3,
                    (completed, total, currentFile) => {
                        const percentage = Math.round((completed / total) * 100);
                        progress.report({ 
                            increment: percentage - (progress as any).lastPercentage || 0,
                            message: `编译 ${currentFile} (${completed}/${total})`
                        });
                        (progress as any).lastPercentage = percentage;
                    }
                );
                
                progress.report({ increment: 100, message: "编译完成" });
                
                // 6. 显示结果
                showCompileResults(results);
            });
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('批量编译错误:', error);
            vscode.window.showErrorMessage(`批量编译失败: ${errorMessage}`);
        }
    }
);

export default compileAllCommand;