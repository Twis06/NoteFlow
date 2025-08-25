import { uploadToCloudflareImages } from '../providers/images_cloudflare'
import { getGitHubFileContent, getGitHubRawFile, updateGitHubFile, getMarkdownFiles } from '../providers/github_files'

/**
 * Obsidian附件处理服务
 * 用于处理Obsidian笔记中的本地图片，上传到Cloudflare Images并替换为云端URL
 */

export interface AttachmentInfo {
  id: string
  url: string
  originalPath: string
  filename: string
  size: number
  uploaded_at: string
}

export interface ProcessedNote {
  filePath: string
  originalContent: string
  updatedContent: string
  attachments: AttachmentInfo[]
  hasChanges: boolean
}

/**
 * 从Markdown内容中提取图片引用
 * 支持格式：![alt](path)、![[path]]、<img src="path">
 */
export function extractImageReferences(content: string): Array<{ match: string; path: string; alt?: string }> {
  const references: Array<{ match: string; path: string; alt?: string }> = []
  
  // 匹配 ![alt](path) 格式
  const markdownRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  let match: RegExpExecArray | null
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

/**
 * 判断路径是否为本地图片文件
 */
function isLocalImagePath(path: string): boolean {
  // 跳过已经是云端URL的图片
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return false
  }
  
  // 检查是否为图片文件扩展名
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico']
  const lowerPath = path.toLowerCase()
  return imageExtensions.some(ext => lowerPath.endsWith(ext))
}

/**
 * 处理单个Markdown文件，上传其中的本地图片并替换路径
 */
export async function processMarkdownFile(
  filePath: string, 
  content: string, 
  basePath: string,
  env: any
): Promise<ProcessedNote> {
  const imageRefs = extractImageReferences(content)
  const attachments: AttachmentInfo[] = []
  let updatedContent = content
  let hasChanges = false

  for (const ref of imageRefs) {
    try {
      // 构建完整的图片文件路径
      let fullImagePath = ref.path
      if (!fullImagePath.startsWith('/')) {
        // 相对路径，基于markdown文件所在目录解析
        const noteDir = filePath.substring(0, filePath.lastIndexOf('/'))
        fullImagePath = `${noteDir}/${ref.path}`.replace(/\/+/g, '/')
      }
      
      // 如果路径不是绝对路径，添加basePath
      if (!fullImagePath.startsWith('/')) {
        fullImagePath = `${basePath}/${fullImagePath}`.replace(/\/+/g, '/')
      }

      // 读取图片文件并上传
      const imageBuffer = await readImageFile(fullImagePath, env)
      const filename = fullImagePath.split('/').pop() || 'image.jpg'
      
      const uploadResult = await uploadToCloudflareImages(imageBuffer, filename, env)
      
      const attachmentInfo: AttachmentInfo = {
        id: uploadResult.id,
        url: uploadResult.url,
        originalPath: ref.path,
        filename,
        size: imageBuffer.length,
        uploaded_at: new Date().toISOString()
      }
      
      attachments.push(attachmentInfo)
      
      // 替换内容中的图片路径
      if (ref.match.includes('![[')) {
        // Obsidian wiki link格式
        updatedContent = updatedContent.replace(ref.match, `![${filename}](${uploadResult.url})`)
      } else if (ref.match.includes('<img')) {
        // HTML img标签格式
        updatedContent = updatedContent.replace(ref.match, `<img src="${uploadResult.url}" alt="${filename}">`)
      } else {
        // 标准Markdown格式
        const alt = ref.alt || filename
        updatedContent = updatedContent.replace(ref.match, `![${alt}](${uploadResult.url})`)
      }
      
      hasChanges = true
      
    } catch (error) {
      console.error(`Failed to process image ${ref.path} in ${filePath}:`, error)
      // 继续处理其他图片，不中断整个流程
    }
  }

  return {
    filePath,
    originalContent: content,
    updatedContent,
    attachments,
    hasChanges
  }
}

/**
 * 读取图片文件
 * 优先从 GitHub 仓库读取 Obsidian notes repo 的附件
 */
