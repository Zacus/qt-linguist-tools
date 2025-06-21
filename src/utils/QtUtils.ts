import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as fileUtils from "./FileUtils";

export interface QtPaths {
  linguist: string;
  lrelease: string;
  lupdate: string;
}

// 获取Qt工具路径
export async function getQtPaths(): Promise<QtPaths> {
  const config = vscode.workspace.getConfiguration("qt-linguist");
  const customQtPath = config.get("qtPath", "");
  const platform = os.platform();

  // 根据平台定义可能的Qt路径
  const possibleBasePaths = [];

  if (customQtPath) {
    possibleBasePaths.push(customQtPath);
  }

  switch (platform) {
    case "darwin": // macOS
      possibleBasePaths.push(
        "/opt/homebrew/opt/qt",
        "/usr/local/opt/qt",
        "/opt/Qt/*/bin"
      );
      break;
    case "win32": // Windows
      possibleBasePaths.push(
        "C:\\Qt\\Tools\\QtCreator\\bin",
        "C:\\Qt\\*\\bin",
        "C:\\Program Files\\Qt\\*\\bin",
        "C:\\Program Files (x86)\\Qt\\*\\bin"
      );
      break;
    case "linux": // Linux
      possibleBasePaths.push(
        "/usr/bin",
        "/usr/local/bin",
        "/opt/qt/bin",
        "/opt/Qt/*/bin",
        "/home/*/Qt/*/bin"
      );
      break;
  }

  // 工具文件名（根据平台）
  const linguistName = platform === "win32" ? "linguist.exe" : "linguist";
  const lreleaseName = platform === "win32" ? "lrelease.exe" : "lrelease";
  const lupdateName = platform === "win32" ? "lupdate.exe" : "lupdate";

  // 查找工具路径
  let linguistPath = "";
  let lreleasePath = "";
  let lupdatePath = "";

  // 优先查找标准路径中的工具
  for (const basePath of possibleBasePaths) {
    try {
      const expandedPaths = await fileUtils.expandGlobPath(basePath);

      for (const expandedPath of expandedPaths) {
        const binPath = path.join(expandedPath, "bin");
        const directPath = expandedPath;

        // 检查bin目录和直接路径
        for (const checkPath of [binPath, directPath]) {
          if (!linguistPath) {
            const linguistCandidate = path.join(checkPath, linguistName);
            if (
              (await fileUtils.fileExists(linguistCandidate)) &&
              (await fileUtils.isExecutable(linguistCandidate))
            ) {
              linguistPath = linguistCandidate;
            }
          }

          if (!lreleasePath) {
            const lreleaseCandidate = path.join(checkPath, lreleaseName);
            if (
              (await fileUtils.fileExists(lreleaseCandidate)) &&
              (await fileUtils.isExecutable(lreleaseCandidate))
            ) {
              lreleasePath = lreleaseCandidate;
            }
          }

          if (!lupdatePath) {
            const lupdateCandidate = path.join(checkPath, lupdateName);
            if (
              (await fileUtils.fileExists(lupdateCandidate)) &&
              (await fileUtils.isExecutable(lupdateCandidate))
            ) {
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
  if (platform === "darwin" && !linguistPath) {
    // 修正的macOS App路径
    const macLinguistPaths = [
      "/Applications/Qt Linguist.app/Contents/MacOS/linguist", // 修正路径
      "/Applications/Qt Creator.app/Contents/Resources/bin/linguist", // Qt Creator内置的linguist
    ];

    for (const appPath of macLinguistPaths) {
      if (
        (await fileUtils.fileExists(appPath)) &&
        (await fileUtils.isExecutable(appPath))
      ) {
        linguistPath = appPath;
        break;
      }
    }
  }

  // 最后才从系统PATH中查找
  if (!linguistPath) linguistPath = await fileUtils.findInPath(linguistName);
  if (!lreleasePath) lreleasePath = await fileUtils.findInPath(lreleaseName);
  if (!lupdatePath) lupdatePath = await fileUtils.findInPath(lupdateName);

  return {
    linguist: linguistPath,
    lrelease: lreleasePath,
    lupdate: lupdatePath,
  };
}
