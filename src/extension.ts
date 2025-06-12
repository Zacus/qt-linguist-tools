/*
 * @Author: zs
 * @Date: 2025-06-11 18:42:54
 * @LastEditors: zs
 * @LastEditTime: 2025-06-12 16:21:11
 * @FilePath: /qt-linguist-tools/qt-linguist/src/extension.ts
 * @Description: 跨平台Qt Linguist VS Code扩展
 * 
 * Copyright (c) 2025 by zs, All Rights Reserved. 
 */
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

interface QtPaths {
	linguist: string;
	lrelease: string;
	lupdate: string;
}

export function activate(context: vscode.ExtensionContext) {

	// 获取Qt工具路径
// 获取Qt工具路径 - 修复版本
	async function getQtPaths(): Promise<QtPaths> {
		const config = vscode.workspace.getConfiguration('qt-linguist');
		const customQtPath = config.get('qtPath', '');
		const platform = os.platform();
		
		// 根据平台定义可能的Qt路径
		const possibleBasePaths = [];
		
		if (customQtPath) {
			possibleBasePaths.push(customQtPath);
		}
		
		switch (platform) {
			case 'darwin': // macOS
				possibleBasePaths.push(
					'/opt/homebrew/opt/qt',
					'/usr/local/opt/qt',
					'/opt/Qt/*/bin'
				);
				break;
			case 'win32': // Windows
				possibleBasePaths.push(
					'C:\\Qt\\Tools\\QtCreator\\bin',
					'C:\\Qt\\*\\bin',
					'C:\\Program Files\\Qt\\*\\bin',
					'C:\\Program Files (x86)\\Qt\\*\\bin'
				);
				break;
			case 'linux': // Linux
				possibleBasePaths.push(
					'/usr/bin',
					'/usr/local/bin',
					'/opt/qt/bin',
					'/opt/Qt/*/bin',
					'/home/*/Qt/*/bin'
				);
				break;
		}
		
		// 工具文件名（根据平台）
		const linguistName = platform === 'win32' ? 'linguist.exe' : 'linguist';
		const lreleaseName = platform === 'win32' ? 'lrelease.exe' : 'lrelease';
		const lupdateName = platform === 'win32' ? 'lupdate.exe' : 'lupdate';
		
		// 查找工具路径
		let linguistPath = '';
		let lreleasePath = '';
		let lupdatePath = '';
		
		// 优先查找标准路径中的工具
		for (const basePath of possibleBasePaths) {
			try {
				const expandedPaths = await expandGlobPath(basePath);
				
				for (const expandedPath of expandedPaths) {
					const binPath = path.join(expandedPath, 'bin');
					const directPath = expandedPath;
					
					// 检查bin目录和直接路径
					for (const checkPath of [binPath, directPath]) {
						if (!linguistPath) {
							const linguistCandidate = path.join(checkPath, linguistName);
							if (await fileExists(linguistCandidate) && await isExecutable(linguistCandidate)) {
								linguistPath = linguistCandidate;
							}
						}
						
						if (!lreleasePath) {
							const lreleaseCandidate = path.join(checkPath, lreleaseName);
							if (await fileExists(lreleaseCandidate) && await isExecutable(lreleaseCandidate)) {
								lreleasePath = lreleaseCandidate;
							}
						}
						
						if (!lupdatePath) {
							const lupdateCandidate = path.join(checkPath, lupdateName);
							if (await fileExists(lupdateCandidate) && await isExecutable(lupdateCandidate)) {
								lupdatePath = lupdateCandidate;
							}
						}
					}
				}
			} catch (e) {
				continue;
			}
		}
		
		// 在macOS上，只有在没找到标准linguist时才查找App包
		if (platform === 'darwin' && !linguistPath) {
			// 修正的macOS App路径
			const macLinguistPaths = [
				'/Applications/Qt Linguist.app/Contents/MacOS/linguist',  // 修正路径
				'/Applications/Qt Creator.app/Contents/Resources/bin/linguist'  // Qt Creator内置的linguist
			];
			
			for (const appPath of macLinguistPaths) {
				if (await fileExists(appPath) && await isExecutable(appPath)) {
					linguistPath = appPath;
					break;
				}
			}
		}
		
		// 最后才从系统PATH中查找
		if (!linguistPath) linguistPath = await findInPath(linguistName);
		if (!lreleasePath) lreleasePath = await findInPath(lreleaseName);
		if (!lupdatePath) lupdatePath = await findInPath(lupdateName);
		
		return {
			linguist: linguistPath,
			lrelease: lreleasePath,
			lupdate: lupdatePath
		};
	}
	
	// 新增：检查文件是否可执行
	async function isExecutable(filePath: string): Promise<boolean> {
		try {
			await fs.promises.access(filePath, fs.constants.X_OK);
			return true;
		} catch {
			return false;
		}
	}
	// 展开glob路径
	async function expandGlobPath(globPath: string): Promise<string[]> {
		if (!globPath.includes('*')) {
			return [globPath];
		}
		
		try {
			const command = os.platform() === 'win32' 
				? `dir "${globPath}" /b /ad 2>nul` 
				: `ls -d ${globPath} 2>/dev/null || true`;
			
			const { stdout } = await execAsync(command);
			return stdout.trim() ? stdout.trim().split('\n') : [];
		} catch (e) {
			return [];
		}
	}
	
	// 检查文件是否存在
	async function fileExists(filePath: string): Promise<boolean> {
		try {
			await fs.promises.access(filePath, fs.constants.F_OK);
			return true;
		} catch {
			return false;
		}
	}
	
	// 在系统PATH中查找工具
	async function findInPath(toolName: string): Promise<string> {
		try {
			const command = os.platform() === 'win32' 
				? `where ${toolName}` 
				: `which ${toolName}`;
			
			const { stdout } = await execAsync(command);
			return stdout.trim().split('\n')[0];
		} catch {
			return '';
		}
	}
	
	// 获取工作空间中的.pro文件
	async function findProFiles(): Promise<vscode.Uri[]> {
		const proFiles = await vscode.workspace.findFiles('**/*.pro', '**/node_modules/**');
		return proFiles;
	}
	
	// 注册命令：在Qt Linguist中打开
	let openLinguistCommand = vscode.commands.registerCommand('qt-linguist.openInLinguist', async (uri: vscode.Uri) => {
		try {
			if (!uri.fsPath.endsWith('.ts')) {
				vscode.window.showErrorMessage('只能打开 .ts 翻译文件');
				return;
			}
			
			const qtPaths = await getQtPaths();
			
			if (!qtPaths.linguist) {
				throw new Error('未找到 Qt Linguist，请检查 Qt 安装或配置路径');
			}
			
			// 检查是否已经有linguist进程在运行此文件
			const isAlreadyOpen = await checkIfLinguistIsOpen(uri.fsPath);
			if (isAlreadyOpen) {
				vscode.window.showInformationMessage('该文件已在 Qt Linguist 中打开');
				return;
			}
			
			// 更严格的命令构建和执行
			let command: string;
			const platform = os.platform();
			
			if (platform === 'darwin') {
				// macOS: 使用 open 命令或直接执行
				if (qtPaths.linguist.includes('.app/')) {
					// App包格式，使用open命令
					command = `open -n "${qtPaths.linguist.replace('/Contents/MacOS/linguist', '')}" --args "${uri.fsPath}"`;
				} else {
					// 命令行工具
					command = `"${qtPaths.linguist}" "${uri.fsPath}" &`;
				}
			} else if (platform === 'win32') {
				// Windows: 添加 /wait 可能有助于避免多实例
				command = `start "" "${qtPaths.linguist}" "${uri.fsPath}"`;
			} else {
				// Linux: 后台运行
				command = `"${qtPaths.linguist}" "${uri.fsPath}" &`;
			}
			
			console.log('执行命令:', command); // 调试用
			
			await execAsync(command, { 
				timeout: 10000,  // 10秒超时
				windowsHide: true  // Windows上隐藏命令窗口
			});
			
			vscode.window.showInformationMessage('Qt Linguist 已打开');
			
		} catch (error) {
			console.error('打开Qt Linguist错误:', error); // 调试用
			vscode.window.showErrorMessage(`无法打开 Qt Linguist: ${error}`);
			
			// 提示用户设置Qt路径
			const setPath = '设置 Qt 路径';
			vscode.window.showErrorMessage('Qt 路径可能不正确，请检查设置', setPath)
				.then(selection => {
					if (selection === setPath) {
						vscode.commands.executeCommand('workbench.action.openSettings', 'qt-linguist.qtPath');
					}
				});
		}
	});

	// 新增：检查linguist是否已经打开了指定文件
	async function checkIfLinguistIsOpen(filePath: string): Promise<boolean> {
		try {
			const platform = os.platform();
			let command: string;
			
			if (platform === 'darwin') {
				command = `ps aux | grep linguist | grep "${path.basename(filePath)}"`;
			} else if (platform === 'win32') {
				command = `tasklist /FI "IMAGENAME eq linguist.exe" /FO CSV | findstr linguist`;
			} else {
				command = `ps aux | grep linguist | grep "${path.basename(filePath)}"`;
			}
			
			const { stdout } = await execAsync(command);
			return stdout.trim().length > 0 && !stdout.includes('grep');
		} catch {
			return false; // 如果检查失败，假设没有打开
		}
	}

	// 注册命令：编译翻译文件（lrelease）
	let generateQmCommand = vscode.commands.registerCommand('qt-linguist.generateQm', async (uri: vscode.Uri) => {
		try {
			if (!uri.fsPath.endsWith('.ts')) {
				vscode.window.showErrorMessage('只能处理 .ts 翻译文件');
				return;
			}
			
			const qtPaths = await getQtPaths();
			
			if (!qtPaths.lrelease) {
				throw new Error('未找到 lrelease 工具，请检查 Qt 安装');
			}
			
			// 显示进度条
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: "编译翻译文件",
				cancellable: false
			}, async (progress) => {
				progress.report({ increment: 0, message: "正在编译..." });
				
				const command = os.platform() === 'win32' 
					? `"${qtPaths.lrelease}" "${uri.fsPath}"` 
					: `'${qtPaths.lrelease}' '${uri.fsPath}'`;
				
				const { stdout, stderr } = await execAsync(command);
				
				progress.report({ increment: 100, message: "完成" });
				
				if (stderr && !stderr.includes('Warning')) {
					throw new Error(stderr);
				}
				
				const qmFile = uri.fsPath.replace('.ts', '.qm');
				vscode.window.showInformationMessage(`翻译文件编译完成: ${path.basename(qmFile)}`);
			});
			
		} catch (error) {
			vscode.window.showErrorMessage(`编译翻译文件失败: ${error}`);
		}
	});

	// 注册命令：更新翻译文件（lupdate）
	let updateTranslationCommand = vscode.commands.registerCommand('qt-linguist.updateTranslation', async (uri?: vscode.Uri) => {
		try {
			const qtPaths = await getQtPaths();
			
			if (!qtPaths.lupdate) {
				throw new Error('未找到 lupdate 工具，请检查 Qt 安装');
			}
			
			// 如果没有传入URI，尝试查找.pro文件
			if (!uri) {
				const proFiles = await findProFiles();
				if (proFiles.length === 0) {
					vscode.window.showErrorMessage('未找到 .pro 文件，请选择项目文件或.ts文件');
					return;
				} else if (proFiles.length === 1) {
					uri = proFiles[0];
				} else {
					// 多个.pro文件，让用户选择
					const items = proFiles.map(file => ({
						label: path.basename(file.fsPath),
						description: file.fsPath,
						uri: file
					}));
					
					const selected = await vscode.window.showQuickPick(items, {
						placeHolder: '选择要更新的项目文件'
					});
					
					if (!selected) return;
					uri = selected.uri;
				}
			}
			
			// 显示进度条
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: "更新翻译文件",
				cancellable: false
			}, async (progress) => {
				progress.report({ increment: 0, message: "正在扫描源码..." });
				
				let command = '';
				if (uri!.fsPath.endsWith('.pro')) {
					// 从.pro文件更新
					command = os.platform() === 'win32' 
						? `"${qtPaths.lupdate}" "${uri!.fsPath}"` 
						: `'${qtPaths.lupdate}' '${uri!.fsPath}'`;
				} else if (uri!.fsPath.endsWith('.ts')) {
					// 直接更新.ts文件（需要指定源文件）
					const sourceDir = path.dirname(uri!.fsPath);
					command = os.platform() === 'win32' 
						? `"${qtPaths.lupdate}" "${sourceDir}" -ts "${uri!.fsPath}"` 
						: `'${qtPaths.lupdate}' '${sourceDir}' -ts '${uri!.fsPath}'`;
				} else {
					throw new Error('请选择 .pro 或 .ts 文件进行更新');
				}
				
				const { stdout, stderr } = await execAsync(command);
				
				progress.report({ increment: 100, message: "完成" });
				
				if (stderr && !stderr.includes('Warning')) {
					throw new Error(stderr);
				}
				
				vscode.window.showInformationMessage('翻译文件更新完成');
				
				// 显示更新统计信息
				if (stdout) {
					const lines = stdout.split('\n').filter(line => line.trim());
					if (lines.length > 0) {
						vscode.window.showInformationMessage(`更新统计: ${lines[lines.length - 1]}`);
					}
				}
			});
			
		} catch (error) {
			vscode.window.showErrorMessage(`更新翻译文件失败: ${error}`);
		}
	});

	// 注册命令：批量编译工作空间中的所有.ts文件
	let compileAllCommand = vscode.commands.registerCommand('qt-linguist.compileAll', async () => {
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
						
						await execAsync(command);
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

	// 添加状态栏按钮
	const linguistButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	linguistButton.text = "$(globe) Qt Linguist";
	linguistButton.tooltip = "Qt Linguist 工具";
	linguistButton.command = 'qt-linguist.showMenu';
	linguistButton.show();

	// 注册菜单命令
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
			if (activeEditor && selected.command !== 'qt-linguist.compileAll' && selected.command !== 'qt-linguist.updateTranslation') {
				vscode.commands.executeCommand(selected.command, activeEditor.document.uri);
			} else {
				vscode.commands.executeCommand(selected.command);
			}
		}
	});

	context.subscriptions.push(
		openLinguistCommand,
		generateQmCommand,
		updateTranslationCommand,
		compileAllCommand,
		showMenuCommand,
		linguistButton
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}