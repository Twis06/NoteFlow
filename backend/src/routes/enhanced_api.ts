/**
 * 增强的API路由
 * 支持双通道图片处理、同步和优化功能
 */
import { createFileAccessService } from '../services/file_access'
import { createSyncService } from '../services/sync_service'
import { createEnhancedHandwrittenService } from '../services/enhanced_handwritten'
import { 
  processEnhancedHandwrittenNote,
  processEnhancedHandwrittenBatch,
  type EnhancedProcessingOptions,
  type ProcessingResult,
  type BatchProcessingResult
} from '../services/enhanced_handwritten_processor'
import { processObsidianRepositoryEnhanced, EnhancedObsidianOptions, EnhancedProcessingResult } from '../services/enhanced_obsidian_processor'
import { optimizeImageBatch, ImageOptimizationOptions } from '../services/image_optimizer'
import { createArticleSharingService, shareArticleQuick, type ShareConfig, type ShareResult, type BatchShareResult } from '../services/article_sharing'
import { createEnhancedFileAccessService } from '../services/enhanced_file_access'
import { createEnhancedSyncService } from '../services/enhanced_sync_service'
import { extractImageReferences, AttachmentInfo, ProcessedNote } from '../services/obsidian_processor'
import { uploadToCloudflareImages } from '../providers/images_cloudflare'
import batchOcrApp from './batch-ocr'
import githubSyncApp from './github-sync'
import cdnReplacementApp from './cdn-replacement'
import automationApp from './automation'

/**
 * 处理Markdown内容中的图片引用并上传到Cloudflare Images
 */
