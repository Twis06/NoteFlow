/**
 * 统一文件访问服务
 * 支持GitHub仓库访问（Cloudflare Workers环境）
 */
import { getGitHubFileContent, getGitHubRawFile, updateGitHubFile, getGitHubDirectoryTree, GitHubTreeItem } from '../providers/github_files'

export interface FileAccessConfig {
  /** GitHub配置 */
  github: {
    owner: string
    repo: string
    branch: string
  }
}

export interface FileInfo {
  path: string
  content?: string
  size: number
  lastModified: string
  isDirectory: boolean
}

/**
 * 统一文件访问服务类
 */
export class FileAccessService {
  private config: FileAccessConfig
  private env: any

  constructor(config: FileAccessConfig, env: any) {
    this.config = config
    this.env = env
  }

  /**
   * 读取文件内容
   */
  async readFile(filePath: string): Promise<string> {
    const fileInfo = await getGitHubFileContent(
      this.config.github.owner,
      this.config.github.repo,
      filePath,
      this.env,
      this.config.github.branch
    )
    return fileInfo.content
  }

  /**
   * 读取二进制文件
   */
  async readBinaryFile(filePath: string): Promise<Uint8Array> {
    const buffer = await getGitHubRawFile(
      this.config.github.owner,
      this.config.github.repo,
      filePath,
      this.env,
      this.config.github.branch
    )
    return buffer
  }

  /**
   * 写入文件
   */
  async writeFile(filePath: string, content: string, commitMessage?: string): Promise<void> {
    // 首先尝试获取现有文件的SHA（如果存在）
    let sha: string | undefined
    try {
      const existingFile = await getGitHubFileContent(
        this.config.github.owner,
        this.config.github.repo,
        filePath,
        this.env,
        this.config.github.branch
      )
      sha = existingFile.sha
    } catch {
      // 文件不存在，创建新文件
    }
    
    await updateGitHubFile(
      this.config.github.owner,
      this.config.github.repo,
      filePath,
      content,
      commitMessage || `更新文件: ${filePath}`,
      sha || '',
      this.env,
      this.config.github.branch
    )
  }

  /**
   * 列出目录内容
   */
  async listDirectory(dirPath: string = ''): Promise<FileInfo[]> {
    const items = await getGitHubDirectoryTree(
      this.config.github.owner,
      this.config.github.repo,
      this.env,
      dirPath,
      false
    )
    return items.map((item: GitHubTreeItem) => ({
      path: item.path,
      size: item.size || 0,
      lastModified: new Date().toISOString(), // GitHub API不直接提供修改时间
      isDirectory: item.type === 'tree'
    }))
  }

  /**
   * 检查文件是否存在
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await this.readFile(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(filePath: string): Promise<FileInfo | null> {
    try {
      const content = await this.readFile(filePath)
      return {
        path: filePath,
        content,
        size: content.length,
        lastModified: new Date().toISOString(),
        isDirectory: false
      }
    } catch {
      return null
    }
  }
}

/**
 * 创建文件访问服务实例
 */
export function createFileAccessService(env: any): FileAccessService {
  const owner = env.NOTES_REPO_OWNER || 'Twis06'
  const repo = env.NOTES_REPO_NAME || 'notes'
  const branch = env.NOTES_REPO_BRANCH || 'main'
  return new FileAccessService({
    github: { owner, repo, branch }
  }, env)
}