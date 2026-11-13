// Trilha Hermes / Evidências, E6 (decisão do RT de 12/11/2026): a biblioteca
// manda, no fim do stream da pergunta ao modelo, uma linha
// {"type":"uso","modelo":…,"entrada_cache":…,"entrada":…,"saida":…}.
// A Edge grava esses números em clinical_search_logs e não repassa a linha à
// tela. O resto do stream passa como veio.

export type Uso = { modelo: string; tokens_entrada_cache: number; tokens_entrada: number; tokens_saida: number }

const inteiro = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null)

/** A linha é o uso? Devolve os números já no formato da tabela, ou null. */
export function lerUso(linha: string): Uso | null {
  if (!linha.includes('"uso"')) return null
  let j: Record<string, unknown>
  try {
    j = JSON.parse(linha)
  } catch {
    return null
  }
  if (j?.type !== 'uso') return null
  const cache = inteiro(j.entrada_cache)
  const entrada = inteiro(j.entrada)
  const saida = inteiro(j.saida)
  const modelo = typeof j.modelo === 'string' ? j.modelo.slice(0, 80) : ''
  if (cache === null || entrada === null || saida === null || !modelo) return null
  return { modelo, tokens_entrada_cache: cache, tokens_entrada: entrada, tokens_saida: saida }
}

/** Separa as linhas do stream NDJSON: tira a linha do uso e entrega o uso a `gravar`. */
export function semLinhaDeUso(gravar: (uso: Uso) => Promise<void>): TransformStream<Uint8Array, Uint8Array> {
  const dec = new TextDecoder()
  const enc = new TextEncoder()
  let resto = ''
  return new TransformStream({
    async transform(pedaco, controle) {
      resto += dec.decode(pedaco, { stream: true })
      const linhas = resto.split('\n')
      resto = linhas.pop() ?? ''
      for (const l of linhas) {
        const uso = lerUso(l)
        if (uso) await gravar(uso)
        else controle.enqueue(enc.encode(l + '\n'))
      }
    },
    async flush(controle) {
      resto += dec.decode()
      if (!resto) return
      const uso = lerUso(resto)
      if (uso) await gravar(uso)
      else controle.enqueue(enc.encode(resto))
    },
  })
}
