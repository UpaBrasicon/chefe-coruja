import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto, pagina } from './fonte.ts'

// Anticoagulação e fibrinólise do adulto — Manual de Medicina de Emergência do
// HCFMUSP (3ª ed., 2022): cap. 13 IAM sem supra (p. 207), cap. 14 IAM com
// supra (p. 218–219), cap. 25 TVP (p. 352–353) e cap. 32 TEP (p. 441–443).
// Doses por peso, ajuste renal/idade quando o capítulo traz, e o nomograma de
// TTPA da Tabela 7 (p. 442). O livro não traz diluição da heparina EV: a
// conversão para mL/h só acontece com a concentração do preparo informada por
// quem usa. A indicação é do médico (ADR 0007).
//
// Versão .1 de 28/09/2026 (fibrinolíticos e anticoagulação plena): AHA/ACC
// 2025 e ESC 2023 da SCA (PDFs lidos) e Diretriz Brasileira de Dor Torácica
// 2025 (PDF lido) ao lado do manual. Páginas de periódico calculadas a partir
// da página do PDF (AHA: e771 = p. 1; ESC: 3720 = p. 1).

export const AHA_SCA_2025: Fonte = {
  citacao: 'Rao SV, O\'Donoghue ML, Ruel M, et al. 2025 ACC/AHA/ACEP/NAEMSP/SCAI Guideline for the Management of Patients With Acute Coronary Syndromes. Circulation. 2025;151:e771–e862. Tabela de anticoagulantes (e795), Tabela 13 dos fibrinolíticos (e806), transfusão (e822), tempo ao dispositivo (e782).',
  url: 'https://doi.org/10.1161/CIR.0000000000001309',
}

export const ESC_SCA_2023: Fonte = {
  citacao: 'Byrne RA, Rossello X, Coughlan JJ, et al. 2023 ESC Guidelines for the management of acute coronary syndromes. Eur Heart J. 2023;44(38):3720–3826. O2 (p. 3744–3745), ICP de resgate (p. 3746), fibrinólise em 10 min (p. 3749), anticoagulantes (p. 3751), meia dose de tenecteplase (p. 3762).',
  url: 'https://doi.org/10.1093/eurheartj/ehad191',
}

export const SBC_DOR_TORACICA_2025: Fonte = {
  citacao: 'de Barros e Silva PGM, Soeiro AM, Ornelas CE, et al. Diretriz Brasileira de Atendimento à Dor Torácica na Unidade de Emergência – 2025. Arq Bras Cardiol. 2025;122(9):e20250620. ECG em 10 min (p. 15), HEART preferencial (p. 29–30), troponina e CK-MB (p. 37).',
  url: 'https://doi.org/10.36660/abc.20250620',
}

export type Faixa = [number, number]

const valido = (x: number) => Number.isFinite(x) && x > 0

// ── Heparina não fracionada EV (cap. 32, p. 442) ─────────────────────────────

export const fichaHnfAdulto = fichaAdulto(
  'adulto-heparina-nao-fracionada',
  'Heparina não fracionada EV — adulto',
  'cap. 32 Tromboembolismo pulmonar, p. 442 (dose e Tabela 7, adaptada de Raschke et al., 1996)',
)

export const HNF_EV = { bolusUIKg: 80, infusaoUIKgH: 18, pagina: 'p. 442' }

export function inicioHnf(pesoKg: number): { bolusUI: number; infusaoUIH: number } | null {
  if (!valido(pesoKg)) return null
  return { bolusUI: HNF_EV.bolusUIKg * pesoKg, infusaoUIH: HNF_EV.infusaoUIKgH * pesoKg }
}

export type LinhaNomograma = {
  faixa: string
  /** limite superior em segundos: exclusivo na 1ª linha (< 35), inclusivo nas demais */
  ate: number
  novoBolusUIKg: number | null
  pararMin: number
  deltaUIKgH: number
}

/**
 * Tabela 7 (p. 442). O livro dá faixas inteiras (35-45, 46-70, 71-90); um
 * TTPA fracionado entre elas (p. ex. 45,5 s) cai na faixa seguinte (46–70 s) — a leitura
 * é por "até X segundos".
 */
