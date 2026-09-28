import { fichaAdulto } from './fonte.ts'
import { INFUSOES_ADULTO, concentracao, velocidadeAdulto } from './infusoes.ts'
import type { Faixa } from './pcr.ts'

// Insuficiência cardíaca aguda do adulto — Manual de Medicina de Emergência do
// HCFMUSP (3ª ed., 2022), cap. 21, p. 286–303. Perfil hemodinâmico, faixa de
// PAS da Figura 1, cortes laboratoriais, doses por peso e resposta ao
// diurético. Diluição e mL/h das infusões vêm do Anexo 1 (infusoes.ts); a
// faixa de dose do capítulo é mostrada à parte. A conduta é do médico (ADR 0007).

export const fichaIcAgudaAdulto = fichaAdulto(
  'adulto-ic-aguda',
  'Insuficiência cardíaca aguda — adulto',
  'cap. 21 Insuficiência cardíaca aguda, p. 286–303 (Figura 1, p. 302); preparo das infusões: Anexo 1, p. 1486–1489',
)

const valido = (x: number) => Number.isFinite(x) && x > 0
const vezes = (f: Faixa, k: number): Faixa => [f[0] * k, f[1] * k]

// ── Classificação e perfil (p. 286, 289–291) ────────────────────────────────

export type ClasseFe = { rotulos: string[]; nota?: string }

/** FE: preservada ≥ 50%, levemente reduzida 40–49%, reduzida ≤ 40% (p. 286). 40% cai em duas. */
export function classificarFe(fe: number): ClasseFe | null {
  if (!Number.isFinite(fe) || fe <= 0 || fe > 100) return null
  const r: string[] = []
  if (fe >= 50) r.push('preservada (≥ 50%)')
  if (fe >= 40 && fe <= 49) r.push('levemente reduzida (40–49%)')
  if (fe <= 40) r.push('reduzida (≤ 40%)')
  if (r.length === 0) return { rotulos: [], nota: 'Entre 49 e 50% o livro não tem faixa (as faixas são em números inteiros).' }
  return { rotulos: r, nota: r.length > 1 ? 'O livro coloca 40% nas duas faixas ("40-49%" e "≤ 40%").' : undefined }
}

export type Perfil = 'A' | 'B' | 'C' | 'L'

/** Perfil (p. 291): quente/frio × seco/úmido. A = quente e seco; B = quente e congesto; C = frio e congesto; L = frio e seco. */
export function perfilHemodinamico(malPerfundido: boolean, congesto: boolean): Perfil {
  if (malPerfundido) return congesto ? 'C' : 'L'
  return congesto ? 'B' : 'A'
}

export const PERFIS: Record<Perfil, { nome: string; texto: string; pagina: string }> = {
  A: { nome: 'A — quente e seco', texto: 'Titular medicações de IC; considerar diagnósticos diferenciais.', pagina: 'p. 298' },
  B: { nome: 'B — quente e congesto', texto: 'Diurético de alça; vasodilatador de acordo com a PA (nitroglicerina, nitroprussiato, iECA, BRA, hidralazina e isossorbida); VNI (CPAP ou EPAP/IPAP).', pagina: 'p. 296' },
  C: { nome: 'C — frio e congesto', texto: 'Óbito ou transplante no dobro do perfil B. Diurético de alça; inotrópico se baixo débito ou choque; vasodilatador se normo ou hipertenso; noradrenalina se choque com hipotensão (PAM alvo 65 mmHg); considerar suporte mecânico.', pagina: 'p. 296–298' },
  L: { nome: 'L — frio e seco', texto: 'A maioria está hipovolêmica (abuso de diurético); reposição volêmica em geral é suficiente; sem melhora e com baixo débito, inotrópico.', pagina: 'p. 298' },
}

/** Faixa de PAS da Figura 1 (p. 302): ≥ 140, 85–140, < 85. 140 aparece em duas colunas. */
export function faixaPasFigura(pas: number): string[] | null {
  if (!valido(pas)) return null
  const r: string[] = []
  if (pas >= 140) r.push('PAS ≥ 140 mmHg')
  if (pas >= 85 && pas <= 140) r.push('PAS 85–140 mmHg')
  if (pas < 85) r.push('PAS < 85 mmHg')
  return r
}

