// Recarga sem conexão, parte 2, N5 = A (RT, 05/11/2026): as telas que abrem
// sem rede são guardadas de antemão pelo service worker. O build escreve a
// lista em `precache.json` (plugin no vite.config.ts) só com a entrada, estas
// telas e o que elas importam; o resto continua guardado só quando é aberto.

export const FONTES_SEM_CONEXAO = [
  'src/pages/Login.tsx',
  'src/pages/enfermagem/InicioEnfermagem.tsx',
  'src/pages/enfermagem/Triagem.tsx',
  'src/pages/enfermagem/ProntoSocorroEnfermagem.tsx',
  'src/pages/enfermagem/InternacaoEnfermagem.tsx',
  'src/pages/enfermagem/Checagem.tsx',
  // a evolução abre pela ferramenta do plantão (plantaoRegistry, sob demanda)
  'src/pages/plantao/PlantaoToolRouter.tsx',
  'src/pages/plantao/secoes/EvolucaoTool.tsx',
]

type Chunk = {
  type: 'chunk'
  fileName: string
  facadeModuleId: string | null
  isEntry: boolean
  imports: string[]
  viteMetadata?: { importedCss: Set<string> }
}
type Item = Chunk | { type: 'asset'; fileName: string }

/** Arquivos (com "/" na frente) da entrada e das telas escolhidas, com o que importam. */
export function listaPrecache(bundle: Record<string, Item>, fontes: string[] = FONTES_SEM_CONEXAO): string[] {
  const chunks = Object.values(bundle).filter((c): c is Chunk => c.type === 'chunk')
  const porArquivo = new Map(chunks.map((c) => [c.fileName, c]))
  const arquivos = new Set<string>()
  const visitar = (c: Chunk) => {
    if (arquivos.has(c.fileName)) return
    arquivos.add(c.fileName)
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
