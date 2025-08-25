# 任务文档（可执行）

本文件定义了首版可用的功能、目录、接口与交付标准。

## 目标
- Telegram 上发出若干张图片（90秒内视为同一会话），系统自动：
  1) 上传图片到 Cloudflare Images（保留原图）
  2) 调用 GLM-4V 进行 OCR/公式识别
  3) 生成包含 LaTeX 的 Markdown
  4) 将文件提交到 GitHub 仓库（Obsidian Git 自动同步）

## 目录结构
```
backend/
  src/
    index.ts                # Worker 入口
    router.ts               # 路由与webhook
    providers/
      ocr_glm.ts            # GLM 多模态
      ocr_openai.ts         # 备用
      images_cloudflare.ts  # 图床
      git_github.ts         # 提交到仓库
    services/
      aggregator.ts         # 会话聚合（90秒窗口）
      note_builder.ts       # Markdown 生成
      utils.ts              # 共用工具
  wrangler.toml             # Cloudflare配置
  package.json
obsidian-plugin/
  main.ts                   # 插件入口
  manifest.json
  styles.css
```

## 接口设计
- POST /webhook/telegram
  - 鉴权：X-Telegram-Bot-Secret-Token 头
  - 内容：Telegram Update（message/photo/document）
  - 行为：
    - 下载图片 → 上传到 Cloudflare Images（记录 imageId+url）
    - 写入聚合会话草稿；窗口到期或收到"/end"即生成笔记

## Markdown 规范
- 路径：Notes/Inbox/YYYY/YYYY-MM-DD/HHmmss-<shortid>.md
- frontmatter：
  - title: 2025-01-01 HHmm draft
  - created: ISO8601
  - tags: [HHmm]
  - source: telegram | obsidian
  - images: [{id,url,variant}]
  - provider: glm-4v
  - status: inbox

## 验收标准
- 从发送到文件落库 ≤ 60s
- 同一用户 90s 内多图合并为一篇
- 重复图片不重复生成
- LaTeX 在 Obsidian 中渲染正常

## 风险与回滚
- 模型不稳定：自动重试与降级到 openai provider
- Git 提交失败：重试并写入 dead-letter（后续手动补）
- 图床上传失败：保留待上传队列，返回占位图链接

## 后续增强（暂不启用）
- 自动摘要/标题改写
- 标签建议
- 图片签名URL与私有访问