export const NOMOGRAMA_TTPA: LinhaNomograma[] = [
  { faixa: '< 35 s', ate: 35, novoBolusUIKg: 80, pararMin: 0, deltaUIKgH: 4 },
  { faixa: '35–45 s', ate: 45, novoBolusUIKg: 40, pararMin: 0, deltaUIKgH: 2 },
  { faixa: '46–70 s', ate: 70, novoBolusUIKg: null, pararMin: 0, deltaUIKgH: 0 },
  { faixa: '71–90 s', ate: 90, novoBolusUIKg: null, pararMin: 0, deltaUIKgH: -2 },
  { faixa: '> 90 s', ate: Infinity, novoBolusUIKg: null, pararMin: 60, deltaUIKgH: -3 },
]

export type AjusteHnf = {
  linha: LinhaNomograma
  novoBolusUI: number | null
  novaInfusaoUIKgH: number
  novaInfusaoUIH: number
}

/** Ajuste pela Tabela 7 a partir do TTPA (s), do peso e da infusão atual (UI/kg/h). */
export function ajustarHnf(ttpaS: number, pesoKg: number, infusaoAtualUIKgH: number): AjusteHnf | null {
  if (!valido(ttpaS) || !valido(pesoKg) || !Number.isFinite(infusaoAtualUIKgH) || infusaoAtualUIKgH < 0) return null
  const linha = ttpaS < 35 ? NOMOGRAMA_TTPA[0] : NOMOGRAMA_TTPA.slice(1).find((l) => ttpaS <= l.ate)!
  const nova = Math.max(0, infusaoAtualUIKgH + linha.deltaUIKgH)
  return {
    linha,
    novoBolusUI: linha.novoBolusUIKg === null ? null : linha.novoBolusUIKg * pesoKg,
    novaInfusaoUIKgH: nova,
    novaInfusaoUIH: nova * pesoKg,
  }
}

/** mL/h para UI/h numa concentração informada pelo usuário (o livro não traz a diluição). */
export function mlHDeUIH(uiH: number, uiPorMl: number): number | null {
  if (!Number.isFinite(uiH) || uiH < 0 || !valido(uiPorMl)) return null
  return uiH / uiPorMl
}

// ── Anticoagulação plena por peso (caps. 13, 14, 25 e 32) ────────────────────

const PAG_ANTICOAG = 'cap. 13 IAM sem supra, p. 207; cap. 14 IAM com supra, p. 219; cap. 25 TVP, p. 352–353; cap. 32 TEP, p. 441–443'

export const fichaAnticoagulacaoPlenaAdulto: Ficha = {
  ...fichaAdulto('adulto-anticoagulacao-plena', 'Anticoagulação plena por peso — adulto', PAG_ANTICOAG),
  versao: '2026-09-28.1',
  fontes: [pagina(PAG_ANTICOAG), AHA_SCA_2025, ESC_SCA_2023],
  revisadoEm: '28/09/2026 (AHA/ACC 2025 e ESC 2023 lidas no texto; manual mantido como base)',
}

/** AHA/ACC 2025 (tabela de anticoagulantes, e795): enoxaparina com fibrinolítico — tetos e regra renal única. */
export const ENOXAPARINA_LITICO_2025 = { bolusMg: 30, mgKg12h: 1, tetoMg: 100, idosoMgKg12h: 0.75, idosoTetoMg: 75, idadeCorte: 75, clcrCorte: 30, pagina: 'AHA/ACC 2025, e795' }

export function enoxaparinaLitico2025(pesoKg: number, idadeAnos?: number, clcr?: number): { bolusMg: number | null; doseMg: number; intervalo: string; noTeto: boolean; regra: string } | null {
  if (!valido(pesoKg)) return null
  const e = ENOXAPARINA_LITICO_2025
  if (clcr !== undefined && Number.isFinite(clcr) && clcr >= 0 && clcr < e.clcrCorte) return { bolusMg: null, doseMg: e.mgKg12h * pesoKg, intervalo: '1 vez ao dia SC', noTeto: false, regra: 'ClCr < 30 mL/min, em qualquer idade: 1 mg/kg SC a cada 24 h' }
  const idoso = idadeAnos !== undefined && Number.isFinite(idadeAnos) && idadeAnos >= e.idadeCorte
  if (idoso) { const d = e.idosoMgKg12h * pesoKg; return { bolusMg: null, doseMg: Math.min(d, e.idosoTetoMg), intervalo: '12/12 h SC', noTeto: d > e.idosoTetoMg, regra: '≥ 75 anos: sem bolus, 0,75 mg/kg 12/12 h (máx. 75 mg nas 2 primeiras doses)' } }
  const d = e.mgKg12h * pesoKg
  return { bolusMg: e.bolusMg, doseMg: Math.min(d, e.tetoMg), intervalo: '12/12 h SC', noTeto: d > e.tetoMg, regra: '< 75 anos: 30 mg IV e, 15 min depois, 1 mg/kg SC 12/12 h (máx. 100 mg nas 2 primeiras doses)' }
}

