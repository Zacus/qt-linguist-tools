/*
 * @Author: zs
 * @Date: 2025-06-11 18:42:54
 * @LastEditors: zs
 * @LastEditTime: 2025-06-21 16:13:40
 * @FilePath: /qt-linguist-tools/qt-linguist/src/test/extension.test.ts
 * @Description: 
 * 
 * Copyright (c) 2025 by zs, All Rights Reserved. 
 */
import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

suite("Qt Linguist Extension Test Suite", () => {
  const testDir = path.join(__dirname, "../../src/test/testFiles");
  const testTsFile = path.join(testDir, "test.ts");
  const testTxtFile = path.join(testDir, "test.txt");

  // 在测试开始前创建测试文件
  suiteSetup(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    // 创建测试用的 ts 文件
    fs.writeFileSync(
      testTsFile,
      '<?xml version="1.0" encoding="utf-8"?><TS version="2.1"></TS>'
    );
    // 创建普通文本文件
    fs.writeFileSync(testTxtFile, "test content");
  });

  // 在所有测试结束后清理
  suiteTeardown(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  test("1. 扩展应该被正确激活", async () => {
    // 使用完整的扩展 ID，包含发布者名称
    const extensionId = "user.qt-linguist";
    const ext = vscode.extensions.getExtension(extensionId);
    assert.ok(ext, `扩展 ${extensionId} 未找到`);

    if (!ext.isActive) {
      await ext.activate();
    }
    assert.strictEqual(ext.isActive, true, "扩展未激活");
  });

  test("2. Qt Linguist 命令应该被正确注册", async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(
      commands.includes("qt-linguist.openInLinguist"),
      "未找到 openInLinguist 命令"
    );
  });

  test("3. 对非 .ts 文件应该拒绝打开", async () => {
    try {
      await vscode.commands.executeCommand(
        "qt-linguist.openInLinguist",
        vscode.Uri.file(testTxtFile)
      );
      assert.fail("应该拒绝打开非 .ts 文件");
    } catch (error) {
      assert.ok(error, "没有正确处理非 .ts 文件的情况");
    }
  });

  test("4. 应该能正确打开 .ts 文件", async () => {
    try {
      await vscode.commands.executeCommand(
        "qt-linguist.openInLinguist",
        vscode.Uri.file(testTsFile)
      );
      assert.ok(true, "成功打开 .ts 文件");
    } catch (error) {
      assert.fail("打开 .ts 文件时出错: " + error);
    }
  });
});
