import fs from 'node:fs'
import path from 'node:path'

// ─────────────────────────────────────────────────────────────────────────────
// FASE 3 — Parser do guia HU-UFGD v3 (Res. 179/2025) para o schema de diluição.
// Estratégia: extrai blocos separados por número AGHU e preenche os campos do
// schema alvo por heurística de ordem. Todo registro sai como RASCUNHO com
// fonte citada (HU-UFGD/EBSERH). Nada é dado como decisão clínica.
// ─────────────────────────────────────────────────────────────────────────────

const TXT = path.resolve('data/cache/guias/hu_ufgd_v3.txt')
const SAIDA = path.resolve('data/diluicao.csv')
const PEND = path.resolve('data/pendencias.csv')

const texto = fs.readFileSync(TXT, 'utf8')

// Remove cabeçalhos de página repetidos
let limpo = texto
  .replace(/=== PAGINA \d+ ===/g, '')
  .replace(/Tipo do Documento\s*MANUAL.*?P\u00e1gina \d+\/90/g, '')
  .replace(/T\u00edtulo do Documento.*?NO HU-UFGD/g, '')
  .replace(/Emiss\u00e3o:.*?Boletim de Servi\u00e7o n\u00ba \d+ de \d+ de \d+/g, '')
  .replace(/MEDICAMENTO\s*Via de\s*Adm\s*Dose Usual\s*RECONSTITUI\u00c7\u00c3O\s*DILUI\u00c7\u00c3O\s*Ajuste Renal\s*INFORMA\u00c7\u00d5ES\s*IMPORTANTES\s*AGHU\s*Apresenta\u00e7\u00e3o\s*Padronizada\s*Tipo e Volume\s*Estabilidade\s*Tipo da\s*solu\u00e7\u00e3o\s*Volume e\/ou\s*Concentra\u00e7\u00e3o\s*Estabilidade\s*Tempo de\s*Administra\u00e7\u00e3o/g, '')

// Divide em blocos por número AGHU (6 dígitos em linha própria)
const blocos = limpo.split(/\n(?=\s*\d{6}\s*\n)/).filter((b) => /\d{6}/.test(b))
console.error(`[debug] blocos apos split: ${blocos.length}`)