/** O que a Figura 1 lista em cada coluna (texto da figura, p. 302). */
export const FIGURA1_COLUNAS = [
  { pas: 'PAS ≥ 140 mmHg', perfil: 'Boa perfusão e congestão', itens: 'VNI; morfina se dispneia; NTG ou nitroprussiato; furosemida EV; manter BB, IECA ou BRA' },
  { pas: 'PAS 85–140 mmHg', perfil: 'Boa perfusão e congestão', itens: 'VNI; NTG EV; furosemida EV; manter BB, IECA e BRA' },
  { pas: 'PAS 85–140 mmHg', perfil: 'Má perfusão e congestão', itens: 'VNI; NTG EV; considerar dobutamina ou levosimendana; furosemida EV; reduzir BB; suspender IECA e BRA' },
  { pas: 'PAS < 85 mmHg', perfil: 'Boa perfusão e congestão', itens: 'VNI; furosemida EV ou VO; reduzir BB; considerar suspender IECA e BRA; considerar dobutamina' },
  { pas: 'PAS < 85 mmHg', perfil: 'Má perfusão e congestão', itens: 'VNI ou IOT; furosemida EV; NE se PAS < 75 mmHg; dobutamina quando PAS ≥ 80 mmHg; suspender BB, IECA e BRA; considerar BIA e dispositivo de assistência ventricular' },
  { pas: 'PAS < 85 mmHg', perfil: 'Má perfusão sem congestão', itens: 'Reposição volêmica; considerar inotrópicos, vasopressores e outras medidas se sem resposta' },
]

// ── Prognóstico e laboratório (p. 292–294) ──────────────────────────────────

export type PrognosticoIc = { alteradas: string[]; n: number; texto: string }

/** Três variáveis (p. 292): ureia > 90 mg/dL, PAS < 115 mmHg, creatinina > 2,7 mg/dL. */
export function prognosticoIc(ureia: number, pas: number, creatinina: number): PrognosticoIc | null {
  if (![ureia, pas, creatinina].every(valido)) return null
  const alteradas: string[] = []
  if (ureia > 90) alteradas.push('ureia > 90 mg/dL')
  if (pas < 115) alteradas.push('PAS < 115 mmHg')
  if (creatinina > 2.7) alteradas.push('creatinina > 2,7 mg/dL')
  const n = alteradas.length
  const texto = n === 3 ? 'três achados: mortalidade maior que 20%' : n === 2 ? 'duas variáveis alteradas: mortalidade próxima a 15%' : 'o livro não dá mortalidade para 0 ou 1 variável alterada'
  return { alteradas, n, texto }
}

/** BNP (Tabela 4, p. 293): < 100 improvável; > 400 provável; entre os cortes o livro não classifica. */
export function leituraBnp(bnp: number): string | null {
  if (!Number.isFinite(bnp) || bnp < 0) return null
  if (bnp < 100) return 'BNP < 100 pg/mL — IC improvável'
  if (bnp > 400) return 'BNP > 400 pg/mL — IC provável'
  return 'BNP entre 100 e 400 pg/mL — o livro não classifica'
}

/** NT-proBNP (Tabela 4, p. 293): provável ≥ 450 (< 50 anos), ≥ 900 (50–75), ≥ 1.800 (> 75); improvável < 300. */
export function leituraNtProBnp(valor: number, idade: number): string | null {
  if (!Number.isFinite(valor) || valor < 0 || !valido(idade)) return null
  const corte = idade < 50 ? 450 : idade <= 75 ? 900 : 1800
  if (valor >= corte) return `NT-proBNP ≥ ${corte.toLocaleString('pt-BR')} pg/mL para a idade — IC provável`
  if (valor < 300) return 'NT-proBNP < 300 pg/mL — IC improvável'
  return `NT-proBNP entre 300 e ${corte.toLocaleString('pt-BR')} pg/mL para a idade — o livro não classifica`
}

