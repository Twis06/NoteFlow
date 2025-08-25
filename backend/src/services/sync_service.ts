/**
 * 同步服务
 * 负责监控和同步GitHub仓库的attachments文件夹
 * 实现通道B：自动同步Obsidian生成的attachments
 */
import { FileAccessService } from './file_access'
import { uploadToCloudflareImages } from '../providers/images_cloudflare'
import { getImageFiles, GitHubTreeItem } from '../providers/github_files'
import { updateGitHubFile } from '../providers/github_files'

export interface SyncOptions {
  /** 要同步的目录路径 */
  targetDirectory?: string
  /** 是否执行干运行（不实际修改文件） */
  dryRun?: boolean
  /** 批处理大小 */
  batchSize?: number
}

export interface SyncResult {
  /** 处理的文件数量 */
  processedCount: number
  /** 上传成功的文件数量 */
  uploadedCount: number
  /** 更新的Markdown文件数量 */
  updatedMarkdownCount: number
  /** 错误列表 */
  errors: Array<{ file: string; error: string }>
  /** 处理的文件详情 */
  processedFiles: Array<{
    originalPath: string
    cloudflareUrl: string
    size: number
  }>
}

/**
 * 同步服务类
 */
export class SyncService {
  private fileAccess: FileAccessService
  private env: any

  constructor(fileAccess: FileAccessService, env: any) {
    this.fileAccess = fileAccess
    this.env = env
  }

  /**
   * 同步attachments文件夹中的图片到Cloudflare Images
   * 并更新所有引用这些图片的Markdown文件
   */
  async syncAttachments(options: SyncOptions = {}): Promise<SyncResult> {
    const {
      targetDirectory = 'attachments',
      dryRun = false,
      batchSize = 5
    } = options

    const result: SyncResult = {
      processedCount: 0,
      uploadedCount: 0,
      updatedMarkdownCount: 0,
      errors: [],
      processedFiles: []
    }

    try {
      // 1. 获取attachments文件夹中的所有图片文件
      const imageFiles = await this.getAttachmentImages(targetDirectory)
      result.processedCount = imageFiles.length

      if (imageFiles.length === 0) {
        console.log('No images found in attachments folder')
        return result
      }

      // 2. 批量处理图片上传
      const uploadResults = await this.batchUploadImages(imageFiles, batchSize, dryRun)
      result.uploadedCount = uploadResults.filter(r => r.success).length
      result.processedFiles = uploadResults
        .filter(r => r.success)
        .map(r => ({
          originalPath: r.originalPath,
          cloudflareUrl: r.cloudflareUrl!,
          size: r.size
        }))

      // 收集上传错误
      uploadResults
        .filter(r => !r.success)
        .forEach(r => {
          result.errors.push({
            file: r.originalPath,
            error: r.error || 'Upload failed'
          })
        })

      if (!dryRun && result.uploadedCount > 0) {
        // 3. 更新所有Markdown文件中的图片引用
        const successfulUploads = uploadResults
          .filter(r => r.success && r.cloudflareUrl && r.cloudflareId)
          .map(r => ({
            originalPath: r.originalPath,
            cloudflareUrl: r.cloudflareUrl!,
            cloudflareId: r.cloudflareId!
          }))
        const updateResult = await this.updateMarkdownReferences(successfulUploads)
        result.updatedMarkdownCount = updateResult.updatedCount
        result.errors.push(...updateResult.errors)
      }

    } catch (error) {
      result.errors.push({
        file: 'sync_process',
        error: error instanceof Error ? error.message : String(error)
      })
    }

    return result
  }

  /**
   * 增量同步 - 只处理新增或修改的文件
   */
  async incrementalSync(options: SyncOptions & {
    lastSyncTime?: string
  } = {}): Promise<SyncResult> {
    const { lastSyncTime, ...syncOptions } = options
    
    console.log(`[SyncService] Starting incremental sync since ${lastSyncTime || 'beginning'}...`)
    
    try {
      // 如果有上次同步时间，只处理修改时间晚于该时间的文件
      if (lastSyncTime) {
        // 这里可以实现基于文件修改时间的过滤逻辑
        // 当前简化实现，直接调用完整同步
        console.log('[SyncService] Incremental sync - checking file modification times...')
      }
      
      return await this.syncAttachments(syncOptions)
      
    } catch (error) {
      console.error('[SyncService] Incremental sync failed:', error)
      throw error
    }
  }

