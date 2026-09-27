import { fichaAdulto } from './fonte.ts'

// Distúrbios eletrolíticos e reposições do adulto — Manual de Medicina de
// Emergência do HCFMUSP (3ª ed., 2022): cap. 67 (potássio, p. 900–917),
// cap. 68 (cálcio, p. 918–930) e Anexo 5 "Reposições" (p. 1498–1503).
// A ferramenta calcula a partir da apresentação que o livro declara e mostra o
// esquema como "o manual traz"; a decisão é do profissional (ADR 0007).
// Hiperpotassemia fica fora daqui: o app já tem regra própria (hiperpotassemia.ts).

export const fichaReposicaoPotassio = fichaAdulto('adulto-reposicao-potassio', 'Hipocalemia — reposição de potássio', 'cap. 67, p. 900–907, e Anexo 5 — Reposições, p. 1498–1499')
export const fichaReposicaoMagnesio = fichaAdulto('adulto-reposicao-magnesio', 'Hipomagnesemia — reposição de magnésio', 'Anexo 5 — Reposições, p. 1501–1502; cap. 67, p. 907; cap. 68, p. 922')
export const fichaReposicaoCalcio = fichaAdulto('adulto-reposicao-calcio', 'Hipocalcemia — cálcio corrigido e reposição', 'cap. 68, p. 919–924, e Anexo 5 — Reposições, p. 1500 e 1503')
export const fichaHipercalcemia = fichaAdulto('adulto-hipercalcemia', 'Hipercalcemia — cálcio corrigido, FECa e tratamento agudo', 'cap. 68, p. 919 e 924–928')
export const fichaReposicaoFosforo = fichaAdulto('adulto-reposicao-fosforo', 'Hipofosfatemia — reposição de fósforo', 'Anexo 5 — Reposições, p. 1501')

/** Trecho do livro mostrado na tela, sempre com página. */
export type Referencia = { texto: string; pagina: string; errata?: string }

const ok = (...xs: (number | undefined)[]) => xs.every((x) => x !== undefined && Number.isFinite(x))
const pos = (...xs: (number | undefined)[]) => ok(...xs) && xs.every((x) => (x as number) > 0)

// ─────────────────────────────── Potássio ───────────────────────────────

export type ApresentacaoK = {
  id: 'kcl-10' | 'kcl-191' | 'xarope-6' | 'capsula-600'
  nome: string
  via: 'EV' | 'VO'
  unidade: 'mL' | 'cápsula'
  /** mEq de K+ por mL (ou por cápsula) */
  mEqPorUnidade: number
  /** volume da ampola, nas formulações EV */
  ampolaMl?: number
  pagina: string
}

/** Tabela 4 do cap. 67 (p. 907) = coluna "Apresentação" do Anexo 5 (p. 1498). */
export const APRESENTACOES_K: ApresentacaoK[] = [
  { id: 'kcl-10', nome: 'KCl 10% — ampola de 10 mL = 13,4 mEq', via: 'EV', unidade: 'mL', mEqPorUnidade: 13.4 / 10, ampolaMl: 10, pagina: 'p. 907 e 1498' },
  { id: 'kcl-191', nome: 'KCl 19,1% — ampola de 10 mL = 25 mEq', via: 'EV', unidade: 'mL', mEqPorUnidade: 25 / 10, ampolaMl: 10, pagina: 'p. 907 e 1498' },
  { id: 'xarope-6', nome: 'KCl xarope 6% — 15 mL = 12 mEq', via: 'VO', unidade: 'mL', mEqPorUnidade: 12 / 15, pagina: 'p. 907 e 1498' },
  { id: 'capsula-600', nome: 'KCl cápsula 600 mg — 8 mEq/cápsula', via: 'VO', unidade: 'cápsula', mEqPorUnidade: 8, pagina: 'p. 907 e 1498' },
]
export const apresentacaoK = (id: ApresentacaoK['id']) => APRESENTACOES_K.find((a) => a.id === id)!

export type GravidadeHipocalemia = 'grave' | 'moderada' | 'leve' | 'sem hipocalemia'

/** p. 900: leve 3–3,4; moderada 2,5–2,9; grave < 2,5 mEq/L (hipocalemia < 3,5). */
export function classificarHipocalemia(k: number): GravidadeHipocalemia | null {
  if (!ok(k) || k <= 0) return null
  if (k < 2.5) return 'grave'
  if (k < 3) return 'moderada'
  if (k < 3.5) return 'leve'
  return 'sem hipocalemia'
}

