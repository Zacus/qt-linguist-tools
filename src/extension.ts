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
// import { exec } from 'child_process';
// import { promisify } from 'util';
// import * as fs from 'fs';
// import * as path from 'path';
// import * as os from 'os';
//import {getQtPaths} from './utils/QtUtils';
import generateQmCommand from './commands/updateTranslation';
import updateTranslationCommand from './commands/generateQm';
import openLinguistCommand from './commands/openLinguist';
import compileAllCommand from './commands/compileAll';		
import updateAllCommand from './commands/updateAll';		
//import * as fileUtils from './utils/FileUtils';

//const execAsync = promisify(exec);

// interface QtPaths {
// 	linguist: string;
// 	lrelease: string;
// 	lupdate: string;
// }

export function activate(context: vscode.ExtensionContext) {

	// 获取Qt工具路径
	// 获取Qt工具路径 - 修复版本
	// async function getQtPaths(): Promise<QtPaths> {
	// 	const config = vscode.workspace.getConfiguration('qt-linguist');
	// 	const customQtPath = config.get('qtPath', '');
	// 	const platform = os.platform();
		
	// 	// 根据平台定义可能的Qt路径
	// 	const possibleBasePaths = [];
		
	// 	if (customQtPath) {
	// 		possibleBasePaths.push(customQtPath);
	// 	}
		
	// 	switch (platform) {
	// 		case 'darwin': // macOS
	// 			possibleBasePaths.push(
	// 				'/opt/homebrew/opt/qt',
	// 				'/usr/local/opt/qt',
	// 				'/opt/Qt/*/bin'
	// 			);
	// 			break;
	// 		case 'win32': // Windows
	// 			possibleBasePaths.push(
	// 				'C:\\Qt\\Tools\\QtCreator\\bin',
	// 				'C:\\Qt\\*\\bin',
	// 				'C:\\Program Files\\Qt\\*\\bin',
	// 				'C:\\Program Files (x86)\\Qt\\*\\bin'
	// 			);
	// 			break;
	// 		case 'linux': // Linux
	// 			possibleBasePaths.push(
	// 				'/usr/bin',
	// 				'/usr/local/bin',
	// 				'/opt/qt/bin',
	// 				'/opt/Qt/*/bin',
	// 				'/home/*/Qt/*/bin'
	// 			);
	// 			break;
	// 	}
		
	// 	// 工具文件名（根据平台）
	// 	const linguistName = platform === 'win32' ? 'linguist.exe' : 'linguist';
	// 	const lreleaseName = platform === 'win32' ? 'lrelease.exe' : 'lrelease';
	// 	const lupdateName = platform === 'win32' ? 'lupdate.exe' : 'lupdate';
		
	// 	// 查找工具路径
	// 	let linguistPath = '';
	// 	let lreleasePath = '';
	// 	let lupdatePath = '';
		
	// 	// 优先查找标准路径中的工具
	// 	for (const basePath of possibleBasePaths) {
	// 		try {
	// 			const expandedPaths = await expandGlobPath(basePath);
				
	// 			for (const expandedPath of expandedPaths) {
	// 				const binPath = path.join(expandedPath, 'bin');
	// 				const directPath = expandedPath;
					
	// 				// 检查bin目录和直接路径
	// 				for (const checkPath of [binPath, directPath]) {
	// 					if (!linguistPath) {
	// 						const linguistCandidate = path.join(checkPath, linguistName);
	// 						if (await fileExists(linguistCandidate) && await isExecutable(linguistCandidate)) {
	// 							linguistPath = linguistCandidate;
	// 						}
	// 					}
						
	// 					if (!lreleasePath) {
	// 						const lreleaseCandidate = path.join(checkPath, lreleaseName);
	// 						if (await fileExists(lreleaseCandidate) && await isExecutable(lreleaseCandidate)) {
	// 							lreleasePath = lreleaseCandidate;
	// 						}
	// 					}
						
	// 					if (!lupdatePath) {
	// 						const lupdateCandidate = path.join(checkPath, lupdateName);
	// 						if (await fileExists(lupdateCandidate) && await isExecutable(lupdateCandidate)) {
	// 							lupdatePath = lupdateCandidate;
	// 						}
	// 					}
	// 				}
	// 			}
	// 		} catch (e) {
	// 			continue;
	// 		}
	// 	}
		
	// 	// 在macOS上，只有在没找到标准linguist时才查找App包
	// 	if (platform === 'darwin' && !linguistPath) {
	// 		// 修正的macOS App路径
	// 		const macLinguistPaths = [
	// 			'/Applications/Qt Linguist.app/Contents/MacOS/linguist',  // 修正路径
	// 			'/Applications/Qt Creator.app/Contents/Resources/bin/linguist'  // Qt Creator内置的linguist
	// 		];
			
	// 		for (const appPath of macLinguistPaths) {
	// 			if (await fileExists(appPath) && await isExecutable(appPath)) {
	// 				linguistPath = appPath;
	// 				break;
	// 			}
	// 		}
	// 	}
		
	// 	// 最后才从系统PATH中查找
	// 	if (!linguistPath) linguistPath = await findInPath(linguistName);
	// 	if (!lreleasePath) lreleasePath = await findInPath(lreleaseName);
	// 	if (!lupdatePath) lupdatePath = await findInPath(lupdateName);
		
	// 	return {
	// 		linguist: linguistPath,
	// 		lrelease: lreleasePath,
	// 		lupdate: lupdatePath
	// 	};
	// }
	
	// 新增：检查文件是否可执行
	// async function isExecutable(filePath: string): Promise<boolean> {
	// 	try {
	// 		await fs.promises.access(filePath, fs.constants.X_OK);
	// 		return true;
	// 	} catch {
	// 		return false;
	// 	}
	// }
	// 展开glob路径
	// async function expandGlobPath(globPath: string): Promise<string[]> {
	// 	if (!globPath.includes('*')) {
	// 		return [globPath];
	// 	}
		
	// 	try {
	// 		const command = os.platform() === 'win32' 
	// 			? `dir "${globPath}" /b /ad 2>nul` 
	// 			: `ls -d ${globPath} 2>/dev/null || true`;
			
	// 		const { stdout } = await execAsync(command);
	// 		return stdout.trim() ? stdout.trim().split('\n') : [];
	// 	} catch (e) {
	// 		return [];
	// 	}
	// }
	
	// 检查文件是否存在
	// async function fileExists(filePath: string): Promise<boolean> {
	// 	try {
	// 		await fs.promises.access(filePath, fs.constants.F_OK);
	// 		return true;
	// 	} catch {
	// 		return false;
	// 	}
	// }
	
	// 在系统PATH中查找工具
	// async function findInPath(toolName: string): Promise<string> {
	// 	try {
	// 		const command = os.platform() === 'win32' 
	// 			? `where ${toolName}` 
	// 			: `which ${toolName}`;
			
	// 		const { stdout } = await execAsync(command);
	// 		return stdout.trim().split('\n')[0];
	// 	} catch {
	// 		return '';
	// 	}
	// }
	
	// 获取工作空间中的.pro文件
	// async function findProFiles(): Promise<vscode.Uri[]> {
	// 	const proFiles = await vscode.workspace.findFiles('**/*.pro', '**/node_modules/**');
	// 	return proFiles;
	// }
	
	// // 用于跟踪已打开的文件
	// const openedFiles = new Set<string>();

	// // 修复后的打开Linguist命令 - 使用简单跟踪方式
	// let openLinguistCommand = vscode.commands.registerCommand('qt-linguist.openInLinguist', async (uri: vscode.Uri) => {
	// 	try {
	// 		if (!uri.fsPath.endsWith('.ts')) {
	// 			vscode.window.showErrorMessage('只能打开 .ts 翻译文件');
	// 			return;
	// 		}
			
	// 		const filePath = path.resolve(uri.fsPath);
			
	// 		// 检查是否已经在跟踪列表中
	// 		if (openedFiles.has(filePath)) {
	// 			const choice = await vscode.window.showWarningMessage(
	// 				`文件 "${path.basename(filePath)}" 可能已经在 Qt Linguist 中打开。是否要重新打开？`,
	// 				'重新打开',
	// 				'激活现有窗口',
	// 				'取消'
	// 			);
				
	// 			if (choice === '取消') {
	// 				return;
	// 			} else if (choice === '激活现有窗口') {
	// 				// 尝试激活现有的linguist窗口
	// 				await activateLinguistWindow();
	// 				return;
	// 			}
	// 			// 如果选择"重新打开"，继续执行下面的代码
	// 		}
			
	// 		const qtPaths = await getQtPaths();
			
	// 		if (!qtPaths.linguist) {
	// 			throw new Error('未找到 Qt Linguist，请检查 Qt 安装或配置路径');
	// 		}
			
	// 		// 构建命令
	// 		let command: string;
	// 		const platform = os.platform();
			
	// 		if (platform === 'darwin') {
	// 			if (qtPaths.linguist.includes('.app/')) {
	// 				// App包格式，使用open命令，但不使用-n参数避免多实例
	// 				const appPath = qtPaths.linguist.replace('/Contents/MacOS/linguist', '');
	// 				command = `open "${appPath}" --args "${filePath}"`;
	// 			} else {
	// 				// 命令行工具
	// 				command = `"${qtPaths.linguist}" "${filePath}"`;
	// 			}
	// 		} else if (platform === 'win32') {
	// 			command = `"${qtPaths.linguist}" "${filePath}"`;
	// 		} else {
	// 			// Linux
	// 			command = `"${qtPaths.linguist}" "${filePath}"`;
	// 		}
			
	// 		console.log('执行命令:', command);
			
	// 		// 执行命令
	// 		const childProcess = exec(command, (error) => {
	// 			if (error) {
	// 				console.error('linguist进程错误:', error);
	// 				openedFiles.delete(filePath); // 如果启动失败，从跟踪列表中移除
	// 			}
	// 		});
			
	// 		// 添加到跟踪列表
	// 		openedFiles.add(filePath);
			
	// 		// 监听进程退出，从跟踪列表中移除
	// 		childProcess.on('exit', () => {
	// 			openedFiles.delete(filePath);
	// 			console.log(`Qt Linguist 进程已退出: ${path.basename(filePath)}`);
	// 		});
			
	// 		// 给进程一些时间启动
	// 		await new Promise(resolve => setTimeout(resolve, 1000));
			
	// 		vscode.window.showInformationMessage(`Qt Linguist 打开成功: ${path.basename(filePath)}`);
			
	// 	} catch (error) {
	// 		console.error('打开Qt Linguist错误:', error);
	// 		vscode.window.showErrorMessage(`无法打开 Qt Linguist: ${error}`);
			
	// 		const setPath = '设置 Qt 路径';
	// 		vscode.window.showErrorMessage('Qt 路径可能不正确，请检查设置', setPath)
	// 			.then(selection => {
	// 				if (selection === setPath) {
	// 					vscode.commands.executeCommand('workbench.action.openSettings', 'qt-linguist.qtPath');
	// 				}
	// 			});
	// 	}
	// });


	// 尝试激活现有的linguist窗口
	// async function activateLinguistWindow(): Promise<void> {
	// 	try {
	// 		const platform = os.platform();
			
	// 		if (platform === 'darwin') {
	// 			// macOS: 激活linguist应用
	// 			await fileUtils.execAsync(`osascript -e 'tell application "linguist" to activate' 2>/dev/null || osascript -e 'tell application "Qt Linguist" to activate' 2>/dev/null || true`);
	// 		} else if (platform === 'win32') {
	// 			// Windows: 尝试将linguist窗口带到前台
	// 			await fileUtils.execAsync(`powershell -Command "Add-Type -TypeDefinition 'using System; using System.Diagnostics; using System.Runtime.InteropServices; public class Win32 { [DllImport(\\"user32.dll\\")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport(\\"user32.dll\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); }'; $p = Get-Process -Name linguist -ErrorAction SilentlyContinue; if($p) { [Win32]::ShowWindow($p.MainWindowHandle, 9); [Win32]::SetForegroundWindow($p.MainWindowHandle) }"`);
	// 		} else {
	// 			// Linux: 尝试激活窗口
	// 			await fileUtils.execAsync(`wmctrl -a linguist 2>/dev/null || true`);
	// 		}
			
	// 		vscode.window.showInformationMessage('已尝试激活现有的 Qt Linguist 窗口');
	// 	} catch (error) {
	// 		console.log('激活linguist窗口失败:', error);
	// 		vscode.window.showInformationMessage('无法激活现有窗口，请手动切换到 Qt Linguist');
	// 	}
	// }

	// // 检查linguist是否已经打开了指定文件
	// async function checkIfLinguistIsOpen(filePath: string): Promise<boolean> {
	// 	try {
	// 		const platform = os.platform();
	// 		const fileName = path.basename(filePath);
	// 		const fullPath = path.resolve(filePath);
			
	// 		if (platform === 'darwin') {
	// 			// macOS: 检查进程参数
	// 			const { stdout } = await fileUtils.execAsync(`ps -eo pid,args | grep linguist`);
	// 			const processes = stdout.split('\n').filter(line => 
	// 				line.includes('linguist') && 
	// 				!line.includes('grep') && 
	// 				(line.includes(fileName) || line.includes(fullPath))
	// 			);
	// 			return processes.length > 0;
	// 		} else if (platform === 'win32') {
	// 			// Windows: 使用wmic检查进程命令行
	// 			const { stdout } = await fileUtils.execAsync(`wmic process where "name='linguist.exe'" get ProcessId,CommandLine /format:csv`);
	// 			return stdout.includes(fileName) || stdout.includes(fullPath.replace(/\\/g, '\\\\'));
	// 		} else {
	// 			// Linux: 检查进程参数
	// 			const { stdout } = await fileUtils.execAsync(`ps -eo pid,args | grep linguist`);
	// 			const processes = stdout.split('\n').filter(line => 
	// 				line.includes('linguist') && 
	// 				!line.includes('grep') && 
	// 				(line.includes(fileName) || line.includes(fullPath))
	// 			);
	// 			return processes.length > 0;
	// 		}
	// 	} catch (error) {
	// 		console.log('检查linguist进程时出错:', error);
	// 		return false; // 如果检查失败，假设没有打开
	// 	}
	// }

////////////////////////////////////////////////////////////////////////////////////////
	// 获取选中的翻译文件（支持多选和文件夹）
	// async function getSelectedTranslationFiles(uri?: vscode.Uri, uris?: vscode.Uri[]): Promise<vscode.Uri[]> {
	// 	const translationFiles: vscode.Uri[] = [];
		
	// 	// 如果传入了多个URI（多选情况）
	// 	if (uris && uris.length > 0) {
	// 		for (const selectedUri of uris) {
	// 			const stat = await vscode.workspace.fs.stat(selectedUri);
				
	// 			if (stat.type === vscode.FileType.Directory) {
	// 				// 如果是文件夹，查找其中的.ts文件
	// 				const tsFiles = await vscode.workspace.findFiles(
	// 					new vscode.RelativePattern(selectedUri, '**/*.ts'),
	// 					new vscode.RelativePattern(selectedUri, '**/node_modules/**')
	// 				);
	// 				translationFiles.push(...tsFiles);
	// 			} else if (selectedUri.fsPath.endsWith('.ts')) {
	// 				// 如果是.ts文件，直接添加
	// 				translationFiles.push(selectedUri);
	// 			}
	// 		}
	// 	} else if (uri) {
	// 		// 单个URI的情况
	// 		const stat = await vscode.workspace.fs.stat(uri);
			
	// 		if (stat.type === vscode.FileType.Directory) {
	// 			// 如果是文件夹，查找其中的.ts文件
	// 			const tsFiles = await vscode.workspace.findFiles(
	// 				new vscode.RelativePattern(uri, '**/*.ts'),
	// 				new vscode.RelativePattern(uri, '**/node_modules/**')
	// 			);
	// 			translationFiles.push(...tsFiles);
	// 		} else if (uri.fsPath.endsWith('.ts')) {
	// 			// 如果是.ts文件，直接添加
	// 			translationFiles.push(uri);
	// 		}
	// 	}
		
	// 	// 去重
	// 	const uniqueFiles = Array.from(new Set(translationFiles.map(f => f.fsPath)))
	// 		.map(path => vscode.Uri.file(path));
		
	// 	return uniqueFiles;
	// }

	// 修改后的编译翻译文件命令 - 支持多选
	// let generateQmCommand = vscode.commands.registerCommand('qt-linguist.generateQm', async (uri: vscode.Uri, uris?: vscode.Uri[]) => {
	// 	try {
	// 		const selectedFiles = await getSelectedTranslationFiles(uri, uris);
			
	// 		if (selectedFiles.length === 0) {
	// 			vscode.window.showErrorMessage('请选择 .ts 翻译文件或包含翻译文件的文件夹');
	// 			return;
	// 		}
			
	// 		const qtPaths = await getQtPaths();
			
	// 		if (!qtPaths.lrelease) {
	// 			throw new Error('未找到 lrelease 工具，请检查 Qt 安装');
	// 		}
			
	// 		// 显示进度条
	// 		await vscode.window.withProgress({
	// 			location: vscode.ProgressLocation.Notification,
	// 			title: "编译翻译文件",
	// 			cancellable: true
	// 		}, async (progress, token) => {
	// 			let compiled = 0;
	// 			let failed = 0;
	// 			const total = selectedFiles.length;
	// 			const results: string[] = [];
				
	// 			for (let i = 0; i < selectedFiles.length; i++) {
	// 				if (token.isCancellationRequested) {
	// 					break;
	// 				}
					
	// 				const file = selectedFiles[i];
	// 				progress.report({ 
	// 					increment: (i / total) * 100, 
	// 					message: `编译 ${path.basename(file.fsPath)} (${i + 1}/${total})` 
	// 				});
					
	// 				try {
	// 					const command = os.platform() === 'win32' 
	// 						? `"${qtPaths.lrelease}" "${file.fsPath}"` 
	// 						: `'${qtPaths.lrelease}' '${file.fsPath}'`;
						
	// 					const { stdout, stderr } = await execAsync(command);
						
	// 					if (stderr && !stderr.includes('Warning')) {
	// 						throw new Error(stderr);
	// 					}
						
	// 					compiled++;
	// 					const qmFile = file.fsPath.replace('.ts', '.qm');
	// 					results.push(`✓ ${path.basename(qmFile)}`);
						
	// 				} catch (error) {
	// 					failed++;
	// 					results.push(`✗ ${path.basename(file.fsPath)}: ${error}`);
	// 					console.error(`编译 ${file.fsPath} 失败:`, error);
	// 				}
	// 			}
				
	// 			progress.report({ increment: 100, message: "完成" });
				
	// 			const message = token.isCancellationRequested 
	// 				? `编译已取消: 成功 ${compiled} 个，失败 ${failed} 个`
	// 				: `编译完成: 成功 ${compiled} 个，失败 ${failed} 个`;
				
	// 			if (failed > 0) {
	// 				vscode.window.showWarningMessage(message, '查看详情').then(selection => {
	// 					if (selection === '查看详情') {
	// 						showCompileResults(results);
	// 					}
	// 				});
	// 			} else {
	// 				vscode.window.showInformationMessage(message);
	// 			}
	// 		});
			
	// 	} catch (error) {
	// 		vscode.window.showErrorMessage(`编译翻译文件失败: ${error}`);
	// 	}
	// });

	// 显示编译结果的辅助函数
	// async function showCompileResults(results: string[]): Promise<void> {
	// 	if (results.length === 0) {
	// 		vscode.window.showInformationMessage('没有编译结果信息');
	// 		return;
	// 	}
		
	// 	const doc = await vscode.workspace.openTextDocument({
	// 		content: `Qt Linguist 编译结果\n${'='.repeat(40)}\n\n${results.join('\n')}`,
	// 		language: 'plaintext'
	// 	});
		
	// 	await vscode.window.showTextDocument(doc);
	// }

	// 注册命令：编译翻译文件（lrelease）
	// let generateQmCommand = vscode.commands.registerCommand('qt-linguist.generateQm', async (uri: vscode.Uri) => {
	// 	try {
	// 		if (!uri.fsPath.endsWith('.ts')) {
	// 			vscode.window.showErrorMessage('只能处理 .ts 翻译文件');
	// 			return;
	// 		}
			
	// 		const qtPaths = await getQtPaths();
			
	// 		if (!qtPaths.lrelease) {
	// 			throw new Error('未找到 lrelease 工具，请检查 Qt 安装');
	// 		}
			
	// 		// 显示进度条
	// 		await vscode.window.withProgress({
	// 			location: vscode.ProgressLocation.Notification,
	// 			title: "编译翻译文件",
	// 			cancellable: false
	// 		}, async (progress) => {
	// 			progress.report({ increment: 0, message: "正在编译..." });
				
	// 			const command = os.platform() === 'win32' 
	// 				? `"${qtPaths.lrelease}" "${uri.fsPath}"` 
	// 				: `'${qtPaths.lrelease}' '${uri.fsPath}'`;
				
	// 			const { stdout, stderr } = await execAsync(command);
				
	// 			progress.report({ increment: 100, message: "完成" });
				
	// 			if (stderr && !stderr.includes('Warning')) {
	// 				throw new Error(stderr);
	// 			}
				
	// 			const qmFile = uri.fsPath.replace('.ts', '.qm');
	// 			vscode.window.showInformationMessage(`翻译文件编译完成: ${path.basename(qmFile)}`);
	// 		});
			
	// 	} catch (error) {
	// 		vscode.window.showErrorMessage(`编译翻译文件失败: ${error}`);
	// 	}
	// });

	// 注册命令：更新翻译文件（lupdate）
	// let updateTranslationCommand = vscode.commands.registerCommand('qt-linguist.updateTranslation', async (uri?: vscode.Uri) => {
	// 	try {
	// 		const qtPaths = await getQtPaths();
			
	// 		if (!qtPaths.lupdate) {
	// 			throw new Error('未找到 lupdate 工具，请检查 Qt 安装');
	// 		}
			
	// 		// 如果没有传入URI，尝试查找.pro文件
	// 		if (!uri) {
	// 			const proFiles = await findProFiles();
	// 			if (proFiles.length === 0) {
	// 				vscode.window.showErrorMessage('未找到 .pro 文件，请选择项目文件或.ts文件');
	// 				return;
	// 			} else if (proFiles.length === 1) {
	// 				uri = proFiles[0];
	// 			} else {
	// 				// 多个.pro文件，让用户选择
	// 				const items = proFiles.map(file => ({
	// 					label: path.basename(file.fsPath),
	// 					description: file.fsPath,
	// 					uri: file
	// 				}));
					
	// 				const selected = await vscode.window.showQuickPick(items, {
	// 					placeHolder: '选择要更新的项目文件'
	// 				});
					
	// 				if (!selected) return;
	// 				uri = selected.uri;
	// 			}
	// 		}
			
	// 		// 显示进度条
	// 		await vscode.window.withProgress({
	// 			location: vscode.ProgressLocation.Notification,
	// 			title: "更新翻译文件",
	// 			cancellable: false
	// 		}, async (progress) => {
	// 			progress.report({ increment: 0, message: "正在扫描源码..." });
				
	// 			let command = '';
	// 			if (uri!.fsPath.endsWith('.pro')) {
	// 				// 从.pro文件更新
	// 				command = os.platform() === 'win32' 
	// 					? `"${qtPaths.lupdate}" "${uri!.fsPath}"` 
	// 					: `'${qtPaths.lupdate}' '${uri!.fsPath}'`;
	// 			} else if (uri!.fsPath.endsWith('.ts')) {
	// 				// 直接更新.ts文件（需要指定源文件）
	// 				const sourceDir = path.dirname(uri!.fsPath);
	// 				command = os.platform() === 'win32' 
	// 					? `"${qtPaths.lupdate}" "${sourceDir}" -ts "${uri!.fsPath}"` 
	// 					: `'${qtPaths.lupdate}' '${sourceDir}' -ts '${uri!.fsPath}'`;
	// 			} else {
	// 				throw new Error('请选择 .pro 或 .ts 文件进行更新');
	// 			}
				
	// 			const { stdout, stderr } = await execAsync(command);
				
	// 			progress.report({ increment: 100, message: "完成" });
				
	// 			if (stderr && !stderr.includes('Warning')) {
	// 				throw new Error(stderr);
	// 			}
				
	// 			vscode.window.showInformationMessage('翻译文件更新完成');
				
	// 			// 显示更新统计信息
	// 			if (stdout) {
	// 				const lines = stdout.split('\n').filter(line => line.trim());
	// 				if (lines.length > 0) {
	// 					vscode.window.showInformationMessage(`更新统计: ${lines[lines.length - 1]}`);
	// 				}
	// 			}
	// 		});
			
	// 	} catch (error) {
	// 		vscode.window.showErrorMessage(`更新翻译文件失败: ${error}`);
	// 	}
	// });
	//注册命令：更新翻译文件
	// let updateTranslationCommand = vscode.commands.registerCommand('qt-linguist.updateTranslation', async (uri: vscode.Uri, uris?: vscode.Uri[]) => {
	// try {
	// 		const selectedFiles = await getSelectedTranslationFiles(uri, uris);
			
	// 		if (selectedFiles.length === 0) {
	// 			vscode.window.showErrorMessage('请选择.ts项目文件或包含源代码的文件夹');
	// 			return;
	// 		}

	// 		const qtPaths = await getQtPaths();
			
	// 		if (!qtPaths.lupdate) {
	// 			throw new Error('未找到 lupdate 工具，请检查 Qt 安装');
	// 		}

	// 		await vscode.window.withProgress({
	// 			location: vscode.ProgressLocation.Notification,
	// 			title: "更新翻译文件",
	// 			cancellable: true
	// 		}, async (progress, token) => {
	// 			let updated = 0;
	// 			let failed = 0;
	// 			const total = selectedFiles.length;
	// 			const results: string[] = [];

	// 			for (let i = 0; i < selectedFiles.length; i++) {
	// 				if (token.isCancellationRequested) break;

	// 				const file = selectedFiles[i];
	// 				progress.report({
	// 					increment: (i / total) * 100,
	// 					message: `处理 ${path.basename(file.fsPath)} (${i + 1}/${total})`
	// 				});

	// 				try {
	// 					const isDir = (await fs.promises.stat(file.fsPath)).isDirectory();
	// 					const targetPath = isDir ? file.fsPath : path.dirname(file.fsPath);
						
	// 					const command = os.platform() === 'win32'
	// 						? `"${qtPaths.lupdate}" "${targetPath}" -ts ${selectedFiles.map(f => `"${f.fsPath}"`).join(' ')}`
	// 						: `'${qtPaths.lupdate}' '${targetPath}' -ts ${selectedFiles.map(f => `'${f.fsPath}'`).join(' ')}`;

	// 					const { stdout, stderr } = await execAsync(command);

	// 					if (stderr && !stderr.includes('Warning')) {
	// 						throw new Error(stderr);
	// 					}

	// 					updated++;
	// 					results.push(`✓ 更新成功: ${path.basename(file.fsPath)}`);

	// 				} catch (error) {
	// 					failed++;
	// 					results.push(`✗ 更新失败: ${path.basename(file.fsPath)}: ${error}`);
	// 					console.error(`更新 ${file.fsPath} 失败:`, error);
	// 				}
	// 			}

	// 			progress.report({ increment: 100, message: "完成" });

	// 			const message = token.isCancellationRequested
	// 				? `更新已取消: 成功 ${updated} 个，失败 ${failed} 个`
	// 				: `更新完成: 成功 ${updated} 个，失败 ${failed} 个`;

	// 			if (failed > 0) {
	// 				vscode.window.showWarningMessage(message, '查看详情').then(selection => {
	// 					if (selection === '查看详情') {
	// 						showUpdateResults(results);
	// 					}
	// 				});
	// 			} else {
	// 				vscode.window.showInformationMessage(message);
	// 			}
	// 		});

	// 	} catch (error) {
	// 		vscode.window.showErrorMessage(`更新翻译文件失败: ${error}`);
	// 	}

	// });

	
	// 注册命令：批量编译工作空间中的所有.ts文件
	// let compileAllCommand = vscode.commands.registerCommand('qt-linguist.compileAll', async () => {
	// 	try {
	// 		const qtPaths = await getQtPaths();
			
	// 		if (!qtPaths.lrelease) {
	// 			throw new Error('未找到 lrelease 工具，请检查 Qt 安装');
	// 		}
			
	// 		// 查找所有.ts文件
	// 		const tsFiles = await vscode.workspace.findFiles('**/*.ts', '**/node_modules/**');
			
	// 		if (tsFiles.length === 0) {
	// 			vscode.window.showInformationMessage('未找到任何 .ts 翻译文件');
	// 			return;
	// 		}
			
	// 		// 显示进度条
	// 		await vscode.window.withProgress({
	// 			location: vscode.ProgressLocation.Notification,
	// 			title: "批量编译翻译文件",
	// 			cancellable: false
	// 		}, async (progress) => {
	// 			let compiled = 0;
	// 			const total = tsFiles.length;
				
	// 			for (const tsFile of tsFiles) {
	// 				progress.report({ 
	// 					increment: (compiled / total) * 100, 
	// 					message: `编译 ${path.basename(tsFile.fsPath)} (${compiled + 1}/${total})` 
	// 				});
					
	// 				try {
	// 					const command = os.platform() === 'win32' 
	// 						? `"${qtPaths.lrelease}" "${tsFile.fsPath}"` 
	// 						: `'${qtPaths.lrelease}' '${tsFile.fsPath}'`;
						
	// 					await fileUtils.execAsync(command);
	// 					compiled++;
	// 				} catch (error) {
	// 					console.error(`编译 ${tsFile.fsPath} 失败:`, error);
	// 				}
	// 			}
				
	// 			progress.report({ increment: 100, message: "完成" });
	// 			vscode.window.showInformationMessage(`批量编译完成: ${compiled}/${total} 个文件`);
	// 		});
			
	// 	} catch (error) {
	// 		vscode.window.showErrorMessage(`批量编译失败: ${error}`);
	// 	}
	// });

	// 注册命令：批量更新工作空间中的所有翻译文件
	// let updateAllCommand = vscode.commands.registerCommand('qt-linguist.updateAll', async () => {
	// 	try {
	// 		const qtPaths = await getQtPaths();
			
	// 		if (!qtPaths.lupdate) {
	// 			throw new Error('未找到 lupdate 工具，请检查 Qt 安装');
	// 		}
			
	// 		// 查找所有.ts文件
	// 		const tsFiles = await vscode.workspace.findFiles('**/*.ts', '**/node_modules/**');
			
	// 		if (tsFiles.length === 0) {
	// 			vscode.window.showInformationMessage('未找到任何 .ts 翻译文件');
	// 			return;
	// 		}
			
	// 		// 询问用户更新策略
	// 		const strategy = await vscode.window.showQuickPick([
	// 			{
	// 				label: '$(file-directory) 按目录分组更新',
	// 				description: '每个目录执行一次 lupdate，包含该目录下的所有 .ts 文件',
	// 				value: 'byDirectory'
	// 			},
	// 			{
	// 				label: '$(file) 逐个文件更新',
	// 				description: '为每个 .ts 文件单独执行 lupdate',
	// 				value: 'individual'
	// 			},
	// 			{
	// 				label: '$(project) 从 .pro 文件更新',
	// 				description: '查找 .pro 文件并使用它们来更新翻译文件',
	// 				value: 'fromPro'
	// 			}
	// 		], {
	// 			placeHolder: '选择批量更新策略'
	// 		});
			
	// 		if (!strategy) return;
			
	// 		// 显示进度条
	// 		await vscode.window.withProgress({
	// 			location: vscode.ProgressLocation.Notification,
	// 			title: "批量更新翻译文件",
	// 			cancellable: true
	// 		}, async (progress, token) => {
	// 			let updated = 0;
	// 			let failed = 0;
	// 			const results: string[] = [];
				
	// 			if (strategy.value === 'fromPro') {
	// 				// 从.pro文件更新
	// 				const proFiles = await fileUtils.findProFiles();
					
	// 				if (proFiles.length === 0) {
	// 					throw new Error('未找到 .pro 文件，请选择其他更新策略');
	// 				}
					
	// 				const total = proFiles.length;
					
	// 				for (let i = 0; i < proFiles.length; i++) {
	// 					if (token.isCancellationRequested) {
	// 						break;
	// 					}
						
	// 					const proFile = proFiles[i];
	// 					progress.report({ 
	// 						increment: (i / total) * 100, 
	// 						message: `更新 ${path.basename(proFile.fsPath)} (${i + 1}/${total})` 
	// 					});
						
	// 					try {
	// 						const command = os.platform() === 'win32' 
	// 							? `"${qtPaths.lupdate}" "${proFile.fsPath}"` 
	// 							: `'${qtPaths.lupdate}' '${proFile.fsPath}'`;
							
	// 						const { stdout, stderr } = await fileUtils.execAsync(command);
	// 						updated++;
							
	// 						// 收集输出信息
	// 						if (stdout) {
	// 							const lines = stdout.split('\n').filter(line => line.trim());
	// 							if (lines.length > 0) {
	// 								results.push(`${path.basename(proFile.fsPath)}: ${lines[lines.length - 1]}`);
	// 							}
	// 						}
							
	// 					} catch (error) {
	// 						failed++;
	// 						results.push(`${path.basename(proFile.fsPath)}: 更新失败 - ${error}`);
	// 						console.error(`更新 ${proFile.fsPath} 失败:`, error);
	// 					}
	// 				}
					
	// 			} else if (strategy.value === 'byDirectory') {
	// 				// 按目录分组更新
	// 				const dirGroups = new Map<string, vscode.Uri[]>();
					
	// 				// 按目录分组
	// 				tsFiles.forEach(file => {
	// 					const dir = path.dirname(file.fsPath);
	// 					if (!dirGroups.has(dir)) {
	// 						dirGroups.set(dir, []);
	// 					}
	// 					dirGroups.get(dir)!.push(file);
	// 				});
					
	// 				const directories = Array.from(dirGroups.keys());
	// 				const total = directories.length;
					
	// 				for (let i = 0; i < directories.length; i++) {
	// 					if (token.isCancellationRequested) {
	// 						break;
	// 					}
						
	// 					const dir = directories[i];
	// 					const files = dirGroups.get(dir)!;
						
	// 					progress.report({ 
	// 						increment: (i / total) * 100, 
	// 						message: `更新目录 ${path.basename(dir)} (${files.length} 个文件) (${i + 1}/${total})` 
	// 					});
						
	// 					try {
	// 						// 构建包含所有.ts文件的命令
	// 						const tsFilePaths = files.map(f => `"${f.fsPath}"`).join(' ');
	// 						const command = os.platform() === 'win32' 
	// 							? `"${qtPaths.lupdate}" "${dir}" -ts ${tsFilePaths}` 
	// 							: `'${qtPaths.lupdate}' '${dir}' -ts ${tsFilePaths}`;
							
	// 						const { stdout, stderr } = await fileUtils.execAsync(command);
	// 						updated += files.length;
							
	// 						// 收集输出信息
	// 						if (stdout) {
	// 							const lines = stdout.split('\n').filter(line => line.trim());
	// 							if (lines.length > 0) {
	// 								results.push(`${path.basename(dir)} (${files.length}个文件): ${lines[lines.length - 1]}`);
	// 							}
	// 						}
							
	// 					} catch (error) {
	// 						failed += files.length;
	// 						results.push(`${path.basename(dir)}: 更新失败 - ${error}`);
	// 						console.error(`更新目录 ${dir} 失败:`, error);
	// 					}
	// 				}
					
	// 			} else {
	// 				// 逐个文件更新
	// 				const total = tsFiles.length;
					
	// 				for (let i = 0; i < tsFiles.length; i++) {
	// 					if (token.isCancellationRequested) {
	// 						break;
	// 					}
						
	// 					const tsFile = tsFiles[i];
	// 					progress.report({ 
	// 						increment: (i / total) * 100, 
	// 						message: `更新 ${path.basename(tsFile.fsPath)} (${i + 1}/${total})` 
	// 					});
						
	// 					try {
	// 						const sourceDir = path.dirname(tsFile.fsPath);
	// 						const command = os.platform() === 'win32' 
	// 							? `"${qtPaths.lupdate}" "${sourceDir}" -ts "${tsFile.fsPath}"` 
	// 							: `'${qtPaths.lupdate}' '${sourceDir}' -ts '${tsFile.fsPath}'`;
							
	// 						const { stdout, stderr } = await fileUtils.execAsync(command);
	// 						updated++;
							
	// 						// 收集输出信息
	// 						if (stdout) {
	// 							const lines = stdout.split('\n').filter(line => line.trim());
	// 							if (lines.length > 0) {
	// 								results.push(`${path.basename(tsFile.fsPath)}: ${lines[lines.length - 1]}`);
	// 							}
	// 						}
							
	// 					} catch (error) {
	// 						failed++;
	// 						results.push(`${path.basename(tsFile.fsPath)}: 更新失败 - ${error}`);
	// 						console.error(`更新 ${tsFile.fsPath} 失败:`, error);
	// 					}
	// 				}
	// 			}
				
	// 			progress.report({ increment: 100, message: "完成" });
				
	// 			// 显示结果
	// 			const message = token.isCancellationRequested 
	// 				? `批量更新已取消: 成功 ${updated} 个，失败 ${failed} 个`
	// 				: `批量更新完成: 成功 ${updated} 个，失败 ${failed} 个`;
				
	// 			if (failed > 0) {
	// 				vscode.window.showWarningMessage(message, '查看详情').then(selection => {
	// 					if (selection === '查看详情') {
	// 						showUpdateResults(results);
	// 					}
	// 				});
	// 			} else {
	// 				vscode.window.showInformationMessage(message, '查看详情').then(selection => {
	// 					if (selection === '查看详情') {
	// 						showUpdateResults(results);
	// 					}
	// 				});
	// 			}
	// 		});
			
	// 	} catch (error) {
	// 		vscode.window.showErrorMessage(`批量更新翻译文件失败: ${error}`);
	// 	}
	// });

	// // 显示更新结果的辅助函数
	// async function showUpdateResults(results: string[]): Promise<void> {
	// 	if (results.length === 0) {
	// 		vscode.window.showInformationMessage('没有更新结果信息');
	// 		return;
	// 	}
		
	// 	// 创建一个新的文档来显示结果
	// 	const doc = await vscode.workspace.openTextDocument({
	// 		content: `Qt Linguist 批量更新结果\n${'='.repeat(40)}\n\n${results.join('\n\n')}`,
	// 		language: 'plaintext'
	// 	});
		
	// 	await vscode.window.showTextDocument(doc);
	// }






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