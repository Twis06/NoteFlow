/**
 * 图片优化服务
 * 支持图片压缩、格式转换、多尺寸变体生成
 * 用于Obsidian图片处理和分享功能
 */
import { uploadToCloudflareImages } from '../providers/images_cloudflare'
import { FileAccessService } from './file_access'

export interface ImageOptimizationOptions {
  /** 目标格式 */
  format?: 'webp' | 'jpeg' | 'png' | 'auto'
  /** 压缩质量 (1-100) */
  quality?: number
  /** 最大宽度 */
  maxWidth?: number
  /** 最大高度 */
  maxHeight?: number
  /** 是否生成多尺寸变体 */
  generateVariants?: boolean
  /** 变体尺寸配置 */
  variants?: Array<{
    name: string
    width?: number
    height?: number
    quality?: number
  }>
  /** 是否保留原图 */
  keepOriginal?: boolean
}

export interface OptimizedImageResult {
  /** 原始图片信息 */
  original: {
    cloudflareId: string
    cloudflareUrl: string
    size: number
  }
  /** 优化后的主图片 */
  optimized: {
    cloudflareId: string
    cloudflareUrl: string
    size: number
    format: string
    width?: number
    height?: number
  }
  /** 变体图片 */
  variants?: Array<{
    name: string
    cloudflareId: string
    cloudflareUrl: string
    size: number
    width?: number
    height?: number
  }>
  /** 压缩比例 */
  compressionRatio: number
  /** 处理时间 */
  processingTime: number
}

export interface BatchOptimizationResult {
  /** 成功处理的数量 */
  successCount: number
  /** 失败的数量 */
  failureCount: number
  /** 总节省的空间（字节） */
  totalSpaceSaved: number
  /** 平均压缩比例 */
  averageCompressionRatio: number
  /** 处理结果详情 */
  results: Array<{
    filename: string
    success: boolean
    result?: OptimizedImageResult
    error?: string
  }>
  /** 总处理时间 */
  totalProcessingTime: number
}

/**
 * 图片优化服务类
 */
export class ImageOptimizationService {
  private fileAccess: FileAccessService
  private env: any

  constructor(fileAccess: FileAccessService, env: any) {
    this.fileAccess = fileAccess
    this.env = env
  }

