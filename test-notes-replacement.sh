#!/bin/bash

# 测试真实notes目录的批量替换功能
# 目标目录: /Users/lipeiyang/Documents/notes

echo "🔍 测试notes目录批量替换功能"
echo "目标目录: /Users/lipeiyang/Documents/notes"
echo "================================"

# 1. 检查API服务器状态
echo "📊 1. 检查API服务器状态..."
curl -s http://localhost:8788/api/stats | jq '.status, .services'
echo ""

# 2. 测试批量替换API - 指定notes目录
echo "🔄 2. 测试批量替换功能（指定notes目录）..."
REPLACE_RESULT=$(curl -s -X POST -H "Content-Type: application/json" -d '{
  "targetDirectory": "/Users/lipeiyang/Documents/notes",
  "dryRun": true,
  "patterns": {
    "markdown": ["![.*]\\(\\./.*\\)", "![.*]\\(attachments/.*\\)", "!\\[\\[.*\\]\\]"],
    "html": ["<img[^>]*src=\"\\./[^\"]*\"", "<img[^>]*src=\"attachments/[^\"]*\""]
  }
}' http://localhost:8788/api/batch-replace)
echo $REPLACE_RESULT | jq .
echo ""

# 3. 如果dry run成功，执行实际替换
SUCCESS=$(echo $REPLACE_RESULT | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
    echo "✅ Dry run成功，执行实际替换..."
    ACTUAL_RESULT=$(curl -s -X POST -H "Content-Type: application/json" -d '{
      "targetDirectory": "/Users/lipeiyang/Documents/notes",
      "dryRun": false,
      "patterns": {
        "markdown": ["![.*]\\(\\./.*\\)", "![.*]\\(attachments/.*\\)", "!\\[\\[.*\\]\\]"],
        "html": ["<img[^>]*src=\"\\./[^\"]*\"", "<img[^>]*src=\"attachments/[^\"]*\""]
      }
    }' http://localhost:8788/api/batch-replace)
    echo $ACTUAL_RESULT | jq .
else
    echo "❌ Dry run失败，请检查API服务器或目录权限"
fi

echo ""
echo "🎯 测试完成！"
echo "如果看到替换成功的结果，说明功能正常工作。"
echo "如果遇到权限问题，请确保API服务器有访问notes目录的权限。"