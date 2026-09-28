import { fichaAdulto } from './fonte.ts'

// Intoxicações e antídotos do adulto — caps. 97 (manejo inicial, p. 1297–1306),
// 98 (fármacos, p. 1307–1324) e 99 (ambientais e drogas de abuso,
// p. 1325–1337) do Manual de Medicina de Emergência do HCFMUSP (3ª ed., 2022).
// A ferramenta mostra o que o manual traz e faz as contas por peso, volume e
// velocidade; a indicação é do médico (ADR 0007). Os valores pediátricos que o
// capítulo 99 cita no cianeto não são implementados (ficha de adulto).

export const fichaIntoxicacoesAdulto = fichaAdulto(
  'adulto-intoxicacoes-antidotos',
  'Intoxicações e antídotos — adulto',
  'caps. 97–99 (Manejo inicial das intoxicações exógenas; Intoxicações por fármacos; Intoxicações ambientais e drogas de abuso), p. 1299–1337; NaHCO3 8,4% = 50 mEq/50 mL: cap. 69, p. 938; emulsão lipídica na PCR: cap. 2, p. 50',
)

export type Faixa = [number, number]

const valido = (x: number) => Number.isFinite(x) && x > 0
const vezes = (f: Faixa, k: number): Faixa => [f[0] * k, f[1] * k]

/** Texto do livro com página; errata quando o livro tem erro ou incoerência. */
export type ItemManual = {
  id: string
  nome: string
  texto: string
  pagina: string
  errata?: string
  nota?: string
}

// ── Carvão ativado (cap. 97; doses de outros capítulos) ─────────────────────

export const CARVAO = {
  razaoGPorGIngerido: 10,
  semDoseConhecidaG: [25, 100] as Faixa,
  gPorKg: 1,
  triciclicoTetoG: 50,
  multiplasGPorHora: 12.5,
  multiplasIntervaloH: [2, 4] as Faixa,
  pagina: 'p. 1300 (dose); p. 1308 (tricíclicos: 1 g/kg, máx. 50 g); p. 1302 (múltiplas doses: 12,5 g/h)',
}

export const CARVAO_INDICACAO: ItemManual[] = [
  { id: 'janela', nome: 'Janela', texto: 'ingesta há menos de 1 a 2 horas; apresentação tardia (> 2 h) é contraindicação. Fluxograma: < 1 h (< 2 h em casos selecionados), intoxicação potencialmente letal, toxina adsorvível, paciente acordado e cooperativo e sem antídoto disponível', pagina: 'p. 1299–1300; Figura 1, p. 1306' },
  { id: 'janela-especifica', nome: 'Janelas citadas por intoxicação', texto: 'paracetamol até 4 h; tricíclicos até 1 h; ISRS < 1 h; anticonvulsivantes e anticolinérgicos < 2 h; betabloqueador < 1–2 h; digoxina e salicilato até 2 h; organofosforado e cianeto oral < 1 h; lítio: sem indicação de carvão', pagina: 'p. 1308–1323; p. 1333, 1337' },
  { id: 'nao-adsorviveis', nome: 'Pouco ou não adsorvíveis', texto: 'ácidos, álcalis, lítio, metais pesados, álcoois e hidrocarbonetos aromáticos', pagina: 'p. 1300' },
  { id: 'contraindicacoes', nome: 'Contraindicações', texto: 'rebaixamento sem proteção de via aérea ou alto risco de broncoaspiração; apresentação > 2 h; paciente agitado, rebaixado ou não colaborativo (não usar SNG em não intubado; não intubar só para o carvão); necessidade de endoscopia; toxinas pouco adsorvíveis; obstrução intestinal', pagina: 'p. 1299–1300' },
  { id: 'multiplas', nome: 'Múltiplas doses', texto: 'carbamazepina, dapsona, fenobarbital, quinina, teofilina, AAS e fenitoína (dados de voluntários também para amitriptilina, digoxina, disopiramida, nadolol e piroxicam); 50 g a cada 4 h ou 25 g a cada 2 h após a 1ª dose', pagina: 'p. 1300–1302',
    errata: 'Duração: a p. 1301 diz "manter esse regime por 12 horas"; as p. 1308, 1315, 1319 e 1323 dizem 12–24 h. O quinino (p. 1300) aparece como "quinina" na p. 1302, e cafeína só na p. 1300.' },
]

