/*
 * @Author: zs
 * @Date: 2025-06-11 18:42:54
 * @LastEditors: zs
 * @LastEditTime: 2025-06-12 00:47:20
 * @FilePath: /qt-linguist-tools/qt-linguist/src/extension.ts
 * @Description: 
 * 
 * Copyright (c) 2025 by zs, All Rights Reserved. 
 */
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

export function activate(context: vscode.ExtensionContext) {

	// 注册命令：打开Qt Linguist
	let openLinguistCommand = vscode.commands.registerCommand('qt-linguist.openInLinguist', async (uri: vscode.Uri) => {
		try {
			if (uri.fsPath.endsWith('.ts')) {
				const config = vscode.workspace.getConfiguration('qt-linguist');
				const qtPath = config.get('qtPath', '/opt/homebrew/opt/qt');
				
				// 检查可能的 Qt Linguist 路径
				// 检查可能的 Qt Linguist 路径
				const possiblePaths = [
					`${qtPath}/bin/linguist`,          // 二进制可执行文件路径
					`${qtPath}/bin/Linguist.app/Contents/MacOS/Linguist`,  // App 包中的可执行文件
					`${qtPath}/../Cellar/qt/*/bin/linguist`  // Homebrew Cellar 路径
				];
				
				let linguistPath = '';
				for (const path of possiblePaths) {
					try {
						// 使用 glob 模式查找 Linguist
						const { stdout } = await execAsync(`ls -d ${path} 2>/dev/null || true`);
						if (stdout.trim()) {
							linguistPath = stdout.trim().split('\n')[0]; // 如果有多个匹配，取第一个
							break;
						}
					} catch (e) {
						// 忽略单个路径的查找错误，继续尝试其他路径
						continue;
					}
				}
				
				if (!linguistPath) {
					throw new Error('未找到 Qt Linguist，请检查 Qt 安装路径');
				}
				
				// 直接使用可执行文件打开
				await execAsync(`'${linguistPath}' '${uri.fsPath}'`);
			} else {
				vscode.window.showErrorMessage('只能打开 .ts 文件');
			}
		} catch (error) {
			vscode.window.showErrorMessage('无法打开Qt Linguist::' + error);
			
			// 如果是路径错误，提示用户设置
			if ((error as Error).message.includes('未找到 Qt Linguist')) {
				const setPath = '设置 Qt 路径:';
				vscode.window.showErrorMessage('Qt 路径可能不正确，请检查设置', setPath)
					.then(selection => {
						if (selection === setPath) {
							vscode.commands.executeCommand('workbench.action.openSettings', 'qt-linguist.qtPath');
						}
					});
			}
		}
	});

	// 注册命令：生成翻译文件
	let generateQmCommand = vscode.commands.registerCommand('qt-linguist.generateQm', async (uri: vscode.Uri) => {
		try {
			if (uri.fsPath.endsWith('.ts')) {
				const { stdout, stderr } = await execAsync(`/opt/homebrew/bin/lrelease '${uri.fsPath}'`);
				vscode.window.showInformationMessage('翻译文件生成完成');
			} else {
				vscode.window.showErrorMessage('只能处理 .ts 文件');
			}
		} catch (error) {
			vscode.window.showErrorMessage('生成翻译文件失败：' + error);
		}
	});

	// 添加状态栏按钮
	const linguistButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	linguistButton.text = "$(globe) Qt Linguist";
	linguistButton.tooltip = "在 Qt Linguist 中打开翻译文件";
	linguistButton.command = 'qt-linguist.openInLinguist';
	linguistButton.show();

	context.subscriptions.push(openLinguistCommand, linguistButton);
}

// This method is called when your extension is deactivated
export function deactivate() {}
