import { uploadToCloudflareImages } from '../providers/images_cloudflare'
import { uploadGitHubBinaryFile } from '../providers/github_files'
import { processImagesWithOCR } from '../providers/ocr_glm'
import { buildMarkdownNote } from './note_builder'
import { submitToGitHub } from '../providers/git_github'

export interface HandwrittenBackupOptions {
  /** 是否启用GitHub备份 */
  enableGitHubBackup?: boolean
  /** GitHub备份目录 */
  gitHubBackupDir?: string
  /** 图片质量选项 */
  imageQuality?: 'auto' | 'highest' | 'high' | 'medium' | 'low'
  /** 是否压缩图片 */
  compressImages?: boolean
  /** 图片变体后缀 */
  variantSuffix?: string
}

export interface ProcessResult {
  /** Cloudflare Images ID */
  cloudflareImageId: string
  /** Cloudflare Images URL */
  cloudflareImageUrl: string
  /** GitHub备份路径（如果启用） */
  gitHubBackupPath?: string
  /** OCR识别结果 */
  ocrText: string
  /** 生成的Markdown笔记路径 */
  notePath: string
}

/**
 * 处理手写笔记照片的完整流程
 * 包括上传到Cloudflare Images、可选GitHub备份、OCR识别、生成Markdown笔记
 */
export async function processHandwrittenNote(
  imageBytes: Uint8Array,
  filename: string,
  env: any,
  options: HandwrittenBackupOptions = {}
): Promise<ProcessResult> {
  const {
    enableGitHubBackup = false,
    gitHubBackupDir = 'handwritten_originals',
    imageQuality = 'high',
    compressImages = true,
    variantSuffix = ''
  } = options

  // 1. 上传到 Cloudflare Images（优化压缩）
  const cloudflareResult = await uploadToCloudflareImages(
    imageBytes,
    filename,
    env,
    {
      quality: compressImages ? imageQuality : 'highest',
      metadata: {
        source: 'handwritten',
        uploaded_at: new Date().toISOString(),
        original_filename: filename,
        backup_enabled: enableGitHubBackup ? 'true' : 'false'
      }
    }
  )

  let gitHubBackupPath: string | undefined

  // 2. 可选：GitHub备份原图
  if (enableGitHubBackup) {
    const owner = env.GITHUB_REPO_OWNER
    const repo = env.GITHUB_REPO_NAME
    const branch = env.GITHUB_REPO_BRANCH || 'main'
    
    // 使用时间戳生成唯一路径
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFilename = `${timestamp}_${filename}`
    gitHubBackupPath = `${gitHubBackupDir}/${new Date().getFullYear()}/${backupFilename}`
    
    try {
      await uploadGitHubBinaryFile(
        owner,
        repo,
        gitHubBackupPath,
        imageBytes,
        `backup: add handwritten note ${backupFilename}`,
        env,
        branch
      )
    } catch (error) {
      console.warn('GitHub backup failed, continuing with process:', error)
      gitHubBackupPath = undefined
    }
  }

  // 3. OCR识别
  const imageUrls = [cloudflareResult.url]
  const ocrText = await processImagesWithOCR(imageUrls, env)

  // 4. 生成并提交Markdown笔记
  const imageItem = {
    id: cloudflareResult.id,
    url: cloudflareResult.url,
    filename,
    size: imageBytes.length,
    uploaded_at: new Date().toISOString()
  }

  const builtNote = buildMarkdownNote({
    images: [imageItem],
    body: ocrText,
    timezone: env.TIMEZONE
  })

  // 在frontmatter中添加备份信息
  if (gitHubBackupPath) {
    const noteContent = builtNote.content.replace(
      /^---\n([\s\S]*?)\n---/,
      (match, frontmatter) => {
        const updatedFrontmatter = frontmatter + `\noriginal_backup: ${gitHubBackupPath}`
        return `---\n${updatedFrontmatter}\n---`
      }
    )
    builtNote.content = noteContent
  }

  await submitToGitHub(builtNote, env)

  return {
    cloudflareImageId: cloudflareResult.id,
    cloudflareImageUrl: cloudflareResult.url,
    gitHubBackupPath,
    ocrText,
    notePath: `${builtNote.dir}/${builtNote.filename}`
  }
}

/**
 * 批量处理多张手写笔记照片
 */
export async function processMultipleHandwrittenNotes(
  images: Array<{ bytes: Uint8Array; filename: string }>,
  env: any,
  options: HandwrittenBackupOptions = {}
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = []
  
  for (const { bytes, filename } of images) {
    try {
      const result = await processHandwrittenNote(bytes, filename, env, options)
      results.push(result)
    } catch (error) {
      console.error(`Failed to process ${filename}:`, error)
      // 继续处理其他图片
    }
  }
  
  return results
}

/**
 * 从字节数据创建图片项
 */
export function createImageFromBytes(
  bytes: Uint8Array,
  filename: string
): { bytes: Uint8Array; filename: string } {
  return { bytes, filename }
}