export const ERRATA_HIPOCALEMIA_P905 =
  'Na p. 905 o livro chama de "grave" a faixa 2,5–3 mEq/L e de "leve a moderada" a faixa 3–3,4; a classificação usada aqui é a da p. 900 (grave < 2,5; moderada 2,5–2,9; leve 3–3,4), que é a mesma do Anexo 5 (p. 1498).'

export type EsquemaK = {
  voMEqDia: [number, number] | null
  voTexto: string
  ev: { mEq: number; horas: [number, number] } | null
  referencia: Referencia
}

/** Esquema do Anexo 5 (p. 1498) pela faixa de K e pela presença de sintomas. */
export function esquemaHipocalemia(k: number, e: { sintomatica: boolean; perdaUrinaria: boolean }): EsquemaK | null {
  const g = classificarHipocalemia(k)
  if (g === null || g === 'sem hipocalemia') return null
  if (g !== 'leve' || e.sintomatica) {
    return {
      voMEqDia: [40 * 3, 40 * 4],
      voTexto: 'VO 40 mEq 3–4 vezes ao dia',
      ev: { mEq: 20, horas: [2, 3] },
      referencia: { texto: 'Hipocalemia moderada (K < 3), grave (K < 2,5) ou sintomática (arritmia, fraqueza muscular, rabdomiólise): o manual traz reposição VO de 40 mEq 3–4 vezes ao dia + reposição EV de 20 mEq em 2–3 horas.', pagina: 'Anexo 5, p. 1498' },
    }
  }
  if (e.perdaUrinaria) {
    return {
      voMEqDia: null,
      voTexto: 'sem esquema no anexo para esta combinação',
      ev: null,
      referencia: { texto: 'O esquema de hipocalemia leve do anexo vale para quem NÃO tem perda urinária; para hipocalemia leve com perda urinária o manual não traz dose específica.', pagina: 'Anexo 5, p. 1498; cap. 67, p. 905' },
    }
  }
  return {
    voMEqDia: [20, 80],
    voTexto: 'VO 10–20 mEq 2–4 vezes ao dia (20–80 mEq/dia)',
    ev: null,
    referencia: { texto: 'Hipocalemia leve (K 3–3,4 mEq/L) sem perda urinária: o manual traz reposição VO de 10–20 mEq 2–4 vezes ao dia (20–80 mEq/dia).', pagina: 'Anexo 5, p. 1498; cap. 67, p. 905' },
  }
}

/** p. 905: cada 1 mEq/L de queda no K corresponde a ~200–400 mEq de perda corporal (se o déficit é verdadeiro). */
export function deficitPotassio(quedaMEqL: number): [number, number] | null {
  if (!ok(quedaMEqL) || quedaMEqL < 0) return null
  return [200 * quedaMEqL, 400 * quedaMEqL]
}

/** Limites da reposição EV que o livro declara (p. 905–906 e 1498–1499). */
export const LIMITES_K_EV = {
  velocidadeUsual: [10, 20] as [number, number], // mEq/h
  velocidadeMaxAmeacaVida: 40, // mEq/h
  flebiteAcimaDe: 10, // mEq/h
  concentracaoPeriferica: [20, 60] as [number, number], // mEq/L
}

export type ResultadoKEV = {
  volumeKClMl: number
  ampolas: number
  volumeTotalMl: number
  concentracaoMEqL: number
  mEqH: number
  mlH: number
  alertas: string[]
}

