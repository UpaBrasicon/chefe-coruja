// Conferência do modelo do Power BI contra a API da HOMOLOGAÇÃO (item 8 dos
// achados guardados, B6). Faz o mesmo caminho das consultas de
// docs/api/powerbi/*.pq, usando scripts/powerbi/coruja.mjs:
//   1. lê as unidades da chave;
//   2. busca leitos, atendimentos (janelas de 31 dias), AIH, APAC e
//      fechamentos de cada unidade;
//   3. imprime as contagens e confere que nenhum atendimento se repete entre
//      janelas.
// Só roda com chave de homologação (cc_test_). A chave de produção (cc_live_)
// e o endereço de produção são recusados.
//
// Uso:
//   CORUJA_CHAVE=cc_test_... node scripts/powerbi/conferir.mjs [--dias 90] [--limite 100]
//   ou, em vez de CORUJA_CHAVE, a chave no arquivo scripts/powerbi/.chave-homolog
//   (fora do git).
//   CORUJA_BASE muda o endereço (padrão https://api-homolog.chefecoruja.com.br).
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { janelas, listar } from './coruja.mjs'

const arquivoChave = fileURLToPath(new URL('./.chave-homolog', import.meta.url))
const chave = (process.env.CORUJA_CHAVE ?? (existsSync(arquivoChave) ? readFileSync(arquivoChave, 'utf8') : '')).trim()
const base = (process.env.CORUJA_BASE ?? 'https://api-homolog.chefecoruja.com.br').replace(/\/+$/, '')
const iDias = process.argv.indexOf('--dias')
const dias = iDias > 0 ? Number(process.argv[iDias + 1]) : 90
// --limite N força páginas pequenas, para provar a paginação com poucos dados
const iLim = process.argv.indexOf('--limite')
const limite = String(iLim > 0 ? Number(process.argv[iLim + 1]) : 100)

if (!chave) { console.error('Defina CORUJA_CHAVE ou crie scripts/powerbi/.chave-homolog.'); process.exit(1) }
if (!chave.startsWith('cc_test_')) { console.error('A conferência só roda com chave de homologação (cc_test_).'); process.exit(1) }
if (/\/\/api\.chefecoruja\.com\.br/.test(base) || base.includes('saqjrjtrkzkswsxxvdxn')) {
  console.error('Endereço de produção recusado: a conferência é só na homologação.'); process.exit(1)
}
if (!Number.isInteger(dias) || dias < 1 || dias > 366) { console.error('--dias de 1 a 366.'); process.exit(1) }
if (!/^(100|[1-9][0-9]?)$/.test(limite)) { console.error('--limite de 1 a 100.'); process.exit(1) }

async function buscar(caminho, query) {
  const url = new URL(`${base}/v1/${caminho}`)
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  const r = await fetch(url, { headers: { Authorization: `Bearer ${chave}`, Accept: 'application/json' } })
  const corpo = await r.json().catch(() => null)
  return { status: r.status, retryAfter: Number(r.headers.get('retry-after')) || undefined, corpo }
}

const unidades = await buscar('unidades', {})
if (unidades.status !== 200) { console.error(`unidades: a API respondeu ${unidades.status}.`); process.exit(1) }
console.log(`Endereço: ${base}`)
console.log(`Unidades na chave: ${unidades.corpo.dados.length}`)

const fim = new Date()
const js = janelas(new Date(fim.getTime() - dias * 864e5), fim, 31)
let falhou = false
for (const u of unidades.corpo.dados) {
  const leitos = await listar(buscar, 'leitos', { unidade_id: u.id, limite })
  const atend = []
  for (const j of js) atend.push(...await listar(buscar, 'atendimentos', { unidade_id: u.id, desde: j.desde, ate: j.ate, limite }))
  const repetidos = atend.length - new Set(atend.map((a) => a.id)).size
  const aih = await listar(buscar, 'producao/aih', { unidade_id: u.id, limite })
  const apac = await listar(buscar, 'producao/apac', { unidade_id: u.id, limite })
  const fech = await buscar('producao/fechamentos', { unidade_id: u.id })
  if (repetidos > 0 || fech.status !== 200) falhou = true
  console.log(`- ${u.nome}: ${leitos.length} leitos; ${atend.length} atendimentos em ${dias} dias (${js.length} janelas, ${repetidos} repetidos); ` +
    `${aih.length} AIH; ${apac.length} APAC; fechamentos ${fech.status === 200 ? fech.corpo.dados.length : `erro ${fech.status}`}`)
}
console.log(falhou ? 'CONFERÊNCIA COM PROBLEMA' : 'Conferência ok.')
process.exit(falhou ? 1 : 0)
