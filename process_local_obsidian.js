#!/usr/bin/env node

/**
 * 本地Obsidian笔记处理脚本
 * 功能：扫描本地Obsidian笔记目录，识别图片文件，批量上传到Cloudflare Images
 */

const fs = require('fs')
const path = require('path')

// 动态导入fetch
let fetch
;(async () => {
  const { default: nodeFetch } = await import('node-fetch')
  fetch = nodeFetch
})()

// 等待fetch加载的辅助函数
async function ensureFetch() {
  if (!fetch) {
    const { default: nodeFetch } = await import('node-fetch')
    fetch = nodeFetch
  }
  return fetch
}

// 配置
const CONFIG = {
  // 本地Obsidian笔记目录
  notesPath: '/Users/lipeiyang/Documents/notes',
  // API端点
  apiUrl: 'http://localhost:8787/api/process/obsidian-content',
  // 支持的图片格式
  imageExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
  // 支持的Markdown文件格式
  markdownExtensions: ['.md', '.markdown']
}

/**
 * 递归扫描目录，查找所有Markdown文件和图片文件
 * @param {string} dirPath - 目录路径
 * @returns {Object} 包含markdown文件和图片文件的对象
 */
function scanDirectory(dirPath) {
  const markdownFiles = []
  const imageFiles = []
  
  function scan(currentPath) {
    try {
      const items = fs.readdirSync(currentPath)
      
      for (const item of items) {
        // 跳过隐藏文件和目录
        if (item.startsWith('.')) continue
        
        const itemPath = path.join(currentPath, item)
        const stat = fs.statSync(itemPath)
        
        if (stat.isDirectory()) {
          // 递归扫描子目录
          scan(itemPath)
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase()
          const relativePath = path.relative(dirPath, itemPath)
          
          if (CONFIG.markdownExtensions.includes(ext)) {
            markdownFiles.push({
              path: relativePath,
              fullPath: itemPath
            })
          } else if (CONFIG.imageExtensions.includes(ext)) {
            imageFiles.push({
              path: relativePath,
              fullPath: itemPath,
              filename: item
            })
          }
        }
      }
    } catch (error) {
      console.error(`扫描目录失败 ${currentPath}:`, error.message)
    }
  }
  
  scan(dirPath)
  return { markdownFiles, imageFiles }
}

/**
 * 将图片文件转换为base64格式
 * @param {string} filePath - 图片文件路径
 * @returns {string} base64编码的图片数据
 */
function imageToBase64(filePath) {
  try {
    const imageBuffer = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase().substring(1)
    const mimeType = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml'
    }[ext] || 'image/jpeg'
    
    return `data:${mimeType};base64,${imageBuffer.toString('base64')}`
  } catch (error) {
    console.error(`读取图片文件失败 ${filePath}:`, error.message)
    return null
  }
}

/**
 * 处理单个批次的文件
 * @param {Array} markdownFiles - Markdown文件列表
 * @param {Array} imageFiles - 图片文件列表
 * @returns {Promise<Object>} API响应结果
 */