/** Solução de KCl EV: volume da ampola, concentração final, mEq/h e mL/h. */
export function calcularKEV(e: { mEq: number; apresentacao: 'kcl-10' | 'kcl-191'; diluenteMl: number; horas: number }): ResultadoKEV | null {
  if (!pos(e.mEq, e.horas) || !ok(e.diluenteMl) || e.diluenteMl < 0) return null
  const a = apresentacaoK(e.apresentacao)
  const volumeKClMl = e.mEq / a.mEqPorUnidade
  const ampolas = Math.ceil(volumeKClMl / a.ampolaMl! - 1e-9)
  const volumeTotalMl = volumeKClMl + e.diluenteMl
  const concentracaoMEqL = e.mEq / (volumeTotalMl / 1000)
  const mEqH = e.mEq / e.horas
  const mlH = volumeTotalMl / e.horas
  const L = LIMITES_K_EV
  const alertas: string[] = []
  if (mEqH > L.velocidadeMaxAmeacaVida) alertas.push(`Acima de ${L.velocidadeMaxAmeacaVida} mEq/h: o manual só admite até 40 mEq/h na hipocalemia ameaçadora à vida (p. 1498).`)
  else if (mEqH > L.velocidadeUsual[1]) alertas.push('Acima da velocidade usual de 10–20 mEq/h; o manual admite até 40 mEq/h só na hipocalemia ameaçadora à vida, com acesso central e monitorização (p. 905 e 1498).')
  if (mEqH > L.flebiteAcimaDe) alertas.push('Acima de 10 mEq/h: dor e flebite em veia periférica são descritas; o manual traz reduzir velocidade e aumentar a diluição (p. 906 e 1499).')
  if (concentracaoMEqL > L.concentracaoPeriferica[1]) alertas.push('Concentração acima de 20–60 mEq/L, faixa que o manual traz para veia periférica (p. 905 e 1498).')
  else if (concentracaoMEqL < L.concentracaoPeriferica[0]) alertas.push('Concentração abaixo da faixa de 20–60 mEq/L do manual para veia periférica (p. 1498).')
  if (e.diluenteMl === 0) alertas.push('Sem diluente: o manual traz KCl diluído em SF (solução salina sem glicose) (p. 905 e 1498).')
  return { volumeKClMl, ampolas, volumeTotalMl, concentracaoMEqL, mEqH, mlH, alertas }
}

/** Quantidade de xarope (mL) ou de cápsulas para uma dose VO em mEq. */
export function quantidadeKVO(mEq: number, apresentacao: 'xarope-6' | 'capsula-600'): number | null {
  if (!pos(mEq)) return null
  return mEq / apresentacaoK(apresentacao).mEqPorUnidade
}

export type LeituraUrinaK = { texto: string; pagina: string; errata?: string }

/** Tabela 2 (p. 903) e Figura 1 (p. 906): excreção urinária de K. */
export function interpretarKUrinario(e: { k24h?: number; kCrSpot?: number; naU?: number; osmU?: number; osmP?: number }): LeituraUrinaK[] {
  const out: LeituraUrinaK[] = []
  if (ok(e.k24h) && e.k24h! >= 0) {
    const k = e.k24h!
    out.push(k > 30
      ? { texto: `K urinário de 24 h ${k} mEq/dia: acima de 30 mEq/dia, o livro lê como perda urinária (renal).`, pagina: 'Tab. 2, p. 903; Fig. 1, p. 906' }
      : k < 25
        ? { texto: `K urinário de 24 h ${k} mEq/dia: abaixo de 25 mEq/dia, o fluxograma do livro segue para perda extrarrenal (após excluir influxo celular).`, pagina: 'Fig. 1, p. 906' }
        : { texto: `K urinário de 24 h ${k} mEq/dia: entre os cortes do livro (< 25 extrarrenal; > 30 renal), sem classificação.`, pagina: 'Tab. 2, p. 903; Fig. 1, p. 906' })
  }
  if (ok(e.kCrSpot) && e.kCrSpot! >= 0) {
    const r = e.kCrSpot!
    const valida = ok(e.naU, e.osmU, e.osmP) ? e.naU! > 30 && e.osmU! > e.osmP! : null
    const cond = valida === null
      ? ' O livro só considera a relação se Na urinário > 30 mEq/L e Osm urinária > Osm plasmática — informe-os para conferir.'
      : valida ? '' : ' Atenção: o livro só considera a relação se Na urinário > 30 mEq/L e Osm urinária > Osm plasmática, o que não se cumpre aqui.'
    const errata = 'No passo a passo da p. 904 o livro escreve "K/Cr < 13 mEq/g: considerar perda urinária"; a própria Tab. 2 (p. 903) e o restante do parágrafo tratam < 13 como perda extrarrenal (GI) e > 13 como perda renal. Usada a leitura da Tab. 2.'
    out.push(r > 13
      ? { texto: `K/Cr urinário ${r} mEq/g: acima de 13 mEq/g, o livro lê como perda urinária.${cond}`, pagina: 'Tab. 2, p. 903', errata }
      : r < 13
        ? { texto: `K/Cr urinário ${r} mEq/g: abaixo de 13 mEq/g, o livro lê como perda extrarrenal (gastrointestinal).${cond}`, pagina: 'Tab. 2, p. 903; p. 904', errata }
        : { texto: 'K/Cr urinário igual a 13 mEq/g: exatamente no corte do livro.', pagina: 'Tab. 2, p. 903' })
  }
  return out
}

