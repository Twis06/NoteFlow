# 双通道图片处理系统 - 用户使用指南

## 概述

本系统专为GitHub用户Twis06的notes仓库设计，提供手写笔记OCR处理、自动同步和文章分享功能。系统支持多种上传方式，能够自动将手写内容转换为Markdown格式并同步到GitHub仓库。

## 系统架构

### 双通道处理模式
- **通道A**: 手写笔记照片处理（Telegram Bot + 直接上传）
- **通道B**: 自动同步GitHub仓库attachments文件夹

### 核心功能
1. 手写笔记OCR识别和处理
2. 多文件批量上传
3. 实时Git仓库状态监控
4. 自动Markdown格式化
5. 文章分享到多平台
6. 增强同步服务

## 快速开始

### 1. 环境配置

#### 必需的环境变量
```bash
# GitHub配置
GITHUB_TOKEN=your_github_token
GITHUB_OWNER=Twis06
GITHUB_REPO=notes

# Telegram Bot配置（可选）
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# OCR服务配置
OCR_API_KEY=your_ocr_api_key

# Cloudflare配置
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
```

#### 启动开发服务器
```bash
cd backend
npm install
npm run dev
```

服务器将在 `http://localhost:8787` 启动。

### 2. 基础使用流程

#### 方式一：通过Web界面上传
1. 访问 `http://localhost:8787`
2. 点击"上传手写笔记"按钮
3. 选择一个或多个图片文件
4. 等待OCR处理完成
5. 查看生成的Markdown内容
6. 确认后自动同步到GitHub

#### 方式二：通过API直接上传
```bash
# 单张图片处理
curl -X POST http://localhost:8787/api/handwritten/process \
  -F "image=@your_image.jpg" \
  -F "options={\"autoCommit\":true,\"generateMarkdown\":true}"

# 批量处理
curl -X POST http://localhost:8787/api/handwritten/batch \
  -F "images=@image1.jpg" \
  -F "images=@image2.jpg" \
  -F "options={\"autoCommit\":true}"
```

#### 方式三：通过Telegram Bot
1. 向配置的Telegram Bot发送图片
2. Bot自动处理OCR并回复结果
3. 内容自动同步到GitHub仓库

## 详细功能说明

### 手写笔记处理

#### 支持的图片格式
- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)
- 最大文件大小：10MB

#### 处理选项
```json
{
  "autoCommit": true,          // 自动提交到GitHub
  "generateMarkdown": true,    // 生成Markdown格式
  "optimizeImage": true,       // 图片优化压缩
  "backupOriginal": true,      // 备份原始图片
  "language": "zh-cn"          // OCR识别语言
}
```

#### 输出格式
系统会生成以下文件：
- `notes/YYYY-MM-DD-handwritten-notes.md` - Markdown笔记
- `attachments/YYYY-MM-DD/original_*.jpg` - 原始图片备份
- `attachments/YYYY-MM-DD/processed_*.jpg` - 处理后图片

### GitHub仓库同步

#### 自动同步功能
- 监控 `attachments` 文件夹变化
- 自动处理新增图片文件
- 生成对应的Markdown笔记
- 提交变更到GitHub仓库

#### 手动同步
```bash
# 检查同步状态
curl -X GET http://localhost:8787/api/sync/enhanced/status

# 手动触发同步
curl -X POST http://localhost:8787/api/sync/enhanced/trigger \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

### 文章分享功能

#### 支持的平台
- GitHub (Issues/Discussions)
- Notion
- Medium
- Dev.to
- Hashnode
- 自定义平台

#### 配置分享平台
```bash
# 添加分享配置
curl -X POST http://localhost:8787/api/share/configs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-medium",
    "platform": "medium",
    "config": {
      "apiKey": "your_medium_api_key",
      "userId": "your_user_id"
    }
  }'

# 分享文章
curl -X POST http://localhost:8787/api/share/article \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "notes/2024-01-15-my-notes.md",
    "platform": "medium",
    "platformConfig": "my-medium"
  }'
```

## Web界面使用

### 主要页面

#### 1. 首页 (`/`)
- 系统状态概览
- 快速上传入口
- 最近处理记录

#### 2. 图片库 (`/gallery`)
- 查看所有处理过的图片
- 网格视图展示
- 点击查看详情

#### 3. 上传页面 (`/upload`)
- 拖拽上传界面
- 多文件选择
- 实时处理进度
- 预览和编辑功能

### 操作流程

1. **上传图片**
   - 点击上传区域或拖拽文件
   - 支持多选（Ctrl/Cmd + 点击）
   - 实时显示上传进度

2. **OCR处理**
   - 自动开始OCR识别
   - 显示处理状态
   - 可以取消正在处理的任务

3. **内容编辑**
   - 查看OCR识别结果
   - 手动编辑和修正
   - 预览Markdown格式

4. **保存和同步**
   - 确认内容无误后保存
   - 自动同步到GitHub
   - 显示同步状态

## API参考

### 手写笔记处理

```bash
# 单张图片处理
POST /api/handwritten/process
Content-Type: multipart/form-data

