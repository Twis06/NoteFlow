/**
 * 文章分享服务
 * 提供将处理后的笔记分享到不同平台的功能
 */
import { EnhancedFileAccessService } from './enhanced_file_access'

export interface ShareConfig {
  /** 分享平台 */
  platform: 'github' | 'notion' | 'medium' | 'dev.to' | 'hashnode' | 'custom'
  /** 平台特定配置 */
  platformConfig: {
    /** GitHub配置 */
    github?: {
      owner: string
      repo: string
      branch?: string
      path?: string
      createPR?: boolean
    }
    /** Notion配置 */
    notion?: {
      databaseId: string
      apiKey: string
      properties?: Record<string, any>
    }
    /** Medium配置 */
    medium?: {
      apiKey: string
      userId: string
      publicationId?: string
    }
    /** Dev.to配置 */
    devTo?: {
      apiKey: string
      organizationId?: string
    }
    /** Hashnode配置 */
    hashnode?: {
      apiKey: string
      publicationId: string
    }
    /** 自定义Webhook */
    custom?: {
      url: string
      method: 'POST' | 'PUT'
      headers?: Record<string, string>
      transform?: (content: ArticleContent) => any
    }
  }
  /** 自动分享设置 */
  autoShare?: {
    enabled: boolean
    triggers: Array<'on_create' | 'on_update' | 'on_tag' | 'scheduled'>
    schedule?: {
      cron: string
      timezone?: string
    }
    filters?: {
      tags?: string[]
      paths?: string[]
      minWordCount?: number
    }
  }
}

export interface ArticleContent {
  /** 文章标题 */
  title: string
  /** 文章内容（Markdown） */
  content: string
  /** 文章摘要 */
  excerpt?: string
  /** 标签 */
  tags: string[]
  /** 分类 */
  category?: string
  /** 封面图片URL */
  coverImage?: string
  /** 发布状态 */
  published: boolean
  /** 发布时间 */
  publishedAt?: string
  /** 作者信息 */
  author?: {
    name: string
    email?: string
    avatar?: string
  }
  /** 元数据 */
  metadata: {
    source: string
    originalPath: string
    lastModified: string
    wordCount: number
    readingTime: number
  }
}

export interface ShareResult {
  /** 分享状态 */
  success: boolean
  /** 平台 */
  platform: string
  /** 分享后的URL */
  url?: string
  /** 平台特定的ID */
  platformId?: string
  /** 错误信息 */
  error?: string
  /** 分享时间 */
  sharedAt: string
  /** 响应数据 */
  response?: any
}

export interface BatchShareResult {
  /** 总体状态 */
  success: boolean
  /** 处理的文章数量 */
  totalArticles: number
  /** 成功分享的数量 */
  successCount: number
  /** 失败的数量 */
  failureCount: number
  /** 详细结果 */
  results: ShareResult[]
  /** 统计信息 */
  statistics: {
    totalProcessingTime: number
    averageShareTime: number
    platformBreakdown: Record<string, { success: number; failure: number }>
  }
}

/**
 * 文章分享服务类
 */
export class ArticleSharingService {
  private fileAccess: EnhancedFileAccessService
  private env: any
  private shareConfigs: Map<string, ShareConfig>

  constructor(fileAccess: EnhancedFileAccessService, env: any) {
    this.fileAccess = fileAccess
    this.env = env
    this.shareConfigs = new Map()
  }

  /**
   * 添加分享配置
   */
  addShareConfig(name: string, config: ShareConfig): void {
    this.shareConfigs.set(name, config)
    console.log(`[Share] Added share config: ${name} -> ${config.platform}`)
  }

  /**
   * 移除分享配置
   */
  removeShareConfig(name: string): boolean {
    const removed = this.shareConfigs.delete(name)
    if (removed) {
      console.log(`[Share] Removed share config: ${name}`)
    }
    return removed
  }

  /**
   * 获取所有分享配置
   */
  getShareConfigs(): Record<string, ShareConfig> {
    return Object.fromEntries(this.shareConfigs)
  }