/** Carvão pela massa ingerida: 10 g de carvão para cada 1 g da substância (p. 1300). */
export function carvaoPorMassaIngerida(gramasIngeridos: number): number | null {
  return valido(gramasIngeridos) ? gramasIngeridos * CARVAO.razaoGPorGIngerido : null
}

/** Dose desconhecida: 25–100 g (1 g/kg) (p. 1300). Sinaliza quando 1 g/kg sai da faixa em gramas. */
export function carvaoPorPeso(pesoKg: number): { g: number; foraDaFaixa: boolean } | null {
  if (!valido(pesoKg)) return null
  const g = pesoKg * CARVAO.gPorKg
  return { g, foraDaFaixa: g < CARVAO.semDoseConhecidaG[0] || g > CARVAO.semDoseConhecidaG[1] }
}

/** Tricíclicos: 1 g/kg, máximo 50 g (p. 1308). */
export function carvaoTriciclico(pesoKg: number): { g: number; limitadoAoTeto: boolean } | null {
  if (!valido(pesoKg)) return null
  const g = pesoKg * CARVAO.gPorKg
  return g > CARVAO.triciclicoTetoG ? { g: CARVAO.triciclicoTetoG, limitadoAoTeto: true } : { g, limitadoAoTeto: false }
}

/** Múltiplas doses: 12,5 g/h ou o equivalente a cada 2 a 4 h (p. 1302). Fora de 2–4 h não calcula. */
export function carvaoMultiplasDoses(intervaloH: number): number | null {
  const [a, b] = CARVAO.multiplasIntervaloH
  if (!Number.isFinite(intervaloH) || intervaloH < a || intervaloH > b) return null
  return CARVAO.multiplasGPorHora * intervaloH
}

// ── Paracetamol e N-acetilcisteína (cap. 98, p. 1310–1312) ──────────────────

export type GravidadeParacetamol = { rotulo: string; pagina: string }

/** Gravidade pela quantidade ingerida (p. 1310). 7,5 e 12 g entram na faixa 7,5–12 g, como escrito. */
export function gravidadeParacetamol(gramas: number): GravidadeParacetamol | null {
  if (!valido(gramas)) return null
  const pagina = 'p. 1310'
  if (gramas < 7.5) return { rotulo: '< 7,5 g: não costumam causar lesão hepática grave', pagina }
  if (gramas <= 12) return { rotulo: '7,5–12 g: lesão hepática importante', pagina }
  if (gramas <= 15) return { rotulo: '> 12 g: insuficiência hepática grave', pagina }
  return { rotulo: '> 15 g: frequentemente letal (e > 12 g: insuficiência hepática grave)', pagina }
}

export type EntradaNac = {
  gramasIngeridos?: number
  nivelDisponivel: boolean
  tempoDesconhecido: boolean
  nivelUgMl?: number
  /** transaminases > 2–3 × LSN: o livro dá faixa, então quem usa marca */
  hepatotoxicidade: boolean
  acimaDaLinhaNomograma: boolean
}

/**
 * Indicações de NAC que o manual lista (p. 1311). O nomograma de
 * Rumack-Matthew é só citado — o livro não traz a linha —, então "acima da
 * linha" é informado por quem usa, não calculado.
 */
export function indicacoesNac(e: EntradaNac): string[] {
  const r: string[] = []
  if (e.acimaDaLinhaNomograma) r.push('nível sérico após 4 h acima da linha do nomograma de Rumack-Matthew')
  if (!e.nivelDisponivel && (e.gramasIngeridos ?? 0) > 7.5) r.push('nível sérico indisponível em intoxicação > 7,5 g')
  if (e.tempoDesconhecido && (e.nivelUgMl ?? 0) > 10) r.push('tempo desconhecido + nível sérico > 10 µg/mL')
  if (e.hepatotoxicidade) r.push('evidência de hepatotoxicidade (transaminases > 2–3 × LSN)')
  return r
}

