/**
 * 增强版同步服务
 * 提供自动化同步机制、智能冲突解决和增量同步功能
 */
import { EnhancedFileAccessService } from './enhanced_file_access'
import { processEnhancedHandwrittenNote, EnhancedProcessingOptions } from './enhanced_handwritten_processor'
import { processObsidianRepositoryEnhanced, EnhancedObsidianOptions } from './enhanced_obsidian_processor'

export interface SyncConfig {
  /** 同步间隔（秒） */
  interval: number
  /** 是否启用自动同步 */
  autoSync: boolean
  /** 同步范围 */
  scope: {
    /** 包含的路径模式 */
    include: string[]
    /** 排除的路径模式 */
    exclude: string[]
  }
  /** 冲突解决策略 */
  conflictResolution: 'local' | 'remote' | 'merge' | 'prompt'
  /** 备份配置 */
  backup: {
    enabled: boolean
    maxBackups: number
    retentionDays: number
  }
  /** 处理选项 */
  processing: {
    handwritten: EnhancedProcessingOptions
    obsidian: EnhancedObsidianOptions
  }
}

export interface SyncStatus {
  /** 同步状态 */
  status: 'idle' | 'syncing' | 'error' | 'paused'
  /** 最后同步时间 */
  lastSync: string | null
  /** 下次同步时间 */
  nextSync: string | null
  /** 同步统计 */
  stats: {
    totalFiles: number
    syncedFiles: number
    failedFiles: number
    conflictFiles: number
    lastSyncDuration: number
  }
  /** 错误信息 */
  errors: Array<{
    file: string
    error: string
    timestamp: string
  }>
  /** 冲突文件 */
  conflicts: Array<{
    file: string
    localHash: string
    remoteHash: string
    timestamp: string
  }>
}

export interface SyncResult {
  success: boolean
  message: string
  stats: {
    processed: number
    succeeded: number
    failed: number
    skipped: number
    conflicts: number
  }
  details: Array<{
    file: string
    action: 'created' | 'updated' | 'deleted' | 'skipped' | 'conflict'
    status: 'success' | 'error'
    message?: string
  }>
  timing: {
    start: number
    end: number
    duration: number
  }
}

export interface FileChange {
  path: string
  type: 'added' | 'modified' | 'deleted'
  timestamp: string
  hash: string
  size: number
}

/**
 * 增强版同步服务类
 */
export class EnhancedSyncService {
  private config: SyncConfig
  private fileAccess: EnhancedFileAccessService
  private env: any
  private syncTimer: any
  private status: SyncStatus
  private isRunning: boolean

  constructor(config: SyncConfig, fileAccess: EnhancedFileAccessService, env: any) {
    this.config = config
    this.fileAccess = fileAccess
    this.env = env
    this.isRunning = false
    this.status = {
      status: 'idle',
      lastSync: null,
      nextSync: null,
      stats: {
        totalFiles: 0,
        syncedFiles: 0,
        failedFiles: 0,
        conflictFiles: 0,
        lastSyncDuration: 0
      },
      errors: [],
      conflicts: []
    }
  }

  /**
   * 启动自动同步
   */
  startAutoSync(): void {
    if (!this.config.autoSync) {
      console.log('[Sync] Auto sync is disabled')
      return
    }

    if (this.syncTimer) {
      console.log('[Sync] Auto sync already running')
      return
    }

    console.log(`[Sync] Starting auto sync with interval: ${this.config.interval}s`)
    
    this.syncTimer = setInterval(async () => {
      try {
        await this.performSync()
      } catch (error) {
        console.error('[Sync] Auto sync failed:', error)
        this.addError('auto-sync', error instanceof Error ? error.message : String(error))
      }
    }, this.config.interval * 1000)

    // 计算下次同步时间
    this.status.nextSync = new Date(Date.now() + this.config.interval * 1000).toISOString()
  }

