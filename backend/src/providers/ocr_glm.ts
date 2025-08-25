/**
 * 使用 SiliconFlow 的 GLM-4.5V 模型进行多模态 OCR 文本抽取
 * 通过 OpenAI 兼容接口，将图片 URL 转换为 Markdown 格式的文本
 */

interface OCRResult {
  text: string
  confidence?: number
}

/**
 * 处理单张图片的 OCR 识别
 * @param imageUrl 图片的公网访问 URL
 * @param env 环境变量，包含 API 密钥等配置
 * @returns OCR 识别结果
 */
export async function processImagesWithOCR(imageUrls: string[], env: any): Promise<string> {
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('No image URLs provided')
  }

  // 检查 API 密钥，优先使用环境变量，如果没有则使用默认密钥
  const apiKey = env.SILICONFLOW_API_KEY || 'sk-mxmioywernqnwcqckymfcsbuekevtymhyjclfwemqvjlwacq'
  if (!apiKey) {
    throw new Error('SILICONFLOW_API_KEY not configured')
  }

  const baseUrl: string = env.SILICONFLOW_BASE || 'https://api.siliconflow.cn'
  const model: string = env.OCR_MODEL || 'zai-org/GLM-4.5V'

  // 组装 OpenAI 兼容的 messages 内容，含提示词与多张图片 URL
  const content: any[] = [
    {
      type: 'text',
      text: [
        '请准确识别以下手写内容并严格遵循以下要求：',
        '1. 仅输出识别出的文字内容',
        '2. 使用Markdown格式规范排版：',
        '   - 标题使用#符号',
        '   - 段落间空一行',
        '   - 列表项使用*或-符号',
        '   - 注意数学公式用$...$或$$...$$格式',
        '3. 不添加任何解释性文字或额外信息，仅作语法、拼写修正，排版优化'
      ].join('\n')
    }
  ]
  for (const url of imageUrls) {
    content.push({
      type: 'image_url',
      image_url: { url }
    })
  }

  const payload = {
    model,
    temperature: 0.2,
    messages: [
      {
        role: 'user',
        content
      }
    ]
  }

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`SiliconFlow API 请求失败: ${res.status} ${res.statusText} - ${text}`)
    }

    const data: any = await res.json()
    const output = data?.choices?.[0]?.message?.content || ''

    // 保底：若模型返回空字符串，回退到占位文本，保证后续流程可执行
    if (!output || typeof output !== 'string') {
      const textBlocks = imageUrls.map((_, i) => `图片${i + 1} 的识别内容（占位，模型无响应）`)
      return textBlocks.join('\n\n')
    }
    return output
  } catch (err: any) {
    // 网络或解析异常的兜底，避免 500 中断整个上传链路
    console.error('[OCR] SiliconFlow 调用失败:', err?.stack || err)
    const textBlocks = imageUrls.map((_, i) => `图片${i + 1} 的识别内容（占位，调用失败）`)
    return textBlocks.join('\n\n')
  }
}