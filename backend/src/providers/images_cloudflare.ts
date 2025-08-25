/**
 * 上传图片到 Cloudflare Images
 * @param bytes 图片字节数据
 * @param filename 文件名
 * @param env 环境变量
 * @param options 上传选项
 */
export async function uploadToCloudflareImages(
  bytes: Uint8Array, 
  filename: string, 
  env: any,
  options?: {
    metadata?: Record<string, string>
    requireSignedURLs?: boolean
    quality?: 'auto' | 'highest' | 'high' | 'medium' | 'low'
  }
) {
  const accountHash = env.CLOUDFLARE_IMAGES_ACCOUNT_HASH
  const accountId = env.CLOUDFLARE_IMAGES_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = env.CLOUDFLARE_IMAGES_API_TOKEN || env.CLOUDFLARE_API_TOKEN
  
  if (!accountHash || !accountId || !apiToken) {
    throw new Error('Missing CLOUDFLARE_IMAGES_ACCOUNT_HASH, CLOUDFLARE_IMAGES_ACCOUNT_ID, or CLOUDFLARE_IMAGES_API_TOKEN')
  }

  const form = new FormData()
  form.append('file', new Blob([bytes]), filename)
  
  // 添加可选参数
  if (options?.metadata) {
    form.append('metadata', JSON.stringify(options.metadata))
  }
  
  if (options?.requireSignedURLs !== undefined) {
    form.append('requireSignedURLs', String(options.requireSignedURLs))
  }

  const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`
    },
    body: form
  })
  const data: any = await resp.json()
  if (!data.success) {
    throw new Error('Cloudflare Images 上传失败: ' + JSON.stringify(data))
  }

  const id = data.result.id
  // 根据质量设置选择变体
  let variant = env.CLOUDFLARE_IMAGES_VARIANT || 'public'
  if (options?.quality && options.quality !== 'auto') {
    // 如果设置了质量，可以通过变体控制
    variant = `${variant}_${options.quality}`
  }
  
  const url = `https://imagedelivery.net/${accountHash}/${id}/${variant}`
  return { id, url, metadata: data.result }
}

/**
 * 获取 Cloudflare Images 列表
 * @param env 环境变量
 * @param page 页码（从1开始）
 * @param perPage 每页数量
 * @returns 图片列表和分页信息
 */
export async function listCloudflareImages(env: any, page: number = 1, perPage: number = 50) {
  const accountId = env.CLOUDFLARE_IMAGES_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = env.CLOUDFLARE_IMAGES_API_TOKEN || env.CLOUDFLARE_API_TOKEN

  if (!accountId || !apiToken) {
    throw new Error('Missing CLOUDFLARE_IMAGES_ACCOUNT_ID or CLOUDFLARE_IMAGES_API_TOKEN')
  }

  const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`)
  url.searchParams.set('page', String(page))
  url.searchParams.set('per_page', String(perPage))

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    throw new Error(`Cloudflare Images API error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json() as any
  
  if (!data.success) {
    throw new Error(`Cloudflare Images API failed: ${JSON.stringify(data.errors)}`)
  }

  // 从API响应中获取图片数组和总数信息
  const images = data.result?.images || []
  const totalCount = data.result_info?.total_count || images.length

  return {
    images,
    page,
    per_page: perPage,
    total_count: totalCount
  }
}