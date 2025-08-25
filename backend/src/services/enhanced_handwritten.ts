/**
 * 增强的手写笔记处理服务
 * 实现通道A：手写笔记照片处理（Telegram Bot + 直接上传）
 * 支持自动备份、OCR识别、标准化Markdown生成
 */
import { FileAccessService } from './file_access'
import { uploadToCloudflareImages } from '../providers/images_cloudflare'
import { processImagesWithOCR } from '../providers/ocr_glm'
import { buildMarkdownNote } from './note_builder'
import { uploadGitHubBinaryFile } from '../providers/github_files'
import { ImageItem } from '../types'

export interface HandwrittenProcessOptions {
  /** 是否启用GitHub原图备份 */
  enableGitHubBackup?: boolean
  /** 备份目录路径 */
  backupDirectory?: string
  /** 时区设置 */
  timezone?: string
  /** 自定义文件名前缀 */
  filenamePrefix?: string
  /** 是否生成详细的OCR结果 */
  detailedOCR?: boolean
}

export interface HandwrittenProcessResult {
  /** Cloudflare图片ID */
  cloudflareImageId: string
  /** Cloudflare图片URL */
  cloudflareImageUrl: string
  /** GitHub备份路径（如果启用） */
  gitHubBackupPath?: string
  /** OCR识别文本 */
  ocrText: string
  /** 生成的笔记路径 */
  notePath: string
  /** 处理时间戳 */
  processedAt: string
  /** 原始图片大小 */
  originalSize: number
}

export interface BatchProcessResult {
  /** 成功处理的数量 */
  successCount: number
  /** 失败的数量 */
  failureCount: number
  /** 处理结果详情 */
  results: Array<{
    filename: string
    success: boolean
    result?: HandwrittenProcessResult
    error?: string
  }>
  /** 总处理时间（毫秒） */
  totalProcessingTime: number
}

/**
 * 增强的手写笔记处理服务类
 */
export class EnhancedHandwrittenService {
  private fileAccess: FileAccessService
  private env: any

  constructor(fileAccess: FileAccessService, env: any) {
    this.fileAccess = fileAccess
    this.env = env
  }

