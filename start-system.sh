#!/bin/bash

# 笔记系统自动启动脚本
# 功能：自动启动前端和后端服务，实现无缝集成

echo "🚀 启动笔记系统综合管理界面..."

# 检查是否在正确的目录
if [ ! -f "admin-dashboard.html" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

# 函数：检查端口是否被占用
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0  # 端口被占用
    else
        return 1  # 端口空闲
    fi
}

# 函数：启动前端服务器
start_frontend() {
    echo "📱 启动前端服务器..."
    if check_port 8080; then
        echo "✅ 前端服务器已在端口 8080 运行"
    else
        echo "🔄 启动前端服务器 (端口 8080)..."
        python3 -m http.server 8080 > /dev/null 2>&1 &
        FRONTEND_PID=$!
        sleep 2
        if check_port 8080; then
            echo "✅ 前端服务器启动成功"
        else
            echo "❌ 前端服务器启动失败"
            exit 1
        fi
    fi
}

# 函数：启动后端API服务器
start_backend() {
    echo "🔧 启动后端API服务器..."
    if check_port 8787; then
        echo "✅ 后端API服务器已在端口 8787 运行"
    else
        echo "🔄 启动后端API服务器 (端口 8787)..."
        cd backend
        node simple-server.cjs > /dev/null 2>&1 &
        BACKEND_PID=$!
        cd ..
        sleep 3
        if check_port 8787; then
            echo "✅ 后端API服务器启动成功"
        else
            echo "❌ 后端API服务器启动失败"
            exit 1
        fi
    fi
}

# 函数：打开浏览器
open_browser() {
    echo "🌐 打开管理界面..."
    sleep 1
    if command -v open >/dev/null 2>&1; then
        # macOS
        open "http://localhost:8080/admin-dashboard.html"
    elif command -v xdg-open >/dev/null 2>&1; then
        # Linux
        xdg-open "http://localhost:8080/admin-dashboard.html"
    elif command -v start >/dev/null 2>&1; then
        # Windows
        start "http://localhost:8080/admin-dashboard.html"
    else
        echo "📋 请手动打开浏览器访问: http://localhost:8080/admin-dashboard.html"
    fi
}

# 函数：显示系统状态
show_status() {
    echo ""
    echo "🎉 笔记系统启动完成！"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📱 前端界面: http://localhost:8080/admin-dashboard.html"
    echo "🔧 后端API:  http://localhost:8787"
    echo "📊 系统状态: http://localhost:8787/api/stats"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "💡 提示：按 Ctrl+C 停止所有服务"
    echo ""
}

# 函数：清理进程
cleanup() {
    echo ""
    echo "🛑 正在停止服务..."
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        echo "✅ 前端服务器已停止"
    fi
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo "✅ 后端API服务器已停止"
    fi
    echo "👋 再见！"
    exit 0
}

# 设置信号处理
trap cleanup SIGINT SIGTERM

# 主执行流程
echo "🔍 检查系统环境..."

# 检查Python
if ! command -v python3 >/dev/null 2>&1; then
    echo "❌ 错误：未找到 python3，请先安装 Python 3"
    exit 1
fi

# 检查Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "❌ 错误：未找到 node，请先安装 Node.js"
    exit 1
fi

# 检查后端文件
if [ ! -f "backend/simple-server.cjs" ]; then
    echo "❌ 错误：未找到后端服务器文件 backend/simple-server.cjs"
    exit 1
fi

echo "✅ 系统环境检查通过"
echo ""

# 启动服务
start_frontend
start_backend
open_browser
show_status

# 保持脚本运行
while true; do
    sleep 1
done