/**
 * 增强版文件访问服务
 * 支持多种文件源：GitHub仓库、本地目录、URL等
 * 提供统一的文件访问接口和增强的错误处理
 */
import { getGitHubFileContent, getGitHubRawFile, updateGitHubFile, getGitHubDirectoryTree, GitHubTreeItem } from '../providers/github_files'

export interface EnhancedFileAccessConfig {
  /** 主要文件源配置 */
  primary: {
    type: 'github' | 'local' | 'url'
    config: any
  }
  /** 备用文件源配置 */
  fallback?: {
    type: 'github' | 'local' | 'url'
    config: any
  }
  /** 缓存配置 */
  cache?: {
    enabled: boolean
    ttl: number // 缓存时间（秒）
    maxSize: number // 最大缓存条目数
  }
  /** 重试配置 */
  retry?: {
    maxAttempts: number
    backoffMs: number
    exponentialBackoff: boolean
  }
}

export interface EnhancedFileInfo {
  path: string
  content?: string
  size: number
  lastModified: string
  isDirectory: boolean
  source: 'github' | 'local' | 'url' | 'cache'
  metadata?: {
    sha?: string
    encoding?: string
    mimeType?: string
    permissions?: string
  }
}

export interface FileOperation {
  type: 'read' | 'write' | 'delete' | 'list'
  path: string
  content?: string
  options?: any
}

export interface OperationResult {
  success: boolean
  data?: any
  error?: string
  source: string
  timing: {
    start: number
    end: number
    duration: number
  }
}

/**
 * 增强版文件访问服务类
 */
export class EnhancedFileAccessService {
  private config: EnhancedFileAccessConfig
  private env: any
  private cache: Map<string, { data: any; timestamp: number; ttl: number }>
  private stats: {
    operations: number
    cacheHits: number
    cacheMisses: number
    errors: number
    totalTime: number
  }

  constructor(config: EnhancedFileAccessConfig, env: any) {
    this.config = {
      cache: { enabled: true, ttl: 300, maxSize: 1000 },
      retry: { maxAttempts: 3, backoffMs: 1000, exponentialBackoff: true },
      ...config
    }
    this.env = env
    this.cache = new Map()
    this.stats = {
      operations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      totalTime: 0
    }
  }

  /**
   * 读取文件内容（支持多种源和缓存）
   */
  async readFile(filePath: string, options: { useCache?: boolean; source?: 'primary' | 'fallback' } = {}): Promise<string> {
    const operation: FileOperation = { type: 'read', path: filePath, options }
    const result = await this.executeOperation(operation)
    
    if (!result.success) {
      throw new Error(`Failed to read file ${filePath}: ${result.error}`)
    }
    
    return result.data
  }

  /**
   * 读取二进制文件
   */
  async readBinaryFile(filePath: string, options: { useCache?: boolean; source?: 'primary' | 'fallback' } = {}): Promise<Uint8Array> {
    const operation: FileOperation = { type: 'read', path: filePath, options: { ...options, binary: true } }
    const result = await this.executeOperation(operation)
    
    if (!result.success) {
      throw new Error(`Failed to read binary file ${filePath}: ${result.error}`)
    }
    
    return result.data
  }

  /**
   * 写入文件
   */
  async writeFile(filePath: string, content: string, commitMessage?: string): Promise<void> {
    const operation: FileOperation = { 
      type: 'write', 
      path: filePath, 
      content,
      options: { commitMessage }
    }
    const result = await this.executeOperation(operation)
    
    if (!result.success) {
      throw new Error(`Failed to write file ${filePath}: ${result.error}`)
    }
    
    // 清除相关缓存
    this.invalidateCache(filePath)
  }

  /**
   * 列出目录内容
   */
  async listDirectory(dirPath: string = '', options: { recursive?: boolean; useCache?: boolean } = {}): Promise<EnhancedFileInfo[]> {
    const operation: FileOperation = { type: 'list', path: dirPath, options }
    const result = await this.executeOperation(operation)
    
    if (!result.success) {
      throw new Error(`Failed to list directory ${dirPath}: ${result.error}`)
    }
    
    return result.data
  }