export const NAC = {
  vo: { ataqueMgKg: 140, manutencaoMgKg: 70, intervaloH: 4, duracaoH: 72, dosesAproximadas: 17, pagina: 'p. 1311',
    texto: 'VO: ataque 140 mg/kg + 70 mg/kg de 4/4 h por 72 h; interromper se acetaminofeno < 10 µg/mL, paciente assintomático e sem hepatotoxicidade (≈ 17 doses)' },
  ev: {
    fases: [
      { rotulo: '1ª fase (ataque)', mgKg: 150, horas: 1, preparo: 'diluídos em 200 a 300 mL de SF ou SG 5%' },
      { rotulo: '2ª fase', mgKg: 50, horas: 4, preparo: 'diluição não informada no capítulo' },
      { rotulo: '3ª fase', mgKg: 100, horas: 16, preparo: 'diluição não informada no capítulo' },
    ],
    quando: 'incapacidade de VO, INR > 2 ou gestante',
    pagina: 'p. 1311',
    errata: 'O livro escreve "manutenção de 50 mg/kg por (6,25 mg/kg/h) 4 h". 50 mg/kg em 4 h são 12,5 mg/kg/h; 6,25 mg/kg/h é a taxa da fase seguinte (100 mg/kg em 16 h). A taxa é calculada pela dose e pelo tempo de cada fase.',
  },
  janela: 'iniciar antes da elevação de enzimas, dentro de 8 h após a ingestão (p. 1311)',
}

export function nacVO(pesoKg: number) {
  if (!valido(pesoKg)) return null
  return { ataqueMg: NAC.vo.ataqueMgKg * pesoKg, manutencaoMg: NAC.vo.manutencaoMgKg * pesoKg, doses: NAC.vo.dosesAproximadas }
}

export type FaseNac = { rotulo: string; mg: number; horas: number; mgH: number; mgKgH: number; preparo: string }

/** Esquema EV em 3 fases (p. 1311); mg/h = dose da fase ÷ horas da fase. */
export function nacEV(pesoKg: number): { fases: FaseNac[]; totalMg: number; totalMgKg: number } | null {
  if (!valido(pesoKg)) return null
  const fases = NAC.ev.fases.map((f) => ({ rotulo: f.rotulo, mg: f.mgKg * pesoKg, horas: f.horas, mgH: (f.mgKg * pesoKg) / f.horas, mgKgH: f.mgKg / f.horas, preparo: f.preparo }))
  const totalMgKg = NAC.ev.fases.reduce((s, f) => s + f.mgKg, 0)
  return { fases, totalMg: totalMgKg * pesoKg, totalMgKg }
}

export const KINGS_COLLEGE: ItemManual = {
  id: 'kings', nome: "King's College modificado (listar para transplante)",
  texto: 'pH < 7,3 após ressuscitação volêmica; ou, juntos em 24 h, Cr > 3,2 mg/dL, INR > 6,5 (TP > 100 s) e encefalopatia III–IV; ou lactato após 2–3 dias > 3,5 mmol/L (> 3 após ressuscitação volêmica)',
  pagina: 'p. 1311–1312',
}

// ── Antídotos de dose fixa ───────────────────────────────────────────────────

export const FLUMAZENIL = { bolusMg: 0.2, segundos: 30, maxMg: 1, pagina: 'p. 1314',
  texto: '0,2 mg EV em 30 s, repetir até o efeito e dose máxima de 1 mg; pico em 6–10 min, duração próxima de 1 h. Uso rotineiro não recomendado, sobretudo em usuário crônico de BZD (abstinência, convulsão; principalmente com tricíclico)' }

/** Quantos bolus de 0,2 mg cabem até o teto de 1 mg. */
export const flumazenilBolusMaximos = () => Math.round(FLUMAZENIL.maxMg / FLUMAZENIL.bolusMg)

export const NALOXONA = {
  cenarios: [
    { id: 'drive', rotulo: 'Drive ventilatório presente', mg: [0.04, 0.04] as Faixa },
    { id: 'apneia', rotulo: 'Apneia', mg: [0.2, 1] as Faixa },
    { id: 'pcr', rotulo: 'PCR', mg: [2, 2] as Faixa },
  ],
  alvo: 'repetir o bolus inicial em poucos minutos até FR > 12 ipm; o alvo não é o nível de consciência',
  reconsiderar: 'sem dose máxima descrita; sem melhora após 5–10 mg, reconsiderar o diagnóstico',
  alta: 'alta ou transferência sem necessidade de naloxona nas últimas 3 horas',
  pagina: 'p. 1316',
}