// ─────────────────────────────── Magnésio ───────────────────────────────

/** Conversões do Anexo 5 (p. 1501): 1 mmol = 2 mEq = 24 mg de Mg elementar = 240 mg de MgSO4; MgSO4 10% 1 g = 10 mL (8 mEq [4 mmol]). */
export const MG = { mgElementarPorMmol: 24, mEqPorMmol: 2, mgSO4PorMmol: 240, mlPorGrama10: 10, mEqPorGrama: 8, mmolPorGrama: 4 }

export type GravidadeHipoMg = 'grave' | 'moderada' | 'hipomagnesemia' | 'sem hipomagnesemia'

/** Anexo 5 (p. 1501): hipomagnesemia < 2 mg/dL; moderada 1–1,5; grave < 1. */
export function classificarMagnesio(mg: number): GravidadeHipoMg | null {
  if (!ok(mg) || mg < 0) return null
  if (mg < 1) return 'grave'
  if (mg <= 1.5) return 'moderada'
  if (mg < 2) return 'hipomagnesemia'
  return 'sem hipomagnesemia'
}

/** mg/dL → mmol/L e mEq/L pelas conversões do anexo (24 mg/mmol; 2 mEq/mmol). */
export function magnesioUnidades(mgDl: number) {
  if (!ok(mgDl) || mgDl < 0) return null
  const mmolL = (mgDl * 10) / MG.mgElementarPorMmol
  return { mmolL, mEqL: mmolL * MG.mEqPorMmol }
}

/** g de MgSO4 → mL de MgSO4 10%, mEq e mmol (p. 1501). */
export function sulfatoMagnesio(g: number) {
  if (!ok(g) || g < 0) return null
  return { ml10: g * MG.mlPorGrama10, mEq: g * MG.mEqPorGrama, mmol: g * MG.mmolPorGrama }
}

export type FaixaEVMg = { gramas: [number, number]; horas: [number, number]; referencia: Referencia }

/** Reposição EV de pacientes internados estáveis, por faixa de Mg (Anexo 5, p. 1502). */
export function faixaReposicaoMgEstavel(mg: number): FaixaEVMg | null {
  if (!ok(mg) || mg < 0) return null
  const pagina = 'Anexo 5, p. 1502'
  if (mg < 1) return { gramas: [4, 8], horas: [12, 24], referencia: { texto: 'Mg < 1 mg/dL (0,4 mmol/L ou 0,8 mEq/L): o manual traz MgSO4 4–8 g em 12–24 horas.', pagina } }
  if (mg <= 1.5) return { gramas: [2, 4], horas: [4, 12], referencia: { texto: 'Mg 1–1,5 mg/dL (0,4–0,6 mmol/L ou 0,8–1,2 mEq/L): o manual traz MgSO4 2–4 g em 4–12 horas.', pagina } }
  if (mg >= 1.6 && mg <= 1.9) return { gramas: [1, 2], horas: [1, 2], referencia: { texto: 'Mg 1,6–1,9 mg/dL (0,7–0,8 mmol/L ou 1,4–1,6 mEq/L): o manual traz MgSO4 1–2 g em 1–2 horas.', pagina } }
  return null
}

/** Esquemas EV de MgSO4 que o livro traz, por contexto (para mostrar, com página). */
export const ESQUEMAS_MG: (Referencia & { id: string; gramas: [number, number]; diluenteMl: [number, number] | null; minutos: [number, number] })[] = [
  { id: 'instavel', texto: 'Hipomagnesemia sintomática grave com instabilidade hemodinâmica/arritmias: MgSO4 10% 1–2 g (10–20 mL) em 2–5 min.', pagina: 'Anexo 5, p. 1501', gramas: [1, 2], diluenteMl: null, minutos: [2, 5] },
  { id: 'grave', texto: 'Hipomagnesemia grave (< 1 mg/dL): MgSO4 10% 1–2 g (10–20 mL) diluídos em 50–100 mL de SG 5%, infusão em 5–60 min.', pagina: 'Anexo 5, p. 1501–1502', gramas: [1, 2], diluenteMl: [50, 100], minutos: [5, 60] },
  { id: 'manutencao', texto: 'Manutenção: MgSO4 10% 4–8 g (32–64 mEq [16–32 mmol]) em 12–24 horas, diluídos em 250–500 mL de SF; objetivo de manter Mg > 1 mg/dL. Reduzir a dose em 50% se DRC com ClCr < 30 mL/min/1,73 m².', pagina: 'Anexo 5, p. 1502', gramas: [4, 8], diluenteMl: [250, 500], minutos: [12 * 60, 24 * 60],
    errata: 'O livro escreve "em 12-25 horas"; no mesmo quadro, a faixa de Mg < 1 mg/dL usa 4–8 g em 12–24 horas. Usado 12–24 h.' },
  { id: 'hipocalemia', texto: 'Hipocalemia refratária com hipomagnesemia: MgSO4 1–2 g (MgSO4 10% 10–20 mL diluídos em 100 mL de SF 0,9%) em 20–30 min.', pagina: 'cap. 67, p. 907', gramas: [1, 2], diluenteMl: [100, 100], minutos: [20, 30] },
  { id: 'hipocalcemia', texto: 'Hipocalcemia com hipomagnesemia: MgSO4 10% 10–20 mL + SF 0,9% 100 mL, infundir em 10–20 min.', pagina: 'cap. 68, p. 922', gramas: [1, 2], diluenteMl: [100, 100], minutos: [10, 20] },
]