function limpar(s) {
  return (s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizar(s) {
  return limpar(s).toLowerCase()
}

function extrairVia(bloco) {
  const m = bloco.match(/\b(EV|IM|SC|IN|VO|SL|SUBQ|ID)\b/g)
  if (!m) return ''
  return [...new Set(m)].slice(0, 3).join(',')
}

function acharAjusteRenal(bloco) {
  const linhas = bloco.split('\n').map((l) => limpar(l))
  // procura nas linhas após o "tempo de administração" um SIM/NÃO isolado
  const idxTempo = linhas.findIndex((l) => /tempo de admin/i.test(l))
  const regiao = linhas.slice(Math.max(0, idxTempo - 2), idxTempo + 8).join(' ')
  if (/n\u00e3o|nao|n\u00e3o/i.test(regiao)) return 'NÃO'
  if (/ajuste renal.*sim/i.test(regiao) || /sim/i.test(regiao)) return 'SIM'
  return ''
}

function extrairDiluicao(bloco) {
  // procura por soluções de diluição
  const solucoes = []
  if (/SF\s*0?,?9\s*%/.test(bloco)) solucoes.push('SF0.9')
  if (/SG\s*5\s*%/.test(bloco)) solucoes.push('SG5')
  if (/SG\s*10\s*%/.test(bloco)) solucoes.push('SG10')
  if (/Ringer\s*Lactato/.test(bloco)) solucoes.push('RL')
  if (/\bAD\b/.test(bloco)) solucoes.push('AD')
  return [...new Set(solucoes)].join(',')
}

function extrairVolumeDiluicao(bloco) {
  // procura padrões de volume como "250 ou 500 mL", "50mL", "100 mL SF"
  const m = bloco.match(/(\d{2,4})\s*(?:ou\s*(\d{2,4})\s*)?mL/i)
  if (m) return m[2] ? `${m[1]}-${m[2]}` : m[1]
  return ''
}

function extrairTempo(bloco) {
  const t = limpar(bloco)
  const m = t.match(/(\d+)\s*(?:a|e)?\s*(\d+)?\s*(min(?:utos)?|hora?|horas)/i)
  if (m) return m[3].startsWith('min') ? `${m[1]}min` : `${m[1]}h`
  if (/lento/i.test(t)) return 'lento'
  if (/bolus/i.test(t) || /direto/i.test(t)) return 'bolus'
  return ''
}

function extrairNomeBloco(bloco) {
  const linhas = bloco.split('\n').map((l) => l.trim())
  const inicio = linhas.findIndex((l) => /^\d{6}$/.test(l))
  // o nome termina na primeira linha de via de administração isolada (EV, IM, SC, IN, VO, SL)
  const fim = linhas.findIndex(
    (l, i) => i > inicio && /^(EV|IM|SC|IN|VO|SL|SUBQ|ID)([,\s]|$)/i.test(l)
  )
  const nome = []
  for (let i = inicio + 1; i < (fim === -1 ? linhas.length : fim); i++) {
    const l = linhas[i]
    if (/^[A-Za-z0-9 .\/+()\-À-ÿ]+$/u.test(l) && l.length > 1 && !/^\d+$/.test(l)) {
      nome.push(l)
    }
  }
  // remove o fabricante (última linha sem dígito de concentração nem parênteses)
  let partes = nome
  while (partes.length > 1) {
    const ult = partes[partes.length - 1]
    if (/^[A-Z\u00c0-\u00ff .'\/-]+$/u.test(ult) && !/[0-9]/.test(ult) && !/[()]/.test(ult)) {
      partes = partes.slice(0, -1)
    } else break
  }
  return partes.join(' ')
}

const registros = []
const pendencias = []

for (const bloco of blocos) {
  const nomeRaw = extrairNomeBloco(bloco)
  const nome = normalizar(nomeRaw)
  const aghu = (bloco.match(/\b(\d{6})\b/) || [])[1] || ''

  if (!nome) {
    pendencias.push({ aghu, principio: '(não identificado)', motivo: 'parser: bloco sem nome reconhecido' })
    continue
  }

  const via = extrairVia(bloco)
  const diluicao_solucao = extrairDiluicao(bloco)
  const diluicao_volume = extrairVolumeDiluicao(bloco)
  const tempo = extrairTempo(bloco)
  const ajuste_renal_text = acharAjusteRenal(bloco)

  registros.push({
    principio_ativo: nome,
    apresentacao: nomeRaw,
    via,
    reconstituicao_diluente: '',
    reconstituicao_volume_ml: '',
    diluicao_solucao,
    diluicao_volume_min_ml: diluicao_volume,
    tempo_infusao_min: tempo,
    ajuste_renal: ajuste_renal_text === 'SIM' ? 'true' : ajuste_renal_text === 'NÃO' ? 'false' : '',
    observacoes: '',
    fonte: 'HU-UFGD_v3',
    status: 'rascunho',
    aghu,
  })
}

// grava diluicao.csv
const header =
  'principio_ativo;apresentacao;via;reconstituicao_diluente;reconstituicao_volume_ml;reconstituicao_concentracao;diluicao_solucao;diluicao_volume_min_ml;concentracao_maxima;tempo_infusao_min;velocidade_max;bolus_permitido;estabilidade_ta_h;estabilidade_refrig_h;fotossensivel;acesso;ajuste_renal;ajuste_renal_regra;incompatibilidades;alta_vigilancia;observacoes;fonte;data_revisao;revisor_crf;status;aghu'
const linhas = [header]
for (const r of registros) {
  linhas.push(
    [r.principio_ativo, r.apresentacao, r.via, r.reconstituicao_diluente, r.reconstituicao_volume_ml, '', r.diluicao_solucao, r.diluicao_volume_min_ml, '', r.tempo_infusao_min, '', '', '', '', '', '', r.ajuste_renal, '', '', '', r.observacoes, r.fonte, '', '', r.status, r.aghu].join(';')
  )
}
fs.writeFileSync(SAIDA, linhas.join('\n') + '\n', 'utf8')

// grava pendencias.csv
const pendLinhas = ['principio_ativo;motivo;fonte']
for (const p of pendencias) {
  pendLinhas.push(`${p.aghu};${p.principio};${p.motivo}`)
}
fs.writeFileSync(PEND, pendLinhas.join('\n') + '\n', 'utf8')

console.log(`[fase3] blocos extraídos: ${registros.length}`)
console.log(`[fase3] pendencias de parse: ${pendencias.length}`)
console.log(`[fase3] gerado diluicao.csv + pendencias.csv`)
