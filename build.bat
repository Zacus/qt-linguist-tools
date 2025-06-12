@echo off
REM VS Code扩展打包脚本 (Windows版本)
REM 使用方法: build.bat [clean|build|package|publish|full|help]

setlocal enabledelayedexpansion

REM 设置代码页为UTF-8
chcp 65001 >nul

REM 颜色定义（Windows命令行颜色代码）
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "NC=[0m"

REM 日志函数
:log_info
echo %GREEN%[INFO]%NC% %~1
goto :eof

:log_warn
echo %YELLOW%[WARN]%NC% %~1
goto :eof

:log_error
echo %RED%[ERROR]%NC% %~1
goto :eof

REM 检查依赖
:check_dependencies
call :log_info "检查依赖..."

where npm >nul 2>&1
if %errorlevel% neq 0 (
    call :log_error "npm 未安装"
    exit /b 1
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    call :log_error "Node.js 未安装"
    exit /b 1
)

call :log_info "依赖检查通过"
goto :eof

REM 安装依赖
:install_dependencies
call :log_info "安装依赖..."
npm install
if %errorlevel% neq 0 (
    call :log_error "依赖安装失败"
    exit /b 1
)

REM 检查并安装vsce
npm list -g @vscode/vsce >nul 2>&1
if %errorlevel% neq 0 (
    call :log_info "安装 @vscode/vsce..."
    npm install -g @vscode/vsce
    if %errorlevel% neq 0 (
        call :log_error "@vscode/vsce 安装失败"
        exit /b 1
    )
)
goto :eof

REM 清理构建文件
:clean
call :log_info "清理构建文件..."
if exist out rmdir /s /q out
if exist node_modules rmdir /s /q node_modules
del /q *.vsix 2>nul
call :log_info "清理完成"
goto :eof

REM 构建项目
:build
call :log_info "构建项目..."
npm run compile
if %errorlevel% eq 0 (
    call :log_info "构建成功"
) else (
    call :log_error "构建失败"
    exit /b 1
)
goto :eof

REM 运行代码检查
:lint
call :log_info "运行代码检查..."
npm run lint
if %errorlevel% eq 0 (
    call :log_info "代码检查通过"
) else (
    call :log_warn "代码检查发现问题，但继续构建"
)
goto :eof

REM 打包扩展
:package
call :log_info "打包VS Code扩展..."

REM 确保out目录存在且有内容
if not exist out (
    call :log_info "out目录不存在，先构建项目"
    call :build
    if %errorlevel% neq 0 exit /b 1
) else (
    dir /b out | findstr . >nul
    if %errorlevel% neq 0 (
        call :log_info "out目录为空，先构建项目"
        call :build
        if %errorlevel% neq 0 exit /b 1
    )
)

REM 使用vsce打包
vsce package
if %errorlevel% eq 0 (
    call :log_info "打包成功"
    REM 显示生成的文件
    for %%f in (*.vsix) do (
        call :log_info "生成文件: %%f"
        dir "%%f"
    )
) else (
    call :log_error "打包失败"
    exit /b 1
)
goto :eof

REM 发布扩展
:publish
call :log_info "发布VS Code扩展..."

REM 检查是否有access token
if "%VSCE_PAT%"=="" (
    call :log_error "请设置环境变量 VSCE_PAT（Personal Access Token）"
    call :log_info "获取token: https://dev.azure.com/vscode/_usersSettings/tokens"
    exit /b 1
)

REM 发布
vsce publish -p %VSCE_PAT%
if %errorlevel% eq 0 (
    call :log_info "发布成功"
) else (
    call :log_error "发布失败"
    exit /b 1
)
goto :eof

REM 完整构建流程
:full_build
call :log_info "开始完整构建流程..."

call :check_dependencies
if %errorlevel% neq 0 exit /b 1

call :install_dependencies
if %errorlevel% neq 0 exit /b 1

call :clean
if %errorlevel% neq 0 exit /b 1

call :build
if %errorlevel% neq 0 exit /b 1

