import fs from 'node:fs'
import path from 'node:path'

// ─────────────────────────────────────────────────────────────────────────────
// FASE 3 — Cruzamento diluicao.csv x medicamento (padronização)
// - Encontra medicamento_id pelo princípio ativo normalizado.
// - Registros sem match entram em pendencias.csv com motivo.
// - Todos permanecem status='rascunho', fonte='HU-UFGD_v3', revisor_crf vazio.
// ─────────────────────────────────────────────────────────────────────────────

const DIL = path.resolve('data/diluicao.csv')
const MED = path.resolve('data/medicamento.csv')
const SAIDA = path.resolve('data/diluicao.csv')
const PEND = path.resolve('data/pendencias.csv')

function lerCsv(caminho) {
  const linhas = fs.readFileSync(caminho, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '')
  const header = linhas[0].split(';').map((h) => h.trim())
  return linhas.slice(1).map((l) => {
    const cols = l.split(';').map((c) => c.trim().replace(/^"(.*)"$/, '$1'))
    const obj = {}
    header.forEach((h, i) => (obj[h] = cols[i] ?? ''))
    return obj
  })
}

function normalizar(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const meds = lerCsv(MED)
const dil = lerCsv(DIL)

// índice da padronização: primeiro token do princípio (nome base)
const indice = new Map()
for (const m of meds) {
  const pa = m.principio_ativo_norm || normalizar(m.principio_ativo)
  const primeiroToken = pa.split(' ')[0]
  if (!indice.has(primeiroToken)) indice.set(primeiroToken, [])
  indice.get(primeiroToken).push(m)
}

function casar(nomeDil) {
  const norm = normalizar(nomeDil)
  // tenta casamento exato do primeiro token + substring
  const token = norm.split(' ')[0]
  const candidatos = indice.get(token) || []
  for (const c of candidatos) {
    const paNorm = c.principio_ativo_norm || normalizar(c.principio_ativo)
    if (paNorm.includes(norm) || norm.includes(paNorm)) return c
  }
  // fallback: qualquer token compartilhado
  for (const c of candidatos) {
    const paNorm = c.principio_ativo_norm || normalizar(c.principio_ativo)
    const tokens = norm.split(' ')
    if (tokens.every((t) => t.length > 3 && (paNorm.includes(t) || t.includes(paNorm.split(' ')[0])))) return c
  }
  return null
}

const out = []
const pendencias = []
let casados = 0

for (const d of dil) {
  const match = casar(d.principio_ativo)
  const row = { ...d }
  if (match) {
    row.medicamento_id = `@${match.principio_ativo}` // placeholder: será resolvido no load por principio_ativo
    row.rxcui = match.rxcui
    casados++
  } else {
    row.medicamento_id = ''
    pendencias.push({
      principio_ativo: d.principio_ativo,
      motivo: `sem correspondente na padronização (aguardando inclusão)`,
      fonte: d.fonte,
    })
  }
  out.push(row)
}

const header =
  'medicamento_id;principio_ativo;apresentacao;via;reconstituicao_diluente;reconstituicao_volume_ml;reconstituicao_concentracao;diluicao_solucao;diluicao_volume_min_ml;concentracao_maxima;tempo_infusao_min;velocidade_max;bolus_permitido;estabilidade_ta_h;estabilidade_refrig_h;fotossensivel;acesso;ajuste_renal;ajuste_renal_regra;incompatibilidades;alta_vigilancia;observacoes;fonte;data_revisao;revisor_crf;status;rxcui'
const linhas = [header]
for (const r of out) {
  linhas.push(
    [
      r.medicamento_id, r.principio_ativo, r.apresentacao, r.via, r.reconstituicao_diluente,
      r.reconstituicao_volume_ml, r.reconstituicao_concentracao, r.diluicao_solucao,
      r.diluicao_volume_min_ml, r.concentracao_maxima, r.tempo_infusao_min, r.velocidade_max,
      r.bolus_permitido, r.estabilidade_ta_h, r.estabilidade_refrig_h, r.fotossensivel,
      r.acesso, r.ajuste_renal, r.ajuste_renal_regra, r.incompatibilidades,
      r.alta_vigilancia, r.observacoes, r.fonte, r.data_revisao, r.revisor_crf, r.status, r.rxcui,
    ].join(';')
  )
}
fs.writeFileSync(SAIDA, linhas.join('\n') + '\n', 'utf8')

const pendLinhas = ['principio_ativo;motivo;fonte']
for (const p of pendencias) pendLinhas.push(`${p.principio_ativo};${p.motivo};${p.fonte}`)
fs.writeFileSync(PEND, pendLinhas.join('\n') + '\n', 'utf8')

console.log(`[fase3] diluicoes: ${out.length}`)
console.log(`[fase3] casadas com a padronização: ${casados}`)
console.log(`[fase3] sem correspondente: ${pendencias.length}`)
