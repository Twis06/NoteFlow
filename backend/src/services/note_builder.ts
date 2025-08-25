import { ImageItem } from '../types'

/**
 * 生成Markdown笔记内容，包含frontmatter与图片外链
 * - 使用 Intl.DateTimeFormat 实现时区安全的时间格式化（无需 dayjs 依赖）
 * - 使用 crypto.randomUUID（若不可用则回退）生成短ID（无需 uuid 依赖）
 */
export function buildMarkdownNote(params: { images: ImageItem[]; body?: string; timezone?: string }) {
  const tz = params.timezone || 'Asia/Shanghai'

  // 使用 Intl.DateTimeFormat 生成指定时区的时间组件
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(new Date())

  const get = (type: string) => parts.find(p => p.type === type)?.value || ''
  const Y = get('year')
  const M = get('month')
  const D = get('day')
  const hh = get('hour')
  const mm = get('minute')
  const ss = get('second')

  const ymd = `${Y}-${M}-${D}`
  const hhmm = `${hh}${mm}`
  const created = new Date().toISOString() // 使用UTC ISO时间作为created
  const title = `${ymd} ${hhmm}`
  const tags = [hhmm]

  // 生成短ID（6位），优先使用 crypto.randomUUID
  const shortId = (globalThis as any).crypto?.randomUUID ? (globalThis as any).crypto.randomUUID().slice(0, 6) : Math.random().toString(36).slice(2, 8)

  const frontmatter = {
    title,
    created,
    tags,
    source: 'telegram',
    provider: 'glm-4v',
    status: 'inbox',
    images: params.images.map((it) => ({ id: it.id, url: it.url, filename: it.filename }))
  }

  const bodyParts: string[] = []
  for (const img of params.images) {
    bodyParts.push(`![${img.filename}](${img.url})`)
  }
  if (params.body) bodyParts.push('\n' + params.body)

  const content = `---\n${yaml(frontmatter)}\n---\n\n${bodyParts.join('\n\n')}\n`
  const dir = `Notes/Inbox/${Y}/${ymd}`
  const filename = `${hh}${mm}${ss}-${shortId}.md`
  return { dir, filename, content }
}

/** 轻量 YAML 序列化，避免引入额外依赖 */
function yaml(obj: Record<string, any>) {
  const lines: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      lines.push(`${k}: [${v.map(x => JSON.stringify(x)).join(', ')}]`)
    } else if (typeof v === 'object' && v !== null) {
      // 简化对象序列化：每个键值对作为一行，增加缩进
      lines.push(`${k}:`)
      for (const [k2, v2] of Object.entries(v)) {
        lines.push(`  ${k2}: ${JSON.stringify(v2)}`)
      }
    } else {
      lines.push(`${k}: ${JSON.stringify(v)}`)
    }
  }
  return lines.join('\n')
}