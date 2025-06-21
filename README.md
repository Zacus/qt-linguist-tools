# Qt Linguist Tools

一个强大的VS Code扩展，为Qt开发者提供完整的翻译文件管理功能。支持Windows、macOS和Linux平台。

## 功能特性

### 🌍 跨平台支持

- ✅ Windows
- ✅ macOS  
- ✅ Linux
- 🔍 自动检测Qt安装路径

### 🛠️ 核心功能

- **Qt Linguist集成** - 直接从VS Code打开.ts翻译文件
- **翻译文件更新** - 使用lupdate从源码更新翻译文件
- **翻译文件编译** - 使用lrelease编译.ts为.qm文件
- **批量操作** - 一键编译工作空间中所有翻译文件
- **批量更新** - 一键更新工作空间中所有翻译文件

### 🎯 便捷操作

- 右键菜单集成
- 状态栏快速访问
- 键盘快捷键支持
- 进度显示和错误处理

## 安装

1. 在VS Code扩展市场搜索"Qt Linguist Tools"
2. 点击安装
3. 重启VS Code

## 使用方法

### 基本操作

#### 1. 在Qt Linguist中打开翻译文件

- 在资源管理器中右键点击`.ts`文件
- 选择"在 Qt Linguist 中打开"
- 或使用快捷键 `Ctrl+Shift+L` (Mac: `Cmd+Shift+L`)

#### 2. 更新翻译文件

- 右键点击`.ts`或`.pro`文件
- 选择"更新翻译文件 (lupdate)"
- 或使用快捷键 `Ctrl+Shift+U` (Mac: `Cmd+Shift+U`)

#### 3. 编译翻译文件

- 右键点击`.ts`文件
- 选择"编译翻译文件 (lrelease)"
- 或使用快捷键 `Ctrl+Shift+R` (Mac: `Cmd+Shift+R`)

#### 4. 批量编译

- 使用命令面板 (`Ctrl+Shift+P`)
- 搜索"Qt Linguist: 批量编译所有翻译文件"
- 或点击状态栏的Qt Linguist按钮选择批量编译

#### 5. 批量更新

- 命令面板：Qt Linguist: 批量更新所有翻译文件
- 快捷键：`Ctrl+Shift+Alt+U`(Mac: `Cmd+Shift+Alt+U`)
- 状态栏菜单：点击状态栏的Qt Linguist按钮
- 右键菜单：在文件夹上右键可看到批量更新选项

### 状态栏菜单

点击状态栏的"🌍 Qt Linguist"按钮，快速访问所有功能：

- 在 Qt Linguist 中打开
- 更新翻译文件
- 编译翻译文件
- 批量编译所有翻译文件
- 批量更新所有翻译文件

## 配置选项

打开VS Code设置，搜索"Qt Linguist"进行配置：

### `qt-linguist.qtPath`

- **类型**: string
- **默认值**: ""
- **说明**: Qt安装路径，如果为空将自动检测
- **示例**:
  - Windows: `C:\\Qt\\6.5.0\\msvc2019_64`
  - macOS: `/opt/homebrew/opt/qt`
  - Linux: `/usr/local/qt`

### `qt-linguist.autoDetectQt`

- **类型**: boolean
- **默认值**: true
- **说明**: 是否自动检测Qt工具路径

### `qt-linguist.showStatusBar`

- **类型**: boolean
- **默认值**: true
- **说明**: 是否在状态栏显示Qt Linguist按钮

### `qt-linguist.showNotifications`

- **类型**: boolean
- **默认值**: true
- **说明**: 是否显示操作完成通知

## 键盘快捷键

| 功能 | Windows/Linux | macOS |
|------|---------------|-------|
| 在Qt Linguist中打开 | `Ctrl+Shift+L` | `Cmd+Shift+L` |
| 编译翻译文件 | `Ctrl+Shift+R` | `Cmd+Shift+R` |
| 更新翻译文件 | `Ctrl+Shift+U` | `Cmd+Shift+U` |
| 显示工具菜单 | `Ctrl+Shift+Q` | `Cmd+Shift+Q` |

## 自动检测路径

扩展会自动检测以下常见的Qt安装路径：

### Windows

- `C:\\Qt\\Tools\\QtCreator\\bin`
- `C:\\Qt\\*\\bin`
- `C:\\Program Files\\Qt\\*\\bin`
- `C:\\Program Files (x86)\\Qt\\*\\bin`

### macOS

- `/opt/homebrew/opt/qt`
- `/usr/local/opt/qt`
- `/Applications/Qt Creator.app/Contents/Resources/qt`
- `/opt/Qt/*/bin`

### Linux

- `/usr/bin`
- `/usr/local/bin`
- `/opt/qt/bin`
- `/opt/Qt/*/bin`

## 故障排除

### Qt Linguist无法打开

1. 检查Qt是否正确安装
2. 在设置中手动指定Qt路径
3. 确保Qt工具在系统PATH中

### 编译失败

1. 确保lrelease工具可用
2. 检查.ts文件格式是否正确
3. 查看VS Code输出面板的错误信息

### 更新失败

1. 确保lupdate工具可用
2. 检查.pro文件是否存在且格式正确
3. 确保源码文件路径正确

## 支持的文件类型

- `.ts` - Qt翻译源文件
- `.pro` - Qt项目文件
- `.qm` - Qt编译后的翻译文件（生成）

## 贡献

欢迎提交Issue和Pull Request到 [GitHub仓库](https://github.com/zacus/qt-linguist-tools)

## 许可证

MIT License

## 更新日志

### 1.1.8

- 修复已知问题

### 1.1.4

- 修复重复打开文件的问题
- 新增批量更新功能

### 1.1.0

- 新增跨平台支持（Windows、macOS、Linux）
- 新增翻译文件更新功能（lupdate）
- 新增批量编译功能
- 改进错误处理和用户体验
- 添加进度显示
- 优化Qt工具路径检测

### 1.0.0

- 初始版本
- 基本的Qt Linguist集成功能
