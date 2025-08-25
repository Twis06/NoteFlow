/**
 * Cloudflare Worker 入口（无框架版）
 * - GET /            简易上传页面 + 健康检查
 * - POST /webhook/telegram  Telegram Webhook 入口
 */
import { handleTelegramWebhook } from './router'
import { uploadToCloudflareImages } from './providers/images_cloudflare'
import { processImagesWithOCR } from './providers/ocr_glm'
import { buildMarkdownNote } from './services/note_builder'
import { submitToGitHub } from './providers/git_github'
import { processObsidianRepoAttachments } from './services/obsidian_processor'
import { listCloudflareImages } from './providers/images_cloudflare'
import { processHandwrittenNote, processMultipleHandwrittenNotes, HandwrittenBackupOptions } from './services/handwritten_backup'
import {
  handleProcessHandwritten,
  handleProcessHandwrittenFromUrl,
  handleProcessHandwrittenBatch,
  handleSyncAttachments,
  handleGetSyncStatus,
  handleOptimizeImages,
  handleGetStats,
  handleProcessObsidian,
  handleProcessObsidianContent,
  handleShareArticle,
  handleShareBatch,
  handleShareConfigs,
  handleEnhancedSync,
  handleOCRRecognition,
  batchOcrApp,
  githubSyncApp,
  cdnReplacementApp,
  automationApp
} from './routes/enhanced_api'