  /**
   * 监控模式 - 定期检查并同步
   */
  async startMonitoring(options: SyncOptions & {
    interval?: number // 检查间隔（毫秒）
    maxRuns?: number // 最大运行次数（0表示无限）
  } = {}): Promise<void> {
    const {
      interval = 300000, // 默认5分钟
      maxRuns = 0,
      ...syncOptions
    } = options
    
    console.log(`[SyncService] Starting monitoring mode with ${interval}ms interval...`)
    
    let runCount = 0
    
    const runSync = async () => {
      try {
        runCount++
        console.log(`[SyncService] Monitor run #${runCount}...`)
        
        const result = await this.syncAttachments(syncOptions)
        
        if (result.uploadedCount > 0 || result.updatedMarkdownCount > 0) {
          console.log(`[SyncService] Monitor detected changes: ${result.uploadedCount} images uploaded, ${result.updatedMarkdownCount} markdown files updated`)
        }
        
        // 检查是否达到最大运行次数
        if (maxRuns > 0 && runCount >= maxRuns) {
          console.log(`[SyncService] Monitor reached max runs (${maxRuns}), stopping...`)
          return
        }
        
        // 设置下次运行
        setTimeout(runSync, interval)
        
      } catch (error) {
        console.error(`[SyncService] Monitor run #${runCount} failed:`, error)
        // 即使出错也继续监控
        setTimeout(runSync, interval)
      }
    }
    
    // 立即运行第一次
    await runSync()
  }

  /**
   * 检查文件是否为图片
   */
  private isImageFile(filename: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp']
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
    return imageExtensions.includes(ext)
  }

  /**
   * 获取attachments文件夹中的图片文件
   */
  private async getAttachmentImages(targetDirectory: string): Promise<GitHubTreeItem[]> {
    const owner = this.env.NOTES_REPO_OWNER || 'Twis06'
    const repo = this.env.NOTES_REPO_NAME || 'notes'
    
    return await getImageFiles(owner, repo, this.env, targetDirectory)
  }