/** Infusão de MgSO4 10%: volume total, mL/h e g/h; reduz 50% se ClCr < 30 (p. 1502). */
export function infusaoMagnesio(e: { gramas: number; diluenteMl: number; minutos: number; clcrMenor30?: boolean }) {
  if (!pos(e.gramas, e.minutos) || !ok(e.diluenteMl) || e.diluenteMl < 0) return null
  const gramas = e.clcrMenor30 ? e.gramas * 0.5 : e.gramas
  const ml10 = gramas * MG.mlPorGrama10
  const volumeTotalMl = ml10 + e.diluenteMl
  const horas = e.minutos / 60
  return { gramas, ml10, mEq: gramas * MG.mEqPorGrama, mmol: gramas * MG.mmolPorGrama, volumeTotalMl, mlH: volumeTotalMl / horas, gH: gramas / horas }
}

/** VO: mg de Mg elementar/dia → cápsulas de cloreto de Mg de liberação prolongada (64–71,5 mg cada) (p. 1502). */
export function capsulasCloretoMg(mgElementarDia: number): [number, number] | null {
  if (!pos(mgElementarDia)) return null
  return [mgElementarDia / 71.5, mgElementarDia / 64]
}

// ─────────────────────────────── Cálcio ───────────────────────────────

/** p. 919: Ca corrigido = Ca medido + [(4,0 − albumina) × 0,8] (Ca em mg/dL, albumina em g/dL). */
export function calcioCorrigido(caMgDl: number, albuminaGDl: number): number | null {
  if (!pos(caMgDl) || !ok(albuminaGDl) || albuminaGDl < 0) return null
  return caMgDl + (4 - albuminaGDl) * 0.8
}

export type LeituraCalcio = { faixa: 'hipocalcemia' | 'normal' | 'hipercalcemia'; referencias: Referencia[] }

/** Cortes do cap. 68 e do Anexo 5 para o cálcio total (mg/dL). */
export function lerCalcioTotal(caT: number): LeituraCalcio | null {
  if (!pos(caT)) return null
  if (caT < 8.5) {
    const r: Referencia[] = [{ texto: 'Hipocalcemia: cálcio total < 8,5 mg/dL.', pagina: 'p. 919 e 1500' }]
    if (caT < 7) r.push({ texto: 'CaT < 7 mg/dL: faixa em que o livro situa a hipocalcemia sintomática, com cálcio EV; meta de reversão dos sintomas e CaT > 7–7,5 mg/dL.', pagina: 'p. 921–922' })
    else if (caT <= 7.5) r.push({ texto: 'CaT entre 7 e 7,5 mg/dL: o Anexo 5 inclui na hipocalcemia sintomática grave ou aguda (CaT < 7–7,5); o cap. 68 usa CaT < 7 para a sintomática.', pagina: 'p. 922 e 1500' })
    else if (caT < 8) r.push({ texto: 'CaT > 7,5 mg/dL: o Anexo 5 trata como hipocalcemia leve (ou sintomática leve/crônica), com cálcio VO 1.500–2.000 mg/dia de Ca elementar em 2–3 doses.', pagina: 'p. 1500' })
    else r.push({ texto: 'CaT 8–8,5 mg/dL: hipocalcemia leve assintomática; o manual traz reposição pela dieta ou VO (carbonato ou citrato), com aumento de 1.000 mg/dia na ingesta de cálcio usualmente suficiente.', pagina: 'p. 922 e 1500' })
    return { faixa: 'hipocalcemia', referencias: r }
  }
  if (caT > 10.5) {
    const r: Referencia[] = [{ texto: 'Hipercalcemia: cálcio total > 10,5 mg/dL.', pagina: 'p. 924' }]
    if (caT > 14) r.push({ texto: 'CaT > 14 mg/dL: hipercalcemia grave, com indicação de tratamento agudo no livro; a crise hipercalcêmica usualmente tem CaT > 14–15 mg/dL.', pagina: 'p. 926–927' })
    else if (caT > 12) r.push({ texto: 'CaT > 12 mg/dL: hipercalcemia moderada; o livro indica tratamento agudo se houver sintomas.', pagina: 'p. 927' })
    else r.push({ texto: 'CaT entre 10,5 e 12 mg/dL: fora dos cortes de tratamento agudo que o livro traz (moderada > 12 com sintomas; grave > 14).', pagina: 'p. 927' })
    return { faixa: 'hipercalcemia', referencias: r }
  }
  return { faixa: 'normal', referencias: [{ texto: 'Cálcio total entre 8,5 e 10,5 mg/dL.', pagina: 'p. 919 e 924' }] }
}

