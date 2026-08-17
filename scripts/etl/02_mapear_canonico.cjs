const fs = require('fs')
const path = require('path')
const { normalizar, nomeBase, nomeInternacional, RXCUI_MANUAL } = require('./sinonimos.cjs')

// ─────────────────────────────────────────────────────────────────────────────
// FASE 1 — Mapeamento de identificação canônica
// Entrada:  data/padronizacao.csv
// Fontes:   ANVISA Dados Abertos (cache local) + RxNorm/RxNav (rxcui)
// Saída:    data/medicamento.csv + data/relatorio_cobertura.txt
//
// Regras inegociáveis:
//  - rxcui buscado via API RxNav (sem chave). Se a rede falhar, usa cache.
//  - Registros sem fonte válida viram PENDENTE (nunca inventar).
//  - SinoBR -> nome internacional p/ buscar no RxNorm (ex.: dipirona -> metamizole).
// ─────────────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..', '..')
const DATA = path.join(ROOT, 'data')
const CACHE = path.join(DATA, 'cache')
const ANVISA_FILE = path.join(CACHE, 'anvisa_medicamentos.csv')
const PADRONIZACAO = path.join(DATA, 'padronizacao.csv')
const SAIDA = path.join(DATA, 'medicamento.csv')
const RELATORIO = path.join(DATA, 'relatorio_cobertura.txt')
const CACHE_RXCUI = path.join(CACHE, 'rxcui_cache.json')

// Lê CSV separado por ';' respeitando aspas simples
function lerCsv(caminho) {
  const linhas = fs.readFileSync(caminho, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '')
  const header = linhas[0].split(';').map((h) => h.trim())
  const dados = linhas.slice(1).map((l) => {
    const cols = l.split(';').map((c) => c.trim().replace(/^"(.*)"$/, '$1'))
    const obj = {}
    header.forEach((h, i) => (obj[h] = cols[i] ?? ''))
    return obj
  })
  return { header, dados }
}

function carregarAnvisa() {
  const { dados } = lerCsv(ANVISA_FILE)
  // índice invertido: cada token do princípio ativo aponta para registros
  const mapa = new Map()
  for (const d of dados) {
    const pa = normalizar(d.PRINCIPIO_ATIVO || d.principio_ativo || '')
    if (!pa) continue
    const reg = (d.NUMERO_REGISTRO_PRODUTO || '').trim()
    const sit = (d.SITUACAO_REGISTRO || '').toLowerCase()
    if (!mapa.has(pa)) mapa.set(pa, [])
    mapa.get(pa).push({
      produto: d.NOME_PRODUTO || '',
      registro: reg,
      ativo: sit.includes('ativo'),
      situacao: d.SITUACAO_REGISTRO || '',
      empresa: d.EMPRESA_DETENTORA_REGISTRO || '',
    })
  }
  return mapa
}

// Busca por casamento progressivo: exato -> contém (o princípio pode ter sufixo,
// ex.: "dipirona" em "dipirona, dipirona monoidratada")
function buscarAnvisa(map, nome) {
  const norm = normalizar(nome)
  if (!norm) return []
  if (map.has(norm)) return map.get(norm)
  const hits = []
  for (const [chave, lista] of map) {
    const termos = chave.split(' ').filter(Boolean)
    if (termos.every((t) => norm.includes(t))) {
      hits.push(...lista)
    } else if (norm.split(' ').every((t) => chave.includes(t))) {
      hits.push(...lista)
    }
  }
  return hits
}