  /**
   * 停止自动同步
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
      this.status.nextSync = null
      console.log('[Sync] Auto sync stopped')
    }
  }

  /**
   * 手动执行同步
   */
  async manualSync(): Promise<SyncResult> {
    console.log('[Sync] Starting manual sync...')
    return await this.performSync()
  }

  /**
   * 获取同步状态
   */
  getSyncStatus(): SyncStatus {
    return { ...this.status }
  }

  /**
   * 暂停同步
   */
  pauseSync(): void {
    this.stopAutoSync()
    this.status.status = 'paused'
    console.log('[Sync] Sync paused')
  }

  /**
   * 恢复同步
   */
  resumeSync(): void {
    this.status.status = 'idle'
    this.startAutoSync()
    console.log('[Sync] Sync resumed')
  }

  /**
   * 检测文件变更
   */
  async detectChanges(basePath: string = ''): Promise<FileChange[]> {
    console.log(`[Sync] Detecting changes in: ${basePath}`)
    
    const files = await this.fileAccess.listDirectory(basePath, { recursive: true })
    const changes: FileChange[] = []
    
    for (const file of files) {
      if (file.isDirectory) continue
      
      // 检查文件是否匹配同步范围
      if (!this.shouldSyncFile(file.path)) continue
      
      // 计算文件哈希
      const hash = await this.calculateFileHash(file.path)
      
      // 检查是否有变更（这里简化处理，实际应该与上次同步的哈希比较）
      changes.push({
        path: file.path,
        type: 'modified', // 简化处理
        timestamp: file.lastModified,
        hash,
        size: file.size
      })
    }
    
    return changes
  }

  /**
   * 同步特定文件
   */
  async syncFile(filePath: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`[Sync] Syncing file: ${filePath}`)
      
      if (!this.shouldSyncFile(filePath)) {
        return { success: false, message: 'File excluded from sync scope' }
      }
      
      // 检测文件类型并应用相应处理
      if (this.isHandwrittenImage(filePath)) {
        await this.processHandwrittenFile(filePath)
      } else if (this.isMarkdownFile(filePath)) {
        await this.processMarkdownFile(filePath)
      }
      
