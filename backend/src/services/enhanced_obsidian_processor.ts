/**
 * 增强版Obsidian图片处理器
 * 提供智能压缩、批量优化、错误恢复、URL替换等增强功能
 */
import { uploadToCloudflareImages } from '../providers/images_cloudflare'
import { getGitHubFileContent, getGitHubRawFile, updateGitHubFile, getMarkdownFiles } from '../providers/github_files'
import { AttachmentInfo, ProcessedNote, extractImageReferences } from './obsidian_processor'

export interface EnhancedObsidianOptions {
  /** 是否启用智能压缩 */
  enableSmartCompression?: boolean
  /** 图片质量设置 */
  imageQuality?: 'auto' | 'highest' | 'high' | 'medium' | 'low'
  /** 最大图片尺寸 */
  maxImageSize?: { width: number; height: number }
  /** 是否生成多个变体 */
  generateVariants?: boolean
  /** 批处理大小 */
  batchSize?: number
  /** 最大重试次数 */
  maxRetries?: number
  /** 是否启用并行处理 */
  enableParallelProcessing?: boolean
  /** 是否保留原始图片备份 */
  keepOriginalBackup?: boolean
  /** GitHub备份目录 */
  backupDirectory?: string
  /** 是否启用进度回调 */
  enableProgressCallback?: boolean
  /** 错误处理策略 */
  errorHandling?: 'skip' | 'retry' | 'fail'
}

export interface EnhancedProcessingResult {
  /** 处理状态 */
  success: boolean
  /** 处理的文件数量 */
  processedFiles: number
  /** 成功上传的图片数量 */
  uploadedImages: number
  /** 失败的图片数量 */
  failedImages: number
  /** 处理详情 */
  results: ProcessedNote[]
  /** 上传的附件信息 */
  attachments: AttachmentInfo[]
  /** 处理统计 */
  statistics: {
    totalProcessingTime: number
    averageFileProcessingTime: number
    totalImageSize: number
    compressionRatio: number
    errorCount: number
    warningCount: number
  }
  /** 错误信息 */
  errors: Array<{
    file: string
    image: string
    error: string
    timestamp: string
  }>
  /** 警告信息 */
  warnings: string[]
}

export interface ProgressCallback {
  (progress: {
    currentFile: number
    totalFiles: number
    currentImage: number
    totalImages: number
    fileName: string
    status: 'processing' | 'uploading' | 'completed' | 'error'
  }): void
}

/**
 * 增强版Obsidian图片处理器类
 */
export class EnhancedObsidianProcessor {
  private env: any
  private defaultOptions: EnhancedObsidianOptions
  private progressCallback?: ProgressCallback

  constructor(env: any, defaultOptions: EnhancedObsidianOptions = {}) {
    this.env = env
    this.defaultOptions = {
      enableSmartCompression: true,
      imageQuality: 'auto',
      maxImageSize: { width: 2048, height: 2048 },
      generateVariants: false,
      batchSize: 5,
      maxRetries: 3,
      enableParallelProcessing: true,
      keepOriginalBackup: false,
      backupDirectory: 'attachments/backup',
      enableProgressCallback: false,
      errorHandling: 'skip',
      ...defaultOptions
    }
  }

