/**
 * 调试Obsidian处理器
 */

const fs = require('fs')
const path = require('path')

// 模拟extractImageReferences函数
function extractImageReferences(content) {
  const references = []
  
  // 匹配 ![alt](path) 格式
  const markdownRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  let match
  while ((match = markdownRegex.exec(content)) !== null) {
    const [fullMatch, alt, path] = match
    if (isLocalImagePath(path)) {
      references.push({ match: fullMatch, path, alt })
    }
  }
  
  // 匹配 ![[path]] 格式 (Obsidian wiki links)
  const wikiRegex = /!\[\[([^\]]+)\]\]/g
  while ((match = wikiRegex.exec(content)) !== null) {
    const [fullMatch, path] = match
    if (isLocalImagePath(path)) {
      references.push({ match: fullMatch, path })
    }
  }
  
  // 匹配 <img src="path"> 格式
  const htmlRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g
  while ((match = htmlRegex.exec(content)) !== null) {
    const [fullMatch, path] = match
    if (isLocalImagePath(path)) {
      references.push({ match: fullMatch, path })
    }
  }
  
  return references
}

// 判断路径是否为本地图片文件
function isLocalImagePath(path) {
  // 跳过已经是云端URL的图片
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return false
  }
  
  // 检查是否为图片文件扩展名
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico']
  const lowerPath = path.toLowerCase()
  return imageExtensions.some(ext => lowerPath.endsWith(ext))
}

// 递归查找所有Markdown文件
function findMarkdownFiles(dir) {
  const files = []
  const items = fs.readdirSync(dir)
  
  for (const item of items) {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)
    
    if (stat.isDirectory()) {
      // 跳过一些常见的非内容目录
      if (!['node_modules', '.git', 'dist', 'build'].includes(item)) {
        files.push(...findMarkdownFiles(fullPath))
      }
    } else if (item.endsWith('.md')) {
      files.push(fullPath)
    }
  }
  
  return files
}

console.log('=== 调试Obsidian处理器 ===')
console.log()

// 1. 查找所有Markdown文件
const markdownFiles = findMarkdownFiles('.')
console.log(`找到 ${markdownFiles.length} 个Markdown文件:`)
markdownFiles.forEach(file => console.log(`  - ${file}`))
console.log()

// 2. 分析每个文件的图片引用
let totalImageRefs = 0
for (const file of markdownFiles) {
  try {
    const content = fs.readFileSync(file, 'utf8')
    const imageRefs = extractImageReferences(content)
    
    if (imageRefs.length > 0) {
      console.log(`📄 ${file}:`)
      console.log(`   内容长度: ${content.length} 字符`)
      console.log(`   图片引用: ${imageRefs.length} 个`)
      
      imageRefs.forEach((ref, index) => {
        console.log(`   ${index + 1}. ${ref.path}`)
        console.log(`      匹配: ${ref.match}`)
        
        // 检查文件是否存在
        const exists = fs.existsSync(ref.path)
        console.log(`      存在: ${exists ? '✅' : '❌'}`)
        
        if (exists) {
          const stat = fs.statSync(ref.path)
          console.log(`      大小: ${stat.size} bytes`)
        }
      })
      
      totalImageRefs += imageRefs.length
      console.log()
    }
  } catch (error) {
    console.log(`❌ 读取文件失败 ${file}: ${error.message}`)
  }
}

console.log(`=== 总结 ===`)
console.log(`总共找到 ${totalImageRefs} 个图片引用`)

// 3. 检查attachments目录
if (fs.existsSync('attachments')) {
  const attachmentFiles = fs.readdirSync('attachments')
  console.log(`\nattachments目录包含 ${attachmentFiles.length} 个文件:`)
  attachmentFiles.forEach(file => {
    const fullPath = path.join('attachments', file)
    const stat = fs.statSync(fullPath)
    console.log(`  - ${file} (${stat.size} bytes)`)
  })
} else {
  console.log('\n❌ attachments目录不存在')
}