/** AHA/ACC 2025 (e795): HNF com fibrinolítico — 60 UI/kg (máx. 4.000) e 12 UI/kg/h (máx. 1.000 UI/h) para TTPa 60–80 s. ESC 2023 (p. 3751): 70–100 U/kg no tratamento inicial. */
export const HNF_LITICO_2025 = { bolusUiKg: 60, bolusMaxUi: 4000, infusaoUiKgH: 12, infusaoMaxUiH: 1000, ttpaS: [60, 80] as Faixa, pagina: 'AHA/ACC 2025, e795' }

export function hnfLitico2025(pesoKg: number): { bolusUi: number; bolusNoTeto: boolean; infusaoUiH: number; infusaoNoTeto: boolean } | null {
  if (!valido(pesoKg)) return null
  const b = HNF_LITICO_2025.bolusUiKg * pesoKg
  const i = HNF_LITICO_2025.infusaoUiKgH * pesoKg
  return { bolusUi: Math.min(b, HNF_LITICO_2025.bolusMaxUi), bolusNoTeto: b > HNF_LITICO_2025.bolusMaxUi, infusaoUiH: Math.min(i, HNF_LITICO_2025.infusaoMaxUiH), infusaoNoTeto: i > HNF_LITICO_2025.infusaoMaxUiH }
}

export const DIFERENCAS_ANTICOAG_2025: string[] = [
  'Enoxaparina com lítico: o manual (p. 219) dá bolus 30 mg e 1 mg/kg 12/12 h (0,75 mg/kg sem bolus > 75 anos; 1 mg/kg 1×/dia com ClCr 15–30) sem teto; a AHA/ACC 2025 acrescenta os tetos de 100 mg e 75 mg nas duas primeiras doses e fixa "ClCr < 30 em qualquer idade → 1 mg/kg 1×/dia", o que resolve a dúvida sobre combinar idade e função renal.',
  'IAM sem supra: o manual não traz ajuste renal (p. 207); a ESC 2023 reduz para 1 mg/kg 1×/dia com ClCr < 30 (p. 3751) e a AHA 2025 idem (e795).',
  'HNF: o manual usa 80 U/kg + 18 U/kg/h no TEP (p. 442); com fibrinolítico a AHA 2025 usa 60 UI/kg (máx. 4.000) + 12 UI/kg/h (máx. 1.000); a ESC 2023 dá 70–100 U/kg no tratamento inicial da SCA.',
]

export type ContextoEnoxaparina = 'iamsst' | 'iamcsst-trombolise' | 'tep-12h' | 'tep-1x' | 'tvp'

export const CONTEXTOS_ENOXAPARINA: Record<ContextoEnoxaparina, { rotulo: string; pagina: string }> = {
  iamsst: { rotulo: 'IAM sem supra — manejo conservador', pagina: 'cap. 13, p. 207' },
  'iamcsst-trombolise': { rotulo: 'IAM com supra — após trombólise', pagina: 'cap. 14, p. 219' },
  'tep-12h': { rotulo: 'TEP — 12/12 h', pagina: 'cap. 32, p. 441–442' },
  'tep-1x': { rotulo: 'TEP — 1 vez ao dia', pagina: 'cap. 32, p. 441–442' },
  tvp: { rotulo: 'TVP — 1 vez ao dia', pagina: 'cap. 25, p. 352' },
}

export type Enoxaparina = {
  /** null quando o capítulo não traz dose para a situação */
  doseMg: number | null
  intervalo: string
  bolusEvMg: number | null
  observacoes: string[]
}

export type DadosEnoxaparina = { pesoKg: number; idadeAnos?: number; clcr?: number; estreptoquinase?: boolean }

