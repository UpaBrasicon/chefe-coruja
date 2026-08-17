import fs from 'node:fs'
import path from 'node:path'

// ─────────────────────────────────────────────────────────────────────────────
// FASE 3 — Relatório de pendências por campo (campo null -> motivo)
// Critério de aceite: 100% dos campos de diluição sem fonte documentados.
// ─────────────────────────────────────────────────────────────────────────────

const DIL = path.resolve('data/diluicao.csv')
const SAIDA = path.resolve('data/pendencias.csv')

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

const dil = lerCsv(DIL)

const campos = [
  ['reconstituicao_diluente', 'reconstituição não informada no guia para esta apresentação'],
  ['reconstituicao_volume_ml', 'volume de reconstituição não informado no guia'],
  ['reconstituicao_concentracao', 'concentração de reconstituição não informada'],
  ['diluicao_solucao', 'solução de diluição não informada no guia (via não é EV ou sem diluição)'],
  ['diluicao_volume_min_ml', 'volume de diluição não capturado pelo parser'],
  ['concentracao_maxima', 'concentração máxima não informada no guia'],
  ['tempo_infusao_min', 'tempo de infusão não informado ou administração em bolus'],
  ['velocidade_max', 'velocidade máxima não capturada pelo parser'],
  ['estabilidade_ta_h', 'estabilidade à temperatura ambiente não informada'],
  ['estabilidade_refrig_h', 'estabilidade refrigerada não informada'],
  ['fotossensivel', 'fotossensibilidade não informada'],
  ['acesso', 'tipo de acesso (periférico/central) não informado'],
  ['ajuste_renal_regra', 'regra de ajuste renal não capturada (campo ajuste_renal vazio)'],
  ['incompatibilidades', 'incompatibilidades não informadas'],
]

const out = []
let totalNull = 0

for (const d of dil) {
  for (const [campo, motivo] of campos) {
    const v = d[campo]
    if (v === undefined || v === '') {
      out.push({
        principio_ativo: d.principio_ativo,
        campo,
        motivo,
        fonte: d.fonte || 'HU-UFGD_v3',
      })
      totalNull++
    }
  }
}

const linhas = ['principio_ativo;campo;motivo;fonte']
for (const p of out) {
  linhas.push(`${p.principio_ativo};${p.campo};${p.motivo};${p.fonte}`)
}
fs.writeFileSync(SAIDA, linhas.join('\n') + '\n', 'utf8')

console.log(`[fase3] registros de diluição: ${dil.length}`)
console.log(`[fase3] campos null documentados: ${totalNull}`)
console.log(`[fase3] pendencias.csv regenerado com ${out.length} linhas`)