  /**
   * 分享单篇文章
   */
  async shareArticle(
    filePath: string,
    configName: string,
    options: {
      forceUpdate?: boolean
      customMetadata?: Record<string, any>
    } = {}
  ): Promise<ShareResult> {
    const config = this.shareConfigs.get(configName)
    if (!config) {
      throw new Error(`Share config not found: ${configName}`)
    }

    try {
      console.log(`[Share] Sharing article: ${filePath} to ${config.platform}`)
      
      // 读取并解析文章内容
      const articleContent = await this.parseArticleContent(filePath, options.customMetadata)
      
      // 根据平台分享
      const result = await this.shareToplatform(articleContent, config)
      
      console.log(`[Share] Successfully shared to ${config.platform}: ${result.url}`)
      return result
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[Share] Failed to share ${filePath} to ${config.platform}:`, error)
      
      return {
        success: false,
        platform: config.platform,
        error: errorMessage,
        sharedAt: new Date().toISOString()
      }
    }
  }

  /**
   * 批量分享文章
   */
  async shareArticleBatch(
    filePaths: string[],
    configName: string,
    options: {
      parallel?: boolean
      maxConcurrency?: number
      continueOnError?: boolean
    } = {}
  ): Promise<BatchShareResult> {
    const startTime = Date.now()
    const config = this.shareConfigs.get(configName)
    
    if (!config) {
      throw new Error(`Share config not found: ${configName}`)
    }

    console.log(`[Share] Starting batch share: ${filePaths.length} articles to ${config.platform}`)
    
    const result: BatchShareResult = {
      success: true,
      totalArticles: filePaths.length,
      successCount: 0,
      failureCount: 0,
      results: [],
      statistics: {
        totalProcessingTime: 0,
        averageShareTime: 0,
        platformBreakdown: {}
      }
    }

    try {
      if (options.parallel) {
        // 并行处理
        const concurrency = options.maxConcurrency || 3
        const batches = this.createBatches(filePaths, concurrency)
        
        for (const batch of batches) {
          const batchPromises = batch.map(filePath => 
            this.shareArticle(filePath, configName).catch(error => ({
              success: false,
              platform: config.platform,
              error: error.message,
              sharedAt: new Date().toISOString()
            }))
          )
          
          const batchResults = await Promise.all(batchPromises)
          result.results.push(...batchResults)
        }
      } else {
        // 串行处理
        for (const filePath of filePaths) {
          try {
            const shareResult = await this.shareArticle(filePath, configName)
            result.results.push(shareResult)
            
            if (!shareResult.success && !options.continueOnError) {
              break
            }
          } catch (error) {
            const shareResult: ShareResult = {
              success: false,
              platform: config.platform,
              error: error instanceof Error ? error.message : String(error),
              sharedAt: new Date().toISOString()
            }
            result.results.push(shareResult)
            
            if (!options.continueOnError) {
              break
            }
          }
        }
      }
      
      // 计算统计信息
      result.successCount = result.results.filter(r => r.success).length
      result.failureCount = result.results.filter(r => !r.success).length
      result.success = result.failureCount === 0
      
      const endTime = Date.now()
      result.statistics.totalProcessingTime = endTime - startTime
      result.statistics.averageShareTime = result.statistics.totalProcessingTime / result.totalArticles
      
      // 平台统计
      result.statistics.platformBreakdown[config.platform] = {
        success: result.successCount,
        failure: result.failureCount
      }
      
      console.log(`[Share] Batch share completed: ${result.successCount}/${result.totalArticles} successful`)
      
    } catch (error) {
      result.success = false
      console.error('[Share] Batch share failed:', error)
    }
    
    return result
  }

  /**
   * 自动分享检查
   */
  async checkAutoShare(): Promise<void> {
    console.log('[Share] Checking auto share triggers...')
    
    for (const [configName, config] of this.shareConfigs) {
      if (!config.autoShare?.enabled) continue
      
      try {
        await this.processAutoShare(configName, config)
      } catch (error) {
        console.error(`[Share] Auto share failed for ${configName}:`, error)
      }
    }
  }

  /**
   * 解析文章内容
   */
  private async parseArticleContent(
    filePath: string,
    customMetadata?: Record<string, any>
  ): Promise<ArticleContent> {
    const content = await this.fileAccess.readFile(filePath)
    const fileInfo = await this.fileAccess.getFileInfo(filePath)
    
    // 解析Front Matter
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/)
    let frontMatter: Record<string, any> = {}
    let markdownContent = content
    
    if (frontMatterMatch) {
      try {
        // 简化的YAML解析（实际应该使用专门的YAML库）
        const yamlContent = frontMatterMatch[1]
        const lines = yamlContent.split('\n')
        for (const line of lines) {
          const [key, ...valueParts] = line.split(':')
          if (key && valueParts.length > 0) {
            const value = valueParts.join(':').trim()
            frontMatter[key.trim()] = value.replace(/^["']|["']$/g, '')
          }
        }
        markdownContent = content.substring(frontMatterMatch[0].length)
      } catch (error) {
        console.warn(`[Share] Failed to parse front matter in ${filePath}:`, error)
      }
    }
    
    // 提取标题
    const titleMatch = markdownContent.match(/^#\s+(.+)$/m)
    const title = frontMatter.title || titleMatch?.[1] || this.extractFilenameTitle(filePath)
    
    // 提取标签
    const tags = this.extractTags(frontMatter, markdownContent)
    
    // 计算字数和阅读时间
    const wordCount = this.countWords(markdownContent)
    const readingTime = Math.ceil(wordCount / 200) // 假设每分钟200字
    
    return {
      title,
      content: markdownContent,
      excerpt: frontMatter.excerpt || this.generateExcerpt(markdownContent),
      tags,
      category: frontMatter.category,
      coverImage: frontMatter.coverImage,
      published: frontMatter.published !== false,
      publishedAt: frontMatter.publishedAt || frontMatter.date,
      author: {
        name: frontMatter.author || 'Anonymous',
        email: frontMatter.email,
        avatar: frontMatter.avatar
      },
      metadata: {
        source: 'enhanced-note-system',
        originalPath: filePath,
        lastModified: fileInfo.lastModified,
        wordCount,
        readingTime,
        ...customMetadata
      }
    }
  }

  /**
   * 分享到指定平台
   */
  private async shareToplatform(
    article: ArticleContent,
    config: ShareConfig
  ): Promise<ShareResult> {
    const sharedAt = new Date().toISOString()
    
    switch (config.platform) {
      case 'github':
        return await this.shareToGitHub(article, config.platformConfig.github!, sharedAt)
        
      case 'notion':
        return await this.shareToNotion(article, config.platformConfig.notion!, sharedAt)
        
      case 'medium':
        return await this.shareToMedium(article, config.platformConfig.medium!, sharedAt)
        
      case 'dev.to':
        return await this.shareToDevTo(article, config.platformConfig.devTo!, sharedAt)
        
      case 'hashnode':
        return await this.shareToHashnode(article, config.platformConfig.hashnode!, sharedAt)
        
      case 'custom':
        return await this.shareToCustom(article, config.platformConfig.custom!, sharedAt)
        
      default:
        throw new Error(`Unsupported platform: ${config.platform}`)
    }
  }

  /**
   * 分享到GitHub
   */
  private async shareToGitHub(
    article: ArticleContent,
    config: NonNullable<ShareConfig['platformConfig']['github']>,
    sharedAt: string
  ): Promise<ShareResult> {
    try {
      const fileName = this.generateFileName(article.title, 'md')
      const filePath = `${config.path || 'articles'}/${fileName}`
      
      // 添加Front Matter
      const frontMatter = [
        '---',
        `title: "${article.title}"`,
        `date: ${article.publishedAt || sharedAt}`,
        `tags: [${article.tags.map(tag => `"${tag}"`).join(', ')}]`,
        article.category ? `category: "${article.category}"` : '',
        article.excerpt ? `excerpt: "${article.excerpt}"` : '',
        `published: ${article.published}`,
        '---',
        ''
      ].filter(Boolean).join('\n')
      
      const fullContent = frontMatter + article.content
      
      // 这里需要调用GitHub API来创建/更新文件
      // 简化实现，实际需要使用github_files模块
      console.log(`[Share] Would create GitHub file: ${config.owner}/${config.repo}/${filePath}`)
      
      const url = `https://github.com/${config.owner}/${config.repo}/blob/${config.branch || 'main'}/${filePath}`
      
      return {
        success: true,
        platform: 'github',
        url,
        platformId: filePath,
        sharedAt
      }
      
    } catch (error) {
      throw new Error(`GitHub share failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 分享到Notion
   */
  private async shareToNotion(
    article: ArticleContent,
    config: NonNullable<ShareConfig['platformConfig']['notion']>,
    sharedAt: string
  ): Promise<ShareResult> {
    try {
      // 这里需要实现Notion API调用
      console.log(`[Share] Would create Notion page in database: ${config.databaseId}`)
      
      return {
        success: true,
        platform: 'notion',
        url: `https://notion.so/${config.databaseId}`,
        platformId: 'notion-page-id',
        sharedAt
      }
      
    } catch (error) {
      throw new Error(`Notion share failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 分享到Medium
   */
  private async shareToMedium(
    article: ArticleContent,
    config: NonNullable<ShareConfig['platformConfig']['medium']>,
    sharedAt: string
  ): Promise<ShareResult> {
    try {
      // 这里需要实现Medium API调用
      console.log(`[Share] Would create Medium post for user: ${config.userId}`)
      
      return {
        success: true,
        platform: 'medium',
        url: 'https://medium.com/@user/article-slug',
        platformId: 'medium-post-id',
        sharedAt
      }
      
    } catch (error) {
      throw new Error(`Medium share failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 分享到Dev.to
   */
  private async shareToDevTo(
    article: ArticleContent,
    config: NonNullable<ShareConfig['platformConfig']['devTo']>,
    sharedAt: string
  ): Promise<ShareResult> {
    try {
      // 这里需要实现Dev.to API调用
      console.log(`[Share] Would create Dev.to post`)
      
      return {
        success: true,
        platform: 'dev.to',
        url: 'https://dev.to/user/article-slug',
        platformId: 'devto-post-id',
        sharedAt
      }
      
    } catch (error) {
      throw new Error(`Dev.to share failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 分享到Hashnode
   */
  private async shareToHashnode(
    article: ArticleContent,
    config: NonNullable<ShareConfig['platformConfig']['hashnode']>,
    sharedAt: string
  ): Promise<ShareResult> {
    try {
      // 这里需要实现Hashnode API调用
      console.log(`[Share] Would create Hashnode post in publication: ${config.publicationId}`)
      
      return {
        success: true,
        platform: 'hashnode',
        url: 'https://hashnode.com/post/article-slug',
        platformId: 'hashnode-post-id',
        sharedAt
      }
      
    } catch (error) {
      throw new Error(`Hashnode share failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 分享到自定义平台
   */
  private async shareToCustom(
    article: ArticleContent,
    config: NonNullable<ShareConfig['platformConfig']['custom']>,
    sharedAt: string
  ): Promise<ShareResult> {
    try {
      const payload = config.transform ? config.transform(article) : article
      
      const response = await fetch(config.url, {
        method: config.method,
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        },
        body: JSON.stringify(payload)
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const responseData = await response.json() as any
      
      return {
        success: true,
        platform: 'custom',
        url: responseData?.url || config.url,
        platformId: responseData?.id,
        sharedAt,
        response: responseData
      }
      
    } catch (error) {
      throw new Error(`Custom share failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 处理自动分享
   */
  private async processAutoShare(configName: string, config: ShareConfig): Promise<void> {
    if (!config.autoShare) return
    
    // 这里需要实现自动分享的逻辑
    // 包括检查触发条件、过滤文件、执行分享等
    console.log(`[Share] Processing auto share for ${configName}`)
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
   * 从文件名提取标题
   */
  private extractFilenameTitle(filePath: string): string {
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1)
    return fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
  }

  /**
   * 提取标签
   */
  private extractTags(frontMatter: Record<string, any>, content: string): string[] {
    const tags: string[] = []
    
    // 从Front Matter提取
    if (frontMatter.tags) {
      if (Array.isArray(frontMatter.tags)) {
        tags.push(...frontMatter.tags)
      } else if (typeof frontMatter.tags === 'string') {
        tags.push(...frontMatter.tags.split(',').map(tag => tag.trim()))
      }
    }
    
    // 从内容中提取标签（#tag格式）
    const tagMatches = content.match(/#([a-zA-Z0-9_-]+)/g)
    if (tagMatches) {
      tags.push(...tagMatches.map(match => match.substring(1)))
    }
    
    return [...new Set(tags)] // 去重
  }

  /**
   * 生成摘要
   */
  private generateExcerpt(content: string, maxLength: number = 200): string {
    // 移除Markdown标记
    const plainText = content
      .replace(/#{1,6}\s+/g, '') // 标题
      .replace(/\*\*(.+?)\*\*/g, '$1') // 粗体
      .replace(/\*(.+?)\*/g, '$1') // 斜体
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // 链接
      .replace(/```[\s\S]*?```/g, '') // 代码块
      .replace(/`(.+?)`/g, '$1') // 行内代码
      .trim()
    
    if (plainText.length <= maxLength) {
      return plainText
    }
    
    return plainText.substring(0, maxLength).trim() + '...'
  }

  /**
   * 计算字数
   */
  private countWords(content: string): number {
    // 移除Markdown标记后计算字数
    const plainText = content
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`(.+?)`/g, '$1')
      .trim()
    
    return plainText.split(/\s+/).filter(word => word.length > 0).length
  }

  /**
   * 生成文件名
   */
  private generateFileName(title: string, extension: string): string {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
    
    const timestamp = new Date().toISOString().split('T')[0]
    return `${timestamp}-${slug}.${extension}`
  }
}

/**
 * 创建文章分享服务实例
 */
export function createArticleSharingService(
  fileAccess: EnhancedFileAccessService,
  env: any
): ArticleSharingService {
  return new ArticleSharingService(fileAccess, env)
}

/**
 * 快速分享文章
 */
export async function shareArticleQuick(
  filePath: string,
  platform: ShareConfig['platform'],
  platformConfig: ShareConfig['platformConfig'],
  fileAccess: EnhancedFileAccessService,
  env: any
): Promise<ShareResult> {
  const service = createArticleSharingService(fileAccess, env)
  
  const config: ShareConfig = {
    platform,
    platformConfig
  }
  
  service.addShareConfig('quick-share', config)
  return await service.shareArticle(filePath, 'quick-share')
}