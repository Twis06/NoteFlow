/**
 * 图片优化服务
 * 提供智能压缩、格式转换、质量优化等功能
 */

export interface ImageOptimizationOptions {
  /** 目标质量 */
  quality?: 'auto' | 'highest' | 'high' | 'medium' | 'low'
  /** 最大宽度 */
  maxWidth?: number
  /** 最大高度 */
  maxHeight?: number
  /** 目标格式 */
  format?: 'auto' | 'webp' | 'jpeg' | 'png'
  /** 是否保持宽高比 */
  maintainAspectRatio?: boolean
  /** 压缩级别 (0-100) */
  compressionLevel?: number
  /** 是否启用渐进式JPEG */
  progressive?: boolean
  /** 是否移除元数据 */
  stripMetadata?: boolean
  /** 最大文件大小（字节） */
  maxFileSize?: number
}

export interface OptimizationResult {
  /** 优化后的图片数据 */
  optimizedData: Uint8Array
  /** 原始大小 */
  originalSize: number
  /** 优化后大小 */
  optimizedSize: number
  /** 压缩比例 */
  compressionRatio: number
  /** 原始格式 */
  originalFormat: string
  /** 优化后格式 */
  optimizedFormat: string
  /** 原始尺寸 */
  originalDimensions: { width: number; height: number }
  /** 优化后尺寸 */
  optimizedDimensions: { width: number; height: number }
  /** 优化统计 */
  statistics: {
    processingTime: number
    qualityScore: number
    sizeSavings: number
    dimensionReduction: number
  }
}

export interface BatchOptimizationResult {
  /** 处理成功的图片数量 */
  successCount: number
  /** 处理失败的图片数量 */
  failureCount: number
  /** 总体压缩比例 */
  overallCompressionRatio: number
  /** 总体大小节省 */
  totalSizeSavings: number
  /** 处理结果详情 */
  results: Array<{
    filename: string
    success: boolean
    result?: OptimizationResult
    error?: string
  }>
  /** 处理统计 */
  statistics: {
    totalProcessingTime: number
    averageProcessingTime: number
    totalOriginalSize: number
    totalOptimizedSize: number
  }
}

/**
 * 图片优化器类
 */
export class ImageOptimizer {
  private defaultOptions: ImageOptimizationOptions

  constructor(defaultOptions: ImageOptimizationOptions = {}) {
    this.defaultOptions = {
      quality: 'auto',
      maxWidth: 2048,
      maxHeight: 2048,
      format: 'auto',
      maintainAspectRatio: true,
      compressionLevel: 80,
      progressive: true,
      stripMetadata: true,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      ...defaultOptions
    }
  }

