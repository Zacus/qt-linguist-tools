# Qt Linguist Tools

一个简单的 VS Code 扩展，用于快速在 Qt Linguist 中打开翻译文件。

## 功能

- 在 VS Code 中右键点击 `.ts` 文件，选择"在 Qt Linguist 中打开"
- 通过状态栏的 Qt Linguist 按钮快速打开文件
- 支持快捷键 `Cmd+Alt+L` (macOS) 打开当前文件

## 要求

- 需要安装 Qt（默认路径：`/opt/homebrew/opt/qt`）
- 仅支持 macOS

## 使用说明

1. 在 VS Code 中打开包含 Qt 翻译文件 (`.ts`) 的项目
2. 右键点击翻译文件，选择"在 Qt Linguist 中打开"
3. Qt Linguist 将自动打开选中的文件

## 已知问题

- 此扩展仅支持 `.ts` 格式的 Qt 翻译文件
- 确保 Qt Linguist 已正确安装在系统中

## 版本历史

### 0.0.1

- 初始版本
- 支持在 VS Code 中快速打开 Qt Linguist
- 添加状态栏按钮和快捷键支持
