// Recarga sem conexão, parte 2, N5 = A (RT, 05/11/2026): as telas que abrem
// sem rede são guardadas de antemão pelo service worker. O build escreve a
// lista em `precache.json` (plugin no vite.config.ts) só com a entrada, estas
// telas e o que elas importam; o resto continua guardado só quando é aberto.

export const FONTES_SEM_CONEXAO = [
  'src/pages/Login.tsx',
  // F1 (Desempenho): a casca logada saiu do pacote de entrada e virou pedaço
  // próprio; sem ela na lista, a recarga sem conexão das telas abaixo quebraria
  'src/components/AppShell.tsx',
  'src/pages/enfermagem/InicioEnfermagem.tsx',
  'src/pages/enfermagem/Triagem.tsx',
  'src/pages/enfermagem/ProntoSocorroEnfermagem.tsx',
  'src/pages/enfermagem/InternacaoEnfermagem.tsx',
  'src/pages/enfermagem/Checagem.tsx',
  // a evolução do médico mora no caderno do leito, na Internação (RT, 24/11/2026:
  // saiu a Evolução clínica do Plantão); a lista e o caderno vêm sob demanda
  'src/pages/plantao/AreaInternacao.tsx',
  'src/pages/plantao/secoes/PacientesInternados.tsx',
]

type Chunk = {
  type: 'chunk'
  fileName: string
  facadeModuleId: string | null
  isEntry: boolean
  imports: string[]
  code?: string
  viteMetadata?: { importedCss: Set<string> }
}
type Item = Chunk | { type: 'asset'; fileName: string }

/** Arquivos (com "/" na frente) da entrada e das telas escolhidas, com o que importam. */
export function listaPrecache(bundle: Record<string, Item>, fontes: string[] = FONTES_SEM_CONEXAO): string[] {
  const chunks = Object.values(bundle).filter((c): c is Chunk => c.type === 'chunk')
  const porArquivo = new Map(chunks.map((c) => [c.fileName, c]))
  const arquivos = new Set<string>()
  const vistos = new Set<string>()
  const visitar = (c: Chunk) => {
    if (vistos.has(c.fileName)) return
    vistos.add(c.fileName)
    // Pedaço só de CSS (ex.: a fonte geist-mono): chega aqui com o código vazio
    // e o Vite o apaga depois deste passo, então o .js não existe no dist e
    // pedia um 404 a cada abertura. Fica só o CSS que ele traz.
    if (c.code === undefined || c.code.trim() !== '') arquivos.add(c.fileName)
    for (const css of c.viteMetadata?.importedCss ?? []) arquivos.add(css)
    for (const i of c.imports) {
      const d = porArquivo.get(i)
      if (d) visitar(d)
    }
  }
  for (const c of chunks) {
    const id = (c.facadeModuleId ?? '').replace(/\\/g, '/')
    if (c.isEntry || fontes.some((f) => id.endsWith(f))) visitar(c)
  }
  return [...arquivos].sort().map((f) => `/${f}`)
}