export default {
  /**
   * 全局 fetch 处理函数
   */
  async fetch(request: Request, env: any, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // 静态文件服务
    if (request.method === 'GET' && (url.pathname === '/app' || url.pathname === '/app/')) {
      // 返回前端主页面
      const html = `<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>双通道图片处理系统</title>
    <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
    <header class="header">
        <div class="container">
            <h1 class="logo">双通道图片处理系统</h1>
            <div class="status-indicator" id="connectionStatus">
                <span class="status-dot"></span>
                <span class="status-text">连接正常</span>
            </div>
        </div>
    </header>

    <main class="main">
        <div class="container">
            <!-- 快速操作面板 -->
            <section class="quick-actions">
                <h2>快速操作</h2>
                <div class="action-grid">
                    <button class="action-btn" id="refreshStatus">
                        <span class="icon">🔄</span>
                        <span>刷新状态</span>
                    </button>
                    <button class="action-btn" id="viewGallery">
                        <span class="icon">🖼️</span>
                        <span>查看相册</span>
                    </button>
                    <button class="action-btn" id="syncRepo">
                        <span class="icon">🔄</span>
                        <span>同步仓库</span>
                    </button>
                    <button class="action-btn" id="clearHistory">
                        <span class="icon">🗑️</span>
                        <span>清空历史</span>
                    </button>
                </div>
            </section>

            <!-- 上传区域 -->
            <section class="upload-section">
                <h2>图片上传处理</h2>
                <div class="upload-area" id="uploadArea">
                    <div class="upload-content">
                        <div class="upload-icon">📁</div>
                        <p class="upload-text">拖拽图片到此处或点击选择文件</p>
                        <p class="upload-hint">支持 JPG、PNG、GIF 格式，单个文件最大 10MB</p>
                        <input type="file" id="fileInput" multiple accept="image/*" style="display: none;">
                        <button class="upload-btn" id="selectFiles">选择文件</button>
                    </div>
                </div>

                <!-- 上传选项 -->
                <div class="upload-options">
                    <div class="option-group">
                        <label class="option-label">
                            <input type="radio" name="processType" value="handwritten" checked>
                            <span class="option-text">手写笔记处理</span>
                        </label>
                        <label class="option-label">
                            <input type="radio" name="processType" value="obsidian">
                            <span class="option-text">Obsidian 增强处理</span>
                        </label>
                        <label class="option-label">
                            <input type="radio" name="processType" value="direct">
                            <span class="option-text">直接上传</span>
                        </label>
                    </div>
                    <div class="option-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="autoSync" checked>
                            <span class="checkmark"></span>
                            <span class="option-text">自动同步到 GitHub</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" id="enableShare">
                            <span class="checkmark"></span>
                            <span class="option-text">启用文章分享</span>
                        </label>
                    </div>
                </div>
            </section>

            <!-- 状态网格 -->
            <section class="status-grid">
                <div class="status-card">
                    <h3>系统统计</h3>
                    <div class="stat-item">
                        <span class="stat-label">总处理数量:</span>
                        <span class="stat-value" id="totalProcessed">-</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">今日处理:</span>
                        <span class="stat-value" id="todayProcessed">-</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">成功率:</span>
                        <span class="stat-value" id="successRate">-</span>
                    </div>
                </div>

                <div class="status-card">
                    <h3>同步状态</h3>
                    <div class="stat-item">
                        <span class="stat-label">GitHub 状态:</span>
                        <span class="stat-value" id="githubStatus">-</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">最后同步:</span>
                        <span class="stat-value" id="lastSync">-</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">待同步文件:</span>
                        <span class="stat-value" id="pendingFiles">-</span>
                    </div>
                </div>

                <div class="status-card">
                    <h3>仓库状态</h3>
                    <div class="stat-item">
                        <span class="stat-label">仓库:</span>
                        <span class="stat-value" id="repoName">Twis06/notes</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">分支:</span>
                        <span class="stat-value" id="currentBranch">-</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">最新提交:</span>
                        <span class="stat-value" id="latestCommit">-</span>
                    </div>
                </div>
            </section>

            <!-- 处理进度 -->
            <section class="progress-section" id="progressSection" style="display: none;">
                <h2>处理进度</h2>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                    <div class="progress-text" id="progressText">准备中...</div>
                </div>
                <div class="file-list" id="fileList"></div>
            </section>

            <!-- 结果展示 -->
            <section class="results-section" id="resultsSection" style="display: none;">
                <h2>处理结果</h2>
                <div class="results-container" id="resultsContainer"></div>
            </section>

            <!-- 历史记录 -->
            <section class="history-section">
                <h2>操作历史</h2>
                <div class="history-container" id="historyContainer">
                    <p class="empty-state">暂无操作记录</p>
                </div>
            </section>
        </div>
    </main>

    <footer class="footer">
        <div class="container">
            <p>&copy; 2024 双通道图片处理系统. 基于 Cloudflare Workers 构建.</p>
        </div>
    </footer>

    <!-- 通知组件 -->
    <div class="notification-container" id="notificationContainer"></div>

    <!-- 模态框 -->
    <div class="modal" id="modal" style="display: none;">
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title" id="modalTitle">标题</h3>
                <button class="modal-close" id="modalClose">&times;</button>
            </div>
            <div class="modal-body" id="modalBody">
                内容
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="modalCancel">取消</button>
                <button class="btn btn-primary" id="modalConfirm">确认</button>
            </div>
        </div>
    </div>

    <script src="/static/app.js"></script>
</body>
</html>`;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // 静态CSS文件
    if (request.method === 'GET' && url.pathname === '/static/styles.css') {
      const css = await getStaticCSS();
      return new Response(css, { status: 200, headers: { 'Content-Type': 'text/css; charset=utf-8' } });
    }

    // 静态JS文件
    if (request.method === 'GET' && url.pathname === '/static/app.js') {
      const js = await getStaticJS();
      return new Response(js, { status: 200, headers: { 'Content-Type': 'application/javascript; charset=utf-8' } });
    }

    // Demo页面：手写OCR演示页面
    if (request.method === 'GET' && url.pathname === '/demo.html') {
      const demoHtml = await getDemoHTML()
      return new Response(demoHtml, { 
        status: 200, 
        headers: { 'Content-Type': 'text/html; charset=utf-8' } 
      })
    }

    // 首页：提供简易上传页面（multipart/form-data）
    if (request.method === 'GET' && url.pathname === '/') {
      const html = `<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Note Uploader</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; padding: 24px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 12px; }
    form { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; background: #fafafa; }
    .row { margin: 12px 0; }
    input[type=file] { padding: 8px; }
    button { background: #111827; color: white; border: none; padding: 10px 14px; border-radius: 8px; cursor: pointer; }
    button:hover { background: #0b1220; }
    #out { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #065f46; margin-top: 12px; }
  </style>
</head>
<body>
  <h1>Note Uploader</h1>
  <form id="f" method="POST" action="/upload" enctype="multipart/form-data">
    <div class="row">
      <input type="file" name="files" multiple accept="image/*" />
    </div>
    <div class="row">
      <button type="submit">Upload & Commit</button>
    </div>
  </form>
  <div id="out"></div>
  <script>
    const f = document.getElementById('f');
    const out = document.getElementById('out');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      const res = await fetch('/upload', { method: 'POST', body: fd });
      const t = await res.text();
      out.textContent = t;
    });
  </script>
</body>
</html>`
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    // 直接上传图片以生成并同步笔记（用于本地/无Telegram测试）
    if (request.method === 'POST' && url.pathname === '/upload') {
      try {
        // 可选鉴权：如设置了 UPLOAD_SECRET，则要求请求头提供 x-upload-secret
        const uploadSecret = env.UPLOAD_SECRET
        if (uploadSecret) {
          const provided = request.headers.get('x-upload-secret')
          if (provided !== uploadSecret) {
            return new Response('unauthorized', { status: 401 })
          }
        }

        const res = await handleDirectUpload(request, env)
        return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } })
      } catch (err: any) {
        // 新增：打印详细错误，便于定位 500 的原因
        console.error('[upload] failed:', err?.stack || err)
        return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
    }

    // Telegram Webhook
    if (request.method === 'POST' && url.pathname === '/webhook/telegram') {
      const secret = request.headers.get('x-telegram-bot-secret-token') || request.headers.get('x-telegram-bot-api-secret-token')
      if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response('unauthorized', { status: 401 })
      }
      try {
        const update: any = await request.json()
        const res = await handleTelegramWebhook(update, env)
        return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } })
      } catch (err: any) {
        return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
    }

    // 批量处理 Obsidian 仓库中的附件，改写 Markdown 链接并提交
    if (request.method === 'POST' && url.pathname === '/obsidian/process') {
      try {
        const body = (await request.json().catch(() => ({}))) as any
        const baseDir = body?.baseDir || ''
        const dryRun = Boolean(body?.dryRun)
        const result = await processObsidianRepoAttachments(env, { baseDir, dryRun })
        return new Response(JSON.stringify({ ok: true, ...result }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      } catch (err: any) {
        console.error('[obsidian/process] failed:', err?.stack || err)
        return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
    }

    // 新增API路由：处理手写笔记照片（通道A）
    if (request.method === 'POST' && url.pathname === '/api/process/handwritten') {
      return await handleProcessHandwritten(request, env)
    }

    // 新增API路由：从URL处理手写笔记
    if (request.method === 'POST' && url.pathname === '/api/process/handwritten-url') {
      return await handleProcessHandwrittenFromUrl(request, env)
    }

    // 新增API路由：批量处理手写笔记
    if (request.method === 'POST' && url.pathname === '/api/process/handwritten-batch') {
      return await handleProcessHandwrittenBatch(request, env)
    }

    // 新增API路由：同步attachments文件夹（通道B）
    if (request.method === 'POST' && url.pathname === '/api/sync/attachments') {
      return await handleSyncAttachments(request, env)
    }

    // 新增API路由：获取同步状态
    if (request.method === 'GET' && url.pathname === '/api/sync/status') {
      return await handleGetSyncStatus(request, env)
    }

    // 新增API路由：优化图片
    if (request.method === 'POST' && url.pathname === '/api/optimize/images') {
      return await handleOptimizeImages(request, env)
    }

    // 新增API路由：获取统计信息
    if (request.method === 'GET' && url.pathname === '/api/stats') {
      return await handleGetStats(request, env)
    }

    // 新增API路由：增强版Obsidian处理
    if (request.method === 'POST' && url.pathname === '/api/process/obsidian') {
      return await handleProcessObsidian(request, env)
    }

    // 新增API路由：处理Obsidian内容（支持直接上传文件内容）
    if (request.method === 'POST' && url.pathname === '/api/process/obsidian-content') {
      return await handleProcessObsidianContent(request, env)
    }

    // 新增API路由：分享文章到指定平台
    if (request.method === 'POST' && url.pathname === '/api/share/article') {
      return await handleShareArticle(request, env)
    }

    // 新增API路由：批量分享文章
    if (request.method === 'POST' && url.pathname === '/api/share/batch') {
      return await handleShareBatch(request, env)
    }

    // 新增API路由：管理分享配置
    if ((request.method === 'GET' || request.method === 'POST' || request.method === 'DELETE') && 
        url.pathname.startsWith('/api/share/configs')) {
      return await handleShareConfigs(request, env)
    }

    // 新增API路由：增强同步控制
    if ((request.method === 'POST' || request.method === 'GET') && 
        url.pathname.startsWith('/api/sync/enhanced/')) {
      return await handleEnhancedSync(request, env)
    }

    // 新增API路由：手写OCR识别
    if (request.method === 'POST' && url.pathname === '/api/ocr/recognize') {
      return await handleOCRRecognition(request, env)
    }

    // 新增API路由：批量OCR处理
    if (url.pathname.startsWith('/api/batch-ocr/')) {
      const subPath = url.pathname.replace('/api/batch-ocr', '')
      const modifiedRequest = new Request(request.url.replace('/api/batch-ocr', ''), {
        method: request.method,
        headers: request.headers,
        body: request.body
      })
      return await batchOcrApp.fetch(modifiedRequest, env)
    }

    // 新增API路由：GitHub同步
    if (url.pathname.startsWith('/api/github-sync/')) {
      const subPath = url.pathname.replace('/api/github-sync', '')
      const modifiedRequest = new Request(request.url.replace('/api/github-sync', ''), {
        method: request.method,
        headers: request.headers,
        body: request.body
      })
      return await githubSyncApp.fetch(modifiedRequest, env)
    }

    // 新增API路由：CDN URL替换
    if (url.pathname.startsWith('/api/cdn-replacement/')) {
      const subPath = url.pathname.replace('/api/cdn-replacement', '')
      const modifiedRequest = new Request(request.url.replace('/api/cdn-replacement', ''), {
        method: request.method,
        headers: request.headers,
        body: request.body
      })
      return await cdnReplacementApp.fetch(modifiedRequest, env)
    }

    // 图片相册：简单网格视图
    if (request.method === 'GET' && url.pathname === '/gallery') {
      try {
        const page = Number(url.searchParams.get('page') || '1')
        const perPage = Number(url.searchParams.get('per_page') || '50')
        const data = await listCloudflareImages(env, page, perPage)
        const accountHash = env.CLOUDFLARE_IMAGES_ACCOUNT_HASH
        const variant = env.CLOUDFLARE_IMAGES_VARIANT || 'public'
        const cards = (data.images || []).map((img: any) => {
          const id = img.id
          const thumb = `https://imagedelivery.net/${accountHash}/${id}/${variant}`
          const created = new Date(img.uploaded).toLocaleString('zh-CN')
          const sizeKB = Math.round((img.meta?.size || 0) / 1024)
          return `<a class="card" href="${thumb}" target="_blank" rel="noreferrer"><img src="${thumb}" alt="${id}"/><div class="meta"><span>${created}</span><span>${sizeKB} KB</span></div></a>`
        }).join('')

        const html = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Images Gallery</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; padding: 16px; color: #111; }
header { display: flex; align-items: baseline; gap: 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-top: 16px; }
.card { display: block; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; background: #fff; text-decoration: none; color: inherit; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.card img { width: 100%; height: 140px; object-fit: cover; display: block; }
.card .meta { display: flex; justify-content: space-between; padding: 8px; font-size: 12px; color: #374151; }
.pager { margin-top: 12px; display: flex; gap: 8px; }
.pager a { padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 8px; text-decoration: none; color: #111; }
</style>
</head>
<body>
<header>
  <h1>Images Gallery</h1>
  <span>共 ${data.total_count || 0} 张，当前第 ${data.page || 1} 页</span>
</header>
<div class="grid">${cards}</div>
<div class="pager">
  ${(data.page || 1) > 1 ? `<a href="/gallery?page=${(data.page || 1) - 1}&per_page=${data.per_page || perPage}">上一页</a>` : ''}
  ${((data.page || 1) * (data.per_page || perPage)) < (data.total_count || 0) ? `<a href="/gallery?page=${(data.page || 1) + 1}&per_page=${data.per_page || perPage}">下一页</a>` : ''}
</div>
</body>
</html>`
        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      } catch (err: any) {
        console.error('[gallery] failed:', err?.stack || err)
        return new Response('Gallery error: ' + String(err?.message || err), { status: 500 })
      }
    }

    return new Response('not found', { status: 404 })
  }
} satisfies ExportedHandler

/**
 * 处理直接图片上传以生成并提交笔记
 * 支持 multipart/form-data（字段名：files，可多选）
 * 如需从URL抓取，可在后续扩展 application/json: { image_urls: string[] }
 */
async function handleDirectUpload(request: Request, env: any) {
  const ctype = request.headers.get('content-type') || ''

  // 仅支持 multipart 表单
  if (!ctype.includes('multipart/form-data')) {
    throw new Error('Unsupported Content-Type. Use multipart/form-data with field "files"')
  }

  const form = await request.formData()
  // 兼容常见字段名：files 或 file
  const fileEntries: File[] = []
  const filesField = form.getAll('files')
  const fileField = form.get('file')
  for (const v of filesField) {
    if (v instanceof File) fileEntries.push(v)
  }
  if (fileField instanceof File) fileEntries.push(fileField)

  if (!fileEntries.length) {
    throw new Error('No files provided. Use field name "files" or "file"')
  }

  // 上传到 Cloudflare Images
  const uploaded: { id: string; url: string; filename: string }[] = []
  for (const f of fileEntries) {
    const buf = new Uint8Array(await f.arrayBuffer())
    const filename = f.name || 'image.jpg'
    const up = await uploadToCloudflareImages(buf, filename, env)
    uploaded.push({ id: up.id, url: up.url, filename })
  }

  // OCR（GLM-4.5V via SiliconFlow）
  const body = await processImagesWithOCR(uploaded.map(x => x.url), env)
  // 生成 Markdown
  const built = buildMarkdownNote({ images: uploaded, body, timezone: env.TIMEZONE })
  // 提交到 GitHub
  await submitToGitHub(built, env)

  return { ok: true, message: 'committed', result: { path: `${built.dir}/${built.filename}` } }
}

/**
 * 获取静态CSS内容
 */
async function getStaticCSS(): Promise<string> {
  return `/* 全局样式重置 */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f8fafc;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

/* 头部样式 */
.header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 1rem 0;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.header .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.logo {
    font-size: 1.5rem;
    font-weight: 600;
}

.status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
}

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #10b981;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

.status-text {
    font-size: 0.9rem;
}

/* 主要内容区域 */
.main {
    padding: 2rem 0;
}

.main section {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 2rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    border: 1px solid #e5e7eb;
}

.main h2 {
    color: #1f2937;
    margin-bottom: 1rem;
    font-size: 1.25rem;
    font-weight: 600;
}

/* 快速操作面板 */
.action-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
}

.action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 1rem;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
    color: #374151;
}

.action-btn:hover {
    border-color: #3b82f6;
    background: #f8fafc;
    transform: translateY(-2px);
}

.action-btn .icon {
    font-size: 1.5rem;
}

/* 上传区域 */
.upload-area {
    border: 2px dashed #d1d5db;
    border-radius: 12px;
    padding: 2rem;
    text-align: center;
    transition: all 0.3s ease;
    cursor: pointer;
}

.upload-area:hover,
.upload-area.dragover {
    border-color: #3b82f6;
    background-color: #f0f9ff;
}

.upload-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
}

.upload-icon {
    font-size: 3rem;
    opacity: 0.6;
}

.upload-text {
    font-size: 1.1rem;
    color: #374151;
    margin: 0;
}

.upload-hint {
    font-size: 0.9rem;
    color: #6b7280;
    margin: 0;
}

.upload-btn {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    transition: background-color 0.2s ease;
}

.upload-btn:hover {
    background: #2563eb;
}

/* 上传选项 */
.upload-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e5e7eb;
}

.option-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.option-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 6px;
    transition: background-color 0.2s ease;
}

.option-label:hover {
    background-color: #f9fafb;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 6px;
    transition: background-color 0.2s ease;
}

.checkbox-label:hover {
    background-color: #f9fafb;
}

.checkmark {
    width: 18px;
    height: 18px;
    border: 2px solid #d1d5db;
    border-radius: 3px;
    position: relative;
    transition: all 0.2s ease;
}

input[type="checkbox"]:checked + .checkmark {
    background-color: #3b82f6;
    border-color: #3b82f6;
}

input[type="checkbox"]:checked + .checkmark::after {
    content: '✓';
    position: absolute;
    top: -2px;
    left: 2px;
    color: white;
    font-size: 12px;
    font-weight: bold;
}

.option-text {
    font-size: 0.95rem;
    color: #374151;
}

/* 状态网格 */
.status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
}

.status-card {
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.25rem;
}

.status-card h3 {
    color: #1f2937;
    margin-bottom: 1rem;
    font-size: 1.1rem;
    font-weight: 600;
}

.stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid #e5e7eb;
}