async function readImageFile(path: string, env: any): Promise<Uint8Array> {
  // 尝试从 GitHub notes 仓库读取
  const owner = env.GITHUB_REPO_OWNER
  const repo = env.GITHUB_REPO_NAME
  const branch = env.GITHUB_REPO_BRANCH || 'main'

  // 将本地绝对路径映射为仓库内相对路径（用户提供的本地路径：/Users/.../notes）
  const localRoot = env.LOCAL_NOTES_ROOT || '/Users/lipeiyang/Documents/notes'
  let repoRelativePath = path
  if (path.startsWith(localRoot)) {
    repoRelativePath = path.substring(localRoot.length).replace(/^\/+/, '')
  }

  try {
    const bytes = await getGitHubRawFile(owner, repo, repoRelativePath, env, branch)
    return bytes
  } catch (e) {
    // 退化：如果 GitHub 不存在该文件，抛错，提醒走本地上传端点
    throw new Error(`Cannot read file via GitHub API: ${repoRelativePath}. Provide upload via endpoint.`)
  }
}

/**
 * 基于 GitHub 仓库批量处理 Markdown，自动上传 attachments 并改写链接并回写 PR/commit
 */
export async function processObsidianRepoAttachments(env: any, options?: { baseDir?: string; dryRun?: boolean }) {
  const owner = env.GITHUB_REPO_OWNER
  const repo = env.GITHUB_REPO_NAME
  const branch = env.GITHUB_REPO_BRANCH || 'main'
  const baseDir = (options?.baseDir || '').replace(/^\/+|\/+$/g, '')

  // 1) 找到所有 Markdown 文件
  const mdFiles = await getMarkdownFiles(owner, repo, env, baseDir)
  const changedFiles: { path: string; newContent: string; sha: string }[] = []
  const uploadedAttachments: AttachmentInfo[] = []

  // 2) 逐个取内容并处理
  for (const f of mdFiles) {
    const file = await getGitHubFileContent(owner, repo, f.path, env, branch)
    const processed = await processMarkdownFile(f.path, file.content, baseDir, env)
    if (processed.hasChanges) {
      changedFiles.push({ path: f.path, newContent: processed.updatedContent, sha: file.sha })
      uploadedAttachments.push(...processed.attachments)
    }
  }

  // 3) 回写更改（按文件更新）
  if (!options?.dryRun) {
    for (const cf of changedFiles) {
      await updateGitHubFile(owner, repo, cf.path, cf.newContent, `chore: migrate images to Cloudflare Images for ${cf.path}`,
        cf.sha, env, branch)
    }
  }

  return { changedCount: changedFiles.length, uploaded: uploadedAttachments }
}

/**
 * 批量处理目录中的所有Markdown文件（仅作为占位说明：在Workers中无法直接读本地目录）
 */
export async function processNotesDirectory(
  notesPath: string,
  env: any,
  options?: {
    recursive?: boolean
    filePattern?: RegExp
  }
): Promise<ProcessedNote[]> {
  const { recursive = true, filePattern = /\.md$/i } = options || {}
  
  // 在Cloudflare Workers环境中，无法直接访问文件系统
  // 这个函数需要配合GitHub API或其他文件提供方式使用
  throw new Error('Directory access not available in Cloudflare Workers environment. Use GitHub API or specific file endpoints instead.')
}

/**
 * 生成图片库数据结构
 */
export function generateGalleryData(attachments: AttachmentInfo[]): any {
  const groupedByDate: Record<string, AttachmentInfo[]> = {}
  
  for (const attachment of attachments) {
    const date = attachment.uploaded_at.split('T')[0] // YYYY-MM-DD
    if (!groupedByDate[date]) {
      groupedByDate[date] = []
    }
    groupedByDate[date].push(attachment)
  }
  
  return {
    totalImages: attachments.length,
    totalSize: attachments.reduce((sum, item) => sum + item.size, 0),
    groupedByDate,
    recentImages: attachments.slice(-20), // 最近20张图片
    statistics: {
      today: groupedByDate[new Date().toISOString().split('T')[0]]?.length || 0,
      thisWeek: Object.keys(groupedByDate).filter(date => {
        const diffTime = Date.now() - new Date(date).getTime()
        return diffTime <= 7 * 24 * 60 * 60 * 1000
      }).reduce((sum, date) => sum + groupedByDate[date].length, 0)
    }
  }
}