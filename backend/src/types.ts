// Telegram 相关类型（精简）
export interface TelegramUpdate { message?: TelegramMessage; edited_message?: TelegramMessage }
export interface TelegramMessage {
  message_id: number
  from?: { id: number; is_bot?: boolean; first_name?: string; username?: string }
  chat: { id: number; type: string }
  date: number
  text?: string
  photo?: Array<{ file_id: string; width: number; height: number; file_size?: number }>
  document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number }
}

// 会话聚合内保存的图片
export interface ImageItem {
  id: string
  url: string
  filename: string
  size?: number
  uploaded_at?: string
}

export interface OCRBlock {
  text: string
  latex?: string
  confidence?: number
}

export interface NoteContent {
  title: string
  created: string
  tags: string[]
  images: ImageItem[]
  bodyMarkdown: string
}