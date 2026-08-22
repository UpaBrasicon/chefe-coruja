// ─────────────────────────────────────────────────────────────────────────────
// HERMES v1.1 — tools/anexos.ts
// Verificação de anexos do Cérbero (Patrulha B, camada anexos):
//   - Magic bytes vs. extensão declarada (PDF que não começa com %PDF, imagem
//     com header de executável, etc.)
//   - Bloqueio de dupla extensão (laudo.pdf.exe)
//   - Limite de tamanho
// Tudo heurístico local, sem custo. Retorna veredicto + motivos.
// ─────────────────────────────────────────────────────────────────────────────

export const TAMANHO_MAX_ANEXO = 25 * 1024 * 1024 // 25 MB

// Assinaturas conhecidas (magic bytes) — primeiros bytes
const MAGIC: { ext: string; bytes: number[]; offset?: number }[] = [
  { ext: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { ext: 'gif', bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { ext: 'zip', bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK..
  { ext: 'txt', bytes: [0xef, 0xbb, 0xbf] }, // UTF-8 BOM (texto)
]

export type VeredictoAnexo = {
  veredicto: 'seguro' | 'suspeito' | 'malicioso'
  motivos: string[]
}

const EXT_PERIGOSAS = /\.(exe|scr|bat|cmd|msi|apk|jar|vbs|ps1|dll|sh)$/i

/**
 * Detecta a extensão real pelo conteúdo (magic bytes).
 * Retorna null se não reconhecer (ex.: texto puro).
 */
export function detectarTipoPorConteudo(buffer: Uint8Array): string | null {
  for (const m of MAGIC) {
    const off = m.offset ?? 0
    if (buffer.length < off + m.bytes.length) continue
    const bate = m.bytes.every((b, i) => buffer[off + i] === b)
    if (bate) return m.ext
  }
  return null
}

/**
 * Verifica um anexo (nome do arquivo + conteúdo em bytes).
 * Regras:
 *   - extensão perigosa → malicioso
 *   - dupla extensão (arquivo.ext.exe) → malicioso
 *   - tamanho acima do limite → malicioso
 *   - magic bytes não batem com a extensão declarada → suspeito
 *     (ex.: "laudo.pdf" que não começa com %PDF; imagem que é na verdade
 *     um executável MZ)
 */
export function verificarAnexo(nomeArquivo: string, conteudo: Uint8Array, tamanho?: number): VeredictoAnexo {
  const motivos: string[] = []
  const tam = tamanho ?? conteudo.length
  const nome = nomeArquivo.toLowerCase()

  if (tam > TAMANHO_MAX_ANEXO) motivos.push('tamanho_excedido')

  // Dupla extensão: algo.exe.pdf → a última extensão é a "real" do nome
  const partes = nome.split('.')
  if (partes.length >= 3 && EXT_PERIGOSAS.test(`.${partes[partes.length - 1]!}`)) {
    motivos.push('dupla_extensao')
  }
  // Qualquer extensão perigosa no nome
  if (EXT_PERIGOSAS.test(nome)) motivos.push('extensao_perigosa')

  // Magic bytes vs. extensão declarada
  const extensaoDeclarada = partes.length >= 2 ? partes[partes.length - 1]! : ''
  const tipoConteudo = detectarTipoPorConteudo(conteudo)
  if (extensaoDeclarada && tipoConteudo && extensaoDeclarada !== tipoConteudo) {
    // PDF declarado mas conteúdo não é PDF → suspeito (pode ser texto/erro)
    motivos.push(`magic_bytes_incompativel: declarado .${extensaoDeclarada}, conteudo ${tipoConteudo}`)
  }
  // Executável MZ (0x4D 0x5A) disfarçado de imagem/documento
  if (conteudo.length >= 2 && conteudo[0] === 0x4d && conteudo[1] === 0x5a) {
    motivos.push('executavel_mz_disfarcado')
  }

  if (
    motivos.includes('extensao_perigosa') ||
    motivos.includes('dupla_extensao') ||
    motivos.includes('executavel_mz_disfarcado') ||
    motivos.includes('tamanho_excedido')
  ) {
    return { veredicto: 'malicioso', motivos }
  }
  return { veredicto: motivos.length ? 'suspeito' : 'seguro', motivos }
}
