# 配置指南

## 概述

本项目包含两个服务器：
- **模拟服务器** (`simple-server.cjs`): 提供模拟数据，用于演示和测试
- **真实API服务器** (`real-server.cjs`): 连接真实的外部服务

## 当前状态

### 已启动的服务
- ✅ 模拟服务器: `http://localhost:3000` (simple-server.cjs)
- ✅ 真实API服务器: `http://localhost:8788` (real-server.cjs)
- ✅ 前端服务: `http://localhost:8080`

### 前端页面
- **模拟版本**: `http://localhost:8080/gallery.html` (连接模拟服务器)
- **真实版本**: `http://localhost:8080/real-gallery.html` (连接真实API服务器)

## API服务状态

### 真实API服务器状态
```json
{
  "services": {
    "api": "healthy",
    "cloudflare": "needs-config",
    "github": "needs-config",
    "ocr": "needs-config"
  },
  "environment": {
    "cloudflare_configured": false,
    "github_configured": false,
    "ocr_configured": false
  }
}
```

## 配置真实API服务

要启用完整功能，需要在 `.env` 文件中配置以下真实的API密钥：

### 1. Cloudflare Images API
```env
# 从 Cloudflare Dashboard 获取
CLOUDFLARE_ACCOUNT_ID=your_actual_account_id
CLOUDFLARE_API_TOKEN=your_actual_api_token
CLOUDFLARE_IMAGES_ACCOUNT_HASH=your_actual_account_hash
CLOUDFLARE_IMAGES_VARIANT=public
```

### 2. GitHub API
```env
# 从 GitHub Settings > Developer settings > Personal access tokens 获取
GITHUB_TOKEN=your_actual_github_token
GITHUB_REPO_OWNER=your_username
GITHUB_REPO_NAME=your_repo_name
GITHUB_REPO_BRANCH=main
```

### 3. OCR/多模态模型 (GLM)
```env
# 从智谱AI平台获取
GLM_API_KEY=your_actual_glm_api_key
GLM_API_BASE=https://open.bigmodel.cn/api/paas/v4
GLM_MODEL=glm-4v
```

## 测试工作流程

### 当前可测试的功能
1. **系统状态检查**: 访问 `/api/stats`
2. **GitHub同步状态**: 访问 `/api/sync/status`
3. **图库管理**: 访问 `/api/gallery/images`
4. **前端界面**: 访问 `real-gallery.html`

### 配置后可用的完整功能
1. **图片上传到Cloudflare Images**
2. **本地图片替换为在线图床链接**
3. **自动同步到GitHub仓库**
4. **OCR文字识别**
5. **批量处理和导出**

## 启动命令

```bash
# 启动模拟服务器
node simple-server.cjs

# 启动真实API服务器
node real-server.cjs

# 启动前端服务
python3 -m http.server 8080
```

## 下一步

1. 根据需要配置真实的API密钥
2. 重启 `real-server.cjs` 以加载新配置
3. 测试完整的工作流程
4. 验证图片上传和GitHub同步功能