.stat-item:last-child {
    border-bottom: none;
}

.stat-label {
    color: #6b7280;
    font-size: 0.9rem;
}

.stat-value {
    color: #1f2937;
    font-weight: 600;
    font-size: 0.9rem;
}

/* 按钮样式 */
.btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 500;
    transition: all 0.2s ease;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
}

.btn-primary {
    background: #3b82f6;
    color: white;
}

.btn-primary:hover {
    background: #2563eb;
}

.btn-secondary {
    background: #6b7280;
    color: white;
}

.btn-secondary:hover {
    background: #4b5563;
}

.btn-success {
    background: #10b981;
    color: white;
}

.btn-success:hover {
    background: #059669;
}

.btn-danger {
    background: #ef4444;
    color: white;
}

.btn-danger:hover {
    background: #dc2626;
}

/* 处理进度区域 */
.progress-container {
    margin-bottom: 1.5rem;
}

.progress-bar {
    width: 100%;
    height: 8px;
    background-color: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 0.5rem;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #1d4ed8);
    border-radius: 4px;
    transition: width 0.3s ease;
    width: 0%;
}

.progress-text {
    text-align: center;
    color: #6b7280;
    font-size: 0.9rem;
}

/* 文件列表 */
.file-list {
    display: grid;
    gap: 0.75rem;
}

