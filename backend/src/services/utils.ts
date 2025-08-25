// 使用 TextEncoder 将任意 Unicode 字符串转为 UTF-8 字节，再安全地进行 base64 编码
export function base64encode(str: string) {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * 将二进制数据编码为 base64 字符串
 * 用于将图片等二进制文件上传到 GitHub
 */
export function base64encodeBytes(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}