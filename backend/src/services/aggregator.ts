import { ImageItem } from '../types'

/**
 * 会话聚合器：优先使用 Cloudflare KV（NOTE_SESSIONS），无则回退到内存Map。
 * 同一用户在窗口期内发送的图片会聚合到一个会话。
 */
const MEM_SESSIONS = new Map<string, { images: ImageItem[]; lastAt: number }>()

export class SessionAggregator {
  constructor(private env: any, private userId: number) {}

  private key() { return `sess:${this.userId}` }

  private hasKV(): boolean { return typeof this.env.NOTE_SESSIONS !== 'undefined' }

  private async kvGet(): Promise<{ images: ImageItem[]; lastAt: number } | null> {
    if (!this.hasKV()) return MEM_SESSIONS.get(this.key()) || null
    const raw = await (this.env.NOTE_SESSIONS as KVNamespace).get(this.key(), 'json') as any
    return raw || null
  }

  private async kvPut(val: { images: ImageItem[]; lastAt: number }) {
    if (!this.hasKV()) { MEM_SESSIONS.set(this.key(), val); return }
    await (this.env.NOTE_SESSIONS as KVNamespace).put(this.key(), JSON.stringify(val), { expirationTtl: 60 * 10 })
  }

  private async kvDel() {
    if (!this.hasKV()) { MEM_SESSIONS.delete(this.key()); return }
    await (this.env.NOTE_SESSIONS as KVNamespace).delete(this.key())
  }

  /** 添加图片到当前会话 */
  async addImage(img: ImageItem) {
    const now = Date.now()
    const win = Number(this.env.AGGREGATION_WINDOW_SECONDS || 90) * 1000
    const sess = await this.kvGet()
    if (!sess || now - sess.lastAt > win) {
      await this.kvPut({ images: [img], lastAt: now })
    } else {
      sess.images.push(img)
      sess.lastAt = now
      await this.kvPut(sess)
    }
  }

  /** 结束会话并返回图片列表 */
  async endSession() {
    const sess = await this.kvGet()
    if (!sess) return { images: [] }
    await this.kvDel()
    return { images: sess.images }
  }

  /** 如果会话已超时，则返回并清空之前的图片列表；否则返回null */
  async maybeFinalizeIfExpired(nowMs?: number) {
    const sess = await this.kvGet()
    if (!sess) return null
    const now = nowMs ?? Date.now()
    const win = Number(this.env.AGGREGATION_WINDOW_SECONDS || 90) * 1000
    if (now - sess.lastAt > win) {
      await this.kvDel()
      return { images: sess.images }
    }
    return null
  }
}