.file-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
}

.file-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.file-icon {
    font-size: 1.25rem;
}

.file-details {
    display: flex;
    flex-direction: column;
}

.file-name {
    font-weight: 500;
    color: #1f2937;
    font-size: 0.9rem;
}

.file-size {
    color: #6b7280;
    font-size: 0.8rem;
}

.file-status {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 500;
}

.status-pending {
    background: #fef3c7;
    color: #92400e;
}

.status-processing {
    background: #dbeafe;
    color: #1e40af;
}

.status-completed {
    background: #d1fae5;
    color: #065f46;
}

.status-error {
    background: #fee2e2;
    color: #991b1b;
}

/* 结果展示区域 */
.results-container {
    display: grid;
    gap: 1rem;
}

.result-item {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
}

.result-header {
    background: #f8fafc;
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.result-title {
    font-weight: 600;
    color: #1f2937;
}

.result-actions {
    display: flex;
    gap: 0.5rem;
}

.result-content {
    padding: 1rem;
}

.result-image {
    max-width: 200px;
    border-radius: 6px;
    margin-bottom: 1rem;
}

.result-text {
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 1rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.9rem;
    line-height: 1.5;
    white-space: pre-wrap;
    max-height: 300px;
    overflow-y: auto;
}

/* 历史记录 */
.history-container {
    max-height: 400px;
    overflow-y: auto;
}

.history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
    transition: background-color 0.2s ease;
}