export function enoxaparina(ctx: ContextoEnoxaparina, d: DadosEnoxaparina): Enoxaparina | null {
  const { pesoKg, idadeAnos, clcr } = d
  if (!valido(pesoKg)) return null
  const temClcr = clcr !== undefined && Number.isFinite(clcr) && clcr >= 0
  if (ctx === 'iamsst') {
    return { doseMg: pesoKg, intervalo: '12/12 h SC', bolusEvMg: null, observacoes: ['O capítulo não traz ajuste renal nem por idade para este uso.', 'Evitar trocas entre enoxaparina e heparina não fracionada (p. 207).'] }
  }
  if (ctx === 'tvp') {
    return { doseMg: 1.5 * pesoKg, intervalo: '1 vez ao dia SC', bolusEvMg: null, observacoes: ['O cap. 25 não traz ajuste renal para a enoxaparina.'] }
  }
  if (ctx === 'tep-12h' || ctx === 'tep-1x') {
    if (temClcr && clcr! < 15) return { doseMg: null, intervalo: '—', bolusEvMg: null, observacoes: ['ClCr < 15 mL/min: o manual sugere não usar (p. 442).'] }
    if (temClcr && clcr! < 30) return { doseMg: pesoKg, intervalo: '1 vez ao dia SC', bolusEvMg: null, observacoes: ['ClCr < 30 mL/min: ajuste para 1 mg/kg 1 x/dia (p. 442).'] }
    return ctx === 'tep-12h'
      ? { doseMg: pesoKg, intervalo: '12/12 h SC', bolusEvMg: null, observacoes: [] }
      : { doseMg: 1.5 * pesoKg, intervalo: '1 vez ao dia SC', bolusEvMg: null, observacoes: ['Esquema citado como prático para uso domiciliar (p. 441).'] }
  }
  // IAM com supra após trombólise (p. 219)
  const obs: string[] = ['Por 7 dias (p. 219).']
  if (temClcr && clcr! < 15) return { doseMg: null, intervalo: '—', bolusEvMg: null, observacoes: ['ClCr < 15 mL/min: o cap. 14 não traz dose.'] }
  const idoso = idadeAnos !== undefined && idadeAnos > 75
  let bolus: number | null = idoso ? null : 30
  if (d.estreptoquinase) {
    bolus = null
    obs.push('Trombólise com estreptoquinase: sem dose de ataque e aguardar 24 horas para a primeira dose (p. 219).')
  }
  if (temClcr && clcr! <= 30) {
    obs.push('ClCr entre 15 e 30: 1 mg/kg SC 1 x/d (p. 219).')
    if (idoso) obs.push('Idade > 75 anos: sem dose de ataque. O capítulo não diz como combinar o ajuste de idade (0,75 mg/kg) com o renal; a dose mostrada é a do ajuste renal.')
    return { doseMg: pesoKg, intervalo: '1 vez ao dia SC', bolusEvMg: bolus, observacoes: obs }
  }
  if (idoso) {
    obs.push('Idade > 75 anos: sem dose de ataque, 0,75 mg/kg 12/12 h (p. 219).')
    return { doseMg: 0.75 * pesoKg, intervalo: '12/12 h SC', bolusEvMg: null, observacoes: obs }
  }
  return { doseMg: pesoKg, intervalo: '12/12 h SC', bolusEvMg: bolus, observacoes: obs }
}

/** Fondaparinux por faixa de peso (cap. 25, p. 352); contraindicado se ClCr < 30. */
export function fondaparinuxMg(pesoKg: number, clcr?: number): number | null {
  if (!valido(pesoKg)) return null
  if (clcr !== undefined && Number.isFinite(clcr) && clcr < 30) return null
  if (pesoKg < 50) return 5
  if (pesoKg <= 100) return 7.5
  return 10
}

/** HNF SC "concentrada" (cap. 25, p. 352): 333 U/kg inicial e 250 U/kg 12/12 h; frasco de 20.000 ou 25.000 U/mL. */
export const HNF_SC = { inicialUKg: 333, manutencaoUKg: 250, concentracoesUMl: [20000, 25000], pagina: 'cap. 25, p. 352' }

export function hnfSc(pesoKg: number) {
  if (!valido(pesoKg)) return null
  const ini = HNF_SC.inicialUKg * pesoKg
  const man = HNF_SC.manutencaoUKg * pesoKg
  return {
    inicialU: ini,
    manutencaoU: man,
    volumes: HNF_SC.concentracoesUMl.map((c) => ({ uMl: c, inicialMl: ini / c, manutencaoMl: man / c })),
  }
}

