# AI 辅助笔记系统

将手机拍照的手写笔记自动转换为 Markdown + LaTeX，并同步到 Obsidian。

## 功能特点

- **多平台输入**: Telegram Bot 接收手机图片
- **智能OCR**: GLM-4.5/GLM-4V 多模态识别手写内容
- **手写OCR**: 支持百度、腾讯等多个OCR服务商的手写文字识别
- **LaTeX支持**: 自动识别数学公式并转换为 LaTeX 格式
- **图床集成**: Cloudflare Images 提供全球CDN加速
- **Obsidian同步**: 自动提交到Git仓库，Obsidian实时同步
- **会话聚合**: 连续发送的图片自动合并为一篇笔记
- **本地图片上传**: Obsidian插件自动上传本地图片到图床
- **批量处理**: 支持本地Obsidian笔记库的批量图片上传和链接更新

## 架构设计

```
手机拍照 → Telegram Bot → Cloudflare Workers → 多模态OCR → Cloudflare Images → Git仓库 → Obsidian同步
```

## 快速开始

### 1. 环境准备

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置文件，填入必要的API密钥
vim .env
```

### 2. 部署后端

```bash
cd backend
npm install
npm run deploy
```

### 3. 配置Telegram Bot

1. 与 @BotFather 对话创建新机器人
2. 获取 Bot Token 并填入 `.env`
3. 设置 Webhook 指向部署的 Cloudflare Workers

### 4. 安装Obsidian插件

将 `obsidian-plugin` 目录复制到你的 `.obsidian/plugins/` 中并启用。

### 5. 开始使用

#### Telegram Bot方式
发送图片到你的Telegram Bot，几秒钟后即可在Obsidian中看到转换后的笔记！

#### 手写OCR API方式
直接调用API进行手写文字识别：

```bash
# 快速测试
curl -X POST http://localhost:8787/api/ocr/handwritten \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/jpeg;base64,/9j/4AAQ...",
    "provider": "baidu",
    "options": {
      "language": "zh-CN",
      "enhance": true
    }
  }'
```

#### 本地Obsidian处理
批量处理本地笔记库中的图片：

```bash
# 安装依赖
npm install node-fetch

# 运行批量处理脚本
node process_local_obsidian.js
```

## 项目结构

```
├── backend/              # Cloudflare Workers后端
├── obsidian-plugin/      # Obsidian插件
├── docs/                 # 文档
├── .env.example         # 环境变量模板
└── README.md           # 项目说明
```

## 技术栈

- **后端**: TypeScript, Cloudflare Workers, Hono
- **图床**: Cloudflare Images
- **多模态AI**: GLM-4.5/GLM-4V (可切换OpenAI)
- **版本控制**: GitHub API
- **前端**: Obsidian Plugin API

## 文档指南

- 📖 **[快速开始](docs/QUICK_START.md)** - 5分钟上手手写OCR功能
- **[完整使用指南](docs/HANDWRITING_OCR_GUIDE.md)** - 详细的API文档和前端集成示例
- **[环境配置](docs/SETUP.md)** - 详细的部署和配置说明
- **[API文档](docs/API_USAGE.md)** - 完整的API接口说明
- **[任务清单](docs/TASKS.md)** - 开发进度和待办事项

## 配置说明

详细配置说明请查看 `docs/` 目录下的文档。