export const FISOSTIGMINA: ItemManual = {
  id: 'fisostigmina', nome: 'Fisostigmina (anticolinérgicos)',
  texto: '0,5–2 mg EV lento (controverso); monitorização cardíaca, atropina e material de RCP disponíveis. Contraindicações relativas: hiper-reatividade brônquica, obstrução intestinal, epilepsia, distúrbio de condução',
  pagina: 'p. 1315',
  nota: 'Contraindicada na intoxicação por tricíclicos (aumenta o risco de PCR), p. 1308.',
}

// ── Betabloqueador (p. 1317–1318) e bloqueador de canal de cálcio (p. 1318, 1321) ─

export const BETABLOQUEADOR = {
  atropina: { mg: 1, dosesMax: 3, pagina: 'p. 1317' },
  glucagon: { bolusMg: 5, repetirMin: [10, 15] as Faixa, infusaoMgH: [2, 5] as Faixa, pagina: 'p. 1317',
    texto: '5 mg EV em 1 min; repetir após 10–15 min sem resposta; com resposta (PAM > 60 mmHg), infusão de 2–5 mg/h' },
  calcio: { texto: 'gluconato de cálcio 10% 30 mL + SF 100 mL em 10 min; monitorizar cálcio', pagina: 'p. 1317' },
  adrenalina: { texto: 'infusão iniciando a 1 µg/min, alvo PAM > 60 mmHg', pagina: 'p. 1317' },
  insulina: { bolusUiKg: 1, infusaoUiKgH: 0.5, tetoUiKg: 10, pagina: 'p. 1317–1318',
    texto: 'insulina regular 1 UI/kg em bolus + 0,5 UI/kg/h, titulando até o máximo de 10 UI/kg até corrigir a hipotensão; corrigir hipocalemia antes; glicemia < 200 mg/dL: 50 mL de glicose 50% e considerar SG 10% a 100 mL/h; resposta em 30–60 min',
    errata: 'O teto "10 UI/kg" vem sem unidade de tempo; pelo contexto de infusão seria UI/kg/h. O valor é mostrado como está, sem cálculo por hora.' },
  emulsao: { texto: 'somente após consulta a centro de referência em toxicologia', pagina: 'p. 1318' },
  sequencia: 'Grave: todas as medidas juntas. Leve refratário a volume e atropina: medidas sucessivas a cada 15 min.',
}

export function insulinaAltaDose(pesoKg: number) {
  if (!valido(pesoKg)) return null
  return {
    bolusUi: BETABLOQUEADOR.insulina.bolusUiKg * pesoKg,
    infusaoUiH: BETABLOQUEADOR.insulina.infusaoUiKgH * pesoKg,
    tetoUi: BETABLOQUEADOR.insulina.tetoUiKg * pesoKg,
  }
}

