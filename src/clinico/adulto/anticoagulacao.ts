import { fichaAdulto } from './fonte.ts'

// Anticoagulação e fibrinólise do adulto — Manual de Medicina de Emergência do
// HCFMUSP (3ª ed., 2022): cap. 13 IAM sem supra (p. 207), cap. 14 IAM com
// supra (p. 218–219), cap. 25 TVP (p. 352–353) e cap. 32 TEP (p. 441–443).
// Doses por peso, ajuste renal/idade quando o capítulo traz, e o nomograma de
// TTPA da Tabela 7 (p. 442). O livro não traz diluição da heparina EV: a
// conversão para mL/h só acontece com a concentração do preparo informada por
// quem usa. A indicação é do médico (ADR 0007).

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

export const fichaAnticoagulacaoPlenaAdulto = fichaAdulto(
  'adulto-anticoagulacao-plena',
  'Anticoagulação plena por peso — adulto',
  'cap. 13 IAM sem supra, p. 207; cap. 14 IAM com supra, p. 219; cap. 25 TVP, p. 352–353; cap. 32 TEP, p. 441–443',
)

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

export const fichaFibrinoliticosAdulto = fichaAdulto(
  'adulto-fibrinoliticos',
  'Fibrinolíticos — adulto (IAM com supra e TEP)',
  'cap. 14 IAM com supra, p. 218–219; cap. 32 TEP, p. 443 (Tabela 8)',
)

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