export const MR_PROANP_CORTE = 120 // pg/mL, p. 294

export const CORTES_IC = [
  { texto: 'Índice cardiotorácico > 0,6: achado relativamente específico para IC', pagina: 'Tabela 4, p. 292' },
  { texto: 'Creatinina > 1,5 mg/dL: indicador de pior prognóstico', pagina: 'Tabela 4, p. 293' },
  { texto: 'Strain longitudinal global < 18% com FE preservada: comprometimento sistólico de VE', pagina: 'p. 286' },
  { texto: 'Alvo de SpO2 > 95%', pagina: 'p. 296' },
  { texto: 'Choque cardiogênico: PAS < 90 mmHg por pelo menos 30 min; índice cardíaco < 2,2 L/min/m²; pressão capilar pulmonar > 15 mmHg', pagina: 'p. 297' },
  { texto: 'Internação: potássio > 6 mEq/L, entre outros critérios', pagina: 'p. 299' },
  { texto: 'Alta (múltiplas internações): 24 h de diurético VO e 24 h sem vasodilatador ou inotrópico EV; contato em 72 h; consulta em 1–2 semanas', pagina: 'Tabela 6, p. 300–301' },
]

/** Critérios de UTI com sinal vital (p. 302). Devolve os que o valor informado atinge. */
export function criteriosUti(v: { sao2?: number; fr?: number; fc?: number; pas?: number }): string[] {
  const r: string[] = []
  if (v.sao2 !== undefined && valido(v.sao2) && v.sao2 < 90) r.push('SaO2 < 90% (apesar de O2 suplementar)')
  if (v.fr !== undefined && valido(v.fr) && v.fr > 25) r.push('FR > 25 irpm')
  if (v.fc !== undefined && valido(v.fc) && (v.fc < 40 || v.fc > 130)) r.push('FC < 40 ou > 130 bpm')
  if (v.pas !== undefined && valido(v.pas) && v.pas < 90) r.push('PAS < 90 mmHg')
  return r
}

// ── Diurético (p. 296, 298) ─────────────────────────────────────────────────

export const FUROSEMIDA_ICA = {
  mgKgDose: [0.5, 1] as Faixa, maximoDiaP296: 240, maximoP298: [400, 600] as Faixa, maximoIrGrave: 1000,
  errata: 'Contradição interna: p. 296 dá "máximo 240 mg/dia"; p. 298 dá "dose máxima de furosemida é de 400-600 mg, mas para pacientes com insuficiência renal grave pode chegar a 1.000 mg". A p. 298 não diz se é por dose ou por dia. As duas aparecem; nenhuma é escolhida.',
}

export type Furosemida = { doseMg: Faixa; dobradaMg: Faixa; acimaDe240: boolean }

/** Furosemida 0,5–1,0 mg/kg/dose (p. 296) e a dose dobrada na resposta inadequada (p. 298). O livro não traz dose por uso prévio. */
export function furosemidaIca(pesoKg: number): Furosemida | null {
  if (!valido(pesoKg)) return null
  const d = vezes(FUROSEMIDA_ICA.mgKgDose, pesoKg)
  const dob = vezes(d, 2)
  return { doseMg: d, dobradaMg: dob, acimaDe240: dob[1] > FUROSEMIDA_ICA.maximoDiaP296 }
}

export type RespostaDiuretico = { criterio: string; leitura: 'atinge' | 'entre-cortes' | 'nao-atinge' }

/**
 * Resposta adequada (p. 298): sódio urinário em 2 h ≥ 50–70 mEq/L, ou débito
 * urinário em 6 h de 100–150 mL/h. O livro dá faixa de corte; entre os dois
 * números a leitura fica "entre os cortes".
 */