export const BCC = {
  gravidade: 'ingestão de 5–10 × a dose usual pode levar a intoxicação grave (p. 1318)',
  calcio: {
    texto: 'cálcio é a 1ª opção após volume e atropina: 3–6 g de cálcio, seguidos de 0,5 mEq/kg/h (0,6–1,2 mL/kg/h de gluconato de cálcio a 10%); monitorizar cálcio e ECG',
    manutencaoMlKgH: [0.6, 1.2] as Faixa,
    manutencaoMEqKgH: 0.5,
    pagina: 'p. 1318',
    errata: 'O livro põe 0,5 mEq/kg/h ao lado de 0,6–1,2 mL/kg/h de gluconato 10%, uma faixa de volume para uma dose única em mEq; e "3–6 g de cálcio" não diz se é sal (gluconato) ou cálcio elementar. O manual não dá o teor de mEq/mL do gluconato. Calcula-se só o mL/h pela faixa em mL/kg/h, como impressa; o ataque não é convertido em mL.',
  },
  figura: {
    pagina: 'Figura 2, p. 1321',
    calcio: 'gluconato de cálcio ou cloreto de cálcio 10% 10 mL EV; pode repetir até 3 vezes',
    vasopressor: 'epinefrina ou norepinefrina 1–5 µg/min (titular)',
    glucagonMg: [3, 10] as Faixa,
    glucagonMgKg: [0.03, 0.05] as Faixa,
    glucagonInfusaoMgH: [1, 5] as Faixa,
    insulinaBolusUiKg: [0.5, 1] as Faixa,
    insulinaInfusaoUiKgH: [0.5, 1] as Faixa,
    glicose: 'se glicemia < 200 mg/dL, 50 mL de G50% com a insulina; infusão de G10% a 200 mL/h',
    emulsaoBolusMlKg: 1.5,
    emulsaoBolusMin: [2, 3] as Faixa,
    emulsaoMlKgMin: 0.5,
    depois: 'atropina ou marca-passo se bradicardia sintomática; extracorpórea se refratário',
  },
  divergencias: [
    'Glucagon na Figura 2: "3–10 mg (0,03–0,05 mg/kg)" não fecha — 0,03–0,05 mg/kg dão 2,1–3,5 mg em 70 kg. O texto do betabloqueador (p. 1317) usa 5 mg + 2–5 mg/h; a figura, infusão de 1–5 mg/h.',
    'Insulina: 1 UI/kg + 0,5 UI/kg/h no betabloqueador (p. 1317) x 0,5–1 UI/kg + 0,5–1 UI/kg/h na Figura 2 (p. 1321).',
    'Glicose de suporte: SG 10% a 100 mL/h (p. 1318) x G10% a 200 mL/h (Figura 2, p. 1321).',
    'Emulsão lipídica 20%: 0,5 mL/kg/min na Figura 2 (p. 1321) x 0,25 mL/kg/min na PCR por anestésico local (cap. 2, p. 50); no betabloqueador, só após centro de toxicologia (p. 1318).',
  ],
}

export function calcioBccManutencao(pesoKg: number): Faixa | null {
  return valido(pesoKg) ? vezes(BCC.calcio.manutencaoMlKgH, pesoKg) : null
}

export function bccFigura(pesoKg: number) {
  if (!valido(pesoKg)) return null
  const f = BCC.figura
  const mlMin = f.emulsaoMlKgMin * pesoKg
  return {
    glucagonPorPesoMg: vezes(f.glucagonMgKg, pesoKg),
    insulinaBolusUi: vezes(f.insulinaBolusUiKg, pesoKg),
    insulinaInfusaoUiH: vezes(f.insulinaInfusaoUiKgH, pesoKg),
    emulsaoBolusMl: f.emulsaoBolusMlKg * pesoKg,
    emulsaoMlMin: mlMin,
    emulsaoMlH: mlMin * 60,
  }
}

// ── Digoxina (p. 1319–1322) ─────────────────────────────────────────────────

export const DIGOXINA = {
  frascosEmpiricos: 10,
  mgPorFrasco: 0.5,
  biodisponibilidade: 0.8,
  indicacoes: 'intoxicação digitálica grave: arritmia ameaçadora à vida (FV, TV, assistolia, BAVT, BAV Mobitz II, bradicardia sintomática); K+ > 5–5,5 mEq/L; disfunção orgânica (IRA, alteração de consciência); digoxinemia > 10 ng/mL (aguda) ou > 4 ng/mL (crônica)',
  nivelTerapeutico: '0,8–2 ng/mL; coletar idealmente 6 h após a ingesta VO',
  pagina: 'p. 1319, 1321–1322',
  nota: 'O livro não diz como arredondar o número de frascos; a conta sai com uma casa decimal.',
}

/** Quantidade conhecida, digoxinemia indisponível: [dose (mg) × 0,8] / 0,5 (p. 1322). */
export function frascosPorDose(mgIngeridos: number): number | null {
  return valido(mgIngeridos) ? (mgIngeridos * DIGOXINA.biodisponibilidade) / DIGOXINA.mgPorFrasco : null
}

/** Quantidade e digoxinemia conhecidas: [digoxinemia (ng/mL) × peso] / 100 (p. 1322). */
export function frascosPorNivel(digoxinemiaNgMl: number, pesoKg: number): number | null {
  return valido(digoxinemiaNgMl) && valido(pesoKg) ? (digoxinemiaNgMl * pesoKg) / 100 : null
}