export type SalCalcio = 'gluconato' | 'cloreto'

/** Ca elementar por mL da solução a 10% (Anexo 5, p. 1500; Tab. 4, p. 922) e mEq por 10 mL (p. 916). */
export const CALCIO: Record<SalCalcio, { nome: string; mgCaPorMl: number; mEqPor10Ml: number }> = {
  gluconato: { nome: 'Gluconato de cálcio 10%', mgCaPorMl: 9, mEqPor10Ml: 4.6 },
  cloreto: { nome: 'Cloreto de cálcio 10%', mgCaPorMl: 27, mEqPor10Ml: 13.6 },
}

export const BOLUS_CALCIO: (Referencia & { sal: SalCalcio; ml: [number, number]; diluenteMl: [number, number]; minutos: [number, number] })[] = [
  { sal: 'gluconato', ml: [10, 20], diluenteMl: [50, 100], minutos: [10, 20], texto: 'Gluconato de cálcio 10% 1–2 g (10–20 mL) diluído em 50–100 mL de SG 5%; infusão em 10–20 min.', pagina: 'Anexo 5, p. 1500 (Tab. 4 do cap. 68, p. 922, traz SG 5% 100 mL)',
    errata: 'O anexo escreve "diluído em 50-100 mg de SG 5%"; a unidade é mL.' },
  { sal: 'cloreto', ml: [8, 10], diluenteMl: [100, 100], minutos: [10, 20], texto: 'Cloreto de cálcio 10% + SG 5% 100 mL; risco de necrose tecidual se extravasar, preferência por acesso venoso central.', pagina: 'Anexo 5, p. 1500; Tab. 4, p. 922',
    errata: 'O volume diverge dentro do livro: o Anexo 5 (p. 1500) traz 8 mL; a Tab. 4 do cap. 68 (p. 922) traz 1 g (10 mL). As duas quantidades aparecem aqui; a escolha é do prescritor.' },
]

/** mg de Ca elementar e mEq num volume da solução a 10%. */
export function calcioElementar(sal: SalCalcio, ml: number) {
  if (!ok(ml) || ml < 0) return null
  const c = CALCIO[sal]
  return { mgCa: ml * c.mgCaPorMl, mEq: (ml / 10) * c.mEqPor10Ml }
}

/** Velocidade de um bolus diluído (mL/h na bomba). */
export function velocidadeBolus(mlDroga: number, diluenteMl: number, minutos: number): number | null {
  if (!ok(mlDroga, diluenteMl) || mlDroga < 0 || diluenteMl < 0 || !pos(minutos)) return null
  return ((mlDroga + diluenteMl) / minutos) * 60
}

/** Infusão contínua sugerida: gluconato 10% 110 mL + SG 5% ou SF 890 mL (p. 922 e 1500). Concentração calculada do preparo. */
export const INFUSAO_CALCIO = {
  gluconatoMl: 110,
  diluenteMl: 890,
  /** mg de Ca elementar/mL: 110 × 9 / 1.000 = 0,99 (o livro arredonda para 1 mg/mL) */
  concentracaoMgMl: (110 * 9) / (110 + 890),
  faixaMgKgH: [0.5, 1.5] as [number, number],
  inicioMlH: 50,
  horas: [6, 12] as [number, number],
}