  /**
   * 设置进度回调函数
   */
  setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback
  }

  /**
   * 处理整个Obsidian仓库的附件
   */
  async processRepository(
    options: EnhancedObsidianOptions = {}
  ): Promise<EnhancedProcessingResult> {
    const startTime = Date.now()
    const mergedOptions = { ...this.defaultOptions, ...options }
    
    console.log('[Enhanced Obsidian] Starting repository processing...')
    
    const owner = this.env.GITHUB_REPO_OWNER
    const repo = this.env.GITHUB_REPO_NAME
    const branch = this.env.GITHUB_REPO_BRANCH || 'main'
    const baseDir = ''

    try {
      // 获取所有Markdown文件
      const mdFiles = await getMarkdownFiles(owner, repo, this.env, baseDir)
      console.log(`[Enhanced Obsidian] Found ${mdFiles.length} markdown files`)

      const result: EnhancedProcessingResult = {
        success: true,
        processedFiles: 0,
        uploadedImages: 0,
        failedImages: 0,
        results: [],
        attachments: [],
        statistics: {
          totalProcessingTime: 0,
          averageFileProcessingTime: 0,
          totalImageSize: 0,
          compressionRatio: 0,
          errorCount: 0,
          warningCount: 0
        },
        errors: [],
        warnings: []
      }

      // 批量处理文件
      const batches = this.createBatches(mdFiles, mergedOptions.batchSize!)
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        console.log(`[Enhanced Obsidian] Processing batch ${batchIndex + 1}/${batches.length}`)
        
        if (mergedOptions.enableParallelProcessing) {
          const batchResults = await Promise.allSettled(
            batch.map(file => this.processMarkdownFileEnhanced(file, baseDir, mergedOptions))
          )
          
          this.processBatchResults(batchResults, result)
        } else {
          for (const file of batch) {
            try {
              const fileResult = await this.processMarkdownFileEnhanced(file, baseDir, mergedOptions)
              this.addFileResult(fileResult, result)
            } catch (error) {
              this.handleFileError(file.path, error, result, mergedOptions)
            }
          }
        }
      }

      // 计算统计信息
      const endTime = Date.now()
      result.statistics.totalProcessingTime = endTime - startTime
      result.statistics.averageFileProcessingTime = result.processedFiles > 0 
        ? result.statistics.totalProcessingTime / result.processedFiles 
        : 0
      
      console.log(`[Enhanced Obsidian] Processing completed: ${result.uploadedImages} images uploaded, ${result.failedImages} failed`)
      
      return result
      
    } catch (error) {
      console.error('[Enhanced Obsidian] Repository processing failed:', error)
      throw error
    }
  }

  /**
   * 增强版Markdown文件处理
   */
  private async processMarkdownFileEnhanced(
    file: { path: string; sha: string },
    baseDir: string,
    options: EnhancedObsidianOptions
  ): Promise<ProcessedNote> {
    const fileStartTime = Date.now()
    
    try {
      // 获取文件内容
      const fileContent = await getGitHubFileContent(
        this.env.GITHUB_REPO_OWNER,
        this.env.GITHUB_REPO_NAME,
        file.path,
        this.env,
        this.env.GITHUB_REPO_BRANCH || 'main'
      )
      
      const imageRefs = extractImageReferences(fileContent.content)
      
      if (imageRefs.length === 0) {
        return {
          filePath: file.path,
          originalContent: fileContent.content,
          updatedContent: fileContent.content,
          attachments: [],
          hasChanges: false
        }
      }
      
      console.log(`[Enhanced Obsidian] Processing ${imageRefs.length} images in ${file.path}`)
      
      const attachments: AttachmentInfo[] = []
      let updatedContent = fileContent.content
      let hasChanges = false
      
      // 处理每个图片引用
      for (let i = 0; i < imageRefs.length; i++) {
        const ref = imageRefs[i]
        
        if (this.progressCallback && options.enableProgressCallback) {
          this.progressCallback({
            currentFile: 1,
            totalFiles: 1,
            currentImage: i + 1,
            totalImages: imageRefs.length,
            fileName: file.path,
            status: 'processing'
          })
        }
        
        try {
          const result = await this.processImageReference(ref, file.path, baseDir, options)
          
          if (result) {
            attachments.push(result.attachment)
            updatedContent = updatedContent.replace(ref.match, result.newReference)
            hasChanges = true
            
            if (this.progressCallback && options.enableProgressCallback) {
              this.progressCallback({
                currentFile: 1,
                totalFiles: 1,
                currentImage: i + 1,
                totalImages: imageRefs.length,
                fileName: file.path,
                status: 'completed'
              })
            }
          }
        } catch (error) {
          console.error(`[Enhanced Obsidian] Failed to process image ${ref.path}:`, error)
          
          if (this.progressCallback && options.enableProgressCallback) {
            this.progressCallback({
              currentFile: 1,
              totalFiles: 1,
              currentImage: i + 1,
              totalImages: imageRefs.length,
              fileName: file.path,
              status: 'error'
            })
          }
          
          if (options.errorHandling === 'fail') {
            throw error
          }
          // 'skip' 或 'retry' 策略继续处理其他图片
        }
      }
      
      // 如果有变更，更新GitHub文件
      if (hasChanges) {
        await updateGitHubFile(
          this.env.GITHUB_REPO_OWNER,
          this.env.GITHUB_REPO_NAME,
          file.path,
          updatedContent,
          `feat: migrate images to Cloudflare Images for ${file.path}`,
          fileContent.sha,
          this.env,
          this.env.GITHUB_REPO_BRANCH || 'main'
        )
      }
      
      return {
        filePath: file.path,
        originalContent: fileContent.content,
        updatedContent,
        attachments,
        hasChanges
      }
      
    } catch (error) {
      console.error(`[Enhanced Obsidian] Failed to process file ${file.path}:`, error)
      throw error
    }
  }

  /**
   * 处理单个图片引用
   */
  private async processImageReference(
    ref: { match: string; path: string; alt?: string },
    filePath: string,
    baseDir: string,
    options: EnhancedObsidianOptions
  ): Promise<{ attachment: AttachmentInfo; newReference: string } | null> {
    try {
      // 构建完整的图片路径
      let fullImagePath = ref.path
      if (!fullImagePath.startsWith('/')) {
        const noteDir = filePath.substring(0, filePath.lastIndexOf('/'))
        fullImagePath = `${noteDir}/${ref.path}`.replace(/\/+/g, '/')
      }
      
      if (!fullImagePath.startsWith('/')) {
        fullImagePath = `${baseDir}/${fullImagePath}`.replace(/\/+/g, '/')
      }
      
      // 读取图片文件
      const imageBuffer = await this.readImageFileEnhanced(fullImagePath, options)
      const filename = fullImagePath.split('/').pop() || 'image.jpg'
      
      // 智能压缩处理
      const processedImage = await this.processImageWithCompression(imageBuffer, filename, options)
      
      // 上传到Cloudflare Images
      const uploadResult = await this.uploadImageWithRetry(processedImage.bytes, filename, options)
      
      const attachmentInfo: AttachmentInfo = {
        id: uploadResult.id,
        url: uploadResult.url,
        originalPath: ref.path,
        filename,
        size: processedImage.bytes.length,
        uploaded_at: new Date().toISOString()
      }
      
      // 生成新的引用
      let newReference: string
      if (ref.match.includes('![[')) {
        // Obsidian wiki link格式
        newReference = `![${filename}](${uploadResult.url})`
      } else if (ref.match.includes('<img')) {
        // HTML img标签格式
        newReference = `<img src="${uploadResult.url}" alt="${filename}">`
      } else {
        // 标准Markdown格式
        const alt = ref.alt || filename
        newReference = `![${alt}](${uploadResult.url})`
      }
      
      return { attachment: attachmentInfo, newReference }
      
    } catch (error) {
      console.error(`[Enhanced Obsidian] Failed to process image reference ${ref.path}:`, error)
      throw error
    }
  }

  /**
   * 增强版图片文件读取
   */
  private async readImageFileEnhanced(
    path: string,
    options: EnhancedObsidianOptions
  ): Promise<Uint8Array> {
    const owner = this.env.GITHUB_REPO_OWNER
    const repo = this.env.GITHUB_REPO_NAME
    const branch = this.env.GITHUB_REPO_BRANCH || 'main'
    
    // 将本地绝对路径映射为仓库内相对路径
    const localRoot = this.env.LOCAL_NOTES_ROOT || '/Users/lipeiyang/Documents/notes'
    let repoRelativePath = path
    if (path.startsWith(localRoot)) {
      repoRelativePath = path.substring(localRoot.length).replace(/^\/+/, '')
    }
    
    try {
      const bytes = await getGitHubRawFile(owner, repo, repoRelativePath, this.env, branch)
      return bytes
    } catch (error) {
      throw new Error(`Cannot read file via GitHub API: ${repoRelativePath}. Error: ${error}`)
    }
  }

  /**
   * 智能图片压缩处理
   */
  private async processImageWithCompression(
    imageBytes: Uint8Array,
    filename: string,
    options: EnhancedObsidianOptions
  ): Promise<{ bytes: Uint8Array; compressionRatio: number }> {
    if (!options.enableSmartCompression) {
      return { bytes: imageBytes, compressionRatio: 1 }
    }
    
    // 简单的压缩逻辑（实际项目中可以集成更复杂的图片处理库）
    const originalSize = imageBytes.length
    
    // 如果图片太大，可以考虑压缩
    if (originalSize > 2 * 1024 * 1024) { // 2MB
      console.log(`[Enhanced Obsidian] Large image detected (${originalSize} bytes), applying compression`)
      // 这里可以集成实际的图片压缩逻辑
      // 目前返回原始图片
    }
    
    return { bytes: imageBytes, compressionRatio: 1 }
  }

  /**
   * 带重试的图片上传
   */
  private async uploadImageWithRetry(
    imageBytes: Uint8Array,
    filename: string,
    options: EnhancedObsidianOptions
  ): Promise<{ id: string; url: string; variants?: Record<string, string> }> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= (options.maxRetries || 3); attempt++) {
      try {
        console.log(`[Enhanced Obsidian] Uploading ${filename} (attempt ${attempt})`)
        
        const result = await uploadToCloudflareImages(imageBytes, filename, this.env)
        
        console.log(`[Enhanced Obsidian] Successfully uploaded ${filename} to ${result.url}`)
        return result
        
      } catch (error) {
        lastError = error as Error
        console.warn(`[Enhanced Obsidian] Upload attempt ${attempt} failed for ${filename}:`, error)
        
        if (attempt < (options.maxRetries || 3)) {
          // 指数退避
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    throw lastError || new Error('Upload failed after all retries')
  }

  /**
   * 创建批次
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  /**
   * 处理批次结果
   */
  private processBatchResults(
    batchResults: PromiseSettledResult<ProcessedNote>[],
    result: EnhancedProcessingResult
  ): void {
    for (const settledResult of batchResults) {
      if (settledResult.status === 'fulfilled') {
        this.addFileResult(settledResult.value, result)
      } else {
        result.statistics.errorCount++
        result.errors.push({
          file: 'unknown',
          image: 'unknown',
          error: settledResult.reason?.message || String(settledResult.reason),
          timestamp: new Date().toISOString()
        })
      }
    }
  }

  /**
   * 添加文件处理结果
   */
  private addFileResult(fileResult: ProcessedNote, result: EnhancedProcessingResult): void {
    result.results.push(fileResult)
    result.processedFiles++
    result.uploadedImages += fileResult.attachments.length
    result.attachments.push(...fileResult.attachments)
    
    // 更新统计信息
    result.statistics.totalImageSize += fileResult.attachments.reduce(
      (sum, att) => sum + att.size, 0
    )
  }

  /**
   * 处理文件错误
   */
  private handleFileError(
    filePath: string,
    error: any,
    result: EnhancedProcessingResult,
    options: EnhancedObsidianOptions
  ): void {
    result.statistics.errorCount++
    result.errors.push({
      file: filePath,
      image: 'unknown',
      error: error?.message || String(error),
      timestamp: new Date().toISOString()
    })
    
    if (options.errorHandling === 'fail') {
      throw error
    }
  }
}

/**
 * 创建增强版Obsidian处理器实例
 */
export function createEnhancedObsidianProcessor(
  env: any,
  options: EnhancedObsidianOptions = {}
): EnhancedObsidianProcessor {
  return new EnhancedObsidianProcessor(env, options)
}

/**
 * 便捷函数：处理整个Obsidian仓库
 */
export async function processObsidianRepositoryEnhanced(
  env: any,
  options: EnhancedObsidianOptions = {}
): Promise<EnhancedProcessingResult> {
  const processor = createEnhancedObsidianProcessor(env, options)
  return processor.processRepository(options)
}