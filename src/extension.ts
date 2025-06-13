/*
 * @Author: zs
 * @Date: 2025-06-11 18:42:54
 * @LastEditors: zs
 * @LastEditTime: 2025-06-12 23:58:52
 * @FilePath: /qt-linguist-tools/qt-linguist/src/extension.ts
 * @Description: 跨平台Qt Linguist VS Code扩展
 * 
 * Copyright (c) 2025 by zs, All Rights Reserved. 
 */
import * as vscode from 'vscode';
import generateQmCommand from './commands/updateTranslation';
import updateTranslationCommand from './commands/generateQm';
import openLinguistCommand from './commands/openLinguist';
import compileAllCommand from './commands/compileAll';		
import updateAllCommand from './commands/updateAll';		

export function activate(context: vscode.ExtensionContext) {


	// 添加状态栏按钮
	const linguistButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	linguistButton.text = "$(globe) Qt Linguist";
	linguistButton.tooltip = "Qt Linguist 工具";
	linguistButton.command = 'qt-linguist.showMenu';
	linguistButton.show();

	// 更新状态栏菜单
	let showMenuCommand = vscode.commands.registerCommand('qt-linguist.showMenu', async () => {
		const items = [
			{
				label: '$(file-code) 在 Qt Linguist 中打开',
				description: '打开当前选中的 .ts 文件',
				command: 'qt-linguist.openInLinguist'
			},
			{
				label: '$(sync) 更新翻译文件',
				description: '使用 lupdate 更新翻译文件',
				command: 'qt-linguist.updateTranslation'
			},
			{
				label: '$(sync-ignored) 批量更新所有翻译文件',
				description: '批量更新工作空间中的所有 .ts 文件',
				command: 'qt-linguist.updateAll'
			},
			{
				label: '$(package) 编译翻译文件',
				description: '使用 lrelease 编译当前 .ts 文件',
				command: 'qt-linguist.generateQm'
			},
			{
				label: '$(checklist) 批量编译所有翻译文件',
				description: '编译工作空间中的所有 .ts 文件',
				command: 'qt-linguist.compileAll'
			}
		];

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: '选择 Qt Linguist 操作'
		});

		if (selected) {
			const activeEditor = vscode.window.activeTextEditor;
			
			if (activeEditor && selected.command !== 'qt-linguist.compileAll' && 
				selected.command !== 'qt-linguist.updateTranslation' && 
				selected.command !== 'qt-linguist.updateAll') {
				vscode.commands.executeCommand(selected.command, activeEditor.document.uri);
			} else {
				vscode.commands.executeCommand(selected.command);
			}
		}
	});

	// 在 context.subscriptions.push() 中添加新命令
	context.subscriptions.push(
		openLinguistCommand,
		generateQmCommand,
		updateTranslationCommand,
		compileAllCommand,
		updateAllCommand, // 新增这一行
		showMenuCommand,
		linguistButton
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}