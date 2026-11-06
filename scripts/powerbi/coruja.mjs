// Item 8 dos achados guardados (A em B1 a B6, 06/11/2026): a lógica das
// consultas do Power BI (docs/api/powerbi/*.pq) em JavaScript, para testar e
// para conferir contra a API da homologação (scripts/powerbi/conferir.mjs).
// Mudou aqui, muda lá: as duas têm de fazer a mesma coisa.

const DIA = 864e5
const MAX_TENTATIVAS = 5

/** Janelas contíguas de até `dias` dias entre inicio e fim; `ate` é exclusivo, como na API. */
export function janelas(inicio, fim, dias = 31) {
  const out = []
  for (let t = inicio.getTime(); t < fim.getTime(); t += dias * DIA) {
    const ate = Math.min(t + dias * DIA, fim.getTime())
    out.push({ desde: new Date(t).toISOString(), ate: new Date(ate).toISOString() })
  }
  return out
}

/**
 * Pagina pelo proximo_cursor e junta os `dados`.
 * buscar(caminho, query) → { status, retryAfter?, corpo }.
 * No 429 espera o Retry-After (segundos) e repete a mesma página, até 5 vezes.
 */
export async function listar(buscar, caminho, filtros, { esperar = (s) => new Promise((r) => setTimeout(r, s * 1000)) } = {}) {
  const dados = []
  let cursor = null
  for (;;) {
    const query = cursor ? { ...filtros, cursor } : { ...filtros }
    let resposta
    for (let tentativa = 0; ; tentativa++) {
      resposta = await buscar(caminho, query)
      if (resposta.status !== 429) break
      if (tentativa + 1 >= MAX_TENTATIVAS) throw new Error(`${caminho}: limite por minuto da chave excedido ${MAX_TENTATIVAS} vezes seguidas.`)
      await esperar(resposta.retryAfter ?? 60)
    }
    if (resposta.status !== 200) {
      throw new Error(`${caminho}: a API respondeu ${resposta.status}${resposta.corpo?.title ? ` (${resposta.corpo.title})` : ''}.`)
    }
    dados.push(...(resposta.corpo.dados ?? []))
    cursor = resposta.corpo.proximo_cursor ?? null
    if (!cursor) return dados
  }
}
