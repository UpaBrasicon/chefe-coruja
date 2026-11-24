// F1 da trilha Desempenho (pedidos 31, 6 e 10; P2 = A): o login em 4G
// esperava o pacote de entrada inteiro para só então pedir o próprio pedaço
// (medido em 23/11/2026 com limite real de rede: `Login-*.js` pedido em
// 3,67 s, LCP 4,75 s). O plugin do vite.config.ts usa esta função para pôr no
// `<head>` do index.html, sem mudar nada na tela:
// - `modulepreload` do pedaço do Login e do que ele importa (o que o Vite já
//   não pré-carrega pela entrada), para descer junto com o pacote de entrada;
// - `preload` da fonte Geist (latin), usada no texto da tela inteira;
// - `prefetch` (prioridade baixa) da casca logada e do que ela importa, que
//   saiu do pacote de entrada: quem já está logado não espera uma ida a mais.

export const FONTE_LOGIN = 'src/pages/Login.tsx'
export const FONTE_CASCA = 'src/components/AppShell.tsx'
export const FONTE_TEXTO = /(^|\/)geist-latin-wght-normal-[^/]*\.woff2$/

type Chunk = {
  type: 'chunk'
  fileName: string
  facadeModuleId: string | null
  isEntry: boolean
  imports: string[]
}
type Item = Chunk | { type: 'asset'; fileName: string }

export type TagPreCarga = {
  tag: 'link'
  attrs: Record<string, string | boolean>
  injectTo: 'head'
}

/** Arquivos (sem a barra da frente) do pedaço e das importações estáticas dele. */
function fechamento(c: Chunk, porArquivo: Map<string, Chunk>, saida = new Set<string>()): Set<string> {
  if (saida.has(c.fileName)) return saida
  saida.add(c.fileName)
  for (const i of c.imports) {
    const d = porArquivo.get(i)
    if (d) fechamento(d, porArquivo, saida)
  }
  return saida
}

export function tagsPreCarga(bundle: Record<string, Item>, base = '/'): TagPreCarga[] {
  const chunks = Object.values(bundle).filter((c): c is Chunk => c.type === 'chunk')
  const porArquivo = new Map(chunks.map((c) => [c.fileName, c]))
  const daFonte = (fonte: string) => chunks.find((c) => (c.facadeModuleId ?? '').replace(/\\/g, '/').endsWith(fonte))

  // o que a entrada já baixa (o Vite põe script e modulepreload dela)
  const naEntrada = new Set<string>()
  for (const c of chunks) if (c.isEntry) fechamento(c, porArquivo, naEntrada)

  const tags: TagPreCarga[] = []
  const link = (attrs: Record<string, string | boolean>) => tags.push({ tag: 'link', attrs, injectTo: 'head' })

  const login = daFonte(FONTE_LOGIN)
  const doLogin = login ? fechamento(login, porArquivo) : new Set<string>()
  for (const f of doLogin) if (!naEntrada.has(f)) link({ rel: 'modulepreload', crossorigin: true, href: base + f })

  const fonte = Object.values(bundle).find((a) => a.type === 'asset' && FONTE_TEXTO.test(a.fileName))
  if (fonte) link({ rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: true, href: base + fonte.fileName })

  const casca = daFonte(FONTE_CASCA)
  if (casca) {
    for (const f of fechamento(casca, porArquivo)) {
      if (!naEntrada.has(f) && !doLogin.has(f)) link({ rel: 'prefetch', crossorigin: true, href: base + f })
    }
  }
  return tags
}
