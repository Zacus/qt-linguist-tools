import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fileUtils from '../utils/FileUtils';
import {getQtPaths} from '../utils/QtUtils'

// 注册命令：批量更新工作空间中的所有翻译文件
const updateAllCommand = vscode.commands.registerCommand('qt-linguist.updateAll', async () => {
    try {
        const qtPaths = await getQtPaths();
        
        if (!qtPaths.lupdate) {
            throw new Error('未找到 lupdate 工具，请检查 Qt 安装');
        }
        
        // 查找所有.ts文件
        const tsFiles = await vscode.workspace.findFiles('**/*.ts', '**/node_modules/**');
        
        if (tsFiles.length === 0) {
            vscode.window.showInformationMessage('未找到任何 .ts 翻译文件');
            return;
        }
        
        // 询问用户更新策略
        const strategy = await vscode.window.showQuickPick([
            {
                label: '$(file-directory) 按目录分组更新',
                description: '每个目录执行一次 lupdate，包含该目录下的所有 .ts 文件',
                value: 'byDirectory'
            },
            {
                label: '$(file) 逐个文件更新',
                description: '为每个 .ts 文件单独执行 lupdate',
                value: 'individual'
            },
            {
                label: '$(project) 从 .pro 文件更新',
                description: '查找 .pro 文件并使用它们来更新翻译文件',
                value: 'fromPro'
            }
        ], {
            placeHolder: '选择批量更新策略'
        });
        
        if (!strategy) return;
        
        // 显示进度条
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "批量更新翻译文件",
            cancellable: true
        }, async (progress, token) => {
            let updated = 0;
            let failed = 0;
            const results: string[] = [];
            
            if (strategy.value === 'fromPro') {
                // 从.pro文件更新
                const proFiles = await fileUtils.findProFiles();
                
                if (proFiles.length === 0) {
                    throw new Error('未找到 .pro 文件，请选择其他更新策略');
                }
                
                const total = proFiles.length;
                
                for (let i = 0; i < proFiles.length; i++) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    
                    const proFile = proFiles[i];
                    progress.report({ 
                        increment: (i / total) * 100, 
                        message: `更新 ${path.basename(proFile.fsPath)} (${i + 1}/${total})` 
                    });
                    
                    try {
                        const command = os.platform() === 'win32' 
                            ? `"${qtPaths.lupdate}" "${proFile.fsPath}"` 
                            : `'${qtPaths.lupdate}' '${proFile.fsPath}'`;
                        
                        const { stdout, stderr } = await fileUtils.execAsync(command);
                        updated++;
                        
                        // 收集输出信息
                        if (stdout) {
                            const lines = stdout.split('\n').filter(line => line.trim());
                            if (lines.length > 0) {
                                results.push(`${path.basename(proFile.fsPath)}: ${lines[lines.length - 1]}`);
                            }
                        }
                        
                    } catch (error) {
                        failed++;
                        results.push(`${path.basename(proFile.fsPath)}: 更新失败 - ${error}`);
                        console.error(`更新 ${proFile.fsPath} 失败:`, error);
                    }
                }
                
            } else if (strategy.value === 'byDirectory') {
                // 按目录分组更新
                const dirGroups = new Map<string, vscode.Uri[]>();
                
                // 按目录分组
                tsFiles.forEach(file => {
                    const dir = path.dirname(file.fsPath);
                    if (!dirGroups.has(dir)) {
                        dirGroups.set(dir, []);
                    }
                    dirGroups.get(dir)!.push(file);
                });
                
                const directories = Array.from(dirGroups.keys());
                const total = directories.length;
                
                for (let i = 0; i < directories.length; i++) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    
                    const dir = directories[i];
                    const files = dirGroups.get(dir)!;
                    
                    progress.report({ 
                        increment: (i / total) * 100, 
                        message: `更新目录 ${path.basename(dir)} (${files.length} 个文件) (${i + 1}/${total})` 
                    });
                    
                    try {
                        // 构建包含所有.ts文件的命令
                        const tsFilePaths = files.map(f => `"${f.fsPath}"`).join(' ');
                        const command = os.platform() === 'win32' 
                            ? `"${qtPaths.lupdate}" "${dir}" -ts ${tsFilePaths}` 
                            : `'${qtPaths.lupdate}' '${dir}' -ts ${tsFilePaths}`;
                        
                        const { stdout, stderr } = await fileUtils.execAsync(command);
                        updated += files.length;
                        
                        // 收集输出信息
                        if (stdout) {
                            const lines = stdout.split('\n').filter(line => line.trim());
                            if (lines.length > 0) {
                                results.push(`${path.basename(dir)} (${files.length}个文件): ${lines[lines.length - 1]}`);
                            }
                        }
                        
                    } catch (error) {
                        failed += files.length;
                        results.push(`${path.basename(dir)}: 更新失败 - ${error}`);
                        console.error(`更新目录 ${dir} 失败:`, error);
                    }
                }
                
            } else {
                // 逐个文件更新
                const total = tsFiles.length;
                
                for (let i = 0; i < tsFiles.length; i++) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    
                    const tsFile = tsFiles[i];
                    progress.report({ 
                        increment: (i / total) * 100, 
                        message: `更新 ${path.basename(tsFile.fsPath)} (${i + 1}/${total})` 
                    });
                    
                    try {
                        const sourceDir = path.dirname(tsFile.fsPath);
                        const command = os.platform() === 'win32' 
                            ? `"${qtPaths.lupdate}" "${sourceDir}" -ts "${tsFile.fsPath}"` 
                            : `'${qtPaths.lupdate}' '${sourceDir}' -ts '${tsFile.fsPath}'`;
                        
                        const { stdout, stderr } = await fileUtils.execAsync(command);
                        updated++;
                        
                        // 收集输出信息
                        if (stdout) {
                            const lines = stdout.split('\n').filter(line => line.trim());
                            if (lines.length > 0) {
                                results.push(`${path.basename(tsFile.fsPath)}: ${lines[lines.length - 1]}`);
                            }
                        }
                        
                    } catch (error) {
                        failed++;
                        results.push(`${path.basename(tsFile.fsPath)}: 更新失败 - ${error}`);
                        console.error(`更新 ${tsFile.fsPath} 失败:`, error);
                    }
                }
            }
            
            progress.report({ increment: 100, message: "完成" });
            
            // 显示结果
            const message = token.isCancellationRequested 
                ? `批量更新已取消: 成功 ${updated} 个，失败 ${failed} 个`
                : `批量更新完成: 成功 ${updated} 个，失败 ${failed} 个`;
            
            if (failed > 0) {
                vscode.window.showWarningMessage(message, '查看详情').then(selection => {
                    if (selection === '查看详情') {
                        showUpdateResults(results);
                    }
                });
            } else {
                vscode.window.showInformationMessage(message, '查看详情').then(selection => {
                    if (selection === '查看详情') {
                        showUpdateResults(results);
                    }
                });
            }
        });
        
    } catch (error) {
        vscode.window.showErrorMessage(`批量更新翻译文件失败: ${error}`);
    }
});

// 显示更新结果的辅助函数
async function showUpdateResults(results: string[]): Promise<void> {
    if (results.length === 0) {
        vscode.window.showInformationMessage('没有更新结果信息');
        return;
    }
    
    // 创建一个新的文档来显示结果
    const doc = await vscode.workspace.openTextDocument({
        content: `Qt Linguist 批量更新结果\n${'='.repeat(40)}\n\n${results.join('\n\n')}`,
        language: 'plaintext'
    });
    
    await vscode.window.showTextDocument(doc);
}


    export default updateAllCommand;