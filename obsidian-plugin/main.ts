import { App, Plugin } from 'obsidian'

interface PluginSettings {
  apiEndpoint: string
  apiToken: string
  accountId: string
  accountHash: string
  variant: string
}

const DEFAULT_SETTINGS: PluginSettings = {
  apiEndpoint: 'https://api.cloudflare.com/client/v4',
  apiToken: '',
  accountId: '',
  accountHash: '',
  variant: 'public'
}

export default class CfImagesUploaderPlugin extends Plugin {
  settings: PluginSettings

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS)

    // 监听粘贴事件
    this.registerEvent(this.app.workspace.on('editor-paste', async (evt, editor) => {
      const items = evt.clipboardData?.items
      if (!items) return
      for (const it of items) {
        if (it.type.startsWith('image/')) {
          evt.preventDefault()
          const file = it.getAsFile()
          if (!file) return
          const link = await this.upload(file)
          editor.replaceSelection(`![](${link})`)
        }
      }
    }))
  }

  /** 上传到 Cloudflare Images 并返回外链 */
  async upload(file: File) {
    const form = new FormData()
    form.append('file', file)
    const resp = await fetch(`${this.settings.apiEndpoint}/accounts/${this.settings.accountId}/images/v1`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.settings.apiToken}` },
      body: form
    })
    const data = await resp.json()
    if (!data.success) throw new Error('上传失败')
    const id = data.result.id
    return `https://imagedelivery.net/${this.settings.accountHash}/${id}/${this.settings.variant}`
  }
}