// ── Bicarbonato de sódio 8,4% (1 mEq/mL: 50 mEq/50 mL, p. 938) ─────────────

export const BICARBONATO_MEQ_ML = 1

export type UsoBicarbonato = { id: string; nome: string; mEqKg: Faixa; texto: string; pagina: string }

export const BICARBONATO_USOS: UsoBicarbonato[] = [
  { id: 'alcalinizacao', nome: 'Alcalinização urinária (salicilato, fenobarbital, metotrexato, sulfonamidas)', mEqKg: [1, 2],
    texto: 'bolus + 150 mEq de NaHCO3 8,4% em SG 5% 1.000 mL a 200–250 mL/h; alvo pH urinário > 7,5 e sérico 7,55–7,6', pagina: 'p. 1302–1303' },
  { id: 'triciclico', nome: 'Tricíclicos (QRS > 100 ms ou arritmia ventricular)', mEqKg: [1, 2],
    texto: 'bolus + 150 mL em SG 5% 1.000 mL a 200–250 mL/h; alvo pH sérico 7,45–7,55 (não passar de 7,6), gasometria 6/6 h', pagina: 'p. 1308' },
  { id: 'isrs', nome: 'ISRS (QTc prolongado)', mEqKg: [1, 2], texto: 'considerar bolus; torsades, QTc > 560 ms ou bradicardia: sulfato de magnésio 2 g em 2 min, repetível após 10 min', pagina: 'p. 1309' },
  { id: 'salicilato', nome: 'Salicilatos', mEqKg: [1, 2], texto: 'bolus + 150 mEq em SG 5% 1.000 mL; alvo pH urinário 7,5–8; repor potássio', pagina: 'p. 1323' },
  { id: 'cocaina', nome: 'Cocaína (QRS alargado)', mEqKg: [1, 1], texto: '1 mEq/kg EV', pagina: 'p. 1332' },
  { id: 'alcoois', nome: 'Álcoois tóxicos (pH < 7,3)', mEqKg: [1, 2], texto: '1–2 mEq/kg até pH > 7,3', pagina: 'p. 1327 (Tabela 2)' },
]

export const BICARBONATO_LITIO = { texto: 'NaHCO3 8,4% 150 mL em SG 5% 850 mL, EV a 200 mL/h; alvo pH sérico 7,5–7,55 (não passar de 7,6)', pagina: 'p. 1313' }

export const BICARBONATO_ERRATA = 'Os alvos de pH sérico mudam entre as páginas: 7,55–7,6 (p. 1302), 7,45–7,55 (p. 1308) e 7,5–7,55 (p. 1313); a p. 1302 fica no teto de 7,6 dado nas outras. O diluente muda: 150 mEq em 1.000 mL (p. 1303, 1308, 1323) x 150 mL em 850 mL (p. 1313). Cada alvo é mostrado com a sua página.'

export function bicarbonatoBolus(uso: UsoBicarbonato, pesoKg: number): { mEq: Faixa; ml: Faixa } | null {
  if (!valido(pesoKg)) return null
  const mEq = vezes(uso.mEqKg, pesoKg)
  return { mEq, ml: [mEq[0] / BICARBONATO_MEQ_ML, mEq[1] / BICARBONATO_MEQ_ML] }
}

// ── Álcoois tóxicos (cap. 99, Tabela 2, p. 1327–1328) ───────────────────────