async function processBatch(markdownFiles, imageFiles) {
  console.log(`\n📝 准备处理批次: ${markdownFiles.length} 个Markdown文件, ${imageFiles.length} 个图片文件`)
  
  // 准备文件数据
  const files = markdownFiles.map(file => {
    try {
      const content = fs.readFileSync(file.fullPath, 'utf-8')
      return {
        path: file.path,
        content: content
      }
    } catch (error) {
      console.error(`读取Markdown文件失败 ${file.path}:`, error.message)
      return null
    }
  }).filter(Boolean)
  
  // 准备图片数据
  const images = imageFiles.map(file => {
    const base64Data = imageToBase64(file.fullPath)
    if (!base64Data) return null
    
    return {
      path: file.path,
      data: base64Data,
      filename: file.filename
    }
  }).filter(Boolean)
  
  // 构建请求数据
  const requestData = {
    files: files,
    images: images,
    options: {
      enableSmartCompression: true,
      imageQuality: 85
    }
  }
  
  console.log(`📤 发送API请求: ${files.length} 个文件, ${images.length} 个图片`)
  
  // 调试信息：显示文件内容和图片路径
  console.log('\n🔍 调试信息:')
  files.forEach(file => {
    console.log(`   📝 文件: ${file.path}`)
    console.log(`   📄 内容预览: ${file.content.substring(0, 100)}...`)
  })
  images.forEach(img => {
    console.log(`   🖼️  图片: ${img.path} -> ${img.filename}`)
  })
  
  try {
    const fetchFn = await ensureFetch()
    const response = await fetchFn(CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    })
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`)
    }
    
    const result = await response.json()
    return result
    
  } catch (error) {
    console.error('API调用失败:', error.message)
    throw error
  }
}

/**
 * 主处理函数
 */
async function main() {
  console.log('🚀 开始处理本地Obsidian笔记')
  console.log(`📁 扫描目录: ${CONFIG.notesPath}`)
  
  // 检查目录是否存在
  if (!fs.existsSync(CONFIG.notesPath)) {
    console.error(`❌ 目录不存在: ${CONFIG.notesPath}`)
    process.exit(1)
  }
  
  // 扫描目录
  console.log('🔍 扫描文件...')
  const { markdownFiles, imageFiles } = scanDirectory(CONFIG.notesPath)
  
  console.log(`\n📊 扫描结果:`)
  console.log(`   📝 Markdown文件: ${markdownFiles.length} 个`)
  console.log(`   🖼️  图片文件: ${imageFiles.length} 个`)
  
  if (markdownFiles.length === 0) {
    console.log('⚠️  没有找到Markdown文件，退出处理')
    return
  }
  
  // 分批处理（避免请求过大）
  const BATCH_SIZE = 10 // 每批处理10个Markdown文件
  let totalUploaded = 0
  let totalFailed = 0
  
  for (let i = 0; i < markdownFiles.length; i += BATCH_SIZE) {
    const batchMarkdown = markdownFiles.slice(i, i + BATCH_SIZE)
    // 只包含当前批次Markdown文件引用的图片
    const batchImages = imageFiles // 简化处理，包含所有图片
    
    try {
      const result = await processBatch(batchMarkdown, batchImages)
      
      if (result.success) {
        const uploaded = result.data ? result.data.uploadedImages : 0
        totalUploaded += uploaded
        console.log(`✅ 批次 ${Math.floor(i/BATCH_SIZE) + 1} 处理成功: ${uploaded} 个图片上传`)
        
        // 将更新后的内容写回文件
        if (result.data && result.data.results) {
          for (const fileResult of result.data.results) {
            if (fileResult.hasChanges) {
              const fullPath = path.join(CONFIG.notesPath, fileResult.filePath)
              try {
                fs.writeFileSync(fullPath, fileResult.updatedContent, 'utf-8')
                console.log(`   💾 已更新文件: ${fileResult.filePath}`)
                console.log(`   🔗 替换了 ${fileResult.attachments.length} 个图片链接`)
              } catch (error) {
                console.error(`   ❌ 写入文件失败 ${fileResult.filePath}:`, error.message)
              }
            }
          }
        }
        
        // 显示处理的文件
        if (result.processedFiles) {
          result.processedFiles.forEach(file => {
            if (file.hasChanges) {
              console.log(`   📝 ${file.filePath}: ${file.attachments.length} 个图片`)
            }
          })
        }
      } else {
        console.error(`❌ 批次 ${Math.floor(i/BATCH_SIZE) + 1} 处理失败:`, result.message)
        totalFailed += batchMarkdown.length
      }
      
    } catch (error) {
      console.error(`❌ 批次 ${Math.floor(i/BATCH_SIZE) + 1} 处理异常:`, error.message)
      totalFailed += batchMarkdown.length
    }
    
    // 批次间延迟，避免API限制
    if (i + BATCH_SIZE < markdownFiles.length) {
      console.log('⏳ 等待2秒后处理下一批次...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  console.log('\n🏁 处理完成')
  console.log(`📈 总计上传图片: ${totalUploaded} 个`)
  console.log(`❌ 失败文件: ${totalFailed} 个`)
  
  if (totalUploaded > 0) {
    console.log('\n💡 提示: 图片已上传到Cloudflare Images，Markdown文件中的图片链接已自动更新')
    console.log('   请检查处理后的文件，确认图片链接正确显示')
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 程序执行失败:', error)
    process.exit(1)
  })
}

module.exports = { scanDirectory, imageToBase64, processBatch }