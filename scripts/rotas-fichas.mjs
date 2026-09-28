// Regenera src/clinico/indice.ts (ficha → rota da Central) a partir do registry:
// para cada ferramenta, abre a tela, acha o `ficha={X}` / `escore={X}` do
// componente exportado e resolve o id da ficha no módulo de src/clinico.
// Uso: node --experimental-strip-types scripts/rotas-fichas.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const raiz = join(import.meta.dirname, '..')
const registry = readFileSync(join(raiz, 'src/content/registry.tsx'), 'utf8')

const rotas = {}
const secoes = [...registry.matchAll(/slug: '([a-z0-9-]+)',\r?\n\s+label:/g)].map((m) => ({ slug: m[1], pos: m.index }))
const ferramentas = [...registry.matchAll(/t\('([a-z0-9-]+)',[^\n]*?import\('@\/pages\/([\w/]+)'\), '(\w+)'\)/g)]

for (const f of ferramentas) {
  const secao = secoes.filter((s) => s.pos < f.index).at(-1).slug
  const arq = join(raiz, 'src/pages', f[2] + '.tsx')
  if (!existsSync(arq)) continue
  const src = readFileSync(arq, 'utf8')
  // corpo do componente exportado (até o próximo export)
  const ini = src.search(new RegExp(`export (function|const) ${f[3]}\\b`))
  if (ini < 0) continue
  const resto = src.slice(ini + 1)
  const fim = resto.search(/\r?\nexport /)
  const corpo = fim < 0 ? resto : resto.slice(0, fim)
  // invólucro (ex.: DrogasVasoativas = () => <InfusoesAdulto grupo=… />): a ficha está no arquivo
  const alvo = corpo.match(/(?:ficha|escore)=\{(\w+)\}/)?.[1] ?? src.match(/(?:ficha|escore)=\{(\w+)\}/)?.[1]
  if (!alvo) continue
  const imp = src.match(new RegExp(`import \\{[^}]*\\b${alvo}\\b[^}]*\\} from '@/clinico/([\\w/]+)'`))
  if (!imp) continue
  const mod = await import(pathToFileURL(join(raiz, 'src/clinico', imp[1] + '.ts')).href)
  const v = mod[alvo]
  const id = v?.ficha?.id ?? v?.id
  if (id && !rotas[id]) rotas[id] = `/plantonista/${secao}/${f[1]}`
}

const linhas = Object.keys(rotas).sort().map((k) => `  '${k}': '${rotas[k]}',`)
writeFileSync(
  join(raiz, 'src/clinico/indice.ts'),
  `// Gerado por scripts/rotas-fichas.mjs a partir do registry. Não editar à mão.\n// Onde cada ficha do pacote aparece no app (para a Revisão Clínica abrir a tela).\nexport const ROTA_DA_FICHA: Record<string, string> = {\n${linhas.join('\n')}\n}\n`,
)
console.log(`${linhas.length} fichas com rota`)