.history-item:hover {
    background-color: #f9fafb;
}

.history-item:last-child {
    border-bottom: none;
}

.history-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.history-action {
    font-weight: 500;
    color: #1f2937;
}

.history-time {
    color: #6b7280;
    font-size: 0.8rem;
}

.history-status {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 500;
}

.empty-state {
    text-align: center;
    color: #6b7280;
    padding: 2rem;
    font-style: italic;
}

/* 底部 */
.footer {
    background: #1f2937;
    color: #d1d5db;
    text-align: center;
    padding: 1.5rem 0;
    margin-top: 2rem;
}

.footer p {
    margin: 0;
    font-size: 0.9rem;
}

/* 通知组件 */
.notification-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.notification {
    padding: 1rem 1.5rem;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease;
    max-width: 400px;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

.notification-success {
    background: #10b981;
}

.notification-error {
    background: #ef4444;
}

.notification-warning {
    background: #f59e0b;
}

.notification-info {
    background: #3b82f6;
}

/* 模态框 */
.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    border-radius: 12px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
}

.modal-title {
    margin: 0;
    color: #1f2937;
    font-size: 1.25rem;
    font-weight: 600;
}

.modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #6b7280;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: background-color 0.2s ease;
}

.modal-close:hover {
    background: #f3f4f6;
}