# 批量处理
POST /api/handwritten/batch
Content-Type: multipart/form-data

# 通过URL处理
POST /api/handwritten/url
Content-Type: application/json
{
  "imageUrl": "https://example.com/image.jpg",
  "options": {...}
}

# 获取处理统计
GET /api/handwritten/stats
```

### Obsidian增强处理

```bash
# 处理Obsidian笔记
POST /api/obsidian/enhanced
Content-Type: application/json
{
  "content": "markdown content",
  "attachments": ["image1.jpg", "image2.png"]
}
```

### 文章分享

```bash
# 管理分享配置
GET /api/share/configs
POST /api/share/configs
PUT /api/share/configs
DELETE /api/share/configs

# 分享文章
POST /api/share/article
POST /api/share/batch
```

### 增强同步

```bash
# 同步状态
GET /api/sync/enhanced/status

# 触发同步
POST /api/sync/enhanced/trigger

# 同步配置
GET /api/sync/enhanced/config
POST /api/sync/enhanced/config
```

## 故障排除

### 常见问题

#### 1. OCR识别不准确
- 确保图片清晰度足够
- 检查光照条件
- 尝试调整图片角度
- 使用更高分辨率的图片

#### 2. GitHub同步失败
- 检查GitHub Token权限
- 确认仓库名称正确
- 查看网络连接状态
- 检查API限制

#### 3. 文件上传失败
- 检查文件大小限制
- 确认文件格式支持
- 查看服务器日志
- 检查存储空间

### 调试方法

#### 查看服务器日志
```bash
# 开发环境
npm run dev
# 查看终端输出

# 生产环境
wrangler tail
```

#### API调试
```bash
# 测试连通性
curl -X GET http://localhost:8787/api/handwritten/stats

# 查看详细错误
curl -v -X POST http://localhost:8787/api/handwritten/process \
  -F "image=@test.jpg"
```

#### 检查配置
```bash
# 验证环境变量
echo $GITHUB_TOKEN
echo $GITHUB_OWNER
echo $GITHUB_REPO
```

## 高级配置

### 自定义OCR设置
```json
{
  "ocrProvider": "tesseract",
  "language": "chi_sim+eng",
  "dpi": 300,
  "psm": 6,
  "preprocessing": {
    "denoise": true,
    "deskew": true,
    "enhance": true
  }
}
```

### 图片优化配置
```json
{
  "compression": {
    "quality": 85,
    "format": "webp",
    "maxWidth": 1920,
    "maxHeight": 1080
  },
  "backup": {
    "enabled": true,
    "location": "cloudflare-images"
  }
}
```

### 同步策略配置
```json
{
  "syncInterval": 300,
  "batchSize": 10,
  "retryAttempts": 3,
  "conflictResolution": "merge",
  "autoCommit": true
}
```

## 安全注意事项

1. **API密钥管理**
   - 使用环境变量存储敏感信息
   - 定期轮换API密钥
   - 限制API权限范围

2. **文件上传安全**
   - 验证文件类型和大小
   - 扫描恶意内容
   - 使用安全的存储位置

3. **网络安全**
   - 使用HTTPS传输
   - 实施速率限制
   - 监控异常访问

## 性能优化

### 图片处理优化
- 使用WebP格式减少文件大小
- 实施图片懒加载
- 缓存处理结果
- 并行处理多个文件

### API性能
- 实施请求缓存
- 使用CDN加速
- 优化数据库查询
- 实施连接池

## 更新和维护

### 定期维护任务
1. 清理临时文件
2. 更新依赖包
3. 备份重要数据
4. 监控系统性能

### 版本更新
```bash
# 更新依赖
npm update

# 部署新版本
npm run deploy

# 验证部署
curl -X GET https://your-domain.com/api/handwritten/stats
```

## 支持和反馈

如果遇到问题或有改进建议，请：

1. 查看本文档的故障排除部分
2. 检查GitHub Issues
3. 提交新的Issue或Pull Request
4. 联系系统管理员

---

*最后更新：2024年1月*