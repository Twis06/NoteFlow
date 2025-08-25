# 真实API端点列表

基于 `backend/src/` 目录下的TypeScript代码分析，以下是真实的API端点：

## 🔧 核心处理API

### 手写笔记处理
- `POST /api/process/handwritten` - 处理手写笔记上传和OCR识别
- `POST /api/process/handwritten-url` - 通过URL处理手写笔记
- `POST /api/process/handwritten-batch` - 批量处理手写笔记

### Obsidian内容处理
- `POST /api/process/obsidian` - 处理Obsidian仓库
- `POST /api/process/obsidian-content` - 处理Obsidian内容和附件

### OCR识别
- `POST /api/ocr/recognize` - OCR文字识别
- `POST /api/batch-ocr/` - 批量OCR处理

## 📊 系统状态API

- `GET /api/stats` - 获取系统统计信息
- `GET /api/sync/status` - 获取同步状态
- `POST /api/sync/attachments` - 同步附件

## 🖼️ 图片管理API (Cloudflare Images)

### 图片上传和管理
- `POST /upload` - 直接上传图片并生成笔记
- `GET /gallery` - 图片相册展示
- `POST /api/optimize/images` - 图片优化

### Gallery API (真实的Cloudflare Images集成)
- 通过 `uploadToCloudflareImages()` 函数上传图片
- 通过 `listCloudflareImages()` 函数获取图片列表
- 支持图片变体和CDN分发

## 🔄 GitHub同步API

### GitHub集成 (`/api/github-sync/`)
- `POST /api/github-sync/sync` - 同步文档到GitHub仓库
- `POST /api/github-sync/files` - 获取仓库文件列表
- `POST /api/github-sync/create-repo` - 创建新的GitHub仓库

### 真实GitHub API功能
- 支持多文档批量同步
- 自动提交和推送
- 仓库文件管理
- 分支操作

## 🌐 CDN替换API

### CDN URL替换 (`/api/cdn-replacement/`)
- `POST /api/cdn-replacement/replace` - 单文档CDN URL替换
- `POST /api/cdn-replacement/batch-replace` - 批量CDN URL替换
- `POST /api/cdn-replacement/validate-urls` - 验证URL有效性

## 📝 文章分享API

- `POST /api/share/article` - 分享单篇文章
- `POST /api/share/batch` - 批量分享文章
- `GET /api/share/configs` - 获取分享配置

## 🤖 自动化API

- `POST /api/sync/enhanced/` - 增强同步功能
- 支持自动化工作流
- 批量处理和优化

## ⚙️ 环境变量要求

真实API需要以下环境变量：

```bash
# Cloudflare Images
CLOUDFLARE_IMAGES_ACCOUNT_ID=your_account_id
CLOUDFLARE_IMAGES_API_TOKEN=your_api_token
CLOUDFLARE_IMAGES_ACCOUNT_HASH=your_hash

# GitHub
GITHUB_TOKEN=your_github_token
GITHUB_REPO_OWNER=your_username
GITHUB_REPO_NAME=your_repo

# OCR/AI
GLM_API_KEY=your_glm_key
GLM_API_BASE=https://open.bigmodel.cn/api/paas/v4
```

## 🚀 启动真实API服务

### 方式1: Cloudflare Workers本地开发
```bash
cd backend
npx wrangler dev --local
```

### 方式2: Node.js本地服务器
```bash
cd backend
npm run dev
```

## ❌ 当前问题

**simple-server.cjs 只提供模拟数据！**

当前运行在端口8787的 `simple-server.cjs` 只是一个模拟服务器，不包含：
- 真实的Cloudflare Images上传
- 真实的GitHub API调用
- 真实的OCR识别
- 真实的文件处理

需要启动真实的Cloudflare Workers服务或配置好的Node.js服务器。