export const ALCOOIS = {
  indicacaoInibicao: 'níveis séricos > 20 mg/dL; alteração de consciência; gap osmolar > 10 mOsm/kg; acidose (pH < 7,3 e BIC < 20 mEq/L)',
  fomepizol: { ataqueMgKg: 15, ataqueMin: 30, manutencaoMgKg: 10, intervaloH: 12, duracaoH: 48, depoisMgKg: 15, pagina: 'p. 1327',
    texto: 'ataque 15 mg/kg EV em 30 min + 10 mg/kg 12/12 h por 48 h → 15 mg/kg/dia até resolver a acidose',
    errata: 'Depois de 48 h o livro escreve "15 mg/kg/dia". O inventário do projeto aponta que o esquema usual seria 15 mg/kg a cada 12 h; o livro não traz outra passagem para conferir. Mostra-se 15 mg/kg por dose com o intervalo impresso ("/dia"), sem calcular dose diária.' },
  etanolEV: { ataqueMlKg: 10, infusaoMlKgH: 1.2, pagina: 'p. 1328',
    texto: 'etanol 10% EV em CVC: ataque 10 mL/kg + 1,2 mL/kg/h, mantendo etanol sérico > 150 mg/dL até resolver a acidose; na falta de fomepizol' },
  etanolVO: { texto: 'ataque de 2 mL/kg + 0,2–0,5 mL/kg/h até resolver a acidose (se etanol EV indisponível)', pagina: 'p. 1328',
    errata: 'O etanol VO vem sem concentração, e o volume depende dela. Não é calculado.' },
  acidoFolico: { mgKg: 1, texto: 'metanol: ácido fólico 1 mg/kg EV de 4/4 h até resolver', pagina: 'p. 1328' },
  outros: [
    { id: 'piridoxina', nome: 'Piridoxina (etilenoglicol)', texto: '50–100 mg EV 6/6 h por 24–48 h', pagina: 'p. 1328' },
    { id: 'tiamina', nome: 'Tiamina (etilenoglicol)', texto: '100 mg EV 6/6 h por 24–48 h', pagina: 'p. 1328' },
    { id: 'calcio', nome: 'Hipocalcemia (só se convulsão ou QT alargado)', texto: 'gluconato de cálcio 10% + SG 5% 100 mL, EV em 10–20 min; repetir se necessário', pagina: 'p. 1327',
      nota: 'O volume de gluconato não está escrito na tabela.' },
    { id: 'hd', nome: 'Hemodiálise', texto: 'acidose refratária; alteração visual (metanol); injúria renal; instabilidade; distúrbio eletrolítico refratário; níveis > 50 mg/dL. Etanol e fomepizol também são dialisáveis: corrigir a dose', pagina: 'p. 1328' },
  ] as ItemManual[],
  gapOsmolar: 'fase precoce: gap osmolar > 15 mOsm/kg (p. 1326); fomepizol se gap > 10 (p. 1327). A fórmula do gap não está no capítulo.',
}

export function fomepizol(pesoKg: number) {
  if (!valido(pesoKg)) return null
  const f = ALCOOIS.fomepizol
  return { ataqueMg: f.ataqueMgKg * pesoKg, manutencaoMg: f.manutencaoMgKg * pesoKg, dosesEm48h: f.duracaoH / f.intervaloH, depoisMg: f.depoisMgKg * pesoKg }
}

export function etanolEV(pesoKg: number) {
  if (!valido(pesoKg)) return null
  return { ataqueMl: ALCOOIS.etanolEV.ataqueMlKg * pesoKg, infusaoMlH: ALCOOIS.etanolEV.infusaoMlKgH * pesoKg }
}

export const acidoFolicoMg = (pesoKg: number) => (valido(pesoKg) ? ALCOOIS.acidoFolico.mgKg * pesoKg : null)

// ── Organofosforados e carbamatos (p. 1333–1334) ────────────────────────────

export const ORGANOFOSFORADO = {
  provaAtropinaMg: 1,
  atropinaInicialMg: [2, 5] as Faixa,
  dobrarACadaMin: [3, 5] as Faixa,
  alvo: 'dobrar a cada 3–5 min até melhora da broncorreia e do broncoespasmo; taquicardia e midríase não são marcadores de melhora nem contraindicação',
  pralidoxima: { bolusMgKg: 30, bolusMin: 30, infusaoMgKgH: 8, texto: 'bolus 30 mg/kg IV em 30 min + 8 mg/kg/h nos casos graves; sempre com atropina; OF moderado ou grave (sem estudos em carbamato)' },
  pagina: 'p. 1333–1334',
}

/** Doses de atropina dobrando a partir da dose inicial (p. 1333): 1ª, 2ª, … com o acumulado. */
export function atropinaDobrando(inicialMg: number, passos: number): { dose: number; acumulado: number }[] {
  if (!valido(inicialMg) || !Number.isInteger(passos) || passos < 1) return []
  const r: { dose: number; acumulado: number }[] = []
  let acumulado = 0
  for (let i = 0; i < passos; i++) {
    const dose = inicialMg * 2 ** i
    acumulado += dose
    r.push({ dose, acumulado })
  }
  return r
}

