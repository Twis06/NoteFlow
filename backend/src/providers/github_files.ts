/**
 * GitHub文件操作提供者
 * 用于读取GitHub仓库中的文件内容，配合Obsidian处理器使用
 */

export interface GitHubFileInfo {
  path: string
  content: string
  sha: string
  size: number
  type: 'file' | 'dir'
}

export interface GitHubTreeItem {
  path: string
  mode: string
  type: string
  sha: string
  size?: number
  url: string
}

/**
 * 获取GitHub仓库中的文件内容
 */
export async function getGitHubFileContent(
  owner: string,
  repo: string,
  path: string,
  env: any,
  branch: string = 'main'
): Promise<GitHubFileInfo> {
  const token = env.GITHUB_TOKEN
  if (!token) throw new Error('GitHub token not configured')

  const encodedPath = encodeURIComponent(path)
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${branch}`

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'obsidian-processor/1.0'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch GitHub file ${path}: ${response.status} ${errorText}`)
  }

  const data = await response.json() as any
  
  if (data.type !== 'file') {
    throw new Error(`Path ${path} is not a file`)
  }

  // GitHub API返回base64编码的内容
  const content = atob(data.content.replace(/\s/g, ''))
  
  return {
    path: data.path,
    content,
    sha: data.sha,
    size: data.size,
    type: 'file'
  }
}

/**
 * 获取GitHub仓库目录树
 */
export async function getGitHubDirectoryTree(
  owner: string,
  repo: string,
  env: any,
  path: string = '',
  recursive: boolean = true
): Promise<GitHubTreeItem[]> {
  const token = env.GITHUB_TOKEN
  if (!token) throw new Error('GitHub token not configured')

  const branch = env.GITHUB_REPO_BRANCH || 'main'
  
  // 获取分支信息以得到tree SHA
  const branchUrl = `https://api.github.com/repos/${owner}/${repo}/branches/${branch}`
  const branchResponse = await fetch(branchUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'obsidian-processor/1.0'
    }
  })

  if (!branchResponse.ok) {
    throw new Error(`Failed to fetch branch info: ${branchResponse.status}`)
  }

  const branchData = await branchResponse.json() as any
  const treeSha = branchData.commit.commit.tree.sha

  // 获取树结构
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}${recursive ? '?recursive=1' : ''}`
  const treeResponse = await fetch(treeUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'obsidian-processor/1.0'
    }
  })

  if (!treeResponse.ok) {
    throw new Error(`Failed to fetch repository tree: ${treeResponse.status}`)
  }

  const treeData = await treeResponse.json() as any
  
  // 过滤指定路径下的文件
  let items = treeData.tree as GitHubTreeItem[]
  
  if (path) {
    const normalizedPath = path.replace(/^\/+|\/+$/g, '') // 移除前后斜杠
    items = items.filter(item => item.path.startsWith(normalizedPath))
  }

  return items
}

/**
 * 获取仓库中所有Markdown文件
 */
export async function getMarkdownFiles(
  owner: string,
  repo: string,
  env: any,
  basePath: string = ''
): Promise<GitHubTreeItem[]> {
  const allFiles = await getGitHubDirectoryTree(owner, repo, env, basePath, true)
  
  return allFiles.filter(item => 
    item.type === 'blob' && 
    item.path.toLowerCase().endsWith('.md')
  )
}

/**
 * 获取仓库中的图片文件
 */
export async function getImageFiles(
  owner: string,
  repo: string,
  env: any,
  basePath: string = ''
): Promise<GitHubTreeItem[]> {
  const allFiles = await getGitHubDirectoryTree(owner, repo, env, basePath, true)
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico']
  
  return allFiles.filter(item => 
    item.type === 'blob' && 
    imageExtensions.some(ext => item.path.toLowerCase().endsWith(ext))
  )
}

/**
 * 批量获取多个文件的内容
 */
export async function getBatchFileContents(
  owner: string,
  repo: string,
  paths: string[],
  env: any,
  branch: string = 'main'
): Promise<GitHubFileInfo[]> {
  const results: GitHubFileInfo[] = []
  
  // 并发获取文件内容，但限制并发数避免API限制
  const batchSize = 5
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize)
    const promises = batch.map(path => 
      getGitHubFileContent(owner, repo, path, env, branch)
        .catch(error => {
          console.error(`Failed to fetch ${path}:`, error)
          return null
        })
    )
    
    const batchResults = await Promise.all(promises)
    results.push(...batchResults.filter(result => result !== null) as GitHubFileInfo[])
  }
  
  return results
}

/**
 * 更新GitHub文件内容
 */
export async function updateGitHubFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha: string,
  env: any,
  branch: string = 'main'
): Promise<{ success: boolean; sha?: string }> {
  const token = env.GITHUB_TOKEN
  if (!token) throw new Error('GitHub token not configured')

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`
  
  // 将内容编码为base64
  const encodedContent = btoa(unescape(encodeURIComponent(content)))

  const body = {
    message,
    content: encodedContent,
    sha,
    branch
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'obsidian-processor/1.0',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to update GitHub file ${path}: ${response.status} ${errorText}`)
  }

  const result = await response.json() as any
  return {
    success: true,
    sha: result.content.sha
  }
}

/**
 * 获取GitHub仓库中的原始文件内容（适用于图片等二进制文件）
 */
export async function getGitHubRawFile(
  owner: string,
  repo: string,
  path: string,
  env: any,
  branch: string = 'main'
): Promise<Uint8Array> {
  const token = env.GITHUB_TOKEN
  if (!token) throw new Error('GitHub token not configured')

  // 使用raw.githubusercontent.com获取原始文件内容
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'obsidian-processor/1.0'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch raw file ${path}: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

export async function uploadGitHubBinaryFile(
  owner: string,
  repo: string,
  path: string,
  contentBytes: Uint8Array,
  message: string,
  env: any,
  branch: string = 'main'
): Promise<{ success: boolean; sha?: string }> {
  const token = env.GITHUB_TOKEN
  if (!token) throw new Error('GitHub token not configured')

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`

  // base64 编码二进制
  let binary = ''
  for (let i = 0; i < contentBytes.length; i++) binary += String.fromCharCode(contentBytes[i])
  const encodedContent = btoa(binary)

  const body: any = {
    message,
    content: encodedContent,
    branch
  }
  if (env.GIT_COMMIT_AUTHOR_NAME && env.GIT_COMMIT_AUTHOR_EMAIL) {
    body.committer = { name: env.GIT_COMMIT_AUTHOR_NAME, email: env.GIT_COMMIT_AUTHOR_EMAIL }
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'obsidian-processor/1.0',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to upload GitHub binary file ${path}: ${response.status} ${errorText}`)
  }

  const result = await response.json() as any
  return { success: true, sha: result.content.sha }
}