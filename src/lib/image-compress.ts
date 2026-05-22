/**
 * Comprime/redimensiona imagens antes do upload. Reduz fotos de celular
 * (5MB+) pra ~500KB-1MB sem perda visível. Não-imagens passam direto.
 *
 * Uso: `const arquivo = await compressImage(file)` antes de `supabase.storage.upload(arquivo)`.
 */

export interface CompressOptions {
  /** Largura máxima em px. Default 1920 (Full HD). */
  maxWidth?: number
  /** Altura máxima em px. Default 1920. */
  maxHeight?: number
  /** Qualidade JPEG 0-1. Default 0.85 (sweet spot tamanho/qualidade). */
  quality?: number
  /** Threshold mínimo pra comprimir. Arquivos menores passam direto. Default 500KB. */
  skipBelowBytes?: number
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  // Não-imagens (PDF, DOC, etc) passam direto
  if (!file.type.startsWith('image/')) return file
  // PNG transparente: mantém PNG (converter pra JPEG perde transparência)
  // Mas se for foto comum, JPEG dá menor
  const targetMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'

  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    skipBelowBytes = 500 * 1024,
  } = opts

  // Arquivos já pequenos: não comprime
  if (file.size < skipBelowBytes) return file

  return new Promise((resolve) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = (e) => {
      img.src = e.target?.result as string
    }
    reader.onerror = () => resolve(file) // fallback: devolve original

    img.onerror = () => resolve(file)
    img.onload = () => {
      // Calcula novo tamanho mantendo aspect ratio
      let { width, height } = img
      const ratio = Math.min(maxWidth / width, maxHeight / height, 1)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob((blob) => {
        if (!blob || blob.size >= file.size) {
          // Falha ou ficou maior que original: devolve original
          resolve(file)
          return
        }
        const ext = targetMime === 'image/png' ? '.png' : '.jpg'
        const newName = file.name.replace(/\.\w+$/, ext)
        resolve(new File([blob], newName, { type: targetMime, lastModified: Date.now() }))
      }, targetMime, quality)
    }

    reader.readAsDataURL(file)
  })
}
