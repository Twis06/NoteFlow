# 配置步骤（首版）

## 1. Cloudflare 侧
- 开通 Cloudflare Images
- 记录以下参数：
  - CLOUDFLARE_ACCOUNT_ID
  - CLOUDFLARE_API_TOKEN（需要 Images 读写权限）
  - CLOUDFLARE_IMAGES_ACCOUNT_HASH（imagedelivery.net 的hash，仪表盘可见）
  - 可选：CLOUDFLARE_IMAGES_VARIANT（默认 public）

## 2. Telegram 侧
- 向 @BotFather 创建机器人，获得 TELEGRAM_BOT_TOKEN
- 设置 Webhook：指向 Workers 部署地址 /webhook/telegram
- 设置 webhook secret：TELEGRAM_WEBHOOK_SECRET

## 3. GitHub 侧
- 创建私有仓库作为 Obsidian Vault
- 生成 PAT（repo权限），填入 GITHUB_TOKEN
- 配置 owner、repo、branch

## 4. 本地 Obsidian 插件
- 打开你的库 .obsidian/plugins/ 目录
- 将 obsidian-plugin 复制为一个子目录，重命名为 cf-images-uploader
- 在 Obsidian 设置中启用第三方插件并启用该插件
- 在插件设置中填入 Cloudflare 参数

## 5. 部署 Workers
```bash
cd backend
npm install
npx wrangler login   # 首次登录
npx wrangler kv namespace create NOTE_SESSIONS  # 如要切换到KV
npm run deploy
```