/**
 * 增强版手写笔记处理器
 * 提供优化的手写照片处理流程，包括智能质量检测、批量处理优化、错误恢复等
 */
import { uploadToCloudflareImages } from '../providers/images_cloudflare'
import { uploadGitHubBinaryFile } from '../providers/github_files'
import { processImagesWithOCR } from '../providers/ocr_glm'
import { buildMarkdownNote } from './note_builder'
import { submitToGitHub } from '../providers/git_github'

export interface EnhancedProcessingOptions {
  /** 是否启用GitHub备份 */
  enableGitHubBackup?: boolean
  /** GitHub备份目录 */
  gitHubBackupDir?: string
  /** 图片质量选项 */
  imageQuality?: 'auto' | 'highest' | 'high' | 'medium' | 'low'
  /** 是否启用智能压缩 */
  smartCompression?: boolean
  /** 最大重试次数 */
  maxRetries?: number
  /** 批处理大小 */
  batchSize?: number
  /** 是否启用质量检测 */
  enableQualityCheck?: boolean
  /** 最小图片尺寸 */
  minImageSize?: { width: number; height: number }
  /** 是否生成多个变体 */
  generateVariants?: boolean
  /** OCR置信度阈值 */
  ocrConfidenceThreshold?: number
}

export interface ProcessingResult {
  /** 处理状态 */
  success: boolean
  /** Cloudflare Images ID */
  cloudflareImageId?: string
  /** Cloudflare Images URL */
  cloudflareImageUrl?: string
  /** 图片变体URLs */
  variants?: Record<string, string>
  /** GitHub备份路径 */
  gitHubBackupPath?: string
  /** OCR识别结果 */
  ocrResult?: {
    text: string
    confidence: number
    blocks: Array<{
      text: string
      confidence: number
      bbox?: { x: number; y: number; width: number; height: number }
    }>
  }
  /** 生成的Markdown笔记路径 */
  notePath?: string
  /** 处理时间统计 */
  timing?: {
    upload: number
    backup: number
    ocr: number
    markdown: number
    total: number
  }
  /** 错误信息 */
  error?: string
  /** 警告信息 */
  warnings?: string[]
}

export interface BatchProcessingResult {
  /** 总处理数量 */
  totalCount: number
  /** 成功数量 */
  successCount: number
  /** 失败数量 */
  failureCount: number
  /** 处理结果详情 */
  results: ProcessingResult[]
  /** 批处理统计 */
  statistics: {
    averageProcessingTime: number
    totalProcessingTime: number
    successRate: number
    commonErrors: Record<string, number>
  }
}

/**
 * 增强版手写笔记处理器类
 */
export class EnhancedHandwrittenProcessor {
  private env: any
  private defaultOptions: EnhancedProcessingOptions

  constructor(env: any, defaultOptions: EnhancedProcessingOptions = {}) {
    this.env = env
    this.defaultOptions = {
      enableGitHubBackup: false,
      gitHubBackupDir: 'handwritten_originals',
      imageQuality: 'auto',
      smartCompression: true,
      maxRetries: 3,
      batchSize: 5,
      enableQualityCheck: true,
      minImageSize: { width: 200, height: 200 },
      generateVariants: true,
      ocrConfidenceThreshold: 0.7,
      ...defaultOptions
    }
  }

