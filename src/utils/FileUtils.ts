/*
 * @Author: zs
 * @Date: 2025-06-12 21:47:24
 * @LastEditors: zs
 * @LastEditTime: 2025-06-21 16:13:32
 * @FilePath: /qt-linguist-tools/qt-linguist/src/utils/FileUtils.ts
 * @Description: 文件操作工具
 *
 * Copyright (c) 2025 by zs, All Rights Reserved.
 */
import * as vscode from "vscode";
import { promisify } from "util";
import { exec } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const execAsync = promisify(exec);
// 获取选中的翻译文件（支持多选和文件夹）
export async function getSelectedTranslationFiles(
  uri?: vscode.Uri,
  uris?: vscode.Uri[]
): Promise<vscode.Uri[]> {
  const translationFiles: vscode.Uri[] = [];

  // 如果传入了多个URI（多选情况）
  if (uris && uris.length > 0) {
    for (const selectedUri of uris) {
      const stat = await vscode.workspace.fs.stat(selectedUri);

      if (stat.type === vscode.FileType.Directory) {
        // 如果是文件夹，查找其中的.ts文件
        const tsFiles = await vscode.workspace.findFiles(
          new vscode.RelativePattern(selectedUri, "**/*.ts"),
          new vscode.RelativePattern(selectedUri, "**/node_modules/**")
        );
        translationFiles.push(...tsFiles);
      } else if (selectedUri.fsPath.endsWith(".ts")) {
        // 如果是.ts文件，直接添加
        translationFiles.push(selectedUri);
      }
    }
  } else if (uri) {
    // 单个URI的情况
    const stat = await vscode.workspace.fs.stat(uri);

    if (stat.type === vscode.FileType.Directory) {
      // 如果是文件夹，查找其中的.ts文件
      const tsFiles = await vscode.workspace.findFiles(
        new vscode.RelativePattern(uri, "**/*.ts"),
        new vscode.RelativePattern(uri, "**/node_modules/**")
      );
      translationFiles.push(...tsFiles);
    } else if (uri.fsPath.endsWith(".ts")) {
      // 如果是.ts文件，直接添加
      translationFiles.push(uri);
    }
  }

  // 去重
  const uniqueFiles = Array.from(
    new Set(translationFiles.map((f) => f.fsPath))
  ).map((path) => vscode.Uri.file(path));

  return uniqueFiles;
}

// 新增：检查文件是否可执行
export async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
// 展开glob路径
export async function expandGlobPath(globPath: string): Promise<string[]> {
  if (!globPath.includes("*")) {
    return [globPath];
  }

  try {
    const command =
      os.platform() === "win32"
        ? `dir "${globPath}" /b /ad 2>nul`
        : `ls -d ${globPath} 2>/dev/null || true`;

    const { stdout } = await execAsync(command);
    return stdout.trim() ? stdout.trim().split("\n") : [];
  } catch (e) {
    return [];
  }
}

// 在系统PATH中查找工具
export async function findInPath(toolName: string): Promise<string> {
  try {
    const command =
      os.platform() === "win32" ? `where ${toolName}` : `which ${toolName}`;

    const { stdout } = await execAsync(command);
    return stdout.trim().split("\n")[0];
  } catch {
    return "";
  }
}

// 检查文件是否存在
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
// 获取工作空间中的.pro文件
export async function findProFiles(): Promise<vscode.Uri[]> {
  const proFiles = await vscode.workspace.findFiles(
    "**/*.pro",
    "**/node_modules/**"
  );
  return proFiles;
}

/**
 * 验证文件是否存在且有效
 */
export async function validateFiles(
  files: vscode.Uri[]
): Promise<vscode.Uri[]> {
  const validFiles: vscode.Uri[] = [];

  for (const file of files) {
    try {
      await fs.promises.access(file.fsPath, fs.constants.R_OK);
      validFiles.push(file);
    } catch (error) {
      console.warn(`文件无法访问: ${file.fsPath}`, error);
    }
  }

  return validFiles;
}

/**
 * 过滤出有效的TS文件
 */
export async function filterTsFiles(files: vscode.Uri[]): Promise<{
  validFiles: vscode.Uri[];
  invalidFiles: string[];
}> {
  const validFiles: vscode.Uri[] = [];
  const invalidFiles: string[] = [];

  for (const file of files) {
    try {
      const stats = await fs.promises.stat(file.fsPath);

      if (stats.isDirectory()) {
        // 如果是目录，查找其中的.ts文件
        const dirFiles = await fs.promises.readdir(file.fsPath);
        const tsFiles = dirFiles
          .filter((f) => f.toLowerCase().endsWith(".ts"))
          .map((f) => vscode.Uri.file(path.join(file.fsPath, f)));

        validFiles.push(...tsFiles);
      } else if (file.fsPath.toLowerCase().endsWith(".ts")) {
        // 验证文件可访问性
        await fs.promises.access(file.fsPath, fs.constants.R_OK);
        validFiles.push(file);
      } else {
        invalidFiles.push(`${path.basename(file.fsPath)} (不是.ts文件)`);
      }
    } catch (error) {
      invalidFiles.push(`${path.basename(file.fsPath)} (无法访问)`);
    }
  }

  return { validFiles, invalidFiles };
}

//获取路径的绝对路径
export function getAbsoluteDir(filepath: string): string {
  // 使用绝对路径确保一致性
  const absoluteDir = path.resolve(path.dirname(filepath));

  // Windows下统一大小写
  const normalizedDir =
    process.platform === "win32" ? absoluteDir.toLowerCase() : absoluteDir;
  return normalizedDir;
}