/** Outras HBPM 1 x/dia (cap. 25, p. 352), em unidades por kg. */
export const OUTRAS_HBPM = [
  { id: 'dalteparina', nome: 'Dalteparina', uKg: 200 },
  { id: 'nadroparina', nome: 'Nadroparina', uKg: 171 },
  { id: 'tinzaparina', nome: 'Tinzaparina', uKg: 175 },
]

/** Bivalirudina (cap. 25, p. 352), mg/kg/h; TTPA-alvo 1,5–2,5 × controle. */
export const BIVALIRUDINA = [
  { situacao: 'padrão', mgKgH: [0.15, 0.15] as Faixa },
  { situacao: 'disfunção hepática', mgKgH: [0.14, 0.14] as Faixa },
  { situacao: 'disfunção hepática e renal', mgKgH: [0.03, 0.05] as Faixa },
]

export function bivalirudinaMgH(mgKgH: Faixa, pesoKg: number): Faixa | null {
  return valido(pesoKg) ? [mgKgH[0] * pesoKg, mgKgH[1] * pesoKg] : null
}

/**
 * Edoxabana (cap. 32, p. 443): "< 60 kg: 30 mg" e "> 60 kg: 60 mg". Com
 * exatamente 60 kg o livro não diz; a função devolve null (sem dose).
 */
export function edoxabanaMg(pesoKg: number): number | null {
  if (!valido(pesoKg) || pesoKg === 60) return null
  return pesoKg < 60 ? 30 : 60
}

export const ORAIS = [
  { id: 'varfarina', nome: 'Varfarina', dose: '5 mg por dia, com ajuste pelo INR (alvo 2,0–3,0 no cap. 25); heparina suspensa só com INR > 2,0 por 2 dias seguidos', pagina: 'cap. 25, p. 353; cap. 32, p. 442' },
  { id: 'rivaroxabana', nome: 'Rivaroxabana', dose: '15 mg VO 12/12 h por 21 dias (3 semanas no cap. 25), depois 20 mg 1 x/dia', pagina: 'cap. 25, p. 353; cap. 32, p. 443' },
  { id: 'apixabana', nome: 'Apixabana', dose: '10 mg VO 12/12 h por 7 dias, depois 5 mg 12/12 h', pagina: 'cap. 25, p. 353; cap. 32, p. 443' },
  { id: 'dabigatrana', nome: 'Dabigatrana', dose: '150 mg VO 12/12 h; suspender a heparina após 7 dias', pagina: 'cap. 25, p. 353' },
  { id: 'edoxabana', nome: 'Edoxabana', dose: '< 60 kg: 30 mg VO 1 x/dia; > 60 kg: 60 mg VO 1 x/dia', pagina: 'cap. 32, p. 443' },
]

// ── Fibrinolíticos (cap. 14 e cap. 32) ───────────────────────────────────────

const PAG_FIBRINO = 'cap. 14 IAM com supra, p. 218–219; cap. 32 TEP, p. 443 (Tabela 8)'

export const fichaFibrinoliticosAdulto: Ficha = {
  ...fichaAdulto('adulto-fibrinoliticos', 'Fibrinolíticos — adulto (IAM com supra e TEP)', PAG_FIBRINO),
  versao: '2026-09-28.1',
  fontes: [pagina(PAG_FIBRINO), AHA_SCA_2025, ESC_SCA_2023, SBC_DOR_TORACICA_2025],
  revisadoEm: '28/09/2026 (AHA/ACC 2025, ESC 2023 e SBC 2025 lidas no texto; manual mantido como base)',
}

/** Tenecteplase pela AHA/ACC 2025 (Tabela 13, e806): faixas fechadas — < 60 kg 30; 60–69 35; 70–79 40; 80–89 45; ≥ 90 kg 50 mg. Meia dose > 75 anos: ESC 2023, IIa B (p. 3762). */
export function tenecteplase2025(pesoKg: number, idadeAnos?: number): { mg: number; faixa: string; metadePorIdade: boolean; mgFinal: number } | null {
  if (!valido(pesoKg)) return null
  const [mg, faixa] = pesoKg < 60 ? [30, '< 60 kg'] : pesoKg < 70 ? [35, '60–69 kg'] : pesoKg < 80 ? [40, '70–79 kg'] : pesoKg < 90 ? [45, '80–89 kg'] : [50, '≥ 90 kg']
  const idoso = idadeAnos !== undefined && Number.isFinite(idadeAnos) && idadeAnos > 75
  return { mg, faixa, metadePorIdade: idoso, mgFinal: idoso ? mg / 2 : mg }
}