  /**
   * 处理单张手写笔记照片
   */
  async processImage(
    imageBytes: Uint8Array,
    filename: string,
    options: EnhancedProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now()
    const opts = { ...this.defaultOptions, ...options }
    const warnings: string[] = []
    const timing: ProcessingResult['timing'] = {
      upload: 0,
      backup: 0,
      ocr: 0,
      markdown: 0,
      total: 0
    }

    try {
      // 1. 图片质量检测
      if (opts.enableQualityCheck) {
        const qualityCheck = await this.checkImageQuality(imageBytes, opts)
        if (!qualityCheck.passed) {
          return {
            success: false,
            error: `Image quality check failed: ${qualityCheck.reason}`,
            timing
          }
        }
        warnings.push(...qualityCheck.warnings)
      }

      // 2. 智能压缩和上传到Cloudflare
      const uploadStart = Date.now()
      const cloudflareResult = await this.uploadWithRetry(
        imageBytes,
        filename,
        opts
      )
      timing.upload = Date.now() - uploadStart

      // 3. 可选：GitHub备份
      let gitHubBackupPath: string | undefined
      if (opts.enableGitHubBackup) {
        const backupStart = Date.now()
        gitHubBackupPath = await this.backupToGitHub(
          imageBytes,
          filename,
          opts
        )
        timing.backup = Date.now() - backupStart
      }

      // 4. OCR识别
      const ocrStart = Date.now()
      const ocrResult = await this.performOCRWithRetry(
        cloudflareResult.url,
        opts
      )
      timing.ocr = Date.now() - ocrStart

      // 5. 生成Markdown笔记
      const markdownStart = Date.now()
      const notePath = await this.generateMarkdownNote(
        cloudflareResult,
        ocrResult,
        filename,
        gitHubBackupPath,
        imageBytes.length
      )
      timing.markdown = Date.now() - markdownStart

      timing.total = Date.now() - startTime

      return {
        success: true,
        cloudflareImageId: cloudflareResult.id,
        cloudflareImageUrl: cloudflareResult.url,
        variants: cloudflareResult.variants,
        gitHubBackupPath,
        ocrResult,
        notePath,
        timing,
        warnings: warnings.length > 0 ? warnings : undefined
      }

    } catch (error) {
      timing.total = Date.now() - startTime
      console.error('[EnhancedHandwrittenProcessor] Processing failed:', error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timing,
        warnings: warnings.length > 0 ? warnings : undefined
      }
    }
  }