export function infusaoCalcioMlH(doseMgKgH: number, pesoKg: number): number | null {
  if (!ok(doseMgKgH) || doseMgKgH < 0 || !pos(pesoKg)) return null
  return (doseMgKgH * pesoKg) / INFUSAO_CALCIO.concentracaoMgMl
}

export function infusaoCalcioDose(mlH: number, pesoKg: number): number | null {
  if (!ok(mlH) || mlH < 0 || !pos(pesoKg)) return null
  return (mlH * INFUSAO_CALCIO.concentracaoMgMl) / pesoKg
}

/** Carbonato de cálcio 1.250 mg = 500 mg de Ca elementar (p. 923 e 1500). */
export function comprimidosCarbonato(mgCaElementarDia: number): number | null {
  if (!pos(mgCaElementarDia)) return null
  return mgCaElementarDia / 500
}

/** FECa = (Ca urinário × fluxo urinário) / (Ca plasmático × TFG) (p. 925); < 0,01 na hipercalcemia hipocalciúrica familiar (p. 924). */
export function fracaoExcrecaoCalcio(e: { caU: number; fluxoMlMin: number; caP: number; tfgMlMin: number }): number | null {
  if (!ok(e.caU, e.fluxoMlMin) || e.caU < 0 || e.fluxoMlMin < 0 || !pos(e.caP, e.tfgMlMin)) return null
  return (e.caU * e.fluxoMlMin) / (e.caP * e.tfgMlMin)
}

/** Tabela 7 (p. 927–928): o que depende do peso vira número; o resto é mostrado como o livro traz. */
export function tratamentoHipercalcemia(pesoKg: number) {
  const p = pos(pesoKg) ? pesoKg : null
  return {
    prednisonaMg: p === null ? null : p * 1,
    calcitoninaUI: p === null ? null : ([4 * p, 8 * p] as [number, number]),
    soroMlH: [200, 300] as [number, number],
    pamidronatoMlH: [250 / 4, 250 / 2] as [number, number],
  }
}

export const TABELA7_HIPERCALCEMIA: Referencia[] = [
  { texto: 'SF 4–6 L/dia (200–300 mL/h → débito urinário 100–150 mL/h).', pagina: 'Tab. 7, p. 927',
    errata: 'As duas formas da dose não coincidem: 4–6 L/dia são 167–250 mL/h, e 200–300 mL/h são 4,8–7,2 L/dia. Os dois números aparecem aqui como o livro traz.' },
  { texto: 'Furosemida: dose individualizada; não prescrever antes de garantir a reidratação e restaurar a diurese.', pagina: 'Tab. 7, p. 927' },
  { texto: 'Pamidronato 90 mg + SF 250 mL em 2–4 horas; não repetir em menos de 7 dias.', pagina: 'Tab. 7, p. 927' },
  { texto: 'Ácido zoledrônico 4 mg IV em 15 min; pode ser repetido se necessário.', pagina: 'Tab. 7, p. 927' },
  { texto: 'Prednisona 1 mg/kg (linfoma, mieloma, doenças granulomatosas, intoxicação por vitamina D).', pagina: 'Tab. 7, p. 928' },
  { texto: 'Calcitonina 4–8 UI/kg IM ou SC de 12/12 h por 48 h; só se CaT > 14 mg/dL, nunca isolada (taquifilaxia).', pagina: 'Tab. 7, p. 928' },
]

// ─────────────────────────────── Fósforo ───────────────────────────────

/** mg de fósforo por mmol, do próprio anexo: 93 mg/mL = 3 mmol/mL (p. 1501). */
export const PO4_MG_POR_MMOL = 93 / 3

export type GravidadeHipoPO4 = 'grave' | 'moderada' | 'hipofosfatemia' | 'sem hipofosfatemia'

/** Anexo 5 (p. 1501): hipofosfatemia < 2,5 mg/dL; moderada 1–2; grave < 1. */
export function classificarFosforo(po4: number): GravidadeHipoPO4 | null {
  if (!ok(po4) || po4 < 0) return null
  if (po4 < 1) return 'grave'
  if (po4 <= 2) return 'moderada'
  if (po4 < 2.5) return 'hipofosfatemia'
  return 'sem hipofosfatemia'
}

export const fosforoMmolL = (mgDl: number) => (ok(mgDl) && mgDl >= 0 ? (mgDl * 10) / PO4_MG_POR_MMOL : null)