/** Alteplase acelerada pela AHA/ACC 2025 (Tabela 13, e806): corte em 67 kg (o manual corta em 65 kg, p. 218). */
export function alteplaseIam2025(pesoKg: number): { fases: FaseInfusao[]; totalMg: number; corteKg: number } | null {
  if (!valido(pesoKg)) return null
  const fases: FaseInfusao[] = pesoKg >= 67
    ? [{ fase: 'bolus', mg: 15, minutos: 0 }, { fase: 'em 30 min', mg: 50, minutos: 30 }, { fase: 'em 60 min', mg: 35, minutos: 60 }]
    : [{ fase: 'bolus', mg: 15, minutos: 0 }, { fase: 'em 30 min (0,75 mg/kg, máx. 50)', mg: Math.min(0.75 * pesoKg, 50), minutos: 30 }, { fase: 'em 60 min (0,5 mg/kg, máx. 35)', mg: Math.min(0.5 * pesoKg, 35), minutos: 60 }]
  return { fases, totalMg: fases.reduce((s, f) => s + f.mg, 0), corteKg: 67 }
}

export type ItemSca2025 = { tema: string; diretriz: string; fonte: string; livro: string }

export const DIRETRIZ_SCA_2025: ItemSca2025[] = [
  { tema: 'Tempo para reperfusão', diretriz: 'ICP primária com meta de 90 min do primeiro contato ao dispositivo (120 min com transferência); fibrinolítico quando o atraso previsto passa de 120 min, iniciado em até 10 min do diagnóstico de IAMCSST e sem esperar biomarcador; após lítico com sucesso, angiografia de rotina em 2–24 h', fonte: 'AHA 2025 e782, e806; ESC 2023 p. 3749', livro: 'cap. 14, p. 218–219' },
  { tema: 'ICP de resgate', diretriz: 'Se a fibrinólise falha (resolução do ST < 50% em 60–90 min) ou há instabilidade hemodinâmica/elétrica, isquemia em piora ou dor persistente', fonte: 'ESC 2023 p. 3746', livro: '—' },
  { tema: 'Tenecteplase', diretriz: 'Bolus único por faixa fechada de peso (30/35/40/45/50 mg); meia dose deve ser considerada acima de 75 anos', fonte: 'AHA 2025 e806; ESC 2023 IIa B, p. 3762', livro: '< 60: 30; 60–70: 35; 70–80: 40; 80–90: 45; > 90 kg: 50 mg; metade > 75 anos (p. 218–219) — bordas de 70 e 80 kg ambíguas' },
  { tema: 'Alteplase acelerada', diretriz: '≥ 67 kg: 15 mg + 50 mg/30 min + 35 mg/60 min; < 67 kg: 15 mg + 0,75 mg/kg (máx. 50) + 0,5 mg/kg (máx. 35)', fonte: 'AHA 2025 e806', livro: 'mesmo esquema com corte em 65 kg (p. 218)' },
  { tema: 'Estreptoquinase', diretriz: 'Não está mais disponível nos EUA (nota da Tabela 13)', fonte: 'AHA 2025 e806', livro: '1.500.000 UI em 60 min (p. 218)' },
  { tema: 'Oxigênio', diretriz: 'Só com SaO2 < 90%; rotina sem hipoxemia não traz benefício', fonte: 'ESC 2023 p. 3744–3745', livro: '—' },
  { tema: 'Transfusão no IAM com anemia', diretriz: 'Estratégia liberal com alvo de Hb em torno de 10 g/dL pode ser razoável (ensaio MINT)', fonte: 'AHA 2025 2b B-R, e822', livro: '—' },
  { tema: 'Diagnóstico na dor torácica (Brasil)', diretriz: 'ECG interpretado em até 10 min (I A); troponina de alta sensibilidade com algoritmos 0/1 h ou 0/2 h; HEART é o escore clínico preferencial (I B); com troponina quantitativa disponível, não pedir CK-MB (III B)', fonte: 'SBC 2025 p. 15, 29–30, 37', livro: 'TIMI e GRACE nas ferramentas próprias' },
]

export type FaseInfusao = { fase: string; mg: number; minutos: number }