  /**
   * 检查文件是否存在
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await this.getFileInfo(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(filePath: string): Promise<EnhancedFileInfo> {
    const cacheKey = `info:${filePath}`
    
    // 检查缓存
    if (this.config.cache?.enabled) {
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        this.stats.cacheHits++
        return cached
      }
      this.stats.cacheMisses++
    }
    
    const info = await this.getFileInfoFromSource(filePath, 'primary')
    
    // 缓存结果
    if (this.config.cache?.enabled) {
      this.setCache(cacheKey, info, this.config.cache.ttl)
    }
    
    return info
  }

  /**
   * 批量操作
   */
  async batchOperation(operations: FileOperation[]): Promise<OperationResult[]> {
    const results: OperationResult[] = []
    
    for (const operation of operations) {
      try {
        const result = await this.executeOperation(operation)
        results.push(result)
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          source: 'unknown',
          timing: { start: Date.now(), end: Date.now(), duration: 0 }
        })
      }
    }
    
    return results
  }

  /**
   * 获取服务统计信息
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      cacheHitRate: this.stats.operations > 0 ? this.stats.cacheHits / this.stats.operations : 0,
      averageOperationTime: this.stats.operations > 0 ? this.stats.totalTime / this.stats.operations : 0
    }
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * 执行文件操作（核心方法）
   */
  private async executeOperation(operation: FileOperation): Promise<OperationResult> {
    const startTime = Date.now()
    this.stats.operations++
    
    try {
      // 尝试主要源
      const result = await this.executeOperationOnSource(operation, 'primary')
      
      const endTime = Date.now()
      this.stats.totalTime += (endTime - startTime)
      
      return {
        success: true,
        data: result,
        source: this.config.primary.type,
        timing: {
          start: startTime,
          end: endTime,
          duration: endTime - startTime
        }
      }
      
    } catch (primaryError) {
      console.warn(`Primary source failed for ${operation.type} ${operation.path}:`, primaryError)
      
      // 尝试备用源
      if (this.config.fallback) {
        try {
          const result = await this.executeOperationOnSource(operation, 'fallback')
          
          const endTime = Date.now()
          this.stats.totalTime += (endTime - startTime)
          
          return {
            success: true,
            data: result,
            source: this.config.fallback.type,
            timing: {
              start: startTime,
              end: endTime,
              duration: endTime - startTime
            }
          }
          
        } catch (fallbackError) {
          console.error(`Fallback source also failed for ${operation.type} ${operation.path}:`, fallbackError)
        }
      }
      
      this.stats.errors++
      const endTime = Date.now()
      this.stats.totalTime += (endTime - startTime)
      
      return {
        success: false,
        error: primaryError instanceof Error ? primaryError.message : String(primaryError),
        source: this.config.primary.type,
        timing: {
          start: startTime,
          end: endTime,
          duration: endTime - startTime
        }
      }
    }
  }

  /**
   * 在指定源上执行操作
   */
  private async executeOperationOnSource(operation: FileOperation, sourceType: 'primary' | 'fallback'): Promise<any> {
    const sourceConfig = sourceType === 'primary' ? this.config.primary : this.config.fallback!
    
    if (sourceConfig.type === 'github') {
      return await this.executeGitHubOperation(operation, sourceConfig.config)
    } else if (sourceConfig.type === 'local') {
      return await this.executeLocalOperation(operation, sourceConfig.config)
    } else if (sourceConfig.type === 'url') {
      return await this.executeUrlOperation(operation, sourceConfig.config)
    } else {
      throw new Error(`Unsupported source type: ${sourceConfig.type}`)
    }
  }

  /**
   * 执行GitHub操作
   */
  private async executeGitHubOperation(operation: FileOperation, config: any): Promise<any> {
    const { owner, repo, branch = 'main' } = config
    
    switch (operation.type) {
      case 'read':
        if (operation.options?.binary) {
          return await getGitHubRawFile(owner, repo, operation.path, this.env, branch)
        } else {
          const fileInfo = await getGitHubFileContent(owner, repo, operation.path, this.env, branch)
          return fileInfo.content
        }
        
      case 'write':
        // 获取现有文件SHA（如果存在）
        let sha: string | undefined
        try {
          const existingFile = await getGitHubFileContent(owner, repo, operation.path, this.env, branch)
          sha = existingFile.sha
        } catch {
          // 文件不存在
        }
        
        await updateGitHubFile(
          owner,
          repo,
          operation.path,
          operation.content!,
          operation.options?.commitMessage || `更新文件: ${operation.path}`,
          sha || '',
          this.env,
          branch
        )
        return true
        
      case 'list':
        const items = await getGitHubDirectoryTree(owner, repo, this.env, operation.path, operation.options?.recursive || false)
        return items.map((item: GitHubTreeItem) => ({
          path: item.path,
          size: item.size || 0,
          lastModified: new Date().toISOString(),
          isDirectory: item.type === 'tree',
          source: 'github' as const,
          metadata: {
            sha: item.sha
          }
        }))
        
      default:
        throw new Error(`Unsupported GitHub operation: ${operation.type}`)
    }
  }

  /**
   * 执行本地文件操作（在Cloudflare Workers中不可用）
   */
  private async executeLocalOperation(operation: FileOperation, config: any): Promise<any> {
    throw new Error('Local file operations are not supported in Cloudflare Workers environment')
  }

  /**
   * 执行URL操作
   */
  private async executeUrlOperation(operation: FileOperation, config: any): Promise<any> {
    if (operation.type !== 'read') {
      throw new Error('Only read operations are supported for URL sources')
    }
    
    const url = `${config.baseUrl}/${operation.path}`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    if (operation.options?.binary) {
      return new Uint8Array(await response.arrayBuffer())
    } else {
      return await response.text()
    }
  }

  /**
   * 从指定源获取文件信息
   */
  private async getFileInfoFromSource(filePath: string, sourceType: 'primary' | 'fallback'): Promise<EnhancedFileInfo> {
    const sourceConfig = sourceType === 'primary' ? this.config.primary : this.config.fallback!
    
    if (sourceConfig.type === 'github') {
      const { owner, repo, branch = 'main' } = sourceConfig.config
      const fileInfo = await getGitHubFileContent(owner, repo, filePath, this.env, branch)
      
      return {
        path: filePath,
        content: fileInfo.content,
        size: fileInfo.size,
        lastModified: new Date().toISOString(),
        isDirectory: false,
        source: 'github',
        metadata: {
          sha: fileInfo.sha
        }
      }
    } else {
      throw new Error(`File info not supported for source type: ${sourceConfig.type}`)
    }
  }

  /**
   * 缓存操作
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key)
    if (!cached) return null
    
    if (Date.now() - cached.timestamp > cached.ttl * 1000) {
      this.cache.delete(key)
      return null
    }
    
    return cached.data
  }

  private setCache(key: string, data: any, ttl: number): void {
    // 清理过期缓存
    if (this.cache.size >= (this.config.cache?.maxSize || 1000)) {
      this.cleanupCache()
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  private invalidateCache(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  private cleanupCache(): void {
    const now = Date.now()
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl * 1000) {
        this.cache.delete(key)
      }
    }
  }
}

/**
 * 创建增强版文件访问服务实例
 */
export function createEnhancedFileAccessService(env: any, options: Partial<EnhancedFileAccessConfig> = {}): EnhancedFileAccessService {
  const owner = env.NOTES_REPO_OWNER || 'Twis06'
  const repo = env.NOTES_REPO_NAME || 'notes'
  const branch = env.NOTES_REPO_BRANCH || 'main'
  
  const config: EnhancedFileAccessConfig = {
    primary: {
      type: 'github',
      config: { owner, repo, branch }
    },
    ...options
  }
  
  return new EnhancedFileAccessService(config, env)
}

/**
 * 创建多源文件访问服务（GitHub + 备用源）
 */
export function createMultiSourceFileAccessService(
  env: any, 
  primaryConfig: any, 
  fallbackConfig?: any
): EnhancedFileAccessService {
  const config: EnhancedFileAccessConfig = {
    primary: primaryConfig,
    fallback: fallbackConfig,
    cache: { enabled: true, ttl: 300, maxSize: 1000 },
    retry: { maxAttempts: 3, backoffMs: 1000, exponentialBackoff: true }
  }
  
  return new EnhancedFileAccessService(config, env)
}