export function pralidoxima(pesoKg: number) {
  if (!valido(pesoKg)) return null
  const p = ORGANOFOSFORADO.pralidoxima
  return { bolusMg: p.bolusMgKg * pesoKg, infusaoMgH: p.infusaoMgKgH * pesoKg }
}

// ── Monóxido de carbono e cianeto (p. 1334–1337) ────────────────────────────

export const MONOXIDO: ItemManual = {
  id: 'co', nome: 'Monóxido de carbono — oxigenoterapia hiperbárica',
  texto: 'O2 100% em máscara não reinalante. Hiperbárica nos graves: COHb > 25%; COHb > 20% em gestante; pH < 7,1; isquemia de órgão-alvo; perda de consciência. COHb normal: até 3% (não tabagista), 10–15% (tabagista)',
  pagina: 'p. 1334–1335',
}

export const CIANETO = {
  suspeita: 'lactato ≥ 10 mmol/L (90 mg/dL) em inalação de fumaça; nitroprussiato: evitar > 2 µg/kg/min (p. 1335–1336)',
  hidroxocobalaminaG: 5,
  hidroxocobalaminaMin: 15,
  hidroxocobalaminaMaxG: 10,
  tiossulfato: { concentracaoPct: 25, adultoG: 12.5, pagina: 'p. 1337',
    errata: 'A 1ª menção é "tiossulfato de sódio 25% 1,65 mL/kg (dose máxima 12,5 g)", sem dizer que o mL/kg é de criança (1,65 mL/kg a 25% ≈ 412 mg/kg, perto dos 400 mg/kg pediátricos citados logo abaixo). Para o adulto, o próprio parágrafo seguinte dá 12,5 g. Calcula-se 12,5 g; o mL/kg não é usado.' },
  nitritoAmila: 'nitrito de amila 1 a 2 ampolas (0,3 mL) inalatórias em 30 s',
  nitritoSodio: { concentracaoPct: 3, ml: 10, texto: 'nitrito de sódio 3% (ampola de 10 mL) 10 mL EV lento' },
  sequencia: 'Hidroxocobalamina 5 g (pré-hospitalar e no DE, em 15 min, repetível até 10 g no total contando o pré-hospitalar). Persistindo repercussão: tiossulfato de sódio 25%. Sem hidroxocobalamina: nitrito de amila → nitrito de sódio → tiossulfato 12,5 g EV.',
  pagina: 'p. 1337',
}

/** Próxima dose de hidroxocobalamina respeitando o total de 10 g, já contando o que foi feito (p. 1337). */
export function hidroxocobalaminaProxima(jaFeitoG: number): { doseG: number; restanteDepoisG: number } | null {
  if (!Number.isFinite(jaFeitoG) || jaFeitoG < 0) return null
  const restante = Math.max(0, CIANETO.hidroxocobalaminaMaxG - jaFeitoG)
  const dose = Math.min(CIANETO.hidroxocobalaminaG, restante)
  return { doseG: dose, restanteDepoisG: restante - dose }
}

/** mL de uma solução a X% (g/100 mL) para uma dose em gramas. */
export const mlDaSolucao = (g: number, pct: number) => (g * 100) / pct

export const tiossulfatoAdultoMl = () => mlDaSolucao(CIANETO.tiossulfato.adultoG, CIANETO.tiossulfato.concentracaoPct)
export const nitritoSodioMg = () => (CIANETO.nitritoSodio.ml * CIANETO.nitritoSodio.concentracaoPct * 1000) / 100

/** Valores pediátricos que o capítulo traz e que esta ficha de adulto não implementa. */
export const PEDIATRICO_CITADO = [
  'hidroxocobalamina 70 mg/kg em crianças (p. 1337)',
  'tiossulfato 400 mg/kg em crianças; 1,65 mL/kg a 25% (p. 1337)',
  'nitrito de sódio 0,15–0,33 mL/kg em 100 mL de SF em 10 min em crianças (p. 1337)',
  'irrigação com PEG: 0,5 L/h (9 meses–6 anos) e 1 L/h (6–12 anos) (p. 1303–1304)',
]