  /**
   * 批量处理多张手写笔记照片
   */
  async processBatch(
    images: Array<{ bytes: Uint8Array; filename: string }>,
    options: EnhancedProcessingOptions = {}
  ): Promise<BatchProcessingResult> {
    const startTime = Date.now()
    const opts = { ...this.defaultOptions, ...options }
    const results: ProcessingResult[] = []
    const errors: Record<string, number> = {}

    console.log(`[EnhancedHandwrittenProcessor] Starting batch processing of ${images.length} images...`)

    // 分批处理以避免资源过载
    for (let i = 0; i < images.length; i += opts.batchSize!) {
      const batch = images.slice(i, i + opts.batchSize!)
      console.log(`[EnhancedHandwrittenProcessor] Processing batch ${Math.floor(i / opts.batchSize!) + 1}/${Math.ceil(images.length / opts.batchSize!)}...`)

      // 并发处理当前批次
      const batchPromises = batch.map(async ({ bytes, filename }) => {
        try {
          return await this.processImage(bytes, filename, opts)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          errors[errorMsg] = (errors[errorMsg] || 0) + 1
          return {
            success: false,
            error: errorMsg,
            timing: { upload: 0, backup: 0, ocr: 0, markdown: 0, total: 0 }
          } as ProcessingResult
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // 批次间短暂延迟，避免API限制
      if (i + opts.batchSize! < images.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    const totalProcessingTime = Date.now() - startTime
    const successCount = results.filter(r => r.success).length
    const failureCount = results.length - successCount
    const averageProcessingTime = results.reduce((sum, r) => sum + (r.timing?.total || 0), 0) / results.length

    console.log(`[EnhancedHandwrittenProcessor] Batch processing completed: ${successCount}/${results.length} successful in ${totalProcessingTime}ms`)

    return {
      totalCount: images.length,
      successCount,
      failureCount,
      results,
      statistics: {
        averageProcessingTime,
        totalProcessingTime,
        successRate: successCount / images.length,
        commonErrors: errors
      }
    }
  }

  /**
   * 检查图片质量
   */
  private async checkImageQuality(
    imageBytes: Uint8Array,
    options: EnhancedProcessingOptions
  ): Promise<{
    passed: boolean
    reason?: string
    warnings: string[]
  }> {
    const warnings: string[] = []

    try {
      // 检查文件大小 (临时禁用最小大小检查)
      // if (imageBytes.length < 1024) {
      //   return {
      //     passed: false,
      //     reason: 'Image file too small (< 1KB)',
      //     warnings
      //   }
      // }

      if (imageBytes.length > 50 * 1024 * 1024) {
        warnings.push('Large image file (> 50MB), processing may be slow')
      }

      // 简单的图片格式检测
      const header = Array.from(imageBytes.slice(0, 8))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      const isValidImage = (
        header.startsWith('ffd8ff') || // JPEG
        header.startsWith('89504e47') || // PNG
        header.startsWith('47494638') || // GIF
        header.startsWith('52494646') // WebP
      )

      if (!isValidImage) {
        return {
          passed: false,
          reason: 'Invalid image format',
          warnings
        }
      }

      return {
        passed: true,
        warnings
      }

    } catch (error) {
      return {
        passed: false,
        reason: `Quality check failed: ${error instanceof Error ? error.message : String(error)}`,
        warnings
      }
    }
  }

  /**
   * 带重试的上传到Cloudflare
   */
  private async uploadWithRetry(
    imageBytes: Uint8Array,
    filename: string,
    options: EnhancedProcessingOptions
  ): Promise<{ id: string; url: string; variants?: Record<string, string> }> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= options.maxRetries!; attempt++) {
      try {
        console.log(`[EnhancedHandwrittenProcessor] Upload attempt ${attempt}/${options.maxRetries} for ${filename}...`)

        const quality = options.smartCompression ? 
          this.determineOptimalQuality(imageBytes) : 
          options.imageQuality!

        const result = await uploadToCloudflareImages(
          imageBytes,
          filename,
          this.env,
          {
            quality,
            metadata: {
              source: 'enhanced_handwritten',
              uploaded_at: new Date().toISOString(),
              original_filename: filename,
              processing_version: '2.0',
              backup_enabled: options.enableGitHubBackup ? 'true' : 'false'
            }
          }
        )

        // 生成变体（如果启用）
        let variants: Record<string, string> | undefined
        if (options.generateVariants) {
          variants = {
            thumbnail: `${result.url}/w=300,h=300,fit=cover`,
            medium: `${result.url}/w=800,h=800,fit=scale-down`,
            large: `${result.url}/w=1200,h=1200,fit=scale-down`
          }
        }

        return {
          id: result.id,
          url: result.url,
          variants
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(`[EnhancedHandwrittenProcessor] Upload attempt ${attempt} failed:`, lastError.message)
        
        if (attempt < options.maxRetries!) {
          // 指数退避
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw new Error(`Upload failed after ${options.maxRetries} attempts: ${lastError?.message}`)
  }

  /**
   * 备份到GitHub
   */
  private async backupToGitHub(
    imageBytes: Uint8Array,
    filename: string,
    options: EnhancedProcessingOptions
  ): Promise<string | undefined> {
    try {
      const owner = this.env.GITHUB_REPO_OWNER
      const repo = this.env.GITHUB_REPO_NAME
      const branch = this.env.GITHUB_REPO_BRANCH || 'main'
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupFilename = `${timestamp}_${filename}`
      const backupPath = `${options.gitHubBackupDir}/${new Date().getFullYear()}/${backupFilename}`
      
      await uploadGitHubBinaryFile(
        owner,
        repo,
        backupPath,
        imageBytes,
        `backup: add enhanced handwritten note ${backupFilename}`,
        this.env,
        branch
      )
      
      return backupPath
      
    } catch (error) {
      console.warn('[EnhancedHandwrittenProcessor] GitHub backup failed:', error)
      return undefined
    }
  }

  /**
   * 带重试的OCR识别
   */
  private async performOCRWithRetry(
    imageUrl: string,
    options: EnhancedProcessingOptions
  ): Promise<ProcessingResult['ocrResult']> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= options.maxRetries!; attempt++) {
      try {
        console.log(`[EnhancedHandwrittenProcessor] OCR attempt ${attempt}/${options.maxRetries}...`)
        
        const ocrText = await processImagesWithOCR([imageUrl], this.env)
        
        // 简单的置信度评估（基于文本长度和特征）
        const confidence = this.estimateOCRConfidence(ocrText)
        
        if (confidence < options.ocrConfidenceThreshold!) {
          console.warn(`[EnhancedHandwrittenProcessor] OCR confidence ${confidence} below threshold ${options.ocrConfidenceThreshold}`)
        }
        
        return {
          text: ocrText,
          confidence,
          blocks: [{
            text: ocrText,
            confidence
          }]
        }
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(`[EnhancedHandwrittenProcessor] OCR attempt ${attempt} failed:`, lastError.message)
        
        if (attempt < options.maxRetries!) {
          const delay = Math.min(2000 * Math.pow(2, attempt - 1), 15000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw new Error(`OCR failed after ${options.maxRetries} attempts: ${lastError?.message}`)
  }

  /**
   * 生成Markdown笔记
   */
  private async generateMarkdownNote(
    cloudflareResult: { id: string; url: string },
    ocrResult: ProcessingResult['ocrResult'],
    filename: string,
    gitHubBackupPath: string | undefined,
    imageSize: number
  ): Promise<string> {
    const imageItem = {
      id: cloudflareResult.id,
      url: cloudflareResult.url,
      filename,
      size: imageSize,
      uploaded_at: new Date().toISOString()
    }

    const builtNote = buildMarkdownNote({
      images: [imageItem],
      body: ocrResult?.text || '',
      timezone: this.env.TIMEZONE
    })

    // 在frontmatter中添加增强信息
    let noteContent = builtNote.content
    
    if (gitHubBackupPath || ocrResult?.confidence) {
      noteContent = noteContent.replace(
        /^---\n([\s\S]*?)\n---/,
        (match, frontmatter) => {
          let updatedFrontmatter = frontmatter
          
          if (gitHubBackupPath) {
            updatedFrontmatter += `\noriginal_backup: ${gitHubBackupPath}`
          }
          
          if (ocrResult?.confidence) {
            updatedFrontmatter += `\nocr_confidence: ${ocrResult.confidence.toFixed(3)}`
          }
          
          updatedFrontmatter += `\nprocessing_version: "2.0"`
          
          return `---\n${updatedFrontmatter}\n---`
        }
      )
    }

    builtNote.content = noteContent
    await submitToGitHub(builtNote, this.env)

    return `${builtNote.dir}/${builtNote.filename}`
  }

  /**
   * 确定最优图片质量
   */
  private determineOptimalQuality(imageBytes: Uint8Array): 'auto' | 'highest' | 'high' | 'medium' | 'low' {
    const sizeInMB = imageBytes.length / (1024 * 1024)
    
    if (sizeInMB > 10) return 'medium'
    if (sizeInMB > 5) return 'high'
    if (sizeInMB > 2) return 'highest'
    return 'auto'
  }

  /**
   * 估算OCR置信度
   */
  private estimateOCRConfidence(text: string): number {
    if (!text || text.trim().length === 0) return 0
    
    // 基于文本特征的简单置信度评估
    let confidence = 0.5 // 基础置信度
    
    // 文本长度因子
    if (text.length > 50) confidence += 0.2
    if (text.length > 200) confidence += 0.1
    
    // 包含数学公式或特殊符号
    if (/[\$\\\{\}\^_]/.test(text)) confidence += 0.1
    
    // 包含常见单词
    const commonWords = ['the', 'and', 'or', 'is', 'are', 'was', 'were', '的', '是', '在', '有']
    const hasCommonWords = commonWords.some(word => text.toLowerCase().includes(word))
    if (hasCommonWords) confidence += 0.1
    
    // 避免过度自信
    return Math.min(confidence, 0.95)
  }
}

/**
 * 创建增强版手写笔记处理器实例
 */
export function createEnhancedHandwrittenProcessor(
  env: any,
  options: EnhancedProcessingOptions = {}
): EnhancedHandwrittenProcessor {
  return new EnhancedHandwrittenProcessor(env, options)
}

/**
 * 便捷函数：处理单张图片
 */
export async function processEnhancedHandwrittenNote(
  imageBytes: Uint8Array,
  filename: string,
  env: any,
  options: EnhancedProcessingOptions = {}
): Promise<ProcessingResult> {
  const processor = createEnhancedHandwrittenProcessor(env, options)
  return await processor.processImage(imageBytes, filename, options)
}

/**
 * 便捷函数：批量处理图片
 */
export async function processEnhancedHandwrittenBatch(
  images: Array<{ bytes: Uint8Array; filename: string }>,
  env: any,
  options: EnhancedProcessingOptions = {}
): Promise<BatchProcessingResult> {
  const processor = createEnhancedHandwrittenProcessor(env, options)
  return await processor.processBatch(images, options)
}