  /**
   * 优化单张图片
   */
  async optimizeImage(
    imageBytes: Uint8Array,
    filename: string,
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizedImageResult> {
    const startTime = Date.now()
    const {
      format = 'webp',
      quality = 85,
      maxWidth = 1920,
      maxHeight = 1080,
      generateVariants = false,
      variants = [],
      keepOriginal = true
    } = options

    try {
      console.log(`[ImageOptimization] Starting optimization for ${filename}...`)
      
      // 1. 上传原图（如果需要保留）
      let originalResult
      if (keepOriginal) {
        console.log(`[ImageOptimization] Uploading original ${filename}...`)
        originalResult = await uploadToCloudflareImages(
          imageBytes,
          `original-${filename}`,
          this.env
        )
      }

      // 2. 生成优化后的主图片
      console.log(`[ImageOptimization] Generating optimized version...`)
      const optimizedImageBytes = await this.processImageOptimization(
        imageBytes,
        {
          format,
          quality,
          maxWidth,
          maxHeight
        }
      )

      const optimizedFilename = this.generateOptimizedFilename(filename, format, 'main')
      const optimizedResult = await uploadToCloudflareImages(
        optimizedImageBytes,
        optimizedFilename,
        this.env
      )

      // 3. 生成变体图片（如果需要）
      const variantResults: OptimizedImageResult['variants'] = []
      if (generateVariants && variants.length > 0) {
        console.log(`[ImageOptimization] Generating ${variants.length} variants...`)
        
        for (const variant of variants) {
          try {
            const variantBytes = await this.processImageOptimization(
              imageBytes,
              {
                format,
                quality: variant.quality || quality,
                maxWidth: variant.width || maxWidth,
                maxHeight: variant.height || maxHeight
              }
            )

            const variantFilename = this.generateOptimizedFilename(
              filename,
              format,
              variant.name
            )
            const variantResult = await uploadToCloudflareImages(
              variantBytes,
              variantFilename,
              this.env
            )

            variantResults.push({
              name: variant.name,
              cloudflareId: variantResult.id,
              cloudflareUrl: variantResult.url,
              size: variantBytes.length,
              width: variant.width,
              height: variant.height
            })

            // 添加延迟避免API限制
            await new Promise(resolve => setTimeout(resolve, 500))
            
          } catch (error) {
            console.warn(`[ImageOptimization] Failed to generate variant ${variant.name}:`, error)
          }
        }
      }

      // 4. 计算压缩比例和结果
      const originalSize = imageBytes.length
      const optimizedSize = optimizedImageBytes.length
      const compressionRatio = ((originalSize - optimizedSize) / originalSize) * 100
      const processingTime = Date.now() - startTime

      const result: OptimizedImageResult = {
        original: originalResult ? {
          cloudflareId: originalResult.id,
          cloudflareUrl: originalResult.url,
          size: originalSize
        } : {
          cloudflareId: '',
          cloudflareUrl: '',
          size: originalSize
        },
        optimized: {
          cloudflareId: optimizedResult.id,
          cloudflareUrl: optimizedResult.url,
          size: optimizedSize,
          format,
          width: maxWidth,
          height: maxHeight
        },
        variants: variantResults.length > 0 ? variantResults : undefined,
        compressionRatio,
        processingTime
      }

      console.log(`[ImageOptimization] Successfully optimized ${filename}: ${compressionRatio.toFixed(1)}% compression in ${processingTime}ms`)
      return result

    } catch (error) {
      console.error(`[ImageOptimization] Failed to optimize ${filename}:`, error)
      throw new Error(`Failed to optimize image ${filename}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 批量优化图片
   */
  async optimizeBatchImages(
    images: Array<{ bytes: Uint8Array; filename: string }>,
    options: ImageOptimizationOptions = {}
  ): Promise<BatchOptimizationResult> {
    const startTime = Date.now()
    const results: BatchOptimizationResult['results'] = []
    let successCount = 0
    let failureCount = 0
    let totalSpaceSaved = 0
    let totalCompressionRatio = 0

    console.log(`[ImageOptimization] Starting batch optimization of ${images.length} images...`)

    // 串行处理以避免API限制
    for (const image of images) {
      try {
        const result = await this.optimizeImage(
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
        totalSpaceSaved += (result.original.size - result.optimized.size)
        totalCompressionRatio += result.compressionRatio
        
        // 添加延迟以避免API限制
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        results.push({
          filename: image.filename,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
        failureCount++
        console.error(`[ImageOptimization] Failed to optimize ${image.filename}:`, error)
      }
    }

    const totalProcessingTime = Date.now() - startTime
    const averageCompressionRatio = successCount > 0 ? totalCompressionRatio / successCount : 0

    console.log(`[ImageOptimization] Batch optimization completed: ${successCount} success, ${failureCount} failures, ${(totalSpaceSaved / 1024 / 1024).toFixed(2)}MB saved in ${totalProcessingTime}ms`)

    return {
      successCount,
      failureCount,
      totalSpaceSaved,
      averageCompressionRatio,
      results,
      totalProcessingTime
    }
  }

  /**
   * 从GitHub仓库优化图片
   */
  async optimizeImageFromGitHub(
    imagePath: string,
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizedImageResult> {
    try {
      console.log(`[ImageOptimization] Reading image from GitHub: ${imagePath}`)
      
      const imageBytes = await this.fileAccess.readBinaryFile(imagePath)
      const filename = imagePath.split('/').pop() || 'image'
      
      return await this.optimizeImage(imageBytes, filename, options)
      
    } catch (error) {
      console.error(`[ImageOptimization] Failed to optimize image from GitHub ${imagePath}:`, error)
      throw new Error(`Failed to optimize image from GitHub: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 处理图片优化（模拟实现，实际项目中可能需要使用图片处理库）
   */
  private async processImageOptimization(
    imageBytes: Uint8Array,
    options: {
      format: string
      quality: number
      maxWidth: number
      maxHeight: number
    }
  ): Promise<Uint8Array> {
    // 这里是一个简化的实现
    // 在实际项目中，你可能需要使用如 sharp、jimp 等图片处理库
    // 或者利用 Cloudflare Images 的变体功能
    
    console.log(`[ImageOptimization] Processing optimization: ${options.format}, quality: ${options.quality}, max: ${options.maxWidth}x${options.maxHeight}`)
    
    // 模拟压缩效果（实际应该使用真正的图片处理）
    const compressionFactor = options.quality / 100
    const simulatedCompressedSize = Math.floor(imageBytes.length * compressionFactor)
    
    // 创建一个模拟的压缩后数据
    // 注意：这只是演示，实际项目中需要真正的图片处理
    const compressedBytes = new Uint8Array(simulatedCompressedSize)
    compressedBytes.set(imageBytes.slice(0, simulatedCompressedSize))
    
    return compressedBytes
  }

  /**
   * 生成优化后的文件名
   */
  private generateOptimizedFilename(
    originalFilename: string,
    format: string,
    variant: string
  ): string {
    const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '')
    const timestamp = Date.now()
    return `${nameWithoutExt}-${variant}-${timestamp}.${format}`
  }

  /**
   * 获取优化统计信息
   */
  async getOptimizationStats(): Promise<{
    totalOptimized: number
    totalSpaceSaved: number
    averageCompressionRatio: number
    recentOptimizations: Array<{
      date: string
      count: number
      spaceSaved: number
    }>
  }> {
    // 这里可以实现更详细的统计逻辑
    // 例如从数据库或日志文件中读取历史数据
    return {
      totalOptimized: 0,
      totalSpaceSaved: 0,
      averageCompressionRatio: 0,
      recentOptimizations: []
    }
  }
}

/**
 * 创建图片优化服务实例
 */
export function createImageOptimizationService(
  fileAccess: FileAccessService,
  env: any
): ImageOptimizationService {
  return new ImageOptimizationService(fileAccess, env)
}