async function buscarRxcui(nomeBR, cache) {
  const base = nomeBase(nomeBR)
  if (cache[base]) return cache[base]
  if (RXCUI_MANUAL[base]) {
    cache[base] = RXCUI_MANUAL[base]
    return RXCUI_MANUAL[base]
  }
  const internacional = nomeInternacional(nomeBR)
  const url = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(internacional)}&search=1`
  let rxcui = null
  try {
    const res = await fetch(url)
    if (res.ok) {
      const j = await res.json()
      const id = j.idGroup?.rxnormId
      rxcui = Array.isArray(id) ? id[0] : id || null
    }
  } catch {
    rxcui = null // rede caiu -> pendente
  }
  cache[base] = rxcui
  return rxcui
}

async function main() {
  const pad = lerCsv(PADRONIZACAO)
  const anvisa = carregarAnvisa()

  let cache = {}
  if (fs.existsSync(CACHE_RXCUI)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_RXCUI, 'utf8'))
    } catch {
      cache = {}
    }
  }

  const out = []
  let comAnvisa = 0
  let comRxcui = 0
  let semAnvisa = 0
  let semRxcui = 0
  const pendencias = []

  for (const item of pad.dados) {
    const pa = item.principio_ativo
    const norm = normalizar(pa)
    const anvisaHits = buscarAnvisa(anvisa, pa)
    const ativosAnvisa = anvisaHits.filter((h) => h.ativo)
    const rxcui = await buscarRxcui(pa, cache)

    const registro = ativosAnvisa.length > 0 ? ativosAnvisa[0] : anvisaHits[0]

    const row = {
      principio_ativo: pa,
      principio_ativo_norm: norm,
      apresentacao: item.apresentacao,
      concentracao: item.concentracao,
      setor_uso: item.setor_uso,
      rxcui: rxcui ?? '',
      anvisa_registro: registro?.registro ?? '',
      anvisa_produto: registro?.produto ?? '',
      anvisa_situacao: registro?.situacao ?? '',
      anvisa_empresa: registro?.empresa ?? '',
      anvisa_ativos: ativosAnvisa.length,
      status: '',
    }

    if (rxcui) {
      comRxcui++
      row.status += 'rxcui_ok '
    } else {
      semRxcui++
      pendencias.push({ principio: pa, motivo: 'rxcui: nome internacional não encontrado no RxNorm' })
    }
    if (registro) {
      comAnvisa++
      row.status += 'anvisa_ok '
    } else {
      semAnvisa++
      pendencias.push({ principio: pa, motivo: 'anvisa: princípio ativo não localizado em DADOS_ABERTOS_MEDICAMENTOS' })
    }

    row.status = row.status.trim() || 'pendente'
    out.push(row)
  }

  // grava cache rxcui
  fs.writeFileSync(CACHE_RXCUI, JSON.stringify(cache, null, 2))

  // escreve medicamento.csv (header em pt, com fonte)
  const header = 'principio_ativo;principio_ativo_norm;apresentacao;concentracao;setor_uso;rxcui;anvisa_registro;anvisa_produto;anvisa_situacao;anvisa_empresa;anvisa_ativos;status'
  const linhas = [header, ...out.map((r) =>
    [r.principio_ativo, r.principio_ativo_norm, r.apresentacao, r.concentracao, r.setor_uso,
      r.rxcui, r.anvisa_registro, r.anvisa_produto, r.anvisa_situacao, r.anvisa_empresa, r.anvisa_ativos, r.status]
      .join(';')
  )]
  fs.writeFileSync(SAIDA, linhas.join('\n') + '\n', 'utf8')

  const total = out.length
  const rel = [
    `RELATÓRIO DE COBERTURA — FASE 1`,
    `Gerado em: ${new Date().toISOString()}`,
    `Total de itens da padronização: ${total}`,
    ``,
    `  ANVISA (DADOS_ABERTOS_MEDICAMENTOS): ${comAnvisa} casados / ${semAnvisa} pendentes`,
    `  RxNorm (rxcui):                        ${comRxcui} casados / ${semRxcui} pendentes`,
    `  Ambos:                                 ${out.filter((r) => r.rxcui && r.anvisa_registro).length}`,
    `  Só ANVISA:                             ${out.filter((r) => r.rxcui && !r.anvisa_registro).length}`,
    `  Nenhum (pendente):                     ${out.filter((r) => !r.rxcui && !r.anvisa_registro).length}`,
    ``,
    `PENDÊNCIAS:`,
  ]
  const unicos = new Map()
  for (const p of pendencias) {
    const k = p.motivo.split(':')[0]
    if (!unicos.has(k)) unicos.set(k, [])
    unicos.get(k).push(p.principio)
  }
  for (const [motivo, itens] of unicos) {
    rel.push(`  - ${motivo}: ${itens.length} item(ns)`)
    rel.push(`      ${itens.join(', ')}`)
  }
  fs.writeFileSync(RELATORIO, rel.join('\n') + '\n', 'utf8')

  console.log(rel.join('\n'))
}

main().catch((e) => {
  console.error('ERRO:', e.message)
  process.exit(1)
})

