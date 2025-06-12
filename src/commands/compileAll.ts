/*
 * @Author: zs
 * @Date: 2025-06-12 23:44:27
 * @LastEditors: zs
 * @LastEditTime: 2025-06-13 00:29:39
 * @FilePath: /qt-linguist-tools/qt-linguist/src/commands/compileAll.ts
 * @Description: 
 * 
 * Copyright (c) 2025 by zs, All Rights Reserved. 
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fileUtils from '../utils/FileUtils'; 
import {getQtPaths} from '../utils/QtUtils'

const compileAllCommand = vscode.commands.registerCommand('qt-linguist.compileAll', async () => {
    try {
        const qtPaths = await getQtPaths();
        
        if (!qtPaths.lrelease) {
            throw new Error('未找到 lrelease 工具，请检查 Qt 安装');
        }
        
        // 查找所有.ts文件
        const tsFiles = await vscode.workspace.findFiles('**/*.ts', '**/node_modules/**');
        
        if (tsFiles.length === 0) {
            vscode.window.showInformationMessage('未找到任何 .ts 翻译文件');
            return;
        }
        
        // 显示进度条
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "批量编译翻译文件",
            cancellable: false
        }, async (progress) => {
            let compiled = 0;
            const total = tsFiles.length;
            
            for (const tsFile of tsFiles) {
                progress.report({ 
                    increment: (compiled / total) * 100, 
                    message: `编译 ${path.basename(tsFile.fsPath)} (${compiled + 1}/${total})` 
                });
                
                try {
                    const command = os.platform() === 'win32' 
                        ? `"${qtPaths.lrelease}" "${tsFile.fsPath}"` 
                        : `'${qtPaths.lrelease}' '${tsFile.fsPath}'`;
                    
                    await fileUtils.execAsync(command);
                    compiled++;
                } catch (error) {
                    console.error(`编译 ${tsFile.fsPath} 失败:`, error);
                }
            }
            
            progress.report({ increment: 100, message: "完成" });
            vscode.window.showInformationMessage(`批量编译完成: ${compiled}/${total} 个文件`);
        });
        
    } catch (error) {
        vscode.window.showErrorMessage(`批量编译失败: ${error}`);
    }
});


    export default compileAllCommand;