  /**
   * 处理单张手写笔记照片
   */
  async processHandwrittenImage(
    imageBytes: Uint8Array,
    filename: string,
    options: HandwrittenProcessOptions = {}
  ): Promise<HandwrittenProcessResult> {
    const startTime = Date.now()
    const {
      enableGitHubBackup = true,
      backupDirectory = 'handwritten-backups',
      timezone = 'Asia/Shanghai',
      filenamePrefix = 'handwritten',
      detailedOCR = false
    } = options

    try {
      // 1. 上传到Cloudflare Images
      console.log(`[HandwrittenService] Uploading ${filename} to Cloudflare Images...`)
      const cloudflareResult = await uploadToCloudflareImages(
        imageBytes,
        filename,
        this.env
      )

      let gitHubBackupPath: string | undefined

      // 2. GitHub原图备份（可选）
      if (enableGitHubBackup) {
        try {
          console.log(`[HandwrittenService] Backing up ${filename} to GitHub...`)
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const backupFilename = `${filenamePrefix}-${timestamp}-${filename}`
          gitHubBackupPath = `${backupDirectory}/${backupFilename}`
          const owner = this.env.NOTES_REPO_OWNER || 'Twis06'
          const repo = this.env.NOTES_REPO_NAME || 'notes'
          const branch = this.env.NOTES_REPO_BRANCH || 'main'

          await uploadGitHubBinaryFile(
            owner,
            repo,
            gitHubBackupPath,
            imageBytes,
            `backup: add handwritten note ${backupFilename}`,
            this.env,
            branch
          )
          console.log(`[HandwrittenService] Backup completed: ${gitHubBackupPath}`)
        } catch (error) {
          console.warn('[HandwrittenService] GitHub backup failed, continuing with process:', error)
          gitHubBackupPath = undefined
        }
      }

      // 3. OCR识别
      console.log(`[HandwrittenService] Processing OCR for ${filename}...`)
      const imageUrls = [cloudflareResult.url]
      const ocrText = await processImagesWithOCR(imageUrls, this.env)

      // 4. 生成标准化Markdown笔记
      console.log(`[HandwrittenService] Building Markdown note...`)
      const imageItem: ImageItem = {
        id: cloudflareResult.id,
        url: cloudflareResult.url,
        filename,
        size: imageBytes.length,
        uploaded_at: new Date().toISOString()
      }

      const builtNote = buildMarkdownNote({
        images: [imageItem],
        body: ocrText,
        timezone
      })

      // 在frontmatter中添加处理信息
      let noteContent = builtNote.content
      if (gitHubBackupPath || detailedOCR) {
        noteContent = noteContent.replace(
          /^---\n([\s\S]*?)\n---/,
          (match, frontmatter) => {
            let updatedFrontmatter = frontmatter
            if (gitHubBackupPath) {
              updatedFrontmatter += `\noriginal_backup: ${gitHubBackupPath}`
            }
            if (detailedOCR) {
              updatedFrontmatter += `\nprocessing_time: ${Date.now() - startTime}ms`
              updatedFrontmatter += `\noriginal_size: ${imageBytes.length}`
              updatedFrontmatter += `\ncloudflare_id: ${cloudflareResult.id}`
            }
            return `---\n${updatedFrontmatter}\n---`
          }
        )
        builtNote.content = noteContent
      }

      // 5. 提交到GitHub notes仓库
      console.log(`[HandwrittenService] Submitting note to GitHub...`)
      const notePath = `${builtNote.dir}/${builtNote.filename}`
      await this.fileAccess.writeFile(
        notePath,
        builtNote.content,
        `add handwritten note: ${builtNote.filename}`
      )

      const result: HandwrittenProcessResult = {
        cloudflareImageId: cloudflareResult.id,
        cloudflareImageUrl: cloudflareResult.url,
        gitHubBackupPath,
        ocrText,
        notePath,
        processedAt: new Date().toISOString(),
        originalSize: imageBytes.length
      }

      console.log(`[HandwrittenService] Successfully processed ${filename} in ${Date.now() - startTime}ms`)
      return result

    } catch (error) {
      console.error(`[HandwrittenService] Failed to process ${filename}:`, error)
      throw new Error(`Failed to process handwritten image ${filename}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 批量处理多张手写笔记照片
   */
  async processBatchHandwrittenImages(
    images: Array<{ bytes: Uint8Array; filename: string }>,
    options: HandwrittenProcessOptions = {}
  ): Promise<BatchProcessResult> {
    const startTime = Date.now()
    const results: BatchProcessResult['results'] = []
    let successCount = 0
    let failureCount = 0

    console.log(`[HandwrittenService] Starting batch processing of ${images.length} images...`)

    // 串行处理以避免API限制和资源竞争
    for (const image of images) {
      try {
        const result = await this.processHandwrittenImage(
          image.bytes,
          image.filename,
          options
        )
        
        results.push({
          filename: image.filename,
          success: true,
          result
        })
        successCount++
        
        // 添加延迟以避免API限制
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        results.push({
          filename: image.filename,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
        failureCount++
        console.error(`[HandwrittenService] Failed to process ${image.filename}:`, error)
      }
    }

    const totalProcessingTime = Date.now() - startTime
    console.log(`[HandwrittenService] Batch processing completed: ${successCount} success, ${failureCount} failures in ${totalProcessingTime}ms`)

    return {
      successCount,
      failureCount,
      results,
      totalProcessingTime
    }
  }

  /**
   * 从URL处理手写笔记（支持Telegram等外部图片）
   */
  async processHandwrittenFromUrl(
    imageUrl: string,
    filename?: string,
    options: HandwrittenProcessOptions = {}
  ): Promise<HandwrittenProcessResult> {
    try {
      console.log(`[HandwrittenService] Downloading image from URL: ${imageUrl}`)
      
      // 下载图片
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`)
      }
      
      const arrayBuffer = await response.arrayBuffer()
      const imageBytes = new Uint8Array(arrayBuffer)
      
      // 如果没有提供文件名，尝试从URL提取
      if (!filename) {
        const urlPath = new URL(imageUrl).pathname
        filename = urlPath.split('/').pop() || `image-${Date.now()}.jpg`
      }
      
      return await this.processHandwrittenImage(imageBytes, filename, options)
      
    } catch (error) {
      console.error(`[HandwrittenService] Failed to process image from URL ${imageUrl}:`, error)
      throw new Error(`Failed to process image from URL: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 获取处理统计信息
   */
  async getProcessingStats(): Promise<{
    totalBackups: number
    recentProcessing: Array<{
      date: string
      count: number
    }>
  }> {
    try {
      // 获取备份目录中的文件数量
      const backupFiles = await this.fileAccess.listDirectory('handwritten-backups')
      const totalBackups = backupFiles.filter(f => !f.isDirectory).length

      // 简单的统计信息（实际项目中可能需要更复杂的统计逻辑）
      const recentProcessing = [{
        date: new Date().toISOString().split('T')[0],
        count: 0 // 这里可以实现更详细的统计逻辑
      }]

      return {
        totalBackups,
        recentProcessing
      }
    } catch (error) {
      console.warn('[HandwrittenService] Failed to get processing stats:', error)
      return {
        totalBackups: 0,
        recentProcessing: []
      }
    }
  }
}

/**
 * 创建增强的手写笔记处理服务实例
 */
export function createEnhancedHandwrittenService(
  fileAccess: FileAccessService,
  env: any
): EnhancedHandwrittenService {
  return new EnhancedHandwrittenService(fileAccess, env)
}