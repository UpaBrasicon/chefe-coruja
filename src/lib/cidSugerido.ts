// CID de referência a partir da Avaliação (achado guardado de 07/10/2026;
// decisão do RT em 06/11/2026: A em C1 a C7;
// docs/porta/CID-SUGERIDO-AVALIACAO-DIAGNOSTICO.md).
//
// A regra (termos curados, negação, busca de texto) mora no banco, em
// public.cid_sugerir_do_texto. Aqui fica só o que a tela decide: quando
// consultar, como ler a resposta e o que esconder. O código de referência
// nunca é gravado por conta própria: o clique só preenche o campo CID.

export type CidSugerido = { codigo: string; descricao: string; motivo: string }

/** Menos que isso não consulta (uma sigla tem 3 letras: PAC, IAM, AVC). */
export const MIN_TEXTO_CID = 3
const MAX_TEXTO_CID = 500

/** Texto que vai ao servidor; '' quando não vale a pena consultar. */
export function textoParaSugestao(texto: string): string {
  const t = texto.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXTO_CID)
  return t.replace(/[^\p{L}\p{N}]/gu, '').length >= MIN_TEXTO_CID ? t : ''
}

/** A resposta do servidor (jsonb), só com itens que têm código e descrição. */
export function lerCidsSugeridos(dados: unknown): CidSugerido[] {
  if (!Array.isArray(dados)) return []
  return dados.flatMap((d) => {
    if (!d || typeof d !== 'object') return []
    const { codigo, descricao, motivo } = d as Record<string, unknown>
    if (typeof codigo !== 'string' || !codigo || typeof descricao !== 'string' || !descricao) return []
    return [{ codigo, descricao, motivo: typeof motivo === 'string' && motivo ? motivo : 'texto' }]
  })
}

/** "J18.9" ou "J18.9 — Pneumonia…" (campo do Diagnóstico) → "J18.9". */
export function codigoDoCampo(valor: string): string {
  return valor.trim().split(/\s|—/)[0].toUpperCase()
}

/** Esconde o CID que já está no campo. */
export function sugestoesVisiveis(lista: CidSugerido[], valorDoCampo: string): CidSugerido[] {
  const atual = codigoDoCampo(valorDoCampo)
  return atual ? lista.filter((s) => s.codigo.toUpperCase() !== atual) : lista
}

/** "sigla PAC" → "Pela sigla PAC"; "texto" → "Pela busca no texto da CID-10". */
export function rotuloMotivo(motivo: string): string {
  if (motivo.startsWith('sigla ')) return `Pela ${motivo}`
  if (motivo.startsWith('termo ')) return `Pelo ${motivo}`
  if (motivo.startsWith('CIAP-2 ')) return `Pela ${motivo}`
  return 'Pela busca no texto da CID-10'
}
