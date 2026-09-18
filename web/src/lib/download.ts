/** Turns a base64 document (wallee RenderedDocument) into a browser download. */
export function downloadBase64(data: string, mimeType: string, filename: string): void {
  const binary = atob(data.replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** `Beleg-VT-2026-000123.pdf` — keeps letters, digits, dash, underscore and dot. */
export function safeFilename(name: string, extension: string): string {
  const cleaned =
    name
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'document'
  return cleaned.toLowerCase().endsWith(`.${extension}`) ? cleaned : `${cleaned}.${extension}`
}

export function extensionForMime(mimeType?: string): string {
  if (!mimeType) return 'pdf'
  if (mimeType.includes('pdf')) return 'pdf'
  if (mimeType.includes('html')) return 'html'
  if (mimeType.includes('png')) return 'png'
  return 'bin'
}