export type SalFosfato = 'potassio' | 'sodio'
/** Formulação EV (p. 1501): 3 mmol PO4/mL; 4 mEq Na/mL ou 4,4 mEq K/mL. */
export const FOSFATO_EV: Record<SalFosfato, { nome: string; mmolPorMl: number; mEqCationPorMl: number; cation: 'K' | 'Na' }> = {
  potassio: { nome: 'Fosfato de potássio (3 mmol PO4/mL; 4,4 mEq K/mL)', mmolPorMl: 3, mEqCationPorMl: 4.4, cation: 'K' },
  sodio: { nome: 'Fosfato de sódio (3 mmol PO4/mL; 4 mEq Na/mL)', mmolPorMl: 3, mEqCationPorMl: 4, cation: 'Na' },
}

export type EsquemaPO4 = { id: 'grave-critico' | 'moderada-vm'; nome: string; mmolKg: [number, number]; horas: [number, number]; maxMmol: number; referencia: Referencia }

export const ESQUEMAS_PO4_IV: EsquemaPO4[] = [
  { id: 'grave-critico', nome: 'Grave em paciente crítico ou sintomático', mmolKg: [0.25, 0.5], horas: [8, 12], maxMmol: 80,
    referencia: { texto: 'Hipofosfatemia grave em paciente crítico ou sintomático: o manual traz reposição IV de 0,25–0,5 mmol/kg em 8–12 horas (máximo de 80 mmol).', pagina: 'Anexo 5, p. 1501' } },
  { id: 'moderada-vm', nome: 'Moderada em ventilação mecânica', mmolKg: [0.08, 0.24], horas: [6, 6], maxMmol: 30,
    referencia: { texto: 'Hipofosfatemia moderada em ventilação mecânica: o manual traz reposição IV de 0,08–0,24 mmol/kg em 6 horas (máximo de 30 mmol).', pagina: 'Anexo 5, p. 1501' } },
]

export const PO4_INFUSAO_MAX_MMOL_H = 7.5

export function reposicaoFosforoIV(e: { esquema: EsquemaPO4['id']; pesoKg: number; mmolKg: number; horas: number; sal: SalFosfato }) {
  const esq = ESQUEMAS_PO4_IV.find((x) => x.id === e.esquema)
  if (!esq || !pos(e.pesoKg, e.mmolKg, e.horas)) return null
  const bruto = e.mmolKg * e.pesoKg
  const mmol = Math.min(bruto, esq.maxMmol)
  const f = FOSFATO_EV[e.sal]
  const ml = mmol / f.mmolPorMl
  const mmolH = mmol / e.horas
  const alertas: string[] = []
  if (bruto > esq.maxMmol) alertas.push(`A conta por peso (${Math.round(bruto * 10) / 10} mmol) passou do máximo de ${esq.maxMmol} mmol do esquema; limitado ao máximo.`)
  if (e.mmolKg < esq.mmolKg[0] || e.mmolKg > esq.mmolKg[1]) alertas.push('Dose por kg fora da faixa do esquema no manual.')
  if (e.horas < esq.horas[0] || e.horas > esq.horas[1]) alertas.push('Tempo de infusão fora do que o esquema traz.')
  if (mmolH > PO4_INFUSAO_MAX_MMOL_H) alertas.push('Acima da infusão máxima de 7,5 mmol/hora do manual (p. 1501).')
  return { mmol, ml, mEqCation: ml * f.mEqCationPorMl, cation: f.cation, mmolH, alertas }
}

/** VO: fosfato de sódio comprimido = 250 mg de PO4 elementar (8 mmol) (p. 1501); esquema 30–80 mmol/dia em 2–3 doses. */
export function comprimidosFosfato(mmolDia: number): number | null {
  if (!pos(mmolDia)) return null
  return mmolDia / 8
}

export const REFERENCIAS_PO4: Referencia[] = [
  { texto: 'Considerar reposição endovenosa em casos sintomáticos ou hipofosfatemia grave; monitorizar PO4 a cada 6 horas na reposição parenteral.', pagina: 'Anexo 5, p. 1501' },
  { texto: 'Modificar a reposição para VO quando PO4 > 1,5 mg/dL (0,48 mmol/L).', pagina: 'Anexo 5, p. 1501' },
  { texto: 'Moderada em ventilação espontânea: reposição oral de 30–80 mmol/dia em 2–3 doses. O livro põe entre parênteses "1.000 mg/dia de PO4 elementar", que corresponde a ~32 mmol (limite inferior da faixa).', pagina: 'Anexo 5, p. 1501' },
]