  /**
   * 优化单张图片
   */
  async optimizeImage(
    imageData: Uint8Array,
    filename: string,
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizationResult> {
    const startTime = Date.now()
    const mergedOptions = { ...this.defaultOptions, ...options }
    
    console.log(`[Image Optimizer] Starting optimization for ${filename}`)
    
    try {
      // 检测图片格式和尺寸
      const imageInfo = await this.analyzeImage(imageData)
      
      // 确定优化策略
      const strategy = this.determineOptimizationStrategy(imageInfo, mergedOptions)
      
      // 执行优化
      const optimizedData = await this.applyOptimization(imageData, strategy)
      
      // 计算统计信息
      const processingTime = Date.now() - startTime
      const compressionRatio = imageData.length / optimizedData.length
      const sizeSavings = imageData.length - optimizedData.length
      
      const result: OptimizationResult = {
        optimizedData,
        originalSize: imageData.length,
        optimizedSize: optimizedData.length,
        compressionRatio,
        originalFormat: imageInfo.format,
        optimizedFormat: strategy.targetFormat,
        originalDimensions: imageInfo.dimensions,
        optimizedDimensions: strategy.targetDimensions,
        statistics: {
          processingTime,
          qualityScore: this.calculateQualityScore(compressionRatio, strategy),
          sizeSavings,
          dimensionReduction: this.calculateDimensionReduction(
            imageInfo.dimensions,
            strategy.targetDimensions
          )
        }
      }
      
      console.log(`[Image Optimizer] Optimization completed for ${filename}: ${compressionRatio.toFixed(2)}x compression`)
      
      return result
      
    } catch (error) {
      console.error(`[Image Optimizer] Failed to optimize ${filename}:`, error)
      throw error
    }
  }

  /**
   * 批量优化图片
   */
  async optimizeBatch(
    images: Array<{ data: Uint8Array; filename: string }>,
    options: ImageOptimizationOptions = {}
  ): Promise<BatchOptimizationResult> {
    const startTime = Date.now()
    
    console.log(`[Image Optimizer] Starting batch optimization for ${images.length} images`)
    
    const results: BatchOptimizationResult['results'] = []
    let successCount = 0
    let failureCount = 0
    let totalOriginalSize = 0
    let totalOptimizedSize = 0
    
    for (const image of images) {
      try {
        const result = await this.optimizeImage(image.data, image.filename, options)
        
        results.push({
          filename: image.filename,
          success: true,
          result
        })
        
        successCount++
        totalOriginalSize += result.originalSize
        totalOptimizedSize += result.optimizedSize
        
      } catch (error) {
        results.push({
          filename: image.filename,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
        
        failureCount++
        totalOriginalSize += image.data.length
        totalOptimizedSize += image.data.length // 未优化，保持原大小
      }
    }
    
    const endTime = Date.now()
    const totalProcessingTime = endTime - startTime
    const overallCompressionRatio = totalOriginalSize > 0 ? totalOriginalSize / totalOptimizedSize : 1
    const totalSizeSavings = totalOriginalSize - totalOptimizedSize
    
    const batchResult: BatchOptimizationResult = {
      successCount,
      failureCount,
      overallCompressionRatio,
      totalSizeSavings,
      results,
      statistics: {
        totalProcessingTime,
        averageProcessingTime: images.length > 0 ? totalProcessingTime / images.length : 0,
        totalOriginalSize,
        totalOptimizedSize
      }
    }
    
    console.log(`[Image Optimizer] Batch optimization completed: ${successCount}/${images.length} successful`)
    
    return batchResult
  }

  /**
   * 分析图片信息
   */
  private async analyzeImage(imageData: Uint8Array): Promise<{
    format: string
    dimensions: { width: number; height: number }
    hasAlpha: boolean
    colorDepth: number
    estimatedQuality: number
  }> {
    // 简单的图片格式检测
    const format = this.detectImageFormat(imageData)
    
    // 模拟图片尺寸检测（实际项目中需要使用图片处理库）
    const dimensions = await this.extractImageDimensions(imageData, format)
    
    return {
      format,
      dimensions,
      hasAlpha: format === 'png', // 简化判断
      colorDepth: 24, // 默认24位
      estimatedQuality: this.estimateImageQuality(imageData, format)
    }
  }

  /**
   * 检测图片格式
   */
  private detectImageFormat(imageData: Uint8Array): string {
    // JPEG
    if (imageData[0] === 0xFF && imageData[1] === 0xD8) {
      return 'jpeg'
    }
    
    // PNG
    if (imageData[0] === 0x89 && imageData[1] === 0x50 && imageData[2] === 0x4E && imageData[3] === 0x47) {
      return 'png'
    }
    
    // WebP
    if (imageData[8] === 0x57 && imageData[9] === 0x45 && imageData[10] === 0x42 && imageData[11] === 0x50) {
      return 'webp'
    }
    
    // GIF
    if (imageData[0] === 0x47 && imageData[1] === 0x49 && imageData[2] === 0x46) {
      return 'gif'
    }
    
    return 'unknown'
  }

  /**
   * 提取图片尺寸（简化版本）
   */
  private async extractImageDimensions(
    imageData: Uint8Array,
    format: string
  ): Promise<{ width: number; height: number }> {
    // 这里是简化的实现，实际项目中需要使用专业的图片处理库
    // 如 sharp、jimp 等来准确获取图片尺寸
    
    if (format === 'jpeg') {
      return this.extractJpegDimensions(imageData)
    } else if (format === 'png') {
      return this.extractPngDimensions(imageData)
    }
    
    // 默认尺寸
    return { width: 1024, height: 768 }
  }

  /**
   * 提取JPEG尺寸
   */
  private extractJpegDimensions(imageData: Uint8Array): { width: number; height: number } {
    // 简化的JPEG尺寸提取
    // 实际实现需要解析JPEG的SOF段
    let i = 2 // 跳过SOI标记
    
    while (i < imageData.length - 4) {
      if (imageData[i] === 0xFF) {
        const marker = imageData[i + 1]
        
        // SOF0, SOF1, SOF2 标记
        if (marker >= 0xC0 && marker <= 0xC2) {
          const height = (imageData[i + 5] << 8) | imageData[i + 6]
          const width = (imageData[i + 7] << 8) | imageData[i + 8]
          return { width, height }
        }
        
        // 跳过当前段
        const segmentLength = (imageData[i + 2] << 8) | imageData[i + 3]
        i += 2 + segmentLength
      } else {
        i++
      }
    }
    
    return { width: 1024, height: 768 }
  }

  /**
   * 提取PNG尺寸
   */
  private extractPngDimensions(imageData: Uint8Array): { width: number; height: number } {
    // PNG的IHDR块在文件开头，包含尺寸信息
    if (imageData.length >= 24) {
      const width = (imageData[16] << 24) | (imageData[17] << 16) | (imageData[18] << 8) | imageData[19]
      const height = (imageData[20] << 24) | (imageData[21] << 16) | (imageData[22] << 8) | imageData[23]
      return { width, height }
    }
    
    return { width: 1024, height: 768 }
  }

  /**
   * 估算图片质量
   */
  private estimateImageQuality(imageData: Uint8Array, format: string): number {
    // 基于文件大小和格式的简单质量估算
    const sizeKB = imageData.length / 1024
    
    if (format === 'jpeg') {
      // JPEG质量估算
      if (sizeKB < 50) return 60
      if (sizeKB < 100) return 75
      if (sizeKB < 200) return 85
      return 95
    } else if (format === 'png') {
      // PNG通常是无损的
      return 100
    }
    
    return 80 // 默认质量
  }

  /**
   * 确定优化策略
   */
  private determineOptimizationStrategy(
    imageInfo: any,
    options: ImageOptimizationOptions
  ): {
    targetFormat: string
    targetDimensions: { width: number; height: number }
    targetQuality: number
    shouldResize: boolean
    shouldConvert: boolean
  } {
    const { format, dimensions } = imageInfo
    
    // 确定目标格式
    let targetFormat = format
    if (options.format === 'webp' || (options.format === 'auto' && format !== 'png')) {
      targetFormat = 'webp'
    }
    
    // 确定目标尺寸
    let targetDimensions = { ...dimensions }
    const shouldResize = dimensions.width > (options.maxWidth || 2048) || 
                        dimensions.height > (options.maxHeight || 2048)
    
    if (shouldResize && options.maintainAspectRatio) {
      const aspectRatio = dimensions.width / dimensions.height
      const maxWidth = options.maxWidth || 2048
      const maxHeight = options.maxHeight || 2048
      
      if (dimensions.width > maxWidth) {
        targetDimensions.width = maxWidth
        targetDimensions.height = Math.round(maxWidth / aspectRatio)
      }
      
      if (targetDimensions.height > maxHeight) {
        targetDimensions.height = maxHeight
        targetDimensions.width = Math.round(maxHeight * aspectRatio)
      }
    }
    
    // 确定目标质量
    let targetQuality = options.compressionLevel || 80
    if (options.quality === 'auto') {
      targetQuality = this.calculateAutoQuality(imageInfo, options)
    } else if (options.quality === 'highest') {
      targetQuality = 95
    } else if (options.quality === 'high') {
      targetQuality = 85
    } else if (options.quality === 'medium') {
      targetQuality = 75
    } else if (options.quality === 'low') {
      targetQuality = 60
    }
    
    return {
      targetFormat,
      targetDimensions,
      targetQuality,
      shouldResize,
      shouldConvert: targetFormat !== format
    }
  }

  /**
   * 计算自动质量
   */
  private calculateAutoQuality(imageInfo: any, options: ImageOptimizationOptions): number {
    const { dimensions, estimatedQuality } = imageInfo
    const pixelCount = dimensions.width * dimensions.height
    
    // 基于像素数量和原始质量调整
    let quality = estimatedQuality
    
    // 大图片可以适当降低质量
    if (pixelCount > 2000000) { // 2MP+
      quality = Math.max(quality - 10, 70)
    } else if (pixelCount > 1000000) { // 1MP+
      quality = Math.max(quality - 5, 75)
    }
    
    // 考虑最大文件大小限制
    if (options.maxFileSize) {
      const estimatedSize = pixelCount * 3 * (quality / 100) // 粗略估算
      if (estimatedSize > options.maxFileSize) {
        quality = Math.max(quality - 15, 60)
      }
    }
    
    return Math.round(quality)
  }

  /**
   * 应用优化
   */
  private async applyOptimization(
    imageData: Uint8Array,
    strategy: any
  ): Promise<Uint8Array> {
    // 这里是简化的实现
    // 实际项目中需要使用图片处理库进行真正的压缩、调整大小、格式转换
    
    console.log(`[Image Optimizer] Applying optimization strategy:`, {
      targetFormat: strategy.targetFormat,
      targetDimensions: strategy.targetDimensions,
      targetQuality: strategy.targetQuality
    })
    
    // 模拟压缩效果（实际需要真正的图片处理）
    const compressionFactor = strategy.targetQuality / 100
    const simulatedCompressedSize = Math.round(imageData.length * compressionFactor)
    
    // 返回模拟的压缩数据
    return imageData.slice(0, simulatedCompressedSize)
  }

  /**
   * 计算质量分数
   */
  private calculateQualityScore(compressionRatio: number, strategy: any): number {
    // 基于压缩比和目标质量计算质量分数
    const compressionScore = Math.min(compressionRatio * 20, 50) // 压缩比贡献
    const qualityScore = strategy.targetQuality / 2 // 质量设置贡献
    
    return Math.round(compressionScore + qualityScore)
  }

  /**
   * 计算尺寸缩减比例
   */
  private calculateDimensionReduction(
    original: { width: number; height: number },
    optimized: { width: number; height: number }
  ): number {
    const originalPixels = original.width * original.height
    const optimizedPixels = optimized.width * optimized.height
    
    return originalPixels > 0 ? (originalPixels - optimizedPixels) / originalPixels : 0
  }
}

/**
 * 创建图片优化器实例
 */
export function createImageOptimizer(options: ImageOptimizationOptions = {}): ImageOptimizer {
  return new ImageOptimizer(options)
}

/**
 * 便捷函数：优化单张图片
 */
export async function optimizeImage(
  imageData: Uint8Array,
  filename: string,
  options: ImageOptimizationOptions = {}
): Promise<OptimizationResult> {
  const optimizer = createImageOptimizer()
  return optimizer.optimizeImage(imageData, filename, options)
}

/**
 * 便捷函数：批量优化图片
 */
export async function optimizeImageBatch(
  images: Array<{ data: Uint8Array; filename: string }>,
  options: ImageOptimizationOptions = {}
): Promise<BatchOptimizationResult> {
  const optimizer = createImageOptimizer()
  return optimizer.optimizeBatch(images, options)
}