#!/bin/bash

# 测试批量替换功能 - 使用正确的笔记目录路径
echo "🧪 测试批量替换功能 - 正确的笔记目录路径"
echo "📁 目标目录: /Users/lipeiyang/Documents/notes"
echo ""

# 检查API服务器状态
echo "📊 检查API服务器状态..."
curl -s http://localhost:8788/api/stats | jq .
echo ""

# 执行dry run测试
echo "🔍 执行 Dry Run 测试..."
curl -s -X POST http://localhost:8788/api/batch-replace \
  -H "Content-Type: application/json" \
  -d '{
    "targetDirectory": "/Users/lipeiyang/Documents/notes",
    "dryRun": true
  }' | jq .
echo ""

# 询问是否执行实际替换
read -p "是否执行实际的批量替换？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 执行实际批量替换..."
    curl -s -X POST http://localhost:8788/api/batch-replace \
      -H "Content-Type: application/json" \
      -d '{
        "targetDirectory": "/Users/lipeiyang/Documents/notes",
        "dryRun": false
      }' | jq .
else
    echo "❌ 取消实际替换操作"
fi

echo "✅ 测试完成"