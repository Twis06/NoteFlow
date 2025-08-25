#!/bin/bash

# 启动脚本 - 同时启动前后端服务并打开浏览器
# 使用方法: ./start-all.sh

echo "🚀 启动图片管理系统..."
echo "================================"

# 检查端口是否被占用
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  端口 $port 已被占用，正在停止现有进程..."
        lsof -ti:$port | xargs kill -9 2>/dev/null
        sleep 2
    fi
}

# 清理函数 - 脚本退出时停止所有服务
cleanup() {
    echo "\n🛑 正在停止所有服务..."
    
    # 停止后端服务器 (端口 8788)
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo "   ✅ 后端服务器已停止"
    fi
    
    # 停止前端服务器 (端口 8080)
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        echo "   ✅ 前端服务器已停止"
    fi
    
    # 清理端口
    lsof -ti:8788 | xargs kill -9 2>/dev/null
    lsof -ti:8080 | xargs kill -9 2>/dev/null
    
    echo "🎯 所有服务已停止"
    exit 0
}

# 设置信号处理
trap cleanup SIGINT SIGTERM

# 检查并清理端口
check_port 8788
check_port 8080

echo "📡 1. 启动后端API服务器 (端口: 8788)..."
cd backend
node real-server.cjs &
BACKEND_PID=$!
cd ..

# 等待后端启动
echo "   ⏳ 等待后端服务启动..."
sleep 3

# 检查后端是否启动成功
if curl -s http://localhost:8788/api/stats > /dev/null; then
    echo "   ✅ 后端服务启动成功"
else
    echo "   ❌ 后端服务启动失败"
    cleanup
fi

echo "🌐 2. 启动前端静态服务器 (端口: 8080)..."
# 使用Python启动简单的HTTP服务器
if command -v python3 &> /dev/null; then
    python3 -m http.server 8080 &
    FRONTEND_PID=$!
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer 8080 &
    FRONTEND_PID=$!
else
    echo "   ❌ 未找到Python，无法启动前端服务器"
    cleanup
fi

# 等待前端启动
echo "   ⏳ 等待前端服务启动..."
sleep 2

# 检查前端是否启动成功
if curl -s http://localhost:8080 > /dev/null; then
    echo "   ✅ 前端服务启动成功"
else
    echo "   ❌ 前端服务启动失败"
    cleanup
fi

echo "🎉 3. 自动打开浏览器..."
# 等待服务完全启动
sleep 1

# 根据系统打开浏览器
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open http://localhost:8080/admin-dashboard.html
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    xdg-open http://localhost:8080/admin-dashboard.html
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows
    start http://localhost:8080/admin-dashboard.html
fi

echo "================================"
echo "🎯 系统启动完成！"
echo ""
echo "📊 服务状态:"
echo "   🔧 后端API: http://localhost:8788"
echo "   🌐 前端页面: http://localhost:8080"
echo "   📱 管理页面: http://localhost:8080/admin-dashboard.html"
echo "   ✍️  手写识别: http://localhost:8080/handwriting-archive.html"
echo "   📚 用户指南: http://localhost:8080/user-guide.html"
echo ""
echo "💡 使用提示:"
echo "   - 按 Ctrl+C 停止所有服务"
echo "   - 后端日志会显示在终端中"
echo "   - 前端页面支持热刷新"
echo ""
echo "⏳ 服务运行中... (按 Ctrl+C 停止)"

# 保持脚本运行，显示后端日志
wait $BACKEND_PID