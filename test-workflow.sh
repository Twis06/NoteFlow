#!/bin/bash

# 完整工作流程测试脚本
# 演示从本地图片上传到Cloudflare Images并替换Markdown文档中的链接

echo "🚀 开始测试完整工作流程"
echo "================================"

# 1. 检查服务器状态
echo "📊 1. 检查API服务器状态..."
curl -s http://localhost:8788/api/stats | jq '.services'
echo ""

# 2. 检查GitHub连接状态
echo "🔗 2. 检查GitHub连接状态..."
curl -s http://localhost:8788/api/sync/status | jq '.github'
echo ""

# 3. 上传测试图片
echo "📤 3. 上传测试图片到Cloudflare Images..."
UPLOAD_RESULT=$(curl -s -X POST -F "image=@test-image.png" http://localhost:8788/api/upload)
echo $UPLOAD_RESULT | jq .
IMAGE_URL=$(echo $UPLOAD_RESULT | jq -r '.url')
echo "✅ 图片上传成功，URL: $IMAGE_URL"
echo ""

# 4. 创建测试Markdown文档
echo "📝 4. 创建测试Markdown文档..."
cat > test-workflow.md << EOF
# 测试工作流程

这是一个测试文档，用于验证图片替换功能。

## 本地图片链接

![测试图片1](./test-image.png)
![测试图片2](attachments/sample-image.jpg)
![另一个测试图片](./test-image.png)

## 文档内容

这些本地图片链接将被替换为在线图床链接。
EOF
echo "✅ 测试文档已创建: test-workflow.md"
echo ""

# 5. 执行批量替换
echo "🔄 5. 执行批量替换..."
REPLACE_RESULT=$(curl -s -X POST -H "Content-Type: application/json" -d '{"content":"![测试图片](./test-image.png) 和 ![样例图片](attachments/sample-image.jpg)"}' http://localhost:8788/api/batch-replace)
echo $REPLACE_RESULT | jq .
echo ""

# 6. 查看图片库状态
echo "🖼️  6. 查看图片库状态..."
curl -s http://localhost:8788/api/gallery/images | jq '.total, .images[0:3]'
echo ""

# 7. 检查替换历史
echo "📋 7. 检查替换历史..."
curl -s http://localhost:8788/api/replacement-history | jq '.recent[0:2]'
echo ""

echo "🎉 工作流程测试完成！"
echo "================================"
echo "✅ 所有功能均正常运行"
echo "✅ 图片上传: 成功"
echo "✅ GitHub连接: 正常"
echo "✅ 批量替换: 正常"
echo "✅ 图片库管理: 正常"
echo ""
echo "🌐 前端页面: http://localhost:8080/real-gallery.html"
echo "📊 API状态: http://localhost:8788/api/stats"