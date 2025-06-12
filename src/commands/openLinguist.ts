import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fileUtils from '../utils/FileUtils';
import {getQtPaths} from '../utils/QtUtils'
import { exec } from 'child_process';
    // 用于跟踪已打开的文件
    const openedFiles = new Set<string>();

    // 修复后的打开Linguist命令 - 使用简单跟踪方式
    const openLinguistCommand = vscode.commands.registerCommand('qt-linguist.openInLinguist', async (uri: vscode.Uri) => {
        try {
            if (!uri.fsPath.endsWith('.ts')) {
                vscode.window.showErrorMessage('只能打开 .ts 翻译文件');
                return;
            }
            
            const filePath = path.resolve(uri.fsPath);
            
            // 检查是否已经在跟踪列表中
            if (openedFiles.has(filePath)) {
                const choice = await vscode.window.showWarningMessage(
                    `文件 "${path.basename(filePath)}" 可能已经在 Qt Linguist 中打开。是否要重新打开？`,
                    '重新打开',
                    '激活现有窗口',
                    '取消'
                );
                
                if (choice === '取消') {
                    return;
                } else if (choice === '激活现有窗口') {
                    // 尝试激活现有的linguist窗口
                    await activateLinguistWindow();
                    return;
                }
                // 如果选择"重新打开"，继续执行下面的代码
            }
            
            const qtPaths = await getQtPaths();
            
            if (!qtPaths.linguist) {
                throw new Error('未找到 Qt Linguist，请检查 Qt 安装或配置路径');
            }
            
            // 构建命令
            let command: string;
            const platform = os.platform();
            
            if (platform === 'darwin') {
                if (qtPaths.linguist.includes('.app/')) {
                    // App包格式，使用open命令，但不使用-n参数避免多实例
                    const appPath = qtPaths.linguist.replace('/Contents/MacOS/linguist', '');
                    command = `open "${appPath}" --args "${filePath}"`;
                } else {
                    // 命令行工具
                    command = `"${qtPaths.linguist}" "${filePath}"`;
                }
            } else if (platform === 'win32') {
                command = `"${qtPaths.linguist}" "${filePath}"`;
            } else {
                // Linux
                command = `"${qtPaths.linguist}" "${filePath}"`;
            }
            
            console.log('执行命令:', command);
            
            // 执行命令
            const childProcess = exec(command, (error) => {
                if (error) {
                    console.error('linguist进程错误:', error);
                    openedFiles.delete(filePath); // 如果启动失败，从跟踪列表中移除
                }
            });
            
            // 添加到跟踪列表
            openedFiles.add(filePath);
            
            // 监听进程退出，从跟踪列表中移除
            childProcess.on('exit', () => {
                openedFiles.delete(filePath);
                console.log(`Qt Linguist 进程已退出: ${path.basename(filePath)}`);
            });
            
            // 给进程一些时间启动
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            vscode.window.showInformationMessage(`Qt Linguist 打开成功: ${path.basename(filePath)}`);
            
        } catch (error) {
            console.error('打开Qt Linguist错误:', error);
            vscode.window.showErrorMessage(`无法打开 Qt Linguist: ${error}`);
            
            const setPath = '设置 Qt 路径';
            vscode.window.showErrorMessage('Qt 路径可能不正确，请检查设置', setPath)
                .then(selection => {
                    if (selection === setPath) {
                        vscode.commands.executeCommand('workbench.action.openSettings', 'qt-linguist.qtPath');
                    }
                });
        }
    });


    // 尝试激活现有的linguist窗口
    async function activateLinguistWindow(): Promise<void> {
        try {
            const platform = os.platform();
            
            if (platform === 'darwin') {
                // macOS: 激活linguist应用
                await fileUtils.execAsync(`osascript -e 'tell application "linguist" to activate' 2>/dev/null || osascript -e 'tell application "Qt Linguist" to activate' 2>/dev/null || true`);
            } else if (platform === 'win32') {
                // Windows: 尝试将linguist窗口带到前台
                await fileUtils.execAsync(`powershell -Command "Add-Type -TypeDefinition 'using System; using System.Diagnostics; using System.Runtime.InteropServices; public class Win32 { [DllImport(\\"user32.dll\\")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport(\\"user32.dll\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); }'; $p = Get-Process -Name linguist -ErrorAction SilentlyContinue; if($p) { [Win32]::ShowWindow($p.MainWindowHandle, 9); [Win32]::SetForegroundWindow($p.MainWindowHandle) }"`);
            } else {
                // Linux: 尝试激活窗口
                await fileUtils.execAsync(`wmctrl -a linguist 2>/dev/null || true`);
            }
            
            vscode.window.showInformationMessage('已尝试激活现有的 Qt Linguist 窗口');
        } catch (error) {
            console.log('激活linguist窗口失败:', error);
            vscode.window.showInformationMessage('无法激活现有窗口，请手动切换到 Qt Linguist');
        }
    }

    // 检查linguist是否已经打开了指定文件
    async function checkIfLinguistIsOpen(filePath: string): Promise<boolean> {
        try {
            const platform = os.platform();
            const fileName = path.basename(filePath);
            const fullPath = path.resolve(filePath);
            
            if (platform === 'darwin') {
                // macOS: 检查进程参数
                const { stdout } = await fileUtils.execAsync(`ps -eo pid,args | grep linguist`);
                const processes = stdout.split('\n').filter(line => 
                    line.includes('linguist') && 
                    !line.includes('grep') && 
                    (line.includes(fileName) || line.includes(fullPath))
                );
                return processes.length > 0;
            } else if (platform === 'win32') {
                // Windows: 使用wmic检查进程命令行
                const { stdout } = await fileUtils.execAsync(`wmic process where "name='linguist.exe'" get ProcessId,CommandLine /format:csv`);
                return stdout.includes(fileName) || stdout.includes(fullPath.replace(/\\/g, '\\\\'));
            } else {
                // Linux: 检查进程参数
                const { stdout } = await fileUtils.execAsync(`ps -eo pid,args | grep linguist`);
                const processes = stdout.split('\n').filter(line => 
                    line.includes('linguist') && 
                    !line.includes('grep') && 
                    (line.includes(fileName) || line.includes(fullPath))
                );
                return processes.length > 0;
            }
        } catch (error) {
            console.log('检查linguist进程时出错:', error);
            return false; // 如果检查失败，假设没有打开
        }
    }


    export default openLinguistCommand;