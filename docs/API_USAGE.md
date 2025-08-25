# 双通道图片处理系统 API 使用指南

## 概述

本系统提供了两个主要处理通道和多个增强功能模块，支持手写笔记处理、GitHub仓库同步、文章分享等功能。

服务器地址：`http://localhost:8787`

## 通道A：手写笔记处理

### 1. 单张图片处理

**端点：** `POST /api/handwritten/process`

**功能：** 处理单张手写笔记图片，支持OCR识别和Markdown生成

**请求体：**
```json
{
  "imageUrl": "https://example.com/image.jpg",
  "options": {
    "enableOCR": true,
    "imageQuality": 0.8,
    "enableBackup": true,
    "outputFormat": "markdown",
    "errorHandling": "skip"
  }
}
```

**测试命令：**
```bash
curl -X POST http://localhost:8787/api/handwritten/process \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/test-image.jpg",
    "options": {
      "enableOCR": true,
      "imageQuality": 0.8,
      "enableBackup": true
    }
  }'
```

### 2. 批量图片处理

**端点：** `POST /api/handwritten/batch`

**功能：** 批量处理多张手写笔记图片

**请求体：**
```json
{
  "imageUrls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "options": {
    "enableOCR": true,
    "enableParallelProcessing": true,
    "maxConcurrency": 3,
    "imageQuality": 0.8
  }
}
```

**测试命令：**
```bash
curl -X POST http://localhost:8787/api/handwritten/batch \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrls": ["https://example.com/test1.jpg", "https://example.com/test2.jpg"],
    "options": {
      "enableOCR": true,
      "enableParallelProcessing": true
    }
  }'
```

### 3. 获取处理统计

**端点：** `GET /api/handwritten/stats`

**功能：** 获取手写笔记处理的统计信息

**测试命令：**
```bash
curl -X GET http://localhost:8787/api/handwritten/stats
```

## 通道B：Obsidian增强处理

### 1. 增强Obsidian处理

**端点：** `POST /api/obsidian/enhanced`

**功能：** 处理Obsidian仓库中的图片，支持自动上传和URL替换

**请求体：**
```json
{
  "repoOwner": "your-username",
  "repoName": "your-repo",
  "options": {
    "imageQuality": 0.8,
    "enableSmartCompression": true,
    "enableParallelProcessing": true,
    "autoUpload": true
  }
}
```

**测试命令：**
```bash
curl -X POST http://localhost:8787/api/obsidian/enhanced \
  -H "Content-Type: application/json" \
  -d '{
    "repoOwner": "your-username",
    "repoName": "your-repo",
    "options": {
      "imageQuality": 0.8,
      "enableSmartCompression": true
    }
  }'
```

## 文章分享功能

### 1. 分享单篇文章

**端点：** `POST /api/share/article`

**功能：** 将处理后的笔记分享到指定平台

**请求体：**
```json
{
  "filePath": "/path/to/article.md",
  "platform": "github",
  "platformConfig": {
    "owner": "your-username",
    "repo": "your-blog-repo",
    "branch": "main"
  }
}
```

**测试命令：**
```bash
curl -X POST http://localhost:8787/api/share/article \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "/test/article.md",
    "platform": "github",
    "platformConfig": {
      "owner": "test-user",
      "repo": "test-repo"
    }
  }'
```

### 2. 批量分享文章

**端点：** `POST /api/share/batch`

**功能：** 批量分享多篇文章

**请求体：**
```json
{
  "filePaths": [
    "/path/to/article1.md",
    "/path/to/article2.md"
  ],
  "platform": "github",
  "platformConfig": {
    "owner": "your-username",
    "repo": "your-blog-repo"
  }
}
```

### 3. 管理分享配置

**获取配置：** `GET /api/share/configs`

**添加配置：** `POST /api/share/configs`
```json
{
  "name": "my-github-blog",
  "config": {
    "platform": "github",
    "owner": "your-username",
    "repo": "your-blog-repo",
    "branch": "main"
  }
}
```

**删除配置：** `DELETE /api/share/configs/{configName}`

**测试命令：**
```bash
# 获取所有配置
curl -X GET http://localhost:8787/api/share/configs

# 添加新配置
curl -X POST http://localhost:8787/api/share/configs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-config",
    "config": {
      "platform": "github",
      "owner": "test-user",
      "repo": "test-repo"
    }
  }'
```

## 增强同步功能

### 1. 获取同步状态

**端点：** `GET /api/sync/enhanced/status`

**功能：** 获取当前同步服务的状态

**测试命令：**
```bash
curl -X GET http://localhost:8787/api/sync/enhanced/status
```

### 2. 启动自动同步

**端点：** `POST /api/sync/enhanced/start`

**请求体：**
```json
{
  "options": {
    "interval": 300000,
    "enableAutoBackup": true,
    "conflictResolution": "merge"
  }
}
```

### 3. 停止自动同步

**端点：** `POST /api/sync/enhanced/stop`

### 4. 手动同步

**端点：** `POST /api/sync/enhanced/manual`

**测试命令：**
```bash
# 启动自动同步
curl -X POST http://localhost:8787/api/sync/enhanced/start \
  -H "Content-Type: application/json" \
  -d '{
    "options": {
      "interval": 300000,
      "enableAutoBackup": true
    }
  }'

# 手动同步
curl -X POST http://localhost:8787/api/sync/enhanced/manual

# 停止同步
curl -X POST http://localhost:8787/api/sync/enhanced/stop
```

## 现有功能端点

### 1. 图片库

**端点：** `GET /gallery`

**功能：** 查看已处理的图片库

**访问：** 直接在浏览器中访问 `http://localhost:8787/gallery`

### 2. Telegram Webhook

**端点：** `POST /telegram/webhook`

**功能：** 处理Telegram Bot的消息

### 3. 图片上传

**端点：** `POST /upload`

**功能：** 直接上传图片文件

## 调试建议

### 1. 检查服务器状态
```bash
# 检查服务器是否运行
curl -X GET http://localhost:8787/

# 检查特定端点
curl -X GET http://localhost:8787/api/handwritten/stats
```

### 2. 查看服务器日志
在终端中查看 `npm run dev` 的输出日志，可以看到请求处理情况和错误信息。

### 3. 测试流程建议

1. **先测试简单端点：**
   ```bash
   curl -X GET http://localhost:8787/api/handwritten/stats
   curl -X GET http://localhost:8787/api/share/configs
   ```

2. **测试配置管理：**
   ```bash
   # 添加测试配置
   curl -X POST http://localhost:8787/api/share/configs \
     -H "Content-Type: application/json" \
     -d '{"name": "test", "config": {"platform": "github"}}'
   
   # 获取配置列表
   curl -X GET http://localhost:8787/api/share/configs
   ```

3. **测试同步功能：**
   ```bash
   curl -X GET http://localhost:8787/api/sync/enhanced/status
   curl -X POST http://localhost:8787/api/sync/enhanced/manual
   ```

### 4. 常见问题排查

- **404错误：** 检查端点路径是否正确
- **500错误：** 查看服务器日志中的错误信息
- **参数错误：** 确认请求体格式和必需参数
- **权限错误：** 检查GitHub token等认证信息

### 5. 环境变量配置

确保在 `.env` 文件中配置了必要的环境变量：
```env
GITHUB_TOKEN=your_github_token
TELEGRAM_BOT_TOKEN=your_telegram_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
```

开始测试时，建议从简单的GET请求开始，然后逐步测试更复杂的POST请求。如果遇到问题，请查看服务器日志获取详细的错误信息。