async function processMarkdownContentWithImages(
  filePath: string,
  content: string,
  imageMap: Map<string, { path: string; data: string; filename: string }>,
  env: any,
  options?: { enableSmartCompression?: boolean; imageQuality?: number }
): Promise<ProcessedNote> {
  const imageRefs = extractImageReferences(content)
  const attachments: AttachmentInfo[] = []
  let updatedContent = content
  let hasChanges = false

  console.log(`[Obsidian Content] Processing ${filePath}, found ${imageRefs.length} image references`)

  for (const ref of imageRefs) {
    try {
      // 查找对应的图片数据
      const imageData = imageMap.get(ref.path) || imageMap.get(`attachments/${ref.path}`) || imageMap.get(ref.path.replace(/^.*\//, ''))
      
      if (!imageData) {
        console.warn(`Image not found in provided data: ${ref.path}`)
        continue
      }

      console.log(`[Obsidian Content] Processing image: ${ref.path} -> ${imageData.filename}`)

      // 解码base64图片数据
      // 移除data:image/xxx;base64,前缀
      const base64Data = imageData.data.includes(',') ? imageData.data.split(',')[1] : imageData.data
      const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
      
      // 上传到Cloudflare Images
      const uploadResult = await uploadToCloudflareImages(imageBuffer, imageData.filename, env)
      
      const attachmentInfo: AttachmentInfo = {
        id: uploadResult.id,
        url: uploadResult.url,
        originalPath: ref.path,
        filename: imageData.filename,
        size: imageBuffer.length,
        uploaded_at: new Date().toISOString()
      }
      
      attachments.push(attachmentInfo)
      
      // 替换内容中的图片路径
      if (ref.match.includes('![[')) {
        // Obsidian wiki link格式
        updatedContent = updatedContent.replace(ref.match, `![${imageData.filename}](${uploadResult.url})`)
      } else if (ref.match.includes('<img')) {
        // HTML img标签格式
        updatedContent = updatedContent.replace(ref.match, `<img src="${uploadResult.url}" alt="${imageData.filename}">`)
      } else {
        // 标准Markdown格式
        const alt = ref.alt || imageData.filename
        updatedContent = updatedContent.replace(ref.match, `![${alt}](${uploadResult.url})`)
      }
      
      hasChanges = true
      console.log(`[Obsidian Content] Successfully uploaded: ${imageData.filename} -> ${uploadResult.url}`)
      
    } catch (error) {
      console.error(`Failed to process image ${ref.path} in ${filePath}:`, error)
      // 继续处理其他图片，不中断整个流程
    }
  }

  console.log(`[Obsidian Content] Completed ${filePath}: ${attachments.length} images uploaded`)

  return {
    filePath,
    originalContent: content,
    updatedContent,
    attachments,
    hasChanges
  }
}

/**
 * 处理本地Obsidian文件（模拟实现）
 * 在Cloudflare Workers环境中，无法直接访问文件系统
 * 这个函数提供一个基础框架，实际使用时需要配合其他服务
 */
async function processLocalObsidianFiles(
  repoPath: string,
  env: any,
  options: any
): Promise<EnhancedProcessingResult> {
  console.log(`[Local Obsidian] Simulating processing for path: ${repoPath}`)
  
  // 在实际环境中，这里需要:
  // 1. 通过某种方式获取本地文件列表和内容
  // 2. 处理图片引用和上传
  // 3. 更新文件内容
  
  // 目前返回一个模拟结果
  return {
    success: true,
    processedFiles: 5, // 模拟处理了5个文件
    uploadedImages: 0, // 暂时没有实际上传
    failedImages: 0,
    results: [],
    attachments: [],
    statistics: {
      totalProcessingTime: 1000,
      averageFileProcessingTime: 200,
      totalImageSize: 0,
      compressionRatio: 0,
      errorCount: 0,
      warningCount: 0
    },
    errors: [],
    warnings: ['Local file processing is not fully implemented in Workers environment']
  }
}

/**
 * 处理Obsidian文件内容（支持直接传递文件内容）
 * POST /api/process/obsidian/content
 */
export async function handleProcessObsidianContent(request: Request, env: any): Promise<Response> {
  try {
    const body = await request.json() as {
      files: Array<{
        path: string
        content: string
      }>
      images: Array<{
        path: string
        data: string // base64 encoded
        filename: string
      }>
      options?: {
        enableSmartCompression?: boolean
        imageQuality?: number
      }
    }

    if (!body.files || !Array.isArray(body.files)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Files array is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const results = []
    let totalUploadedImages = 0
    let totalFailedImages = 0
    const allAttachments = []

    // 创建图片映射表
    const imageMap = new Map()
    if (body.images) {
      for (const img of body.images) {
        imageMap.set(img.path, img)
      }
    }

    // 处理每个文件
    for (const file of body.files) {
      try {
        const result = await processMarkdownContentWithImages(
          file.path,
          file.content,
          imageMap,
          env,
          body.options
        )
        
        results.push(result)
        totalUploadedImages += result.attachments.length
        allAttachments.push(...result.attachments)
        
      } catch (error) {
        console.error(`Failed to process file ${file.path}:`, error)
        totalFailedImages++
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${results.length} files: ${totalUploadedImages} images uploaded, ${totalFailedImages} failed`,
      data: {
        processedFiles: results.length,
        uploadedImages: totalUploadedImages,
        failedImages: totalFailedImages,
        results,
        attachments: allAttachments
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error processing Obsidian content:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 处理手写笔记照片上传（通道A）
 * POST /api/process/handwritten
 */
export async function handleProcessHandwritten(request: Request, env: any): Promise<Response> {
  try {
    console.log('[API] Processing handwritten note request...')
    
    const contentType = request.headers.get('content-type') || ''
    
    // 支持多种上传方式
    let imageBytes: Uint8Array
    let filename: string
    let options: EnhancedProcessingOptions = {}
    
    if (contentType.includes('multipart/form-data')) {
      // 表单上传
      const formData = await request.formData()
      const file = formData.get('files') as File
      const optionsStr = formData.get('options') as string
      
      if (!file) {
        return new Response(JSON.stringify({ error: 'No image file provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      imageBytes = new Uint8Array(await file.arrayBuffer())
      filename = file.name
      
      if (optionsStr) {
        try {
          options = JSON.parse(optionsStr)
        } catch (e) {
          console.warn('[API] Failed to parse options:', e)
        }
      }
      
    } else if (contentType.includes('application/json')) {
      // JSON上传（base64编码的图片）
      const body = await request.json() as any
      
      if (!body.imageData || !body.filename) {
        return new Response(JSON.stringify({ error: 'Missing imageData or filename' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      // 解码base64图片数据
      const base64Data = body.imageData.replace(/^data:image\/[a-z]+;base64,/, '')
      const binaryString = atob(base64Data)
      imageBytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        imageBytes[i] = binaryString.charCodeAt(i)
      }
      
      filename = body.filename
      options = body.options || {}
      
    } else {
      // 直接二进制上传
      const arrayBuffer = await request.arrayBuffer()
      imageBytes = new Uint8Array(arrayBuffer)
      
      // 从URL参数获取文件名和选项
      const url = new URL(request.url)
      filename = url.searchParams.get('filename') || `handwritten-${Date.now()}.jpg`
      
      // 从URL参数构建增强选项
      const enableBackup = url.searchParams.get('backup') === 'true'
      const backupDir = url.searchParams.get('backupDir') || 'handwritten_originals'
      const quality = url.searchParams.get('quality') as any || 'auto'
      const enableQualityCheck = url.searchParams.get('qualityCheck') !== 'false'
      const smartCompression = url.searchParams.get('smartCompression') !== 'false'
      const generateVariants = url.searchParams.get('generateVariants') !== 'false'
      
      options = {
        enableGitHubBackup: enableBackup,
        gitHubBackupDir: backupDir,
        imageQuality: quality,
        enableQualityCheck,
        smartCompression,
        generateVariants,
        maxRetries: 3,
        batchSize: 5
      }
    }
    
    // 使用增强版手写笔记处理器
    const result = await processEnhancedHandwrittenNote(
      imageBytes,
      filename,
      env,
      options
    )
    
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('[API] Failed to process handwritten note:', error)
    console.error('[API] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('[API] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      cause: error instanceof Error ? error.cause : undefined
    })
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 处理从URL的手写笔记（支持Telegram等）
 * POST /api/process/handwritten-url
 */
export async function handleProcessHandwrittenFromUrl(request: Request, env: any): Promise<Response> {
  try {
    console.log('[API] Processing handwritten note from URL...')
    
    const body = await request.json() as any
    
    if (!body.imageUrl) {
      return new Response(JSON.stringify({ error: 'Missing imageUrl' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const fileAccess = createFileAccessService(env)
    const handwrittenService = createEnhancedHandwrittenService(fileAccess, env)
    
    const result = await handwrittenService.processHandwrittenFromUrl(
      body.imageUrl,
      body.filename,
      body.options || {}
    )
    
    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('[API] Failed to process handwritten note from URL:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 同步GitHub仓库attachments文件夹（通道B）
 * POST /api/sync/attachments
 */
export async function handleSyncAttachments(request: Request, env: any): Promise<Response> {
  try {
    console.log('[API] Starting attachments sync...')
    
    const body = await request.json().catch(() => ({})) as any
    const options = body.options || {}
    
    const fileAccess = createFileAccessService(env)
    const syncService = createSyncService(fileAccess, env)
    
    const result = await syncService.syncAttachments(options)
    
    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('[API] Failed to sync attachments:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 获取同步状态
 * GET /api/sync/status
 */
export async function handleGetSyncStatus(request: Request, env: any): Promise<Response> {
  try {
    console.log('[API] Getting sync status...')
    
    const fileAccess = createFileAccessService(env)
    const syncService = createSyncService(fileAccess, env)
    
    const status = await syncService.getSyncStatus()
    
    return new Response(JSON.stringify({
      success: true,
      data: status
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('[API] Failed to get sync status:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 优化图片
 * POST /api/optimize/images
 */
export async function handleOptimizeImages(request: Request, env: any): Promise<Response> {
  try {
    console.log('[Enhanced API] Starting image optimization...')
    
    // 解析请求参数
    const url = new URL(request.url)
    const quality = (url.searchParams.get('quality') as any) || 'auto'
    const maxWidth = parseInt(url.searchParams.get('maxWidth') || '2048')
    const maxHeight = parseInt(url.searchParams.get('maxHeight') || '2048')
    const format = (url.searchParams.get('format') as any) || 'auto'
    const compressionLevel = parseInt(url.searchParams.get('compression') || '80')
    
    const options: ImageOptimizationOptions = {
      quality,
      maxWidth,
      maxHeight,
      format,
      compressionLevel,
      maintainAspectRatio: true,
      stripMetadata: true
    }
    
    // 处理请求体
    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('multipart/form-data')) {
      // 处理表单上传的多个图片
      const formData = await request.formData()
      const files = formData.getAll('images') as File[]
      
      if (files.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No images provided'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      const images = await Promise.all(
        files.map(async (file) => ({
          data: new Uint8Array(await file.arrayBuffer()),
          filename: file.name
        }))
      )
      
      const result = await optimizeImageBatch(images, options)
      
      return new Response(JSON.stringify({
        success: result.successCount > 0,
        message: `Optimized ${result.successCount}/${files.length} images`,
        data: {
          successCount: result.successCount,
          failureCount: result.failureCount,
          overallCompressionRatio: result.overallCompressionRatio,
          totalSizeSavings: result.totalSizeSavings,
          statistics: result.statistics,
          results: result.results.map(r => ({
            filename: r.filename,
            success: r.success,
            compressionRatio: r.result?.compressionRatio,
            sizeSavings: r.result ? r.result.originalSize - r.result.optimizedSize : 0,
            error: r.error
          }))
        }
      }), {
        status: result.successCount > 0 ? 200 : 400,
        headers: { 'Content-Type': 'application/json' }
      })
      
    } else {
      // 处理单个图片的二进制数据
      const imageData = new Uint8Array(await request.arrayBuffer())
      const filename = url.searchParams.get('filename') || 'image.jpg'
      
      const result = await optimizeImageBatch([{ data: imageData, filename }], options)
      
      if (result.successCount === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: result.results[0]?.error || 'Optimization failed'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      const optimizationResult = result.results[0].result!
      
      return new Response(JSON.stringify({
        success: true,
        message: `Image optimized successfully`,
        data: {
          originalSize: optimizationResult.originalSize,
          optimizedSize: optimizationResult.optimizedSize,
          compressionRatio: optimizationResult.compressionRatio,
          sizeSavings: optimizationResult.originalSize - optimizationResult.optimizedSize,
          statistics: optimizationResult.statistics
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
  } catch (error) {
    console.error('[Enhanced API] Image optimization failed:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 批量处理手写笔记
 * POST /api/process/handwritten-batch
 */
export async function handleProcessHandwrittenBatch(request: Request, env: any): Promise<Response> {
  try {
    console.log('[API] Processing batch handwritten notes...')
    
    const formData = await request.formData()
    const files: Array<{ bytes: Uint8Array; filename: string }> = []
    const optionsStr = formData.get('options') as string
    
    // 收集所有图片文件
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('image') && value instanceof File) {
        files.push({
          bytes: new Uint8Array(await value.arrayBuffer()),
          filename: value.name
        })
      }
    }
    
    if (files.length === 0) {
      return new Response(JSON.stringify({ error: 'No image files provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    let options: EnhancedProcessingOptions = {
      enableGitHubBackup: false,
      smartCompression: true,
      generateVariants: true,
      enableQualityCheck: true,
      maxRetries: 3,
      batchSize: 3 // 批量处理时使用较小的批次大小
    }
    
    if (optionsStr) {
      try {
        const parsedOptions = JSON.parse(optionsStr)
        options = { ...options, ...parsedOptions }
      } catch (e) {
        console.warn('[API] Failed to parse options:', e)
      }
    }
    
    // 使用增强版批量处理器
    const result = await processEnhancedHandwrittenBatch(
      files,
      env,
      options
    )
    
    return new Response(JSON.stringify(result), {
      status: result.successCount > 0 ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('[API] Failed to process batch handwritten notes:', error)
    return new Response(JSON.stringify({
      totalCount: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
      statistics: {
        averageProcessingTime: 0,
        totalProcessingTime: 0,
        successRate: 0,
        commonErrors: { [error instanceof Error ? error.message : String(error)]: 1 }
      }
    } as BatchProcessingResult), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 处理Obsidian仓库（增强版）
 * POST /api/process/obsidian
 */
export async function handleProcessObsidian(request: Request, env: any): Promise<Response> {
  try {
    console.log('[Enhanced API] Processing Obsidian repository with enhanced processor...')
    
    // 解析请求参数
    const url = new URL(request.url)
    const repoPath = url.searchParams.get('repoPath')
    const enableSmartCompression = url.searchParams.get('compression') !== 'false'
    const imageQuality = (url.searchParams.get('quality') as any) || 'auto'
    const batchSize = parseInt(url.searchParams.get('batchSize') || '5')
    const enableParallelProcessing = url.searchParams.get('parallel') !== 'false'
    const errorHandling = (url.searchParams.get('errorHandling') as any) || 'skip'
    
    // 如果提供了repoPath，处理本地文件
    if (repoPath) {
      console.log(`[Enhanced API] Processing local directory: ${repoPath}`)
      
      // 对于本地文件处理，我们需要通过其他方式获取文件内容
      // 这里暂时返回一个模拟结果，实际实现需要配合前端或其他服务
      const result = await processLocalObsidianFiles(repoPath, env, {
        enableSmartCompression,
        imageQuality,
        batchSize,
        enableParallelProcessing,
        errorHandling,
        maxRetries: 3
      })
      
      return new Response(JSON.stringify({
        success: result.success,
        message: `Local Obsidian directory processed: ${result.uploadedImages} images uploaded, ${result.failedImages} failed`,
        data: {
          processedFiles: result.processedFiles,
          uploadedImages: result.uploadedImages,
          failedImages: result.failedImages,
          statistics: result.statistics,
          errors: result.errors,
          warnings: result.warnings
        }
      }), {
        status: result.success ? 200 : 207,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // 处理GitHub仓库
    const options: EnhancedObsidianOptions = {
      enableSmartCompression,
      imageQuality,
      batchSize,
      enableParallelProcessing,
      errorHandling,
      maxRetries: 3,
      enableProgressCallback: false
    }
    
    const result = await processObsidianRepositoryEnhanced(env, options)
    
    return new Response(JSON.stringify({
      success: result.success,
      message: `Obsidian repository processed: ${result.uploadedImages} images uploaded, ${result.failedImages} failed`,
      data: {
        processedFiles: result.processedFiles,
        uploadedImages: result.uploadedImages,
        failedImages: result.failedImages,
        statistics: result.statistics,
        errors: result.errors,
        warnings: result.warnings
      }
    }), {
      status: result.success ? 200 : 207, // 207 for partial success
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('[Enhanced API] Enhanced Obsidian processing failed:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 获取处理统计信息
 * GET /api/stats
 */
export async function handleGetStats(request: Request, env: any): Promise<Response> {
  try {
    console.log('[API] Getting processing stats...')
    
    const fileAccess = createFileAccessService(env)
    const handwrittenService = createEnhancedHandwrittenService(fileAccess, env)
    
    const handwrittenStats = await handwrittenService.getProcessingStats()
    
    // 图片优化统计信息（简化版）
    const optimizationStats = {
      totalOptimized: 0,
      totalSizeSaved: 0,
      averageCompressionRatio: 0,
      lastOptimization: null
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        handwritten: handwrittenStats,
        optimization: optimizationStats
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('[API] Failed to get stats:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 分享文章到指定平台
 * POST /api/share/article
 */
export async function handleShareArticle(request: Request, env: any): Promise<Response> {
  try {
    console.log('[API] Processing article share request...')
    
    const body = await request.json() as any
    const { filePath, platform, platformConfig, configName, options = {} } = body
    
    if (!filePath) {
      return new Response(JSON.stringify({ error: 'File path is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const fileAccess = createEnhancedFileAccessService(env)
    
    let result: ShareResult
    
    if (configName) {
      // 使用预配置的分享设置
      const sharingService = createArticleSharingService(fileAccess, env)
      result = await sharingService.shareArticle(filePath, configName, options)
    } else if (platform && platformConfig) {
      // 快速分享
      result = await shareArticleQuick(filePath, platform, { [platform]: platformConfig }, fileAccess, env)
    } else {
      return new Response(JSON.stringify({ error: 'Either configName or platform+platformConfig is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({
      success: true,
      result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('[API] Article share error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to share article',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 批量分享文章
 * POST /api/share/batch
 */
export async function handleShareBatch(request: Request, env: any): Promise<Response> {
  try {
    console.log('[API] Processing batch article share request...')
    
    const body = await request.json() as any
    const { filePaths, configName, options = {} } = body
    
    if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
      return new Response(JSON.stringify({ error: 'File paths array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    if (!configName) {
      return new Response(JSON.stringify({ error: 'Config name is required for batch sharing' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const fileAccess = createEnhancedFileAccessService(env)
    const sharingService = createArticleSharingService(fileAccess, env)
    
    const result = await sharingService.shareArticleBatch(filePaths, configName, options)
    
    return new Response(JSON.stringify({
      success: true,
      result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('[API] Batch share error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to share articles',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 管理分享配置
 * GET /api/share/configs - 获取所有配置
 * POST /api/share/configs - 添加配置
 * DELETE /api/share/configs/{name} - 删除配置
 */
export async function handleShareConfigs(request: Request, env: any): Promise<Response> {
  try {
    const url = new URL(request.url)
    const method = request.method
    const pathParts = url.pathname.split('/')
    const configName = pathParts[pathParts.length - 1]
    
    const fileAccess = createEnhancedFileAccessService(env)
    const sharingService = createArticleSharingService(fileAccess, env)
    
    if (method === 'GET') {
      // 获取所有配置
      const configs = sharingService.getShareConfigs()
      
      return new Response(JSON.stringify({
        success: true,
        configs
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
      
    } else if (method === 'POST') {
      // 添加配置
      const body = await request.json() as any
      const { name, config } = body
      
      if (!name || !config) {
        return new Response(JSON.stringify({ error: 'Name and config are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      sharingService.addShareConfig(name, config)
      
      return new Response(JSON.stringify({
        success: true,
        message: `Share config '${name}' added successfully`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
      
    } else if (method === 'DELETE') {
      // 删除配置
      if (!configName || configName === 'configs') {
        return new Response(JSON.stringify({ error: 'Config name is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      const removed = sharingService.removeShareConfig(configName)
      
      if (removed) {
        return new Response(JSON.stringify({
          success: true,
          message: `Share config '${configName}' removed successfully`
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      } else {
        return new Response(JSON.stringify({ error: 'Config not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
    
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('[API] Share configs error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to manage share configs',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 增强同步控制
 * POST /api/sync/enhanced/start - 启动自动同步
 * POST /api/sync/enhanced/stop - 停止自动同步
 * POST /api/sync/enhanced/manual - 手动同步
 * GET /api/sync/enhanced/status - 获取同步状态
 */
export async function handleEnhancedSync(request: Request, env: any): Promise<Response> {
  try {
    const url = new URL(request.url)
    const action = url.pathname.split('/').pop()
    
    const fileAccess = createEnhancedFileAccessService(env)
    const syncService = createEnhancedSyncService(fileAccess, env)
    
    switch (action) {
      case 'start':
        syncService.startAutoSync()
        return new Response(JSON.stringify({
          success: true,
          message: 'Auto sync started'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
        
      case 'stop':
        syncService.stopAutoSync()
        return new Response(JSON.stringify({
          success: true,
          message: 'Auto sync stopped'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
        
      case 'manual':
        const result = await syncService.manualSync()
        return new Response(JSON.stringify({
          success: true,
          result
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
        
      case 'status':
        const status = syncService.getSyncStatus()
        return new Response(JSON.stringify({
          success: true,
          status
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
        
      case 'pause':
        syncService.pauseSync()
        return new Response(JSON.stringify({
          success: true,
          message: 'Sync paused'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
        
      case 'resume':
        syncService.resumeSync()
        return new Response(JSON.stringify({
          success: true,
          message: 'Sync resumed'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
        
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
    
  } catch (error) {
    console.error('[API] Enhanced sync error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to handle sync operation',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * 处理手写OCR识别请求
 * 支持多种输入格式：multipart/form-data、application/json、直接二进制
 */
export async function handleOCRRecognition(request: Request, env: any): Promise<Response> {
  try {
    console.log('[OCR Recognition] Starting OCR recognition request')
    const startTime = Date.now()
    const contentType = request.headers.get('content-type') || ''
    console.log('[OCR Recognition] Content-Type:', contentType)
    let imageUrls: string[] = []
    
    if (contentType.includes('multipart/form-data')) {
      // 处理文件上传
      const formData = await request.formData()
      const files = formData.getAll('files') as File[]
      
      if (files.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: '未提供图片文件' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }
      
      // 上传图片到Cloudflare Images并获取URL
      for (const file of files) {
        const buffer = new Uint8Array(await file.arrayBuffer())
        const uploadResult = await uploadToCloudflareImages(buffer, file.name, env)
        imageUrls.push(uploadResult.url)
      }
      
    } else if (contentType.includes('application/json')) {
       // 处理JSON格式的图片URL或base64数据
       const body = await request.json() as any
       console.log('[OCR Recognition] Full JSON body:', JSON.stringify(body, null, 2))
       console.log('[OCR Recognition] JSON body keys:', Object.keys(body))
       console.log('[OCR Recognition] Body.image type:', typeof body.image)
       console.log('[OCR Recognition] Body.image length:', body.image ? body.image.length : 'undefined')
       
       // 支持 image 或 base64Image 字段
       const imageData = body.image || body.base64Image
       if (imageData && typeof imageData === 'string') {
         // 处理base64图片数据
         try {
           console.log('[OCR Recognition] Processing base64 image data')
           const buffer = Uint8Array.from(atob(imageData), c => c.charCodeAt(0))
           console.log('[OCR Recognition] Buffer size:', buffer.length)
           
           // 尝试上传到Cloudflare Images，如果失败则使用base64数据URL
           try {
             const filename = `ocr_${Date.now()}.jpg`
             console.log('[OCR Recognition] Uploading to Cloudflare Images...')
             const uploadResult = await uploadToCloudflareImages(buffer, filename, env)
             console.log('[OCR Recognition] Upload successful, URL:', uploadResult.url)
             imageUrls.push(uploadResult.url)
           } catch (uploadError) {
             console.log('[OCR Recognition] Cloudflare upload failed, using base64 data URL')
             // 如果Cloudflare上传失败，直接使用base64数据URL
             const mimeType = 'image/jpeg' // 假设是JPEG格式
             const dataUrl = `data:${mimeType};base64,${imageData}`
             imageUrls.push(dataUrl)
           }
         } catch (error) {
           console.error('[OCR Recognition] Base64 processing error:', error)
           return new Response(
             JSON.stringify({ success: false, error: `图片处理失败: ${error instanceof Error ? error.message : '未知错误'}` }),
             { status: 400, headers: { 'Content-Type': 'application/json' } }
           )
         }
       } else {
         // 处理图片URL列表
         imageUrls = body.imageUrls || body.image_urls || []
         
         if (imageUrls.length === 0) {
           return new Response(
             JSON.stringify({ success: false, error: '未提供图片URL或base64数据' }),
             { status: 400, headers: { 'Content-Type': 'application/json' } }
           )
         }
       }
      
    } else {
      // 处理直接二进制上传
      const buffer = new Uint8Array(await request.arrayBuffer())
      const filename = `ocr_${Date.now()}.jpg`
      const uploadResult = await uploadToCloudflareImages(buffer, filename, env)
      imageUrls.push(uploadResult.url)
    }
    
    // 调用OCR识别
    const { processImagesWithOCR } = await import('../providers/ocr_glm')
    const recognizedText = await processImagesWithOCR(imageUrls, env)
    
    return new Response(
      JSON.stringify({
        success: true,
        text: recognizedText,
        confidence: 0.95, // 默认置信度
        actualProcessTime: Date.now() - startTime,
        words: recognizedText ? recognizedText.split(/\s+/).filter(w => w.length > 0) : [],
        imageUrls: imageUrls,
        processedAt: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('[OCR Recognition] Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : '识别失败：无法获取数据' 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  }
}

// 导出新的API路由模块
export { batchOcrApp, githubSyncApp, cdnReplacementApp, automationApp }