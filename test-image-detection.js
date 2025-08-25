/**
 * 测试图片识别功能
 */

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

// 读取测试文件内容
const fs = require('fs')
const testContent = fs.readFileSync('test-note.md', 'utf8')

console.log('测试笔记内容:')
console.log(testContent)
console.log('\n' + '='.repeat(50) + '\n')

// 提取图片引用
const imageRefs = extractImageReferences(testContent)

console.log('识别到的图片引用:')
console.log(JSON.stringify(imageRefs, null, 2))

console.log('\n图片引用数量:', imageRefs.length)

// 检查文件是否存在
console.log('\n检查图片文件是否存在:')
for (const ref of imageRefs) {
  const exists = fs.existsSync(ref.path)
  console.log(`${ref.path}: ${exists ? '✅ 存在' : '❌ 不存在'}`)
}