call :lint
REM lint 警告不中断流程

call :test
if %errorlevel% neq 0 (
    call :log_warn "测试失败，但继续打包流程"
)

call :package
if %errorlevel% neq 0 exit /b 1

call :log_info "完整构建流程完成！"
goto :eof

REM 显示帮助信息
:show_help
echo.
echo %BLUE%VS Code 扩展打包脚本%NC%
echo.
echo %GREEN%使用方法:%NC%
echo   build.bat [命令]
echo.
echo %GREEN%可用命令:%NC%
echo   %YELLOW%clean%NC%     - 清理构建文件和依赖
echo   %YELLOW%build%NC%     - 编译TypeScript代码
echo   %YELLOW%lint%NC%      - 运行代码检查
echo   %YELLOW%test%NC%      - 运行测试
echo   %YELLOW%package%NC%   - 打包扩展为.vsix文件
echo   %YELLOW%publish%NC%   - 发布扩展到VS Code marketplace
echo   %YELLOW%full%NC%      - 执行完整构建流程 (推荐)
echo   %YELLOW%help%NC%      - 显示此帮助信息
echo.
echo %GREEN%环境变量:%NC%
echo   %YELLOW%VSCE_PAT%NC%  - 发布时需要的Personal Access Token
echo.
echo %GREEN%示例:%NC%
echo   build.bat full       - 执行完整构建
echo   build.bat package    - 仅打包
echo   build.bat clean      - 清理文件
echo.
goto :eof

REM 检查package.json中的常见问题
:validate_package
call :log_info "验证 package.json..."

if not exist package.json (
    call :log_error "未找到 package.json 文件"
    exit /b 1
)

REM 检查必要字段（简单检查）
findstr /C:"\"name\"" package.json >nul
if %errorlevel% neq 0 (
    call :log_error "package.json 缺少 name 字段"
    exit /b 1
)

findstr /C:"\"version\"" package.json >nul
if %errorlevel% neq 0 (
    call :log_error "package.json 缺少 version 字段"
    exit /b 1
)

findstr /C:"\"main\"" package.json >nul
if %errorlevel% neq 0 (
    call :log_error "package.json 缺少 main 字段"
    exit /b 1
)

call :log_info "package.json 验证通过"
goto :eof

REM 显示项目信息
:show_info
call :log_info "项目信息:"
if exist package.json (
    for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"name\"" package.json') do (
        set name=%%a
        set name=!name:"=!
        set name=!name: =!
        echo   扩展名称: !name!
    )
    for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"version\"" package.json') do (
        set version=%%a
        set version=!version:"=!
        set version=!version: =!
        echo   版本: !version!
    )
)

if exist out (
    echo   构建状态: %GREEN%已构建%NC%
) else (
    echo   构建状态: %RED%未构建%NC%
)

if exist *.vsix (
    echo   打包状态: %GREEN%已打包%NC%
    for %%f in (*.vsix) do echo   包文件: %%f
) else (
    echo   打包状态: %RED%未打包%NC%
)
goto :eof

REM 主程序入口
:main
set command=%1

if "%command%"=="" set command=help
if "%command%"=="help" goto show_help
if "%command%"=="--help" goto show_help
if "%command%"=="-h" goto show_help

REM 显示项目信息
call :show_info
echo.

REM 验证package.json
call :validate_package
if %errorlevel% neq 0 exit /b 1

REM 执行对应命令
if "%command%"=="clean" (
    call :clean
) else if "%command%"=="build" (
    call :build
) else if "%command%"=="lint" (
    call :lint
) else if "%command%"=="test" (
    call :test
) else if "%command%"=="package" (
    call :package
) else if "%command%"=="publish" (
    call :publish
) else if "%command%"=="full" (
    call :full_build
) else (
    call :log_error "未知命令: %command%"
    echo.
    call :show_help
    exit /b 1
)

echo.
call :log_info "脚本执行完成"
goto :eof

REM 脚本入口点
call :main %*
exit /b %errorlevel%