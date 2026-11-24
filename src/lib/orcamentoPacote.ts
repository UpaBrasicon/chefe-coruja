// F1 da trilha Desempenho (pedidos 31, 6 e 10 do checklist de 23/11/2026):
// orçamento do JavaScript inicial. Em 09/11 eram 342 KB em gzip; em 23/11,
// 358 KB, sem ninguém ver, porque a guarda `pacoteInicial` só confere a
// configuração do manualChunks, não o tamanho. O script
// `scripts/orcamento-pacote.mjs` lê o `dist/`, aplica o gzip e usa estas
// funções. Por decisão provisória (pergunta P7 ao RT), o CI só avisa.

/** Folga sobre a linha de base antes de avisar (ou falhar): +5%. */
export const FOLGA_PADRAO = 0.05

const atributo = (tag: string, nome: string): string | null => {
  const m = tag.match(new RegExp(`\\s${nome}\\s*=\\s*"([^"]*)"`, 'i'))
  return m ? m[1] : null
}

/**
 * Os `.js` que o navegador baixa ao abrir qualquer tela: os `<script src>` e
 * os `<link rel="modulepreload">` do `index.html`. O `<link rel="prefetch">`
 * fica de fora: é baixado com prioridade baixa, depois da página pronta.
 * Devolve os caminhos sem a barra da frente, na ordem do HTML, sem repetir.
 */
export function jsIniciais(html: string): string[] {
  const vistos = new Set<string>()
  for (const tag of html.match(/<(script|link)\b[^>]*>/gi) ?? []) {
    const ehScript = /^<script/i.test(tag)
    let url: string | null = null
    if (ehScript) url = atributo(tag, 'src')
    else if ((atributo(tag, 'rel') ?? '').toLowerCase() === 'modulepreload') url = atributo(tag, 'href')
    if (!url || /^[a-z]+:\/\//i.test(url) || url.startsWith('//')) continue
    const caminho = url.split(/[?#]/)[0].replace(/^\.?\//, '')
    if (caminho.endsWith('.js')) vistos.add(caminho)
  }
  return [...vistos]
}

export type Avaliacao = {
  total: number
  base: number
  limite: number
  /** variação sobre a base, em fração (0,031 = +3,1%) */
  variacao: number
  passou: boolean
}

/** Compara o total (bytes em gzip) com a base mais a folga. */
export function avaliarOrcamento(total: number, base: number, folga: number = FOLGA_PADRAO): Avaliacao {
  if (!(base > 0)) throw new Error('linha de base inválida')
  const limite = Math.round(base * (1 + folga))
  return { total, base, limite, variacao: total / base - 1, passou: total <= limite }
}
