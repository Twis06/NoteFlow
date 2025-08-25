import { base64encode } from '../services/utils'

/**
 * 将生成的Markdown提交到GitHub仓库
 */
export async function submitToGitHub(params: { dir: string; filename: string; content: string }, env: any) {
  const token = env.GITHUB_TOKEN
  const owner = env.GITHUB_REPO_OWNER
  const repo = env.GITHUB_REPO_NAME
  const branch = env.GITHUB_REPO_BRANCH || 'main'
  if (!token || !owner || !repo) throw new Error('缺少 GitHub 配置')

  const path = `${params.dir}/${params.filename}`.replace(/^\/+/, '')
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`

  const body: any = {
    message: `add note ${params.filename}`,
    branch,
    content: base64encode(params.content)
  }
  if (env.GIT_COMMIT_AUTHOR_NAME && env.GIT_COMMIT_AUTHOR_EMAIL) {
    body.committer = { name: env.GIT_COMMIT_AUTHOR_NAME, email: env.GIT_COMMIT_AUTHOR_EMAIL }
  }

  const res = await fetch(api, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json',
      // GitHub REST API 要求必须提供 User-Agent，否则会 403
      'User-Agent': 'note-worker/0.1'
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error('GitHub 提交失败: ' + t)
  }
  return { ok: true, path }
}