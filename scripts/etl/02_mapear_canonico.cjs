const fs = require('fs')
const path = require('path')

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

// Sinonímia BR -> nome internacional (RxNorm). Só para BUSCA no RxNorm; a
// apresentação/diluição continua dependente da fonte clínica (bula ANVISA).
const SINONIMIA = {
  adrenalina: 'epinephrine',
  noradrenalina: 'norepinephrine',
  dipirona: 'metamizole',
  'dipirona (gotas)': 'metamizole',
  'dipirona (ampola)': 'metamizole',
  acetilcisteina: 'acetylcysteine',
  'acido folico': 'folic acid',
  'acido aminocaproico': 'aminocaproic acid',
  amicacina: 'amikacin',
  amiodarona: 'amiodarone',
  anlodipino: 'amlodipine',
  atracurio: 'atracurium',
  bicarbonato: 'sodium bicarbonate',
  carbamazepina: 'carbamazepine',
  ceftazidima: 'ceftazidime',
  cefuroxima: 'cefuroxime',
  cetamina: 'ketamine',
  cetorolaco: 'ketorolac',
  cetoprofeno: 'ketoprofen',
  cianocobalamina: 'cyanocobalamin',
  ciprofloxacino: 'ciprofloxacin',
  cisatracurio: 'cisatracurium',
  clopidogrel: 'clopidogrel',
  codeina: 'codeine',
  desmopressina: 'desmopressin',
  dexametasona: 'dexamethasone',
  digoxina: 'digoxin',
  diltiazem: 'diltiazem',
  dobutamina: 'dobutamine',
  doxorrubicina: 'doxorubicin',
  enalapril: 'enalapril',
  enoxaparina: 'enoxaparin',
  ertapenem: 'ertapenem',
  escopolamina: 'scopolamine',
  esmolol: 'esmolol',
  esomeprazol: 'esomeprazole',
  espironolactona: 'spironolactone',
  fentanila: 'fentanyl',
  fenitoina: 'phenytoin',
  fenobarbital: 'phenobarbital',
  fenoterol: 'fenoterol',
  fitomenadiona: 'phytonadione',
  fluconazol: 'fluconazole',
  furosemida: 'furosemide',
  ganciclovir: 'ganciclovir',
  gentamicina: 'gentamicin',
  glicose: 'glucose',
  glucagon: 'glucagon',
  haloperidol: 'haloperidol',
  hidralazina: 'hydralazine',
  'hidroclorotiazida': 'hydrochlorothiazide',
  hidrocortisona: 'hydrocortisone',
  ipratropio: 'ipratropium',
  levetiracetam: 'levetiracetam',
  levofloxacino: 'levofloxacin',
  linezolida: 'linezolid',
  lorazepam: 'lorazepam',
  losartana: 'losartan',
  meropenem: 'meropenem',
  metformina: 'metformin',
  metilprednisolona: 'methylprednisolone',
  metoclopramida: 'metoclopramide',
  metoprolol: 'metoprolol',
  metronidazol: 'metronidazole',
  midazolam: 'midazolam',
  milrinona: 'milrinone',
  misoprostol: 'misoprostol',
  morfina: 'morphine',
  naloxona: 'naloxone',
  nitrofurantoina: 'nitrofurantoin',
  nitroglicerina: 'nitroglycerin',
  nifedipino: 'nifedipine',
  noradrenalina: 'norepinephrine',
  octreotida: 'octreotide',
  ocitocina: 'oxytocin',
  omeprazol: 'omeprazole',
  ondansetrona: 'ondansetron',
  oseltamivir: 'oseltamivir',
  oxacilina: 'oxacillin',
  pantoprazol: 'pantoprazole',
  paracetamol: 'acetaminophen',
  piperacilina: 'piperacillin',
  prometazina: 'promethazine',
  propofol: 'propofol',
  protamina: 'protamine',
  ranitidina: 'ranitidine',
  rocuronio: 'rocuronium',
  salbutamol: 'albuterol',
  sulfametoxazol: 'sulfamethoxazole',
  teofilina: 'theophylline',
  tramadol: 'tramadol',
  tranexamico: 'tranexamic acid',
  valproato: 'valproic acid',
  vancomicina: 'vancomycin',
  vasopressina: 'vasopressin',
  verapamil: 'verapamil',
  nitroprussiato: 'nitroprusside',
  'soro fisiologico': 'sodium chloride',
  'soro glicofisiologico': 'sodium chloride / dextrose',
  'ringer lactato': 'lactated ringer',
  'albumina humana': 'albumin human',
  'heparina nao fracionada': 'heparin',
  'cloreto de potassio': 'potassium chloride',
  'fosfato de potassio': 'potassium phosphate',
  'sulfato de magnesio': 'magnesium sulfate',
  'gluconato de calcio': 'calcium gluconate',
  'cloreto de calcio': 'calcium chloride',
  'bicarbonato de sodio': 'sodium bicarbonate',
  'cloreto de sodio': 'sodium chloride',
  glicose: 'glucose',
  'carvao ativado': 'charcoal activated',
  dimenidrinato: 'dimenhydrinate',
  sulbactam: 'sulbactam',
  amoxicilina: 'amoxicillin',
  'amoxicilina clavulanato': 'amoxicillin / clavulanate',
  'amoxicilina sulbactam': 'amoxicillin / clavulanate',
  'ampicilina sulbactam': 'ampicillin / sulbactam',
  'ampicilina': 'ampicillin',
  'piperacilina tazobactam': 'piperacillin / tazobactam',
  'imipenem cilastatina': 'imipenem / cilastatin',
  'sulfametoxazol trimetoprima': 'sulfamethoxazole / trimethoprim',
  'anfotericina b desoxicolato': 'amphotericin b',
  'anfotericina b lipossomal': 'amphotericin b',
  'insulina nph': 'insulin isophane',
  'acido acetilsalicilico': 'aspirin',
  aas: 'aspirin',
  'sulfato ferroso': 'ferrous sulfate',
  hidroxiureia: 'hydroxyurea',
  colistina: 'colistin',
  'acido aminocaproico': 'aminocaproic acid',
  rimantadina: 'rimantadine',
  warfarina: 'warfarin',
  levotiroxina: 'levothyroxine',
  oseltamivir: 'oseltamivir',
}

// rxcui canônicos verificados via RxNorm (nome -> rxcui), para casos onde o
// princípio não é um fármaco (soros/soluções) e o RxNav não resolve por nome.
const RXCUI_MANUAL = {
  'soro fisiologico': '9863', // sodium chloride
  'soro glicofisiologico': '20623', // sodium chloride 0.9% / dextrose 5%
  'ringer lactato': '2877', // lactated ringers
  'nitroprussiato de sodio': '7476', // nitroprusside
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

// Extrai o nome base antes de parênteses/colchetes e remove tokens numéricos de
// concentração (ex.: "Cloreto de potassio 10%" -> "cloreto de potassio")
function nomeBase(s) {
  const semParenteses = (s || '').replace(/[\(\[].*?[\)\]]/g, '').replace(/\s+/g, ' ').trim()
  const semNumeros = semParenteses
    .split(' ')
    .filter((tok) => !/^[0-9.,/%]+$/.test(tok))
    .join(' ')
  return normalizar(semNumeros)
}

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
  const internacional = SINONIMIA[base] ?? base
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