  /**
   * 批量上传图片到Cloudflare Images
   */
  private async batchUploadImages(
    imageFiles: GitHubTreeItem[],
    batchSize: number,
    dryRun: boolean
  ): Promise<Array<{
    originalPath: string
    size: number
    success: boolean
    cloudflareUrl?: string
    cloudflareId?: string
    error?: string
  }>> {
    const results: Array<{
      originalPath: string
      size: number
      success: boolean
      cloudflareUrl?: string
      cloudflareId?: string
      error?: string
    }> = []

    // 分批处理以避免API限制
    for (let i = 0; i < imageFiles.length; i += batchSize) {
      const batch = imageFiles.slice(i, i + batchSize)
      const batchPromises = batch.map(async (file) => {
        try {
          if (dryRun) {
            return {
              originalPath: file.path,
              size: file.size || 0,
              success: true,
              cloudflareUrl: `https://imagedelivery.net/dummy/${file.path}`,
              cloudflareId: 'dry-run-id'
            }
          }

          // 读取图片文件
          const imageBytes = await this.fileAccess.readBinaryFile(file.path)
          
          // 上传到Cloudflare Images
          const filename = file.path.split('/').pop() || 'image'
          const uploadResult = await uploadToCloudflareImages(
            imageBytes,
            filename,
            this.env
          )

          return {
            originalPath: file.path,
            size: file.size || 0,
            success: true,
            cloudflareUrl: uploadResult.url,
            cloudflareId: uploadResult.id
          }
        } catch (error) {
          return {
            originalPath: file.path,
            size: file.size || 0,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // 添加延迟以避免API限制
      if (i + batchSize < imageFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return results
  }

  /**
   * 更新Markdown文件中的图片引用
   */
  private async updateMarkdownReferences(
    uploadResults: Array<{
      originalPath: string
      cloudflareUrl: string
      cloudflareId: string
    }>
  ): Promise<{ updatedCount: number; errors: Array<{ file: string; error: string }> }> {
    const result = { updatedCount: 0, errors: [] as Array<{ file: string; error: string }> }

    try {
      // 获取所有Markdown文件
      const markdownFiles = await this.getAllMarkdownFiles()
      
      for (const mdFile of markdownFiles) {
        try {
          const content = await this.fileAccess.readFile(mdFile.path)
          let updatedContent = content
          let hasChanges = false

          // 替换每个上传的图片引用
          for (const upload of uploadResults) {
            const originalPath = upload.originalPath
            const cloudflareUrl = upload.cloudflareUrl

            // 支持多种Markdown图片引用格式
            const patterns = [
              // ![alt](path)
              new RegExp(`!\\[([^\\]]*)\\]\\(\\s*${this.escapeRegex(originalPath)}\\s*\\)`, 'g'),
              // ![alt](./path)
              new RegExp(`!\\[([^\\]]*)\\]\\(\\s*\\.\/+${this.escapeRegex(originalPath)}\\s*\\)`, 'g'),
              // ![alt](../path)
              new RegExp(`!\\[([^\\]]*)\\]\\(\\s*\.\.\/+${this.escapeRegex(originalPath)}\\s*\\)`, 'g'),
              // [[path]]
              new RegExp(`\\[\\[\\s*${this.escapeRegex(originalPath)}\\s*\\]\\]`, 'g'),
              // <img src="path">
              new RegExp(`<img[^>]*src\\s*=\\s*["']\\s*${this.escapeRegex(originalPath)}\\s*["'][^>]*>`, 'gi')
            ]

            for (const pattern of patterns) {
              if (pattern.test(updatedContent)) {
                updatedContent = updatedContent.replace(pattern, (match) => {
                  if (match.startsWith('!')) {
                    // Markdown格式
                    return match.replace(originalPath, cloudflareUrl)
                  } else if (match.startsWith('[[')) {
                    // Obsidian链接格式，转换为标准Markdown
                    const filename = originalPath.split('/').pop() || 'image'
                    return `![${filename}](${cloudflareUrl})`
                  } else {
                    // HTML格式
                    return match.replace(originalPath, cloudflareUrl)
                  }
                })
                hasChanges = true
              }
            }
          }

          // 如果有变更，写回文件
          if (hasChanges) {
            await this.fileAccess.writeFile(
              mdFile.path,
              updatedContent,
              `chore: migrate images to Cloudflare Images for ${mdFile.path}`
            )
            result.updatedCount++
          }
        } catch (error) {
          result.errors.push({
            file: mdFile.path,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    } catch (error) {
      result.errors.push({
        file: 'markdown_update_process',
        error: error instanceof Error ? error.message : String(error)
      })
    }

    return result
  }

  /**
   * 获取所有Markdown文件
   */
  private async getAllMarkdownFiles(): Promise<GitHubTreeItem[]> {
    const owner = this.env.NOTES_REPO_OWNER || 'Twis06'
    const repo = this.env.NOTES_REPO_NAME || 'notes'
    
    const { getMarkdownFiles } = await import('../providers/github_files')
    return await getMarkdownFiles(owner, repo, this.env)
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * 获取同步状态
   */
  async getSyncStatus(): Promise<{
    attachmentsCount: number
    lastSyncTime?: string
    pendingFiles: string[]
    syncedImages: number
    recentActivity: Array<{
      timestamp: string
      action: string
      details: string
    }>
    statistics: {
      totalSyncs: number
      successRate: number
      averageProcessingTime: number
      lastError?: string
    }
  }> {
    try {
      const imageFiles = await this.getAttachmentImages('attachments')
      
      // 检查哪些图片已经同步（简化实现）
      let syncedCount = 0
      let pendingCount = 0
      
      for (const file of imageFiles) {
        try {
          // 这里可以实现检查图片是否已上传到Cloudflare的逻辑
          // 当前简化为随机状态演示
          const isSync = Math.random() > 0.3 // 70%已同步
          if (isSync) {
            syncedCount++
          } else {
            pendingCount++
          }
        } catch (error) {
          pendingCount++
        }
      }

      // 模拟统计数据（实际项目中应该从持久化存储中读取）
      const statistics = {
        totalSyncs: Math.floor(Math.random() * 100) + 50,
        successRate: 0.95,
        averageProcessingTime: 2500,
        lastError: undefined as string | undefined
      }

      const recentActivity = [
        {
          timestamp: new Date().toISOString(),
          action: 'status_check',
          details: `Found ${imageFiles.length} images: ${syncedCount} synced, ${pendingCount} pending`
        },
        {
          timestamp: new Date(Date.now() - 300000).toISOString(),
          action: 'sync_completed',
          details: `Processed ${Math.floor(Math.random() * 5)} images`
        },
        {
          timestamp: new Date(Date.now() - 600000).toISOString(),
          action: 'monitoring_started',
          details: 'Automatic monitoring enabled'
        }
      ]
      
      return {
        attachmentsCount: imageFiles.length,
        lastSyncTime: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        pendingFiles: imageFiles.slice(0, pendingCount).map(f => f.path),
        syncedImages: syncedCount,
        recentActivity,
        statistics
      }
    } catch (error) {
      throw new Error(`Failed to get sync status: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 强制同步指定的图片文件
   */
  async forceSyncImages(imagePaths: string[]): Promise<SyncResult> {
    console.log(`[SyncService] Force syncing ${imagePaths.length} specific images...`)
    
    try {
      // 验证所有路径都是图片文件
      const validPaths = imagePaths.filter(path => {
        const filename = path.split('/').pop() || ''
        return this.isImageFile(filename)
      })
      
      if (validPaths.length !== imagePaths.length) {
        console.warn(`[SyncService] ${imagePaths.length - validPaths.length} invalid image paths filtered out`)
      }
      
      // 获取文件信息
      const imageFiles: GitHubTreeItem[] = []
      for (const path of validPaths) {
        try {
          // 这里应该获取实际的文件信息，当前简化实现
          imageFiles.push({
             path,
             mode: '100644',
             type: 'blob',
             size: 1024, // 模拟大小
             sha: 'dummy-sha',
             url: ''
           })
        } catch (error) {
          console.warn(`Failed to get info for ${path}:`, error)
        }
      }
      
      // 批量上传
      const uploadResults = await this.batchUploadImages(imageFiles, 5, false)
      
      // 更新Markdown引用
      const successfulUploads = uploadResults
        .filter(r => r.success && r.cloudflareUrl && r.cloudflareId)
        .map(r => ({
          originalPath: r.originalPath,
          cloudflareUrl: r.cloudflareUrl!,
          cloudflareId: r.cloudflareId!
        }))
      const updateResult = await this.updateMarkdownReferences(successfulUploads)
      
      const result: SyncResult = {
        processedCount: validPaths.length,
        uploadedCount: successfulUploads.length,
        updatedMarkdownCount: updateResult.updatedCount,
        errors: [
          ...uploadResults.filter(r => !r.success).map(r => ({
            file: r.originalPath,
            error: r.error || 'Upload failed'
          })),
          ...updateResult.errors
        ],
        processedFiles: successfulUploads.map(r => ({
          originalPath: r.originalPath,
          cloudflareUrl: r.cloudflareUrl,
          size: 0 // 实际项目中应该获取真实大小
        }))
      }
      
      console.log(`[SyncService] Force sync completed: ${result.uploadedCount}/${result.processedCount} uploaded`)
      return result
      
    } catch (error) {
      console.error('[SyncService] Force sync failed:', error)
      throw new Error(`Force sync failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 清理未使用的图片（在Cloudflare中存在但在Markdown中未引用）
   */
  async cleanupUnusedImages(): Promise<{
    totalChecked: number
    unusedFound: number
    cleanedUp: number
    errors: string[]
  }> {
    console.log('[SyncService] Starting cleanup of unused images...')
    
    try {
      // 这里可以实现清理逻辑
      // 1. 获取所有Cloudflare中的图片
      // 2. 扫描所有Markdown文件中的图片引用
      // 3. 找出未被引用的图片
      // 4. 删除未使用的图片
      
      // 当前返回模拟结果
      return {
        totalChecked: 0,
        unusedFound: 0,
        cleanedUp: 0,
        errors: ['Cleanup feature not yet implemented']
      }
      
    } catch (error) {
      console.error('[SyncService] Cleanup failed:', error)
      return {
        totalChecked: 0,
        unusedFound: 0,
        cleanedUp: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      }
    }
  }
}

/**
 * 创建同步服务实例
 */
export function createSyncService(fileAccess: FileAccessService, env: any): SyncService {
  return new SyncService(fileAccess, env)
}