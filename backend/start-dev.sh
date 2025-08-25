#!/bin/bash

# 禁用Yarn PnP
export YARN_IGNORE_PATH=1
export YARN_ENABLE_PNP=false

# 清理可能的yarn缓存
unset YARN_PNP_LOADER_PATH
unset YARN_PNP_FALLBACK_MODE

# 确保使用npm
export npm_config_package_manager=npm

# 启动wrangler开发服务器
echo "Starting Cloudflare Workers development server..."
npx wrangler dev --local --port 8787