.modal-body {
    padding: 1.5rem;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .container {
        padding: 0 15px;
    }
    
    .header .container {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
    }
    
    .action-grid {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .upload-options {
        grid-template-columns: 1fr;
        gap: 1rem;
    }
    
    .status-grid {
        grid-template-columns: 1fr;
    }
    
    .modal-content {
        margin: 20px;
        width: calc(100% - 40px);
    }
    
    .notification-container {
        left: 20px;
        right: 20px;
    }
    
    .notification {
        max-width: none;
    }
}`;
}

/**
 * 获取静态JS内容
 */
async function getStaticJS(): Promise<string> {
  return `/**
 * 双通道图片处理系统前端应用
 * 主要功能：文件上传、OCR处理、状态监控、结果展示
 */
class ImageProcessingApp {
    constructor() {
        this.apiBase = '';
        this.maxConcurrentUploads = 3;
        this.uploadQueue = [];
        this.activeUploads = 0;
        this.history = this.loadHistory();
        
        this.init();
    }

    /**
     * 初始化应用
     */
    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.updateStatus();
        this.loadHistory();
        
        // 定期更新状态
        setInterval(() => this.updateStatus(), 30000);
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 文件选择
        document.getElementById('selectFiles').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFiles(Array.from(e.target.files));
        });
        
        // 快速操作按钮
        document.getElementById('refreshStatus').addEventListener('click', () => {
            this.updateStatus();
            this.showNotification('状态已刷新', 'success');
        });
        
        document.getElementById('viewGallery').addEventListener('click', () => {
            window.open('/gallery', '_blank');
        });
        
        document.getElementById('syncRepo').addEventListener('click', () => {
            this.syncRepository();
        });
        
        document.getElementById('clearHistory').addEventListener('click', () => {
            this.clearHistory();
        });
        
        // 模态框
        document.getElementById('modalClose').addEventListener('click', () => {
            this.hideModal();
        });
        
        document.getElementById('modalCancel').addEventListener('click', () => {
            this.hideModal();
        });
        
        // 点击模态框外部关闭
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                this.hideModal();
            }
        });
    }

    /**
     * 设置拖拽上传
     */
    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = Array.from(e.dataTransfer.files).filter(file => 
                file.type.startsWith('image/')
            );
            
            if (files.length > 0) {
                this.handleFiles(files);
            } else {
                this.showNotification('请选择图片文件', 'warning');
            }
        });
        
        uploadArea.addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
    }

    /**
     * 处理文件上传
     */
    async handleFiles(files) {
        if (files.length === 0) return;
        
        // 验证文件
        const validFiles = files.filter(file => {
            if (!file.type.startsWith('image/')) {
                this.showNotification(\`文件 \${file.name} 不是图片格式\`, 'warning');
                return false;
            }
            if (file.size > 10 * 1024 * 1024) {
                this.showNotification(\`文件 \${file.name} 超过10MB限制\`, 'warning');
                return false;
            }
            return true;
        });
        
        if (validFiles.length === 0) return;
        
        // 显示进度区域
        this.showProgressSection();
        this.updateFileList(validFiles);
        
        // 获取处理类型
        const processType = document.querySelector('input[name="processType"]:checked').value;
        const autoSync = document.getElementById('autoSync').checked;
        const enableShare = document.getElementById('enableShare').checked;
        
        // 添加到上传队列
        for (const file of validFiles) {
            this.uploadQueue.push({
                file,
                processType,
                autoSync,
                enableShare,
                status: 'pending'
            });
        }
        
        // 开始处理队列
        this.processUploadQueue();
    }

    /**
     * 处理上传队列
     */
    async processUploadQueue() {
        while (this.uploadQueue.length > 0 && this.activeUploads < this.maxConcurrentUploads) {
            const uploadItem = this.uploadQueue.shift();
            this.activeUploads++;
            
            try {
                await this.processFile(uploadItem);
            } catch (error) {
                console.error('文件处理失败:', error);
                this.updateFileStatus(uploadItem.file.name, 'error');
                this.showNotification(\`处理文件 \${uploadItem.file.name} 失败\`, 'error');
            } finally {
                this.activeUploads--;
                this.updateProgress();
            }
        }
        
        // 所有文件处理完成
        if (this.uploadQueue.length === 0 && this.activeUploads === 0) {
            this.showNotification('所有文件处理完成', 'success');
            setTimeout(() => {
                this.hideProgressSection();
            }, 3000);
        }
    }

    /**
     * 处理单个文件
     */
    async processFile(uploadItem) {
        const { file, processType, autoSync, enableShare } = uploadItem;
        
        this.updateFileStatus(file.name, 'processing');
        
        const formData = new FormData();
        formData.append('files', file);
        
        let endpoint;
        switch (processType) {
            case 'handwritten':
                endpoint = '/api/process/handwritten';
                break;
            case 'obsidian':
                endpoint = '/api/process/obsidian';
                break;
            case 'direct':
            default:
                endpoint = '/upload';
                break;
        }
        
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
        }
        
        const result = await response.json();
        
        this.updateFileStatus(file.name, 'completed');
        this.addToHistory({
            action: \`\${processType} 处理\`,
            file: file.name,
            status: 'success',
            time: new Date().toISOString(),
            result
        });
        
        this.showResult(file, result);
        
        // 如果启用分享，调用分享API
        if (enableShare && result.ok) {
            try {
                await this.shareResult(result);
            } catch (error) {
                console.error('分享失败:', error);
            }
        }
    }

    /**
     * 更新文件状态
     */
    updateFileStatus(fileName, status) {
        const fileItems = document.querySelectorAll('.file-item');
        fileItems.forEach(item => {
            const nameElement = item.querySelector('.file-name');
            if (nameElement && nameElement.textContent === fileName) {
                const statusElement = item.querySelector('.file-status');
                if (statusElement) {
                    statusElement.className = \`file-status status-\${status}\`;
                    statusElement.textContent = this.getStatusText(status);
                }
            }
        });
    }

    /**
     * 获取状态文本
     */
    getStatusText(status) {
        const statusMap = {
            pending: '等待中',
            processing: '处理中',
            completed: '已完成',
            error: '失败'
        };
        return statusMap[status] || status;
    }

    /**
     * 更新进度
     */
    updateProgress() {
        const totalFiles = document.querySelectorAll('.file-item').length;
        const completedFiles = document.querySelectorAll('.status-completed, .status-error').length;
        const progress = totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 0;
        
        document.getElementById('progressFill').style.width = \`\${progress}%\`;
        document.getElementById('progressText').textContent = 
            \`已处理 \${completedFiles}/\${totalFiles} 个文件\`;
    }

    /**
     * 显示进度区域
     */
    showProgressSection() {
        document.getElementById('progressSection').style.display = 'block';
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('progressText').textContent = '准备中...';
    }

    /**
     * 隐藏进度区域
     */
    hideProgressSection() {
        document.getElementById('progressSection').style.display = 'none';
        document.getElementById('fileList').innerHTML = '';
    }

    /**
     * 更新文件列表
     */
    updateFileList(files) {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';
        
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = \`
                <div class="file-info">
                    <div class="file-icon">📷</div>
                    <div class="file-details">
                        <div class="file-name">\${file.name}</div>
                        <div class="file-size">\${this.formatFileSize(file.size)}</div>
                    </div>
                </div>
                <div class="file-status status-pending">等待中</div>
            \`;
            fileList.appendChild(fileItem);
        });
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 显示处理结果
     */
    showResult(file, result) {
        const resultsSection = document.getElementById('resultsSection');
        const resultsContainer = document.getElementById('resultsContainer');
        
        resultsSection.style.display = 'block';
        
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        
        const imageUrl = URL.createObjectURL(file);
        
        resultItem.innerHTML = \`
            <div class="result-header">
                <div class="result-title">\${file.name}</div>
                <div class="result-actions">
                    <button class="btn btn-primary btn-sm" onclick="app.copyResult('\${result.result?.path || ''}')">复制路径</button>
                    <button class="btn btn-secondary btn-sm" onclick="app.downloadResult('\${file.name}', '\${JSON.stringify(result).replace(/'/g, "\\'")}')">下载结果</button>
                </div>
            </div>
            <div class="result-content">
                <img src="\${imageUrl}" alt="\${file.name}" class="result-image">
                <div class="result-text">\${JSON.stringify(result, null, 2)}</div>
            </div>
        \`;
        
        resultsContainer.appendChild(resultItem);
        
        // 滚动到结果区域
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * 复制结果
     */
    copyResult(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('已复制到剪贴板', 'success');
        }).catch(() => {
            this.showNotification('复制失败', 'error');
        });
    }

    /**
     * 下载结果
     */
    downloadResult(fileName, resultData) {
        const blob = new Blob([resultData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = \`\${fileName}_result.json\`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 更新系统状态
     */
    async updateStatus() {
        try {
            // 更新系统统计
            const statsResponse = await fetch('/api/stats');
            if (statsResponse.ok) {
                const stats = await statsResponse.json();
                this.updateStats(stats);
            }
            
            // 更新同步状态
            const syncResponse = await fetch('/api/sync/status');
            if (syncResponse.ok) {
                const syncStatus = await syncResponse.json();
                this.updateSyncStatus(syncStatus);
            }
            
            // 更新连接状态
            this.updateConnectionStatus(true);
        } catch (error) {
            console.error('更新状态失败:', error);
            this.updateConnectionStatus(false);
        }
    }

    /**
     * 更新统计信息
     */
    updateStats(stats) {
        document.getElementById('totalProcessed').textContent = stats.totalProcessed || '-';
        document.getElementById('todayProcessed').textContent = stats.todayProcessed || '-';
        document.getElementById('successRate').textContent = stats.successRate ? \`\${stats.successRate}%\` : '-';
    }

    /**
     * 更新同步状态
     */
    updateSyncStatus(syncStatus) {
        document.getElementById('githubStatus').textContent = syncStatus.githubStatus || '-';
        document.getElementById('lastSync').textContent = syncStatus.lastSync ? 
            new Date(syncStatus.lastSync).toLocaleString('zh-CN') : '-';
        document.getElementById('pendingFiles').textContent = syncStatus.pendingFiles || '-';
        document.getElementById('currentBranch').textContent = syncStatus.currentBranch || '-';
        document.getElementById('latestCommit').textContent = syncStatus.latestCommit ? 
            syncStatus.latestCommit.substring(0, 8) : '-';
    }

    /**
     * 更新连接状态
     */
    updateConnectionStatus(isConnected) {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');
        
        if (isConnected) {
            statusDot.style.backgroundColor = '#10b981';
            statusText.textContent = '连接正常';
        } else {
            statusDot.style.backgroundColor = '#ef4444';
            statusText.textContent = '连接异常';
        }
    }

    /**
     * 同步仓库
     */
    async syncRepository() {
        try {
            this.showNotification('开始同步仓库...', 'info');
            
            const response = await fetch('/api/sync/enhanced/manual', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    force: false,
                    dryRun: false
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showNotification('仓库同步成功', 'success');
                this.addToHistory({
                    action: '仓库同步',
                    status: 'success',
                    time: new Date().toISOString(),
                    result
                });
                this.updateStatus();
            } else {
                throw new Error(\`同步失败: \${response.statusText}\`);
            }
        } catch (error) {
            console.error('同步仓库失败:', error);
            this.showNotification(\`同步失败: \${error.message}\`, 'error');
        }
    }

    /**
     * 分享结果
     */
    async shareResult(result) {
        const response = await fetch('/api/share/article', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: result,
                platforms: ['github'],
                autoPublish: true
            })
        });
        
        if (response.ok) {
            this.showNotification('分享成功', 'success');
        } else {
            throw new Error('分享失败');
        }
    }

    /**
     * 添加到历史记录
     */
    addToHistory(item) {
        this.history.unshift(item);
        // 限制历史记录数量
        if (this.history.length > 100) {
            this.history = this.history.slice(0, 100);
        }
        this.saveHistory();
        this.renderHistory();
    }

    /**
     * 加载历史记录
     */
    loadHistory() {
        try {
            const saved = localStorage.getItem('imageProcessingHistory');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('加载历史记录失败:', error);
            return [];
        }
    }

    /**
     * 保存历史记录
     */
    saveHistory() {
        try {
            localStorage.setItem('imageProcessingHistory', JSON.stringify(this.history));
        } catch (error) {
            console.error('保存历史记录失败:', error);
        }
    }

    /**
     * 渲染历史记录
     */
    renderHistory() {
        const container = document.getElementById('historyContainer');
        
        if (this.history.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无操作记录</p>';
            return;
        }
        
        container.innerHTML = this.history.map(item => \`
            <div class="history-item">
                <div class="history-info">
                    <div class="history-action">\${this.escapeHtml(item.action)}\${item.file ? \` - \${this.escapeHtml(item.file)}\` : ''}</div>
                    <div class="history-time">\${new Date(item.time).toLocaleString('zh-CN')}</div>
                </div>
                <div class="history-status status-\${item.status}">\${this.getStatusText(item.status)}</div>
            </div>
        \`).join('');
    }

    /**
     * 清空历史记录
     */
    clearHistory() {
        this.showModal('确认清空', '确定要清空所有历史记录吗？此操作不可撤销。', () => {
            this.history = [];
            this.saveHistory();
            this.renderHistory();
            this.showNotification('历史记录已清空', 'success');
        });
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        notification.className = \`notification notification-\${type}\`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        // 自动移除通知
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    /**
     * 显示模态框
     */
    showModal(title, content, onConfirm) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = content;
        document.getElementById('modal').style.display = 'flex';
        
        const confirmBtn = document.getElementById('modalConfirm');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            if (onConfirm) onConfirm();
            this.hideModal();
        });
    }

    /**
     * 隐藏模态框
     */
    hideModal() {
        document.getElementById('modal').style.display = 'none';
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化应用
const app = new ImageProcessingApp();

// 全局错误处理
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
    app.showNotification('发生未知错误，请刷新页面重试', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
    app.showNotification('网络请求失败，请检查连接', 'error');
});`;
}

/**
 * 获取Demo页面HTML内容
 */
async function getDemoHTML(): Promise<string> {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>手写OCR演示 - AI辅助笔记系统</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; padding: 20px;
        }
        .container {
            max-width: 800px; margin: 0 auto; background: white;
            border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white; padding: 30px; text-align: center;
        }
        .header h1 { font-size: 28px; margin-bottom: 8px; font-weight: 600; }
        .header p { opacity: 0.9; font-size: 16px; }
        .content { padding: 40px; }
        .upload-area {
            border: 3px dashed #e5e7eb; border-radius: 12px; padding: 40px;
            text-align: center; transition: all 0.3s ease; cursor: pointer; margin-bottom: 30px;
        }
        .upload-area:hover { border-color: #4f46e5; background-color: #f8fafc; }
        .upload-area.dragover { border-color: #4f46e5; background-color: #eef2ff; }
        .upload-icon { font-size: 48px; margin-bottom: 16px; color: #9ca3af; }
        .upload-text { font-size: 18px; color: #374151; margin-bottom: 8px; }
        .upload-hint { font-size: 14px; color: #6b7280; }
        .file-input { display: none; }
        .preview-area { margin: 30px 0; display: none; }
        .preview-image { max-width: 100%; max-height: 400px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .action-buttons { display: flex; gap: 12px; margin: 20px 0; justify-content: center; }
        .btn {
            padding: 12px 24px; border: none; border-radius: 8px; font-size: 16px;
            font-weight: 500; cursor: pointer; transition: all 0.2s ease;
            display: inline-flex; align-items: center; gap: 8px;
        }
        .btn-primary {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white;
        }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4); }
        .btn-secondary { background: #f3f4f6; color: #374151; }
        .btn-secondary:hover { background: #e5e7eb; }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .loading { display: none; text-align: center; padding: 20px; }
        .spinner {
            width: 40px; height: 40px; border: 4px solid #f3f4f6;
            border-top: 4px solid #4f46e5; border-radius: 50%;
            animation: spin 1s linear infinite; margin: 0 auto 16px;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .result-area { margin-top: 30px; display: none; }
        .result-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; }
        .result-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .result-icon {
            width: 24px; height: 24px; background: #10b981; border-radius: 50%;
            display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;
        }
        .result-title { font-size: 18px; font-weight: 600; color: #1f2937; }
        .result-text {
            background: white; border: 1px solid #d1d5db; border-radius: 8px;
            padding: 16px; font-size: 16px; line-height: 1.6; color: #374151;
            margin-bottom: 16px; white-space: pre-wrap;
        }
        .result-meta {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px; font-size: 14px;
        }
        .meta-item {
            display: flex; justify-content: space-between; padding: 8px 12px;
            background: white; border-radius: 6px; border: 1px solid #e5e7eb;
        }
        .meta-label { color: #6b7280; font-weight: 500; }
        .meta-value { color: #1f2937; font-weight: 600; }
        .error-area { margin-top: 30px; display: none; }
        .error-card { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 24px; }
        .error-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .error-icon {
            width: 24px; height: 24px; background: #ef4444; border-radius: 50%;
            display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;
        }
        .error-title { font-size: 18px; font-weight: 600; color: #dc2626; }
        .error-message { color: #7f1d1d; font-size: 16px; line-height: 1.5; }
        @media (max-width: 768px) {
            .container { margin: 10px; border-radius: 12px; }
            .content { padding: 20px; }
            .header { padding: 20px; }
            .header h1 { font-size: 24px; }
            .upload-area { padding: 30px 20px; }
            .action-buttons { flex-direction: column; }
            .result-meta { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🖋️ 手写OCR演示</h1>
            <p>AI辅助笔记系统 - 智能识别手写文字</p>
        </div>
        <div class="content">
            <div class="upload-area" id="uploadArea">
                <div class="upload-icon">📷</div>
                <div class="upload-text">点击或拖拽上传手写图片</div>
                <div class="upload-hint">支持 JPG、PNG、WEBP 格式，最大 10MB</div>
                <input type="file" class="file-input" id="fileInput" accept="image/*">
            </div>
            <div class="preview-area" id="previewArea">
                <img class="preview-image" id="previewImage" alt="预览图片">
                <div class="action-buttons">
                    <button class="btn btn-primary" id="recognizeBtn">
                        <span>🔍</span> 开始识别
                    </button>
                    <button class="btn btn-secondary" id="clearBtn">
                        <span>🗑️</span> 重新选择
                    </button>
                </div>
            </div>
            <div class="loading" id="loadingArea">
                <div class="spinner"></div>
                <div>正在识别中，请稍候...</div>
            </div>
            <div class="result-area" id="resultArea">
                <div class="result-card">
                    <div class="result-header">
                        <div class="result-icon">✓</div>
                        <div class="result-title">识别结果</div>
                    </div>
                    <div class="result-text" id="resultText"></div>
                    <div class="result-meta" id="resultMeta"></div>
                </div>
            </div>
            <div class="error-area" id="errorArea">
                <div class="error-card">
                    <div class="error-header">
                        <div class="error-icon">✕</div>
                        <div class="error-title">识别失败</div>
                    </div>
                    <div class="error-message" id="errorMessage"></div>
                </div>
            </div>
        </div>
    </div>
    <script>
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const previewArea = document.getElementById('previewArea');
        const previewImage = document.getElementById('previewImage');
        const recognizeBtn = document.getElementById('recognizeBtn');
        const clearBtn = document.getElementById('clearBtn');
        const loadingArea = document.getElementById('loadingArea');
        const resultArea = document.getElementById('resultArea');
        const resultText = document.getElementById('resultText');
        const resultMeta = document.getElementById('resultMeta');
        const errorArea = document.getElementById('errorArea');
        const errorMessage = document.getElementById('errorMessage');
        let currentFile = null;
        let currentBase64 = null;
        
        uploadArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileSelect);
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) handleFile(files[0]);
        });
        recognizeBtn.addEventListener('click', performOCR);
        clearBtn.addEventListener('click', clearAll);
        
        function handleFileSelect(event) {
            const file = event.target.files[0];
            if (file) handleFile(file);
        }
        
        function handleFile(file) {
            if (!file.type.startsWith('image/')) {
                showError('请选择图片文件');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                showError('文件大小不能超过 10MB');
                return;
            }
            currentFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImage.src = e.target.result;
                previewArea.style.display = 'block';
                const base64Data = e.target.result.split(',')[1];
                currentBase64 = base64Data;
                hideError();
                hideResult();
            };
            reader.readAsDataURL(file);
        }
        
        async function performOCR() {
            if (!currentBase64) {
                showError('请先选择图片');
                return;
            }
            showLoading();
            hideError();
            hideResult();
            try {
                const response = await fetch('/api/ocr/recognize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        base64Image: currentBase64,
                        options: { language: 'zh-cn', format: 'text' }
                    })
                });
                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }
                const result = await response.json();
                if (result.success) {
                    showResult(result);
                } else {
                    showError(result.error || '识别失败');
                }
            } catch (error) {
                console.error('OCR Error:', error);
                showError(\`识别失败: \${error.message}\`);
            } finally {
                hideLoading();
            }
        }
        
        function showLoading() {
            loadingArea.style.display = 'block';
            recognizeBtn.disabled = true;
        }
        function hideLoading() {
            loadingArea.style.display = 'none';
            recognizeBtn.disabled = false;
        }
        function showResult(result) {
            resultText.textContent = result.text || '未识别到文字';
            const metaItems = [
                { label: '置信度', value: \`\${(result.confidence * 100).toFixed(1)}%\` },
                { label: '服务商', value: 'SiliconFlow GLM-4.5V' },
                { label: '处理时间', value: \`\${result.actualProcessTime}ms\` },
                { label: '识别词数', value: \`\${result.words || 0}个\` }
            ];
            resultMeta.innerHTML = metaItems.map(item => 
                \`<div class="meta-item">
                    <span class="meta-label">\${item.label}</span>
                    <span class="meta-value">\${item.value}</span>
                </div>\`
            ).join('');
            resultArea.style.display = 'block';
        }
        function hideResult() { resultArea.style.display = 'none'; }
        function showError(message) {
            errorMessage.textContent = message;
            errorArea.style.display = 'block';
        }
        function hideError() { errorArea.style.display = 'none'; }
        function clearAll() {
            currentFile = null;
            currentBase64 = null;
            fileInput.value = '';
            previewArea.style.display = 'none';
            hideLoading();
            hideResult();
            hideError();
        }
    </script>
</body>
</html>`;
}