export function respostaDiuretico(naUrinario2h?: number, volume6hMl?: number): RespostaDiuretico[] {
  const r: RespostaDiuretico[] = []
  if (naUrinario2h !== undefined && Number.isFinite(naUrinario2h) && naUrinario2h >= 0) {
    r.push({ criterio: `Na urinário 2 h = ${naUrinario2h} mEq/L`, leitura: naUrinario2h >= 70 ? 'atinge' : naUrinario2h >= 50 ? 'entre-cortes' : 'nao-atinge' })
  }
  if (volume6hMl !== undefined && Number.isFinite(volume6hMl) && volume6hMl >= 0) {
    const mlH = volume6hMl / 6
    r.push({ criterio: `débito em 6 h = ${Math.round(mlH)} mL/h`, leitura: mlH >= 150 ? 'atinge' : mlH >= 100 ? 'entre-cortes' : 'nao-atinge' })
  }
  return r
}

// ── Infusões (p. 296–297) ───────────────────────────────────────────────────

const anexo = (id: string) => INFUSOES_ADULTO.find((i) => i.id === id)!

export type InfusaoIc = { id: string; nome: string; faixaCap: Faixa; unidade: string; pagina: string; anexoId?: string; nota?: string }

export const INFUSOES_IC: InfusaoIc[] = [
  { id: 'nitroglicerina', nome: 'Nitroglicerina', faixaCap: [10, 200], unidade: 'µg/min', pagina: 'p. 296', anexoId: 'nitroglicerina', nota: 'Em µg/min, sem peso. Preparo de 200 µg/mL (Anexo 1, igual ao cap. 19).' },
  { id: 'nitroprussiato', nome: 'Nitroprussiato', faixaCap: [0.3, 10], unidade: 'µg/kg/min', pagina: 'p. 296', anexoId: 'nitroprussiato' },
  { id: 'dobutamina', nome: 'Dobutamina', faixaCap: [2.5, 20], unidade: 'µg/kg/min', pagina: 'p. 297', anexoId: 'dobutamina', nota: 'Anexo 1: 2–20 µg/kg/min.' },
  { id: 'milrinona', nome: 'Milrinona', faixaCap: [0.375, 0.75], unidade: 'µg/kg/min', pagina: 'p. 297', anexoId: 'milrinona' },
  { id: 'noradrenalina', nome: 'Noradrenalina', faixaCap: [0.2, 1], unidade: 'µg/kg/min', pagina: 'p. 297', anexoId: 'noradrenalina', nota: 'Anexo 1: 0,02–2 µg/kg/min. PAM alvo de 65 mmHg (p. 297).' },
  { id: 'levosimendana', nome: 'Levosimendana', faixaCap: [0.05, 0.1], unidade: 'µg/kg/min por 24 h', pagina: 'p. 297', nota: 'O livro não traz preparo nem dose de ataque: só µg/min e o total em 24 h são calculados.' },
]

/** mL/h nas duas pontas da faixa do capítulo, no preparo do Anexo 1. */
export function mlHFaixaCap(item: InfusaoIc, pesoKg: number): Faixa | null {
  if (!item.anexoId) return null
  const a = anexo(item.anexoId)
  if (item.id === 'nitroglicerina') {
    const c = concentracao(a)
    return [(item.faixaCap[0] * 60) / c, (item.faixaCap[1] * 60) / c]
  }
  const x = velocidadeAdulto(a, item.faixaCap[0], pesoKg)
  const y = velocidadeAdulto(a, item.faixaCap[1], pesoKg)
  return x === null || y === null ? null : [x, y]
}

/** Levosimendana 0,05–0,1 µg/kg/min por 24 h: µg/min e mg no total das 24 h. */
export function levosimendana(pesoKg: number): { ugMin: Faixa; total24hMg: Faixa } | null {
  if (!valido(pesoKg)) return null
  const ugMin = vezes([0.05, 0.1], pesoKg)
  return { ugMin, total24hMg: vezes(ugMin, (60 * 24) / 1000) }
}

export const DIGOXINA_ICA = { semUsoPrevioMg: [0.25, 0.5] as Faixa, idosoOuIrMg: [0.0625, 0.125] as Faixa, fcCorte: 110, pagina: 'p. 298' }

export const BETABLOQUEADOR_ICA = { texto: 'Na ICA, reduzir pela metade a dose de betabloqueador de quem já usava; suspender se choque.', pagina: 'p. 298' }