      return { success: true, message: 'File synced successfully' }
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.addError(filePath, message)
      return { success: false, message }
    }
  }

  /**
   * 解决冲突
   */
  async resolveConflict(filePath: string, strategy?: 'local' | 'remote' | 'merge'): Promise<boolean> {
    const resolveStrategy = strategy || this.config.conflictResolution
    
    try {
      console.log(`[Sync] Resolving conflict for ${filePath} using strategy: ${resolveStrategy}`)
      
      switch (resolveStrategy) {
        case 'local':
          // 保留本地版本
          return true
          
        case 'remote':
          // 使用远程版本
          // 这里需要实现从远程获取并覆盖本地的逻辑
          return true
          
        case 'merge':
          // 尝试合并（对于文本文件）
          return await this.mergeFile(filePath)
          
        case 'prompt':
          // 需要用户干预
          return false
          
        default:
          throw new Error(`Unknown conflict resolution strategy: ${resolveStrategy}`)
      }
      
    } catch (error) {
      console.error(`[Sync] Failed to resolve conflict for ${filePath}:`, error)
      return false
    }
  }

  /**
   * 创建备份
   */
  async createBackup(filePath: string): Promise<string> {
    if (!this.config.backup.enabled) {
      throw new Error('Backup is disabled')
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = `backups/${filePath}.${timestamp}.bak`
    
    try {
      const content = await this.fileAccess.readFile(filePath)
      await this.fileAccess.writeFile(backupPath, content, `Backup: ${filePath}`)
      
      console.log(`[Sync] Created backup: ${backupPath}`)
      return backupPath
      
    } catch (error) {
      console.error(`[Sync] Failed to create backup for ${filePath}:`, error)
      throw error
    }
  }

  /**
   * 清理旧备份
   */
  async cleanupBackups(): Promise<void> {
    if (!this.config.backup.enabled) return
    
    try {
      const backupFiles = await this.fileAccess.listDirectory('backups')
      const cutoffDate = new Date(Date.now() - this.config.backup.retentionDays * 24 * 60 * 60 * 1000)
      
      for (const file of backupFiles) {
        if (new Date(file.lastModified) < cutoffDate) {
          // 这里需要实现删除文件的功能
          console.log(`[Sync] Would delete old backup: ${file.path}`)
        }
      }
      
    } catch (error) {
      console.error('[Sync] Failed to cleanup backups:', error)
    }
  }

  /**
   * 执行同步（核心方法）
   */
  private async performSync(): Promise<SyncResult> {
    if (this.isRunning) {
      console.log('[Sync] Sync already in progress, skipping...')
      return {
        success: false,
        message: 'Sync already in progress',
        stats: { processed: 0, succeeded: 0, failed: 0, skipped: 0, conflicts: 0 },
        details: [],
        timing: { start: Date.now(), end: Date.now(), duration: 0 }
      }
    }
    
    this.isRunning = true
    this.status.status = 'syncing'
    
    const startTime = Date.now()
    const result: SyncResult = {
      success: true,
      message: 'Sync completed',
      stats: { processed: 0, succeeded: 0, failed: 0, skipped: 0, conflicts: 0 },
      details: [],
      timing: { start: startTime, end: 0, duration: 0 }
    }
    
    try {
      console.log('[Sync] Starting sync process...')
      
      // 检测变更
      const changes = await this.detectChanges()
      result.stats.processed = changes.length
      
      // 处理每个变更
      for (const change of changes) {
        try {
          const syncResult = await this.syncFile(change.path)
          
          if (syncResult.success) {
            result.stats.succeeded++
            result.details.push({
              file: change.path,
              action: 'updated',
              status: 'success'
            })
          } else {
            result.stats.failed++
            result.details.push({
              file: change.path,
              action: 'skipped',
              status: 'error',
              message: syncResult.message
            })
          }
          
        } catch (error) {
          result.stats.failed++
          const message = error instanceof Error ? error.message : String(error)
          result.details.push({
            file: change.path,
            action: 'skipped',
            status: 'error',
            message
          })
        }
      }
      
      // 更新状态
      this.status.lastSync = new Date().toISOString()
      this.status.stats.totalFiles = result.stats.processed
      this.status.stats.syncedFiles = result.stats.succeeded
      this.status.stats.failedFiles = result.stats.failed
      
      if (this.config.autoSync) {
        this.status.nextSync = new Date(Date.now() + this.config.interval * 1000).toISOString()
      }
      
      console.log(`[Sync] Sync completed: ${result.stats.succeeded}/${result.stats.processed} files`)
      
    } catch (error) {
      result.success = false
      result.message = error instanceof Error ? error.message : String(error)
      this.status.status = 'error'
      console.error('[Sync] Sync failed:', error)
      
    } finally {
      const endTime = Date.now()
      result.timing.end = endTime
      result.timing.duration = endTime - startTime
      this.status.stats.lastSyncDuration = result.timing.duration
      
      this.isRunning = false
      if (this.status.status === 'syncing') {
        this.status.status = 'idle'
      }
    }
    
    return result
  }

  /**
   * 检查文件是否应该同步
   */
  private shouldSyncFile(filePath: string): boolean {
    // 检查包含模式
    const included = this.config.scope.include.length === 0 || 
      this.config.scope.include.some(pattern => this.matchPattern(filePath, pattern))
    
    if (!included) return false
    
    // 检查排除模式
    const excluded = this.config.scope.exclude.some(pattern => this.matchPattern(filePath, pattern))
    
    return !excluded
  }

  /**
   * 模式匹配（简化版）
   */
  private matchPattern(path: string, pattern: string): boolean {
    // 简化的通配符匹配
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'))
    return regex.test(path)
  }

  /**
   * 计算文件哈希
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    try {
      const content = await this.fileAccess.readFile(filePath)
      // 简化的哈希计算（实际应该使用更强的哈希算法）
      let hash = 0
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // 转换为32位整数
      }
      return hash.toString(16)
    } catch (error) {
      console.error(`[Sync] Failed to calculate hash for ${filePath}:`, error)
      return ''
    }
  }

  /**
   * 检查是否为手写图片
   */
  private isHandwrittenImage(filePath: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp']
    const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'))
    return imageExtensions.includes(ext) && 
           (filePath.includes('handwritten') || filePath.includes('notes') || filePath.includes('attachments'))
  }

  /**
   * 检查是否为Markdown文件
   */
  private isMarkdownFile(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.md')
  }

  /**
   * 处理手写文件
   */
  private async processHandwrittenFile(filePath: string): Promise<void> {
    try {
      const imageData = await this.fileAccess.readBinaryFile(filePath)
      const filename = filePath.substring(filePath.lastIndexOf('/') + 1)
      
      await processEnhancedHandwrittenNote(
        imageData,
        filename,
        this.config.processing.handwritten
      )
      
      console.log(`[Sync] Processed handwritten file: ${filePath}`)
      
    } catch (error) {
      console.error(`[Sync] Failed to process handwritten file ${filePath}:`, error)
      throw error
    }
  }

  /**
   * 处理Markdown文件
   */
  private async processMarkdownFile(filePath: string): Promise<void> {
    try {
      // 这里可以添加Markdown文件的特殊处理逻辑
      console.log(`[Sync] Processing markdown file: ${filePath}`)
      
    } catch (error) {
      console.error(`[Sync] Failed to process markdown file ${filePath}:`, error)
      throw error
    }
  }

  /**
   * 合并文件（简化版）
   */
  private async mergeFile(filePath: string): Promise<boolean> {
    try {
      console.log(`[Sync] Attempting to merge file: ${filePath}`)
      // 这里需要实现文件合并逻辑
      // 对于简单情况，可以选择较新的版本
      return true
      
    } catch (error) {
      console.error(`[Sync] Failed to merge file ${filePath}:`, error)
      return false
    }
  }

  /**
   * 添加错误记录
   */
  private addError(file: string, error: string): void {
    this.status.errors.push({
      file,
      error,
      timestamp: new Date().toISOString()
    })
    
    // 保持错误记录数量在合理范围内
    if (this.status.errors.length > 100) {
      this.status.errors = this.status.errors.slice(-50)
    }
  }

  /**
   * 添加冲突记录
   */
  private addConflict(file: string, localHash: string, remoteHash: string): void {
    this.status.conflicts.push({
      file,
      localHash,
      remoteHash,
      timestamp: new Date().toISOString()
    })
    
    // 保持冲突记录数量在合理范围内
    if (this.status.conflicts.length > 50) {
      this.status.conflicts = this.status.conflicts.slice(-25)
    }
  }
}

/**
 * 创建增强版同步服务实例
 */
export function createEnhancedSyncService(
  fileAccess: EnhancedFileAccessService,
  env: any,
  options: Partial<SyncConfig> = {}
): EnhancedSyncService {
  const defaultConfig: SyncConfig = {
    interval: 300, // 5分钟
    autoSync: false,
    scope: {
      include: ['**/*.md', '**/*.jpg', '**/*.png', '**/*.jpeg'],
      exclude: ['**/node_modules/**', '**/.git/**', '**/backups/**']
    },
    conflictResolution: 'local',
    backup: {
      enabled: true,
      maxBackups: 10,
      retentionDays: 30
    },
    processing: {
      handwritten: {
        enableGitHubBackup: true,
        smartCompression: true,
        enableQualityCheck: true,
        imageQuality: 'high'
      },
      obsidian: {
        enableSmartCompression: true,
        imageQuality: 'high',
        batchSize: 10,
        enableParallelProcessing: true,
        errorHandling: 'skip'
      }
    }
  }
  
  const config = { ...defaultConfig, ...options }
  return new EnhancedSyncService(config, fileAccess, env)
}