#!/bin/bash

# VS Code扩展打包脚本
# 使用方法: ./build.sh [clean|build|package|publish]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装"
        exit 1
    fi
    
    log_info "依赖检查通过"
}

# 安装依赖
install_dependencies() {
    log_info "安装依赖..."
    npm install
    
    # 安装vsce（VS Code Extension Manager）
    if ! npm list -g @vscode/vsce &> /dev/null; then
        log_info "安装 @vscode/vsce..."
        npm install -g @vscode/vsce
    fi
}

# 清理构建文件
clean() {
    log_info "清理构建文件..."
    rm -rf out/
    rm -rf node_modules/
    rm -f *.vsix
    log_info "清理完成"
}

# 构建项目
build() {
    log_info "构建项目..."
    npm run compile
    
    if [ $? -eq 0 ]; then
        log_info "构建成功"
    else
        log_error "构建失败"
        exit 1
    fi
}

# 运行代码检查
lint() {
    log_info "运行代码检查..."
    npm run lint
    
    if [ $? -eq 0 ]; then
        log_info "代码检查通过"
    else
        log_warn "代码检查发现问题，但继续构建"
    fi
}

# 打包扩展
package() {
    log_info "打包VS Code扩展..."
    
    # 确保out目录存在且有内容
    if [ ! -d "out" ] || [ -z "$(ls -A out)" ]; then
        log_info "out目录为空，先构建项目"
        build
    fi
    
    # 使用vsce打包
    vsce package --out ./
    
    if [ $? -eq 0 ]; then
        VSIX_FILE=$(ls -t *.vsix | head -1)
        log_info "打包成功: ${VSIX_FILE}"
        
        # 显示文件信息
        ls -lh *.vsix
    else
        log_error "打包失败"
        exit 1
    fi
}

# 发布扩展
publish() {
    log_info "发布VS Code扩展..."
    
    # 检查是否有access token
    if [ -z "$VSCE_PAT" ]; then
        log_error "请设置环境变量 VSCE_PAT（Personal Access Token）"
        log_info "获取token: https://dev.azure.com/vscode/_usersSettings/tokens"
        exit 1
    fi
    
    # 发布
    vsce publish -p $VSCE_PAT
    
    if [ $? -eq 0 ]; then
        log_info "发布成功"
    else
        log_error "发布失败"
        exit 1
    fi
}

# 完整构建流程
full_build() {
    log_info "开始完整构建流程..."
    
    check_dependencies
    install_dependencies
    lint
    build
    package
    
    log_info "构建流程完成！"
}

# 显示帮助信息
show_help() {
    echo "VS Code扩展打包脚本"
    echo ""
    echo "用法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  clean      - 清理构建文件"
    echo "  build      - 构建项目"
    echo "  lint       - 代码检查"
    echo "  package    - 打包扩展"
    echo "  publish    - 发布扩展"
    echo "  full       - 完整构建流程"
    echo "  help       - 显示帮助"
    echo ""
    echo "环境变量:"
    echo "  VSCE_PAT   - VS Code Marketplace Personal Access Token"
    echo ""
    echo "示例:"
    echo "  $0 full              # 完整构建"
    echo "  $0 package           # 仅打包"
    echo "  VSCE_PAT=xxx $0 publish  # 发布到市场"
}

# 主函数
main() {
    case "${1:-full}" in
        "clean")
            clean
            ;;
        "build")
            check_dependencies
            install_dependencies
            build
            ;;
        "lint")
            check_dependencies
            install_dependencies
            lint
            ;;
        "package")
            check_dependencies
            install_dependencies
            package
            ;;
        "publish")
            check_dependencies
            install_dependencies
            publish
            ;;
        "full")
            full_build
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"