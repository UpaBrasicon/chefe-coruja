// IA1 (RT, 24/11/2026): conversa de seguimento na busca com IA. A tela manda,
// junto da pergunta nova, as últimas trocas da sessão (pergunta e resposta
// anteriores, guardadas só na memória da página). Aqui o pedido é lido e
// aparado; a liberação (máscara, resíduo e NER) fica em liberar.ts, como a da
// pergunta. Nada daqui é gravado: o registro continua só com a pergunta atual.

/** No máximo as 2 últimas trocas vão para a biblioteca. */
export const MAX_TROCAS = 2
/** Teto de cada parte: a pergunta tem o mesmo limite da pergunta nova; a resposta é cortada. */
export const MAX_PERGUNTA = 800
export const MAX_RESPOSTA = 1500

export type Troca = { pergunta: string; resposta: string }

/** Tira as citações [n] da resposta anterior: os números eram dos trechos daquela busca. */
export function semCitacoes(texto: string): string {
  return texto.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, '')
}

const enxugar = (s: string) => s.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

/** Lê o campo `historico` do pedido: só as últimas trocas válidas, aparadas. Inválido vira lista vazia. */
export function lerHistorico(bruto: unknown): Troca[] {
  if (!Array.isArray(bruto)) return []
  const trocas: Troca[] = []
  for (const item of bruto.slice(-MAX_TROCAS)) {
    if (!item || typeof item !== 'object') continue
    const { pergunta, resposta } = item as { pergunta?: unknown; resposta?: unknown }
    if (typeof pergunta !== 'string') continue
    const p = enxugar(pergunta)
    if (p.length < 2 || p.length > MAX_PERGUNTA) continue
    const r = typeof resposta === 'string' ? enxugar(semCitacoes(resposta)).slice(0, MAX_RESPOSTA) : ''
    trocas.push({ pergunta: p, resposta: r })
  }
  return trocas
}

/**
 * Primeira linha do stream da Edge que aceita seguimento. A tela só mostra o
 * campo "Perguntar mais sobre isto" quando esta linha chega e a biblioteca
 * também avisa (meta.seguimento); com a Edge ou a biblioteca antigas, fica a
 * pergunta única de antes.
 */
export const LINHA_SEGUIMENTO = JSON.stringify({ type: 'seguimento', aceita: true }) + '\n'

/** Põe `linha` antes do stream que vem da biblioteca. */
export function comAbertura(linha: string): TransformStream<Uint8Array, Uint8Array> {
  return new TransformStream({
    start(controle) {
      controle.enqueue(new TextEncoder().encode(linha))
    },
  })
}
