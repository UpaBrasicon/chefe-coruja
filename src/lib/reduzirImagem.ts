// Item 02 do kit de desempenho (docs/desempenho/AUDITORIA.md): banner, foto do
// perfil e arte do painel eram enviados no tamanho original. Antes de subir, a
// imagem é reduzida no aparelho para o tamanho em que aparece e vira WebP.
// Se algo falhar, ou se o resultado não ficar menor, sobe o arquivo original.

const REDUZIVEIS = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function valeReduzir(tipo: string): boolean {
  return REDUZIVEIS.has(tipo)
}

/** Lado maior até `maxLado`, mantendo a proporção; nunca aumenta. */
export function medidaReduzida(largura: number, altura: number, maxLado: number): { largura: number; altura: number } {
  const maior = Math.max(largura, altura)
  if (maior <= maxLado) return { largura, altura }
  const fator = maxLado / maior
  return { largura: Math.max(1, Math.round(largura * fator)), altura: Math.max(1, Math.round(altura * fator)) }
}

export function nomeWebp(nome: string): string {
  const ponto = nome.lastIndexOf('.')
  return (ponto > 0 ? nome.slice(0, ponto) : nome) + '.webp'
}

export async function reduzirImagem(arquivo: File, maxLado: number, qualidade = 0.82): Promise<File> {
  if (!valeReduzir(arquivo.type) || typeof createImageBitmap !== 'function') return arquivo
  try {
    const bitmap = await createImageBitmap(arquivo)
    const { largura, altura } = medidaReduzida(bitmap.width, bitmap.height, maxLado)
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    if (!ctx) return arquivo
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, largura, altura)
    bitmap.close()
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', qualidade))
    // navegador sem WebP devolve PNG; só vale se ficou WebP e menor
    if (!blob || blob.type !== 'image/webp' || blob.size >= arquivo.size) return arquivo
    return new File([blob], nomeWebp(arquivo.name), { type: 'image/webp' })
  } catch {
    return arquivo
  }
}
