import { TelegramUpdate, TelegramMessage } from './types'
import { SessionAggregator } from './services/aggregator'
import { uploadToCloudflareImages } from './providers/images_cloudflare'
import { processImagesWithOCR } from './providers/ocr_glm'
import { submitToGitHub } from './providers/git_github'
import { buildMarkdownNote } from './services/note_builder'
import { processHandwrittenNote, HandwrittenBackupOptions } from './services/handwritten_backup'
import { processEnhancedHandwrittenNote, processEnhancedHandwrittenBatch, EnhancedProcessingOptions } from './services/enhanced_handwritten_processor'

/**
 * 处理Telegram Webhook
 * 实现连续图片聚合、OCR转换、Git提交的完整链路
 */
export async function handleTelegramWebhook(update: TelegramUpdate, env: any) {
  const message = update.message || update.edited_message
  if (!message) return { ok: false, message: 'no_message' }

  const userId = message.from?.id
  if (!userId) return { ok: false, message: 'no_user' }

  const aggregator = new SessionAggregator(env, userId)

  // 处理文本命令：结束会话
  if (message.text && (message.text.includes('/end') || message.text.includes('结束'))) {
    const ended = await aggregator.endSession()
    if (ended.images.length) {
      const result = await finalizeAndCommit(ended.images, env)
      return { ok: true, message: 'session_ended_and_committed', result }
    }
    return { ok: true, message: 'session_ended_empty' }
  }

  // 处理图片消息
  if (message.photo || message.document) {
    // 若上一个会话已超时，先结转提交
    const expired = await aggregator.maybeFinalizeIfExpired()
    if (expired && expired.images.length) {
      await finalizeAndCommit(expired.images, env)
    }

    try {
      // 使用增强版处理器处理图片
       const imageBytes = await downloadImageFromTelegram(message, env)
       const options: EnhancedProcessingOptions = {
         enableGitHubBackup: true,
         smartCompression: true,
         generateVariants: false, // Telegram场景下不需要生成变体
         enableQualityCheck: true,
         maxRetries: 2
       }
       
       const result = await processEnhancedHandwrittenNote(imageBytes, 'telegram_image.jpg', env, options)
       
       if (result.success) {
          // 添加到聚合会话（保持兼容性）
          const imageInfo = {
            id: result.cloudflareImageId!,
            url: result.cloudflareImageUrl!,
            filename: 'telegram_image.jpg'
          }
          await aggregator.addImage(imageInfo)
          return { 
            ok: true, 
            message: 'image_processed_enhanced', 
            imageId: result.cloudflareImageId,
            markdownPath: result.notePath,
            processingTime: result.timing?.total
          }
        } else {
          throw new Error(result.error || 'Enhanced processing failed')
        }
    } catch (error: any) {
      console.error('处理图片失败:', error)
      return { ok: false, message: 'image_processing_failed', error: String(error?.message || error) }
    }
  }

  return { ok: false, message: 'unsupported_message_type' }
}

/**
 * 将一组图片完成 OCR -> Markdown -> 提交Git
 */
async function finalizeAndCommit(images: { id: string; url: string; filename: string }[], env: any) {
  // OCR（占位版本返回组合文本）
  const body = await processImagesWithOCR(images.map(i => i.url), env)
  // 生成Markdown
  const built = buildMarkdownNote({ images, body, timezone: env.TIMEZONE })
  // 提交到GitHub
  await submitToGitHub(built, env)
  return { path: `${built.dir}/${built.filename}` }
}

/**
 * 从Telegram消息中下载图片字节数据
 */
async function downloadImageFromTelegram(message: TelegramMessage, env: any): Promise<Uint8Array> {
  let fileId: string

  if (message.photo) {
    // 选择最高质量的照片
    const photo = message.photo[message.photo.length - 1]
    fileId = photo.file_id
  } else if (message.document && message.document.mime_type?.startsWith('image/')) {
    fileId = message.document.file_id
  } else {
    throw new Error('不支持的图片格式')
  }

  // 从Telegram下载文件
  const fileResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`)
  const fileData = await fileResponse.json() as any
  
  if (!fileData.ok) {
    throw new Error('获取Telegram文件失败')
  }

  const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`
  const imageResponse = await fetch(fileUrl)
  const imageBuffer = await imageResponse.arrayBuffer()

  return new Uint8Array(imageBuffer)
}

/**
 * 从Telegram消息中处理图片（保留原有函数以保持兼容性）
 * 下载原图并上传到Cloudflare Images
 */
async function processImageFromTelegram(message: TelegramMessage, env: any) {
  let fileId: string
  let fileName = 'image.jpg'

  if (message.photo) {
    // 选择最高质量的照片
    const photo = message.photo[message.photo.length - 1]
    fileId = photo.file_id
  } else if (message.document && message.document.mime_type?.startsWith('image/')) {
    fileId = message.document.file_id
    fileName = message.document.file_name || fileName
  } else {
    throw new Error('不支持的图片格式')
  }

  // 从Telegram下载文件
  const fileResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`)
  const fileData = await fileResponse.json() as any
  
  if (!fileData.ok) {
    throw new Error('获取Telegram文件失败')
  }

  const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`
  const imageResponse = await fetch(fileUrl)
  const imageBuffer = await imageResponse.arrayBuffer()

  // 上传到Cloudflare Images
  const uploadResult = await uploadToCloudflareImages(new Uint8Array(imageBuffer), fileName, env)
  
  return {
    id: uploadResult.id,
    url: uploadResult.url,
    filename: fileName,
    size: imageBuffer.byteLength,
    uploaded_at: new Date().toISOString()
  }
}