/** Alteplase no IAM com supra, esquema acelerado (p. 218). */
export function alteplaseIam(pesoKg: number): { fases: FaseInfusao[]; totalMg: number } | null {
  if (!valido(pesoKg)) return null
  const fases: FaseInfusao[] = pesoKg >= 65
    ? [{ fase: 'bolus', mg: 15, minutos: 0 }, { fase: 'em 30 min', mg: 50, minutos: 30 }, { fase: 'em 60 min', mg: 35, minutos: 60 }]
    : [{ fase: 'bolus', mg: 15, minutos: 0 }, { fase: 'em 30 min (0,75 mg/kg)', mg: 0.75 * pesoKg, minutos: 30 }, { fase: 'em 60 min (0,5 mg/kg)', mg: 0.5 * pesoKg, minutos: 60 }]
  return { fases, totalMg: fases.reduce((s, f) => s + f.mg, 0) }
}

/** mg/h de uma fase (para a bomba). */
export const mgHDaFase = (f: FaseInfusao) => (f.minutos > 0 ? (f.mg / f.minutos) * 60 : null)

export type Tenecteplase = { mg: Faixa; bordaAmbigua: boolean; metadePorIdade: boolean }

/**
 * Tenecteplase por peso (p. 218–219): < 60 kg 30 mg; 60–70 kg 35 mg; 70–80 kg
 * 40 mg; 80–90 kg 45 mg; > 90 kg 50 mg; metade se > 75 anos. Com 70 ou 80 kg
 * exatos o peso cabe em duas faixas do livro: devolve as duas doses.
 */
export function tenecteplase(pesoKg: number, idadeAnos?: number): Tenecteplase | null {
  if (!valido(pesoKg)) return null
  let mg: Faixa
  let borda = false
  if (pesoKg < 60) mg = [30, 30]
  else if (pesoKg < 70) mg = [35, 35]
  else if (pesoKg === 70) { mg = [35, 40]; borda = true }
  else if (pesoKg < 80) mg = [40, 40]
  else if (pesoKg === 80) { mg = [40, 45]; borda = true }
  else if (pesoKg <= 90) mg = [45, 45]
  else mg = [50, 50]
  const idoso = idadeAnos !== undefined && idadeAnos > 75
  return { mg: idoso ? [mg[0] / 2, mg[1] / 2] : mg, bordaAmbigua: borda, metadePorIdade: idoso }
}

export const ESTREPTOQUINASE = {
  iam: { ui: 1_500_000, minutos: 60, pagina: 'cap. 14, p. 218' },
  tepPreferivel: { ui: 1_500_000, minutos: 120, pagina: 'cap. 32, p. 443' },
  tepAlternativo: {
    texto: '250.000 UI IV em bolus em 30 min, seguidos de "100 UI/h" por 12–24 h',
    ataqueUI: 250_000,
    ataqueMinutos: 30,
    pagina: 'cap. 32, p. 443 (Tabela 8)',
    errata: 'A manutenção está impressa como "100 UI/h", valor sem sentido ao lado de um ataque de 250.000 UI (faltam, provavelmente, três zeros). O livro não traz outro dado que permita corrigir; a manutenção deste esquema não é calculada.',
  },
}

/** UI/h de um esquema de estreptoquinase em volume único. */
export const uiPorHora = (e: { ui: number; minutos: number }) => (e.ui / e.minutos) * 60

/** rtPA no TEP (Tabela 8, p. 443). */
export const ALTEPLASE_TEP = {
  preferivel: { mg: 100, minutos: 120 },
  alternativo: { mgKg: 0.6, minutos: 15, maxMg: 50 },
  pcr: { mg: 50, texto: 'na suspeita de PCR por TEP: 50 mg em bolus durante a RCP, que continua por no mínimo 60 minutos; pode ser repetida uma vez' },
  pagina: 'cap. 32, p. 443',
}

export function alteplaseTepAlternativo(pesoKg: number): { mg: number; limitadoAoTeto: boolean } | null {
  if (!valido(pesoKg)) return null
  const mg = ALTEPLASE_TEP.alternativo.mgKg * pesoKg
  return mg > ALTEPLASE_TEP.alternativo.maxMg ? { mg: ALTEPLASE_TEP.alternativo.maxMg, limitadoAoTeto: true } : { mg, limitadoAoTeto: false }
}
