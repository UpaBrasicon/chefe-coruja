// LG10: gate de aprovação clínica antes de publicar
// (docs/regulatorio/LG10-GATE-APROVACAO-DIAGNOSTICO.md, decisões do RT de
// 17/11/2026, todas A).
//
// Compara as fichas de src/clinico do PR com as da base e:
// - G2 (guarda): falha se ficha, topo, guia ou arquivo de ficha mudou sem
//   versão nova; tela ligada a ficha também, salvo com a linha
//   "Sem mudança clínica: <motivo>" no corpo do PR;
// - G1 (gate): toda ficha com versão nova (ou ficha nova) precisa estar
//   'aprovada' na produção, lida por public.status_versoes_fichas (G6).
//
// Uso: node --experimental-strip-types scripts/gate-fichas.mjs [--base <rev>] [--sem-gate]
//   --base      revisão de comparação (padrão origin/master; o CI passa HEAD^1)
//   --sem-gate  só a guarda, sem consultar a produção (uso local)
// Ambiente: PR_BODY (corpo do PR), GATE_SUPABASE_URL e GATE_SUPABASE_KEY
//   (URL e chave publicável da produção). Sem URL ou chave, o gate falha
//   quando há versão nova: na dúvida, não publica.
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

import { avaliar, conferirAprovacao, ehPacoteClinico, ehTela, fichasUsadas, temDispensa } from './gate-fichas-regras.mjs'

const args = process.argv.slice(2)
const opcao = (nome) => {
  const i = args.indexOf(nome)
  return i >= 0 ? args[i + 1] : undefined
}
const semGate = args.includes('--sem-gate')
const raiz = join(import.meta.dirname, '..')
const git = (...a) => execFileSync('git', a, { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()

const pedida = opcao('--base') ?? 'origin/master'
const base = git('merge-base', pedida, 'HEAD')

// fichas de uma árvore src/clinico: mesmo critério do scripts/fichas-sql.mjs
async function carregar(raizSrc) {
  const dir = join(raizSrc, 'clinico')
  const arquivos = (d) =>
    readdirSync(d).flatMap((a) => {
      const c = join(d, a)
      if (statSync(c).isDirectory()) return arquivos(c)
      return a.endsWith('.ts') && !a.endsWith('.test.ts') ? [c] : []
    })
  const fichas = new Map()
  const modulos = new Map()
  for (const arq of arquivos(dir)) {
    const rel = 'src/' + relative(raizSrc, arq).split(sep).join('/')
    const mod = await import(pathToFileURL(arq).href)
    modulos.set(rel.replace(/^src\/clinico\//, '').replace(/\.ts$/, ''), mod)
    for (const [nome, v] of Object.entries(mod)) {
      if (!v || typeof v !== 'object') continue
      const f = nome.startsWith('ficha') && v.id && v.versao ? v : v.ficha?.id && v.ficha?.versao ? v.ficha : null
      if (!f) continue
      const ja = fichas.get(f.id)
      if (ja && ja.ficha.versao !== f.versao) throw new Error(`ficha ${f.id} com versões diferentes: ${ja.ficha.versao} × ${f.versao}`)
      if (ja) ja.arquivos.includes(rel) || ja.arquivos.push(rel)
      else fichas.set(f.id, { ficha: f, arquivos: [rel] })
    }
  }
  const topos = modulos.get('topos')?.TOPOS ?? {}
  const guias = modulos.get('guias')?.GUIAS ?? {}
  return { fichas, modulos, topos, guias }
}

const tmp = mkdtempSync(join(tmpdir(), 'gate-fichas-'))
let saida = 0
try {
  const tar = execFileSync('git', ['archive', '--format=tar', base, 'src'], { cwd: raiz, maxBuffer: 512 * 1024 * 1024 })
  execFileSync('tar', ['-x', '-f', '-', '-C', tmp], { input: tar })
  const antes = await carregar(join(tmp, 'src'))
  const depois = await carregar(join(raiz, 'src'))

  const mudados = git('diff', '--name-only', base, 'HEAD').split('\n').filter(Boolean)
  const fichasDaTela = new Map()
  for (const arq of mudados.filter((a) => ehTela(a) || ehPacoteClinico(a))) {
    let fonte
    try {
      fonte = readFileSync(join(raiz, arq), 'utf8')
    } catch {
      continue // apagado no PR
    }
    fichasDaTela.set(arq, fichasUsadas(fonte, (m) => depois.modulos.get(m)))
  }

  const r = avaliar({
    base: antes.fichas,
    cabeca: depois.fichas,
    toposBase: antes.topos,
    toposCabeca: depois.topos,
    guiasBase: antes.guias,
    guiasCabeca: depois.guias,
    mudados,
    fichasDaTela,
    dispensa: temDispensa(process.env.PR_BODY),
  })

  let pendentes = []
  if (r.novas.length && !semGate) {
    const url = process.env.GATE_SUPABASE_URL
    const chave = process.env.GATE_SUPABASE_KEY
    if (!url || !chave) {
      pendentes = ['Sem GATE_SUPABASE_URL e GATE_SUPABASE_KEY: o gate não lê a produção e não deixa publicar versão nova.']
    } else {
      const resp = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/status_versoes_fichas`, {
        method: 'POST',
        headers: { apikey: chave, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_itens: r.novas }),
      }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }))
      if (!resp.ok) pendentes = [`A produção não respondeu (${resp.status}): ${(await resp.text()).slice(0, 200)}`]
      else pendentes = conferirAprovacao(r.novas, await resp.json())
    }
  }

  const linhas = [
    `## Gate de aprovação das fichas (LG10)`,
    `Base: ${base.slice(0, 8)} · arquivos mudados: ${mudados.length} · fichas com versão nova: ${r.novas.length}`,
    ...r.novas.map((n) => `- versão nova: ${n.ferramenta_id} ${n.versao}`),
    ...r.erros.map((e) => `- ERRO (guarda): ${e}`),
    ...pendentes.map((e) => `- ERRO (gate): ${e}`),
    ...r.avisos.map((a) => `- aviso: ${a}`),
    semGate && r.novas.length ? '- gate não consultado (--sem-gate)' : '',
    r.erros.length || pendentes.length ? '**Resultado: bloqueado.**' : '**Resultado: liberado.**',
  ].filter(Boolean)
  console.log(linhas.join('\n'))
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, linhas.join('\n') + '\n')
  saida = r.erros.length || pendentes.length ? 1 : 0
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
process.exit(saida)
