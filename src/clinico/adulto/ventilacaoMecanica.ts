import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto, pagina } from './fonte.ts'

// Ventilação mecânica no departamento de emergência — cap. 37 (p. 498–511) do
// Manual de Medicina de Emergência do HCFMUSP (3ª ed., 2022). A regra faz as
// contas de mecânica (resistência, complacência estática, constante de tempo,
// driving pressure), o volume corrente pelo peso que o usuário informa, a
// relação I:E, a posição da FiO2 nas tabelas de PEEP e a classe de Berlim, e
// compara números com os cortes do livro. Não escolhe modo nem parâmetro
// (ADR 0007): mostra o que a tabela do livro traz ao lado da conta.
//
// Peso: o capítulo escreve "mL/kg" sem dizer se é peso real, ideal ou predito,
// e o livro não traz fórmula de peso predito — a conta usa o peso informado.
//
// A VM na asma (p. 416) e na DPOC (p. 425) já está em asmaDpoc.ts; aqui entra
// só a Tabela 4 do cap. 37 ("obstruído grave"), que é outra tabela.

export const fichaVmAjusteAdulto = fichaAdulto('adulto-vm-ajuste-inicial', 'Ventilação mecânica — ajuste inicial (adulto)', 'cap. 37, p. 498–504 e 509')
export const fichaVmObstruidoAdulto = fichaAdulto('adulto-vm-obstruido-grave', 'Ventilação mecânica no obstruído grave (adulto)', 'cap. 37, Tabela 4, p. 504–505')
export const fichaMecanicaAdulto = fichaAdulto('adulto-vm-mecanica', 'Mecânica ventilatória — resistência, complacência e constante de tempo (adulto)', 'cap. 37, p. 499–500 e 506')
// .2: VT moderada/grave 4–6 mL/kg (errata da p. 506, que imprime 3–6)
// Versão 2026-09-28.1: definição global de SDRA 2024, diretriz ATS 2024 e
// diretriz ESICM 2023 (textos integrais lidos) ao lado do cap. 37.

export const DEFINICAO_GLOBAL_SDRA_2024: Fonte = {
  citacao: 'Matthay MA, Arabi Y, Arroliga AC, et al. A New Global Definition of Acute Respiratory Distress Syndrome. Am J Respir Crit Care Med. 2024;209(1):37–47. Tabela 1.',
  url: 'https://doi.org/10.1164/rccm.202303-0558WS',
}

export const ATS_SDRA_2024: Fonte = {
  citacao: 'Qadir N, Sahetya S, Munshi L, et al. An Update on Management of Adult Patients with Acute Respiratory Distress Syndrome: An Official American Thoracic Society Clinical Practice Guideline. Am J Respir Crit Care Med. 2024;209(1):24–36. Resumo executivo e Figura 1.',
  url: 'https://doi.org/10.1164/rccm.202311-2011ST',
}

export const ESICM_SDRA_2023: Fonte = {
  citacao: 'Grasselli G, Calfee CS, Camporota L, et al. ESICM guidelines on acute respiratory distress syndrome: definition, phenotyping and respiratory support strategies. Intensive Care Med. 2023;49:727–759. Recomendações 3.1, 5.1, 6.3, 6.4, 7.1, 7.2, 8.1, 9.1 e 9.2.',
  url: 'https://doi.org/10.1007/s00134-023-07050-7',
}

const PAG_SDRA = 'cap. 37, p. 505–508; VT: p. 127 e 403'

export const fichaSdraAdulto: Ficha = {
  ...fichaAdulto('adulto-vm-sdra', 'SDRA — Berlim, definição global 2024, ventilação protetora e tabelas PEEP × FiO2 (adulto)', PAG_SDRA),
  versao: '2026-09-28.1',
  fontes: [pagina(PAG_SDRA), DEFINICAO_GLOBAL_SDRA_2024, ATS_SDRA_2024, ESICM_SDRA_2023],
  revisadoEm: '28/09/2026 (definição global 2024, ATS 2024 e ESICM 2023 lidas no texto; manual mantido como base)',
}
export const fichaDesmameAdulto = fichaAdulto('adulto-vm-desmame', 'Desmame e teste de respiração espontânea (adulto)', 'cap. 37, Figura 5, p. 510')

export type Faixa = [number, number]

const valido = (x: number | undefined): x is number => x !== undefined && Number.isFinite(x) && x > 0
const naoNeg = (x: number | undefined): x is number => x !== undefined && Number.isFinite(x) && x >= 0

// ---------------------------------------------------------------- indicações

/** p. 498: principais indicações de VM. */
export const INDICACOES_VM = [
  { texto: 'Hipoxemia (PO2 < 60) associada a esforço respiratório sem melhora após aporte adequado de O2 (cateter nasal, máscara de Venturi, máscara não reinalante e VNI quando indicada)', pagina: 'p. 498' },
  { texto: 'Hipercapnia (PCO2 > 55) em pacientes não retentores crônicos, principalmente quando associada a falência ventilatória e/ou carbonarcose', pagina: 'p. 498' },
]

/** Cortes numéricos da p. 498 atingidos (o livro exige também o contexto clínico, que a tela só lista). */
export function cortesIndicacaoVm(g: { po2?: number; pco2?: number }): string[] {
  const r: string[] = []
  if (valido(g.po2) && g.po2 < 60) r.push('PO2 < 60 mmHg (com esforço respiratório sem melhora após O2 adequado)')
  if (valido(g.pco2) && g.pco2 > 55) r.push('PCO2 > 55 mmHg (em não retentor crônico)')
  return r
}

// ---------------------------------------------------------------- mecânica

/** p. 499: valores normais em VM. */
export const NORMAL_MECANICA = { resistencia: [4, 8] as Faixa, complacencia: [50, 80] as Faixa, constantesEsvaziamento: [3, 5] as Faixa, pagina: 'p. 499' }

/** p. 499–500: condições para o cálculo. */
export const CONDICOES_MECANICA = [
  'Modo ventilação por volume controlado',
  'Curva de fluxo quadrada (unidade convertida para L/s)',
  'Sem esforço muscular respiratório, de preferência sedado e bloqueado',
  'Pausa inspiratória de 2–3 segundos (sem vazamento no sistema)',
]

/** Figura 2 (p. 499): exemplo do livro — VC 500 mL, fluxo 60 L/min (1 L/s), Ppico 40, Pplatô 30, PEEP 5 → Rva 10, Cst 20. */
export const EXEMPLO_FIGURA2 = { vcMl: 500, fluxoLMin: 60, ppico: 40, pplato: 30, peep: 5, rva: 10, cst: 20 }

export const lMinParaLs = (lmin: number) => lmin / 60

/** Resistência (p. 499): (Ppico − Pplatô)/fluxo, em cmH2O/L/s; fluxo informado em L/min. */
export function resistencia(ppico: number, pplato: number, fluxoLMin: number): number | null {
  if (!valido(ppico) || !valido(pplato) || !valido(fluxoLMin) || ppico < pplato) return null
  return (ppico - pplato) / lMinParaLs(fluxoLMin)
}

/** Complacência estática (p. 499): VC/(Pplatô − PEEP), em mL/cmH2O. */
export function complacenciaEstatica(vcMl: number, pplato: number, peep: number): number | null {
  if (!valido(vcMl) || !valido(pplato) || !naoNeg(peep) || pplato <= peep) return null
  return vcMl / (pplato - peep)
}

/** Driving pressure (p. 506): Pplatô − PEEP; o livro diz evitar > 15 cmH2O. */
export function drivingPressure(pplato: number, peep: number): number | null {
  if (!valido(pplato) || !naoNeg(peep) || pplato < peep) return null
  return pplato - peep
}

export const DRIVING_MAX = 15
export const PLATO_MAX = 30

/**
 * Constante de tempo (p. 499): resistência × complacência estática. Com R em
 * cmH2O/L/s e Cst em mL/cmH2O, a Cst vai para L/cmH2O e o resultado sai em
 * segundos; 3 a 5 constantes = tempo para o esvaziamento alveolar adequado.
 */
export function constanteTempo(rCmH2OLs: number, cstMl: number): { tauS: number; esvaziamentoS: Faixa } | null {
  if (!valido(rCmH2OLs) || !valido(cstMl)) return null
  const tauS = rCmH2OLs * (cstMl / 1000)
  return { tauS, esvaziamentoS: [3 * tauS, 5 * tauS] }
}

export type Mecanica = {
  resistencia: number | null
  complacencia: number | null
  driving: number | null
  tau: ReturnType<typeof constanteTempo>
  notas: string[]
}

/** Tudo de uma vez, com a posição em relação às faixas do livro. */
export function mecanica(m: { vcMl: number; fluxoLMin: number; ppico: number; pplato: number; peep: number }): Mecanica {
  const r = resistencia(m.ppico, m.pplato, m.fluxoLMin)
  const c = complacenciaEstatica(m.vcMl, m.pplato, m.peep)
  const d = drivingPressure(m.pplato, m.peep)
  const tau = r !== null && c !== null ? constanteTempo(r, c) : null
  const notas: string[] = []
  const [r0, r1] = NORMAL_MECANICA.resistencia
  const [c0, c1] = NORMAL_MECANICA.complacencia
  if (r !== null) notas.push(r > r1 ? `Resistência acima de ${r1} cmH2O/L/s (faixa normal do livro ${r0}–${r1}, p. 499)` : r < r0 ? `Resistência abaixo de ${r0} cmH2O/L/s (faixa normal ${r0}–${r1}, p. 499)` : `Resistência na faixa normal do livro (${r0}–${r1} cmH2O/L/s, p. 499)`)
  if (c !== null) notas.push(c < c0 ? `Complacência estática abaixo de ${c0} mL/cmH2O (faixa normal do livro ${c0}–${c1}, p. 499)` : c > c1 ? `Complacência estática acima de ${c1} mL/cmH2O (faixa normal ${c0}–${c1}, p. 499)` : `Complacência estática na faixa normal do livro (${c0}–${c1} mL/cmH2O, p. 499)`)
  if (d !== null && d > DRIVING_MAX) notas.push(`Driving pressure acima de ${DRIVING_MAX} cmH2O (o livro diz evitar > ${DRIVING_MAX}, Tabela 5, p. 506)`)
  if (valido(m.pplato) && m.pplato > PLATO_MAX) notas.push(`Pplatô acima de ${PLATO_MAX} cmH2O (Tabelas 4 e 5, p. 505–506)`)
  return { resistencia: r, complacencia: c, driving: d, tau, notas }
}

/** Tabela 1 (p. 500): causas de ↓ complacência e ↑ resistência. */
export const CAUSAS_MECANICA = {
  complacencia: ['Edema agudo de pulmão', 'SDRA', 'Pneumonia', 'Atelectasia', 'Derrame pleural', 'Pneumotórax', 'Intubação seletiva', 'Fibrose pulmonar', 'Resistência da caixa torácica', 'Aumento de pressão intra-abdominal'],
  resistencia: ['Asma', 'DPOC', 'Secreção em via aérea', 'Cânula orotraqueal fina', 'Acotovelamento da COT', 'Obstrução extrínseca da via aérea (abscesso, neoplasia)'],
  pagina: 'Tabela 1, p. 500',
}

// ---------------------------------------------------------------- ciclo

/** Relação I:E (1:n) a partir da FR e do tempo inspiratório. */
export function relacaoIE(fr: number, tinsS: number): { cicloS: number; teS: number; n: number } | null {
  if (!valido(fr) || !valido(tinsS)) return null
  const cicloS = 60 / fr
  const teS = cicloS - tinsS
  if (teS <= 0) return null
  return { cicloS, teS, n: teS / tinsS }
}

/** Tempo inspiratório do VCV com fluxo quadrado (conta aritmética): VC (L) / fluxo (L/s). */
export function tinsVcv(vcMl: number, fluxoLMin: number): number | null {
  if (!valido(vcMl) || !valido(fluxoLMin)) return null
  return vcMl / 1000 / lMinParaLs(fluxoLMin)
}

/** VC nas pontas de uma faixa de mL/kg, pelo peso que o usuário informa. */
export function vcPorPeso(pesoKg: number, mlKg: Faixa): Faixa | null {
  return valido(pesoKg) ? [mlKg[0] * pesoKg, mlKg[1] * pesoKg] : null
}

// ---------------------------------------------------------------- ajuste inicial (Tabela 2)

export type Modo = 'pcv' | 'vcv' | 'psv'
export const NOME_MODO: Record<Modo, string> = { pcv: 'PCV', vcv: 'VCV', psv: 'PSV' }

/** Tabela 2 (p. 501–502), linha a linha, como impressa. */
export const TABELA2: { parametro: string; modos: Record<Modo, string> }[] = [
  { parametro: 'Disparo', modos: { pcv: 'Tempo (ventilador), pressão ou fluxo (paciente)', vcv: 'Tempo (ventilador), pressão ou fluxo (paciente)', psv: 'Pressão ou fluxo (paciente)' } },
  { parametro: 'Ciclagem', modos: { pcv: 'Tempo (ao atingir a pressão determinada no tempo inspiratório)', vcv: 'Volume (ao atingir o volume determinado)', psv: 'Queda do pico de fluxo — inicialmente 25% (alguns ventiladores permitem 5–80%)' } },
  { parametro: 'Volume corrente', modos: { pcv: 'Regular a pressão inspiratória objetivando Vt 6–8 mL/kg', vcv: 'Regulagem direta do Vt 6–8 mL/kg', psv: 'Regular a pressão de suporte objetivando Vt 6–8 mL/kg' } },
  { parametro: 'PEEP', modos: { pcv: '3–5 cmH2O inicialmente, com ajuste conforme necessário', vcv: '3–5 cmH2O inicialmente, com ajuste conforme necessário', psv: '3–5 cmH2O inicialmente, com ajuste conforme necessário' } },
  { parametro: 'FiO2', modos: { pcv: 'Inicialmente 100%, ajuste posterior objetivando SatO2 93–97%', vcv: 'Inicialmente 100%, ajuste posterior objetivando SatO2 93–97%', psv: 'SatO2 93–97%' } },
  { parametro: 'FR', modos: { pcv: '12–16 rpm, com ajuste do tempo inspiratório visando I:E 1:2 ou 1:3', vcv: '12–16 rpm, com ajuste do fluxo inspiratório visando I:E 1:2 ou 1:3', psv: 'Drive do paciente (ajustar ventilação de apneia)' } },
  { parametro: 'Específicos do modo', modos: { pcv: 'Tins 0,8–1,2 s visando I:E 1:2 ou 1:3 a depender da FR', vcv: 'Fluxo inspiratório 30–60 L/min visando I:E 1:2 ou 1:3 a depender da FR', psv: 'Velocidade do fluxo inspiratório (rampa, rise time ou slope)' } },
  { parametro: 'Aquecimento e umidificação', modos: { pcv: 'Métodos passivos; ativos se secreção espessa', vcv: 'Métodos passivos; ativos se secreção espessa', psv: 'Métodos passivos; ativos se secreção espessa' } },
]

export const AJUSTE_INICIAL = {
  vtMlKg: [6, 8] as Faixa,
  peep: [3, 5] as Faixa,
  sato2: [93, 97] as Faixa,
  fr: [12, 16] as Faixa,
  ie: [2, 3] as Faixa,
  tins: [0.8, 1.2] as Faixa,
  fluxo: [30, 60] as Faixa,
  ciclagemPsv: 25,
  pagina: 'Tabela 2, p. 501–502',
}

// ---------------------------------------------------------------- obstruído grave (Tabela 4)

export const OBSTRUIDO = {
  vtMlKg: 6,
  peep: [3, 5] as Faixa,
  fracaoAutoPeep: 0.85,
  sato2Acima: 92,
  fr: [8, 12] as Faixa,
  ieMinimo: 3,
  ieEvitarAcima: 5,
  tinsMax: 1,
  fluxoMin: 60,
  platoMax: 30,
  picoMax: 45,
  phToleravel: 7.2,
  pagina: 'Tabela 4, p. 505',
}

/** PEEP a 85% do valor da auto-PEEP (Tabela 4, p. 505). */
export const peepPorAutoPeep = (autoPeep: number) => (valido(autoPeep) ? autoPeep * OBSTRUIDO.fracaoAutoPeep : null)

/** Confere os números informados contra a Tabela 4 e o texto da p. 505. */
export function conferirObstruido(v: { fr?: number; tins?: number; fluxo?: number; pplato?: number; ppico?: number; ph?: number }): string[] {
  const r: string[] = []
  const ie = valido(v.fr) && valido(v.tins) ? relacaoIE(v.fr, v.tins) : null
  if (valido(v.fr) && (v.fr < OBSTRUIDO.fr[0] || v.fr > OBSTRUIDO.fr[1])) r.push(`FR fora de 8–12 rpm (valor inicial da Tabela 4)`)
  if (valido(v.tins) && v.tins > OBSTRUIDO.tinsMax) r.push('Tins acima de 1 s (Tabela 4: Tins ≤ 1 s)')
  if (ie && ie.n < OBSTRUIDO.ieMinimo) r.push(`I:E 1:${ie.n.toFixed(1).replace('.', ',')} — menor que 1:3 (Tabela 4: I:E ≥ 1:3)`)
  if (ie && ie.n > OBSTRUIDO.ieEvitarAcima) r.push(`I:E 1:${ie.n.toFixed(1).replace('.', ',')} — além de 1:5 (p. 505: evita-se I:E > 1:5, risco de retenção de CO2)`)
  if (valido(v.fluxo) && v.fluxo < OBSTRUIDO.fluxoMin) r.push('Fluxo abaixo de 60 L/min (Tabela 4: fluxo ≥ 60 L/min no VCV)')
  if (valido(v.pplato) && v.pplato > OBSTRUIDO.platoMax) r.push('Pplatô > 30 cmH2O (Tabela 4: evitar)')
  if (valido(v.ppico) && v.ppico > OBSTRUIDO.picoMax) r.push('Ppico > 45 cmH2O (Tabela 4: evitar)')
  if (valido(v.ph) && v.ph <= OBSTRUIDO.phToleravel) r.push('pH ≤ 7,2 — o livro tolera hipercapnia se pH > 7,2 (p. 505)')
  return r
}

export const AUTO_PEEP = {
  identificar: ['Na expiração, a curva de fluxo não toca a linha de base antes de novo disparo', 'Pausa expiratória: PEEP aferida maior que a PEEP regulada'],
  otimizar: ['Cânulas mais calibrosas se possível', 'Diminuição do espaço morto não fisiológico', 'Aumento do tempo expiratório (atentar para a constante de tempo)'],
  pagina: 'p. 504',
}

// ---------------------------------------------------------------- SDRA

export type ClasseBerlim = 'leve' | 'moderada' | 'grave'
export const NOME_BERLIM: Record<ClasseBerlim, string> = { leve: 'Leve (201–300)', moderada: 'Moderada (101–200)', grave: 'Grave (≤ 100)' }

export type LeituraBerlim = { classe: ClasseBerlim | null; nota?: string }

/**
 * Critérios de Berlim como o livro traz (p. 505): relação PO2/FiO2 com PEEP
 * ≥ 5 cmH2O — leve 201–300, moderada 101–200, grave ≤ 100. As faixas são
 * inteiras: valores fracionários entre 200 e 201 (ou 100 e 101) ficam sem
 * classe, como impresso. Só a relação P/F; o livro não lista os demais
 * critérios de Berlim no capítulo.
 */
export function berlim(pf: number, peep: number): LeituraBerlim | null {
  if (!valido(pf) || !naoNeg(peep)) return null
  if (peep < 5) return { classe: null, nota: 'PEEP < 5 cmH2O: o livro define a classe com PEEP ≥ 5 cmH2O.' }
  if (pf > 300) return { classe: null, nota: 'P/F acima de 300: fora das faixas de Berlim do livro.' }
  if (pf >= 201) return { classe: 'leve' }
  if (pf > 200) return { classe: null, nota: 'Entre 200 e 201: as faixas do livro são inteiras (moderada até 200, leve a partir de 201).' }
  if (pf >= 101) return { classe: 'moderada' }
  if (pf > 100) return { classe: null, nota: 'Entre 100 e 101: as faixas do livro são inteiras (grave até 100, moderada a partir de 101).' }
  return { classe: 'grave' }
}

/** Relação PaO2/FiO2 com FiO2 em % (21–100). */
export function relacaoPF(pao2: number, fio2Pct: number): number | null {
  if (!valido(pao2) || !valido(fio2Pct) || fio2Pct > 100) return null
  return pao2 / (fio2Pct / 100)
}

/** Tabela 5 (p. 506). */
export const SDRA = {
  vtLeve: 6,
  // Errata: a Tabela 5 (p. 506) imprime 3–6 mL/kg; o próprio livro traz 4–6 mL/kg
  // na Tabela 12 do choque séptico (p. 127) e na p. 403 ("de forma similar à SDRA").
  vtModeradaGrave: [4, 6] as Faixa,
  sato2Acima: 92,
  frInicial: 20,
  frGrave: [35, 45] as Faixa,
  tinsMax: 1,
  ieMinimo: 2,
  fluxo: [45, 60] as Faixa,
  platoMax: 30,
  drivingMax: 15,
  bnmPfAbaixo: 150,
  bnmHoras: 48,
  pronaPfAte: 150,
  pronaAposHoras: [12, 24] as Faixa,
  pronaHorasMin: 16,
  modosControladosHoras: [48, 72] as Faixa,
  phToleravel: 7.2,
  pagina: 'Tabela 5, p. 506; p. 505–507',
}

export const ERRATA_VT_SDRA =
  'A Tabela 5 (p. 506) imprime "Moderada/grave: Vt 3-6 mL/kg". O mesmo livro traz 4–6 mL/kg na Tabela 12 do choque séptico (p. 127) e na p. 403 ("volume corrente baixo (4-6 mL/kg) … de forma similar à SDRA"); a conta usa 4–6.'

/** VT da Tabela 5 conforme a classe (p. 506), pelo peso informado. */
export function vtSdra(classe: ClasseBerlim, pesoKg: number): Faixa | null {
  return classe === 'leve' ? vcPorPeso(pesoKg, [SDRA.vtLeve, SDRA.vtLeve]) : vcPorPeso(pesoKg, SDRA.vtModeradaGrave)
}

/** Qual tabela de PEEP a Tabela 5 aponta para a classe (p. 506). */
export const tabelaPeepDaClasse = (c: ClasseBerlim): 'baixo' | 'alto' => (c === 'grave' ? 'alto' : 'baixo')

/** Uma coluna das tabelas PEEP × FiO2: FiO2 e PEEP, cada um valor único ou faixa ("↔" no livro). */
export type ColunaPeep = { fio2: Faixa; peep: Faixa }

const col = (f0: number, p0: number, f1 = f0, p1 = p0): ColunaPeep => ({ fio2: [f0, f1], peep: [p0, p1] })

/** Tabela 6 (p. 506): PEEP baixo × FiO2. */
export const PEEP_BAIXO: ColunaPeep[] = [
  col(0.3, 5), col(0.4, 5), col(0.4, 8), col(0.5, 8), col(0.5, 10), col(0.6, 10), col(0.7, 10), col(0.7, 12), col(0.7, 14),
  col(0.8, 14), col(0.9, 14), col(0.9, 16), col(0.9, 18), col(1.0, 18, 1.0, 24),
]

/** Tabela 7 (p. 507): PEEP alto × FiO2, estudo ALVEOLI. */
export const PEEP_ALTO_ALVEOLI: ColunaPeep[] = [
  col(0.3, 12), col(0.3, 14), col(0.4, 14), col(0.4, 16), col(0.5, 16), col(0.5, 18), col(0.5, 20, 0.8, 20), col(0.8, 22), col(0.9, 22), col(1.0, 22, 1.0, 24),
]

/** Tabela 7 (p. 507): PEEP alto × FiO2, estudo LOVS. */
export const PEEP_ALTO_LOVS: ColunaPeep[] = [
  col(0.3, 5, 0.3, 10), col(0.4, 10, 0.4, 18), col(0.5, 18, 0.5, 20), col(0.6, 20), col(0.7, 20), col(0.8, 20, 0.8, 22), col(0.9, 22), col(1.0, 22, 1.0, 24),
]

export type TabelaPeepId = 'baixo' | 'alveoli' | 'lovs'
export const TABELAS_PEEP: Record<TabelaPeepId, { nome: string; colunas: ColunaPeep[]; pagina: string }> = {
  baixo: { nome: 'PEEP baixo × FiO2', colunas: PEEP_BAIXO, pagina: 'Tabela 6, p. 506' },
  alveoli: { nome: 'PEEP alto × FiO2 — ALVEOLI', colunas: PEEP_ALTO_ALVEOLI, pagina: 'Tabela 7, p. 507' },
  lovs: { nome: 'PEEP alto × FiO2 — LOVS', colunas: PEEP_ALTO_LOVS, pagina: 'Tabela 7, p. 507' },
}

export type LeituraPeep = { exatas: ColunaPeep[]; anterior?: ColunaPeep; seguinte?: ColunaPeep }

/**
 * Colunas da tabela cuja FiO2 é a informada (fração 0,3–1,0). Sem coluna
 * exata, devolve as vizinhas — sem interpolar, porque o livro não interpola.
 */
export function peepParaFio2(tabela: TabelaPeepId, fio2: number): LeituraPeep | null {
  if (!valido(fio2) || fio2 > 1) return null
  const cols = TABELAS_PEEP[tabela].colunas
  const eps = 1e-9
  const exatas = cols.filter((c) => fio2 >= c.fio2[0] - eps && fio2 <= c.fio2[1] + eps)
  if (exatas.length) return { exatas }
  const anteriores = cols.filter((c) => c.fio2[1] < fio2)
  const seguintes = cols.filter((c) => c.fio2[0] > fio2)
  return { exatas: [], anterior: anteriores[anteriores.length - 1], seguinte: seguintes[0] }
}

/** Confere números informados contra a Tabela 5 (p. 506). */
export function conferirSdra(v: { pplato?: number; peep?: number; fr?: number; tins?: number; fluxo?: number; ph?: number }): string[] {
  const r: string[] = []
  const d = valido(v.pplato) && naoNeg(v.peep) ? drivingPressure(v.pplato, v.peep) : null
  if (valido(v.pplato) && v.pplato > SDRA.platoMax) r.push('Pplatô > 30 cmH2O (Tabela 5: manter ≤ 30)')
  if (d !== null && d > SDRA.drivingMax) r.push(`Driving pressure ${d} cmH2O — acima de 15 (Tabela 5: evitar > 15)`)
  const ie = valido(v.fr) && valido(v.tins) ? relacaoIE(v.fr, v.tins) : null
  if (valido(v.tins) && v.tins > SDRA.tinsMax) r.push('Tins acima de 1 s (Tabela 5: Tins ≤ 1 s)')
  if (ie && ie.n < SDRA.ieMinimo) r.push(`I:E 1:${ie.n.toFixed(1).replace('.', ',')} — menor que 1:2 (Tabela 5: ≥ 1:2 para esvaziamento)`)
  if (valido(v.fr) && v.fr > SDRA.frInicial) r.push(`FR acima dos 20 rpm iniciais — o livro diz que casos graves podem precisar de 35–45 rpm (atentar para auto-PEEP)`)
  if (valido(v.fluxo) && (v.fluxo < SDRA.fluxo[0] || v.fluxo > SDRA.fluxo[1])) r.push('Fluxo fora de 45–60 L/min (Tabela 5, VCV)')
  if (valido(v.ph) && v.ph <= SDRA.phToleravel) r.push('pH ≤ 7,2 — o livro tolera hipercapnia se pH > 7,2 (p. 507)')
  return r
}

/** p. 506–507: marcos de P/F citados no capítulo. */
export function marcosPf(pf: number): string[] {
  if (!valido(pf)) return []
  const r: string[] = []
  if (pf < SDRA.bnmPfAbaixo) r.push('P/F inicial < 150: o livro cita considerar bloqueio neuromuscular por 48 horas (p. 506)')
  if (pf <= SDRA.pronaPfAte) r.push('P/F ≤ 150: critério do livro para prona quando persiste após 12–24 horas de ventilação protetora adequada; manter ≥ 16 horas se melhora (p. 507)')
  return r
}

// ---------------------------------------------------------------- definição global 2024 e diretrizes

export type SuporteSdra2024 = 'nenhum' | 'o2' | 'cnaf30' | 'vni' | 'vmi'
export type CategoriaSdra2024 = 'não intubada' | 'intubada' | 'recursos limitados'
export type GravidadeSdra2024 = 'leve' | 'moderada' | 'grave'

export type LeituraSdra2024 = { categoria: CategoriaSdra2024 | null; gravidade: GravidadeSdra2024 | null; criterioOxigenacao: boolean; notas: string[] }

/**
 * Definição global de SDRA 2024 (Tabela 1): oxigenação por P/F ≤ 300 ou S/F
 * ≤ 315 (SpO2 ≤ 97%). Não intubada: em CNAF ≥ 30 L/min ou VNI/CPAP ≥ 5.
 * Intubada (PEEP ≥ 5): leve 200 < P/F ≤ 300 ou 235 < S/F ≤ 315; moderada
 * 100 < P/F ≤ 200 ou 148 < S/F ≤ 235; grave P/F ≤ 100 ou S/F ≤ 148. Recursos
 * limitados: S/F ≤ 315 sem exigir PEEP nem fluxo. Só a oxigenação: início em
 * 1 semana, opacidades bilaterais (RX, TC ou ultrassom) e não explicado por
 * derrame/atelectasia/nódulos ficam com quem avalia.
 */
export function sdraGlobal2024(e: { pf?: number; sf?: number; spo2?: number; suporte: SuporteSdra2024; peep?: number; recursosLimitados?: boolean }): LeituraSdra2024 | null {
  const temPf = valido(e.pf)
  const sfValido = valido(e.sf) && (e.spo2 === undefined || (valido(e.spo2) && e.spo2 <= 97))
  const notas: string[] = []
  if (valido(e.sf) && valido(e.spo2) && e.spo2 > 97) notas.push('S/F só vale com SpO2 ≤ 97%: com SpO2 acima disso a relação não é usada.')
  if (!temPf && !sfValido) return null
  const porPf = temPf ? e.pf! <= 300 : false
  const porSf = sfValido ? e.sf! <= 315 : false
  const criterioOxigenacao = porPf || porSf
  const gravidadePf = (pf: number): GravidadeSdra2024 | null => (pf <= 100 ? 'grave' : pf <= 200 ? 'moderada' : pf <= 300 ? 'leve' : null)
  const gravidadeSf = (sf: number): GravidadeSdra2024 | null => (sf <= 148 ? 'grave' : sf <= 235 ? 'moderada' : sf <= 315 ? 'leve' : null)
  if (e.recursosLimitados) {
    if (!sfValido) { notas.push('Em recursos limitados a definição usa a S/F (SpO2 ≤ 97%).'); return { categoria: 'recursos limitados', gravidade: null, criterioOxigenacao: porSf, notas } }
    return { categoria: 'recursos limitados', gravidade: null, criterioOxigenacao: porSf, notas: [...notas, 'Sem exigência de PEEP, fluxo ou dispositivo; gravidade não é graduada nessa categoria.'] }
  }
  if (e.suporte === 'vmi') {
    if (!valido(e.peep) || e.peep! < 5) { notas.push('Intubada: exige PEEP ≥ 5 cmH2O em todas as gravidades.'); return { categoria: 'intubada', gravidade: null, criterioOxigenacao, notas } }
    const g = temPf ? gravidadePf(e.pf!) : gravidadeSf(e.sf!)
    if (temPf && sfValido && gravidadeSf(e.sf!) !== g) notas.push('P/F e S/F apontam gravidades diferentes; a leitura usa a P/F.')
    return { categoria: 'intubada', gravidade: g, criterioOxigenacao, notas }
  }
  if (e.suporte === 'cnaf30' || e.suporte === 'vni') return { categoria: 'não intubada', gravidade: null, criterioOxigenacao, notas: [...notas, 'Não intubada: gravidade não é graduada; CNAF com fluxo ≥ 30 L/min ou VNI/CPAP com PEEP ≥ 5.'] }
  notas.push(e.suporte === 'nenhum' ? 'Sem suporte: a definição global exige CNAF ≥ 30 L/min, VNI/CPAP ≥ 5 ou ventilação invasiva (salvo recursos limitados).' : 'O2 convencional (cateter/máscara) não cumpre o critério de suporte da definição global (salvo recursos limitados).')
  return { categoria: null, gravidade: null, criterioOxigenacao, notas }
}

/** Relação SpO2/FiO2 com FiO2 em % (21–100). */
export function relacaoSF(spo2: number, fio2Pct: number): number | null {
  if (!valido(spo2) || spo2 > 100 || !valido(fio2Pct) || fio2Pct > 100) return null
  return spo2 / (fio2Pct / 100)
}

export type ItemSdra2024 = { tema: string; diretriz: string; forca: string; fonte: string; livro: string }

export const DIRETRIZ_SDRA_2024: ItemSdra2024[] = [
  { tema: 'Volume corrente e platô', diretriz: 'Vt 4–8 mL/kg de peso predito e Pplatô < 30 cmH2O em toda SDRA', forca: 'forte, evidência moderada', fonte: 'ATS 2024 (mantida de 2017); ESICM 2023 rec. 5.1', livro: 'leve 6; moderada/grave 4–6 mL/kg; Pplatô ≤ 30 (Tabela 5, p. 506)' },
  { tema: 'Posição prona', diretriz: 'ATS: > 12 h/dia na SDRA grave. ESICM: P/F < 150 com PEEP ≥ 5 após otimização, iniciada cedo, sessões de 16 h consecutivas ou mais', forca: 'forte, evidência moderada (ATS) · forte, evidência alta (ESICM 7.1–7.2)', fonte: 'ATS 2024; ESICM 2023', livro: 'P/F ≤ 150 após 12–24 h de ventilação protetora; ≥ 16 h se melhora (p. 507)' },
  { tema: 'Manobra de recrutamento prolongada', diretriz: 'Contra (pressão ≥ 35 cmH2O por ≥ 1 min); manobras breves: sugere contra o uso rotineiro', forca: 'forte, evidência moderada (ATS e ESICM 6.3) · fraca (ESICM 6.4)', fonte: 'ATS 2024; ESICM 2023', livro: 'condicional, baixa a moderada confiança; sem protocolo (p. 507–508)' },
  { tema: 'PEEP', diretriz: 'PEEP mais alta sem manobra de recrutamento, em vez de PEEP baixa, na moderada/grave', forca: 'condicional, evidência baixa a moderada', fonte: 'ATS 2024', livro: 'tabela de PEEP alto na grave (Tabela 5)' },
  { tema: 'Corticoide', diretriz: 'Sugere corticoide na SDRA', forca: 'condicional, evidência moderada', fonte: 'ATS 2024', livro: '—' },
  { tema: 'Bloqueio neuromuscular', diretriz: 'ATS: sugere na SDRA grave precoce. ESICM: contra infusão contínua rotineira na moderada/grave não COVID — divergência declarada', forca: 'condicional, evidência baixa (ATS) · forte, evidência moderada contra (ESICM 8.1)', fonte: 'ATS 2024; ESICM 2023', livro: 'considerar por 48 h se P/F inicial < 150 (p. 506)' },
  { tema: 'ECMO venovenosa', diretriz: 'Selecionados com SDRA grave (ATS); critérios do EOLIA, em centro com padrão organizacional (ESICM 9.1); ECCO2R só em ensaio (ESICM 9.2)', forca: 'condicional, evidência baixa (ATS) · forte, evidência moderada (ESICM)', fonte: 'ATS 2024; ESICM 2023', livro: 'considerar na refratariedade; sobrevida 56% (ELSO) (p. 508)' },
  { tema: 'Ventilação oscilatória de alta frequência', diretriz: 'Contra o uso rotineiro na moderada/grave', forca: 'forte, evidência alta', fonte: 'ATS 2024 (mantida)', livro: '—' },
  { tema: 'Cânula nasal de alto fluxo na IRpA hipoxêmica não intubada', diretriz: 'Recomenda CNAF em vez de O2 convencional para reduzir intubação (não cardiogênica, não DPOC); sem recomendação sobre mortalidade', forca: 'forte, evidência moderada (ESICM 3.1)', fonte: 'ESICM 2023', livro: '—' },
  { tema: 'Definição', diretriz: 'Definição global 2024: entra a SDRA não intubada (CNAF ≥ 30 L/min ou VNI/CPAP), S/F ≤ 315 com SpO2 ≤ 97% substitui a gasometria, ultrassom vale como imagem, categoria para recursos limitados sem PEEP/fluxo', forca: 'consenso', fonte: 'Definição global 2024, Tabela 1', livro: 'Berlim só pela P/F com PEEP ≥ 5 (p. 505)' },
]

export const RESGATE_HIPOXEMIA = [
  { nome: 'Posição prona', texto: 'Recomendação forte (ATS/ESICM/SCCM 2017) na SDRA grave; P/F ≤ 150 após 12–24 h de ventilação protetora adequada; se melhora, pelo menos 16 horas', pagina: 'p. 507' },
  { nome: 'Manobras de recrutamento', texto: 'Aumento transitório da pressão transpulmonar; recomendação condicional com baixa a moderada confiança de evidência. O livro não traz protocolo nem níveis de pressão', pagina: 'p. 507–508' },
  { nome: 'Óxido nítrico inalatório', texto: 'Terapia de resgate na hipoxemia refratária (evidência limitada)', pagina: 'p. 508' },
  { nome: 'ECMO venovenosa', texto: 'Considerar na refratariedade às medidas de resgate; sobrevida reportada de 56% (ELSO) na indicação respiratória primária', pagina: 'p. 508' },
]

// ---------------------------------------------------------------- pós-intubação e assincronias

/** Figura 4 (p. 509). */
export const POS_INTUBACAO = [
  'Cálculo de mecânica se possível: modo VCV, Vt 500 mL, fluxo 60 L/min (1 L/s), curva de fluxo quadrada',
  'Gasometria arterial após 30 min a 1 h do ajuste inicial',
  'Sedação e analgesia com objetivo RASS −2 a 0',
  'Avaliar assincronias; checar SatO2, parâmetros e curvas',
  'pH mais baixo e PCO2 mais alta podem ser tolerados em obstruídos ou SDRA se pH > 7,2',
  'Hipoxemia: regular FiO2 ou PEEP (se ↓ Cst por quadro alveolar)',
]

export const DOPE = ['D — Deslocamento do tubo endotraqueal', 'O — Obstrução do tubo endotraqueal', 'P — Pneumotórax', 'E — Falha de equipamento']

/** Tabela 3 (p. 502–504), resumida. */
export const ASSINCRONIAS: { nome: string; identificacao: string; livro: string; errata?: string }[] = [
  { nome: 'Disparo ineficaz', identificacao: 'Esforço inspiratório sem início de ciclo', livro: '"Diminuição da sensibilidade do disparo"; evitar autodisparo; procurar auto-PEEP', errata: 'Sentido provavelmente trocado com o autodisparo: para o esforço disparar o ciclo, o ventilador precisa ficar mais sensível. Mostrado como impresso.' },
  { nome: 'Duplo disparo', identificacao: 'Dois ciclos consecutivos', livro: 'VCV: reduzir fluxo e/ou aumentar Vt; PCV: aumentar Tins e/ou pressão; PSV: aumentar pressão ou reduzir % de ciclagem' },
  { nome: 'Autodisparo', identificacao: 'FR maior que a ajustada, ciclos sem esforço', livro: 'Retirar condensado; corrigir vazamentos; "aumentar a sensibilidade do disparo"', errata: 'Sentido provavelmente trocado com o disparo ineficaz (ver acima). Mostrado como impresso.' },
  { nome: 'Fluxo insuficiente', identificacao: 'Frequente no VCV; desconforto inspiratório', livro: 'Corrigir febre, dor, ansiedade e acidose; aumentar o fluxo em VCV' },
  { nome: 'Fluxo excessivo', identificacao: 'VCV: pico de pressão precoce; PCV/PSV: pressão ultrapassa o limite', livro: 'VCV: reduzir o fluxo; PCV/PSV: diminuir a velocidade do fluxo (rampa, rise time, slope)' },
  { nome: 'Ciclagem prematura', identificacao: 'Interrupção precoce do fluxo (dupla ciclagem)', livro: 'Semelhante ao duplo disparo; trocar para PCV ou PSV' },
  { nome: 'Ciclagem tardia', identificacao: 'Prolongamento do tempo inspiratório', livro: 'VCV: aumentar fluxo e diminuir Vt se excessivo; PCV: diminuir Tins; PSV: aumentar a % de ciclagem' },
]

// ---------------------------------------------------------------- desmame (Figura 5)

export const DESMAME = {
  po2Min: 60,
  fio2Max: 0.4,
  pfMin: 150,
  peepTexto: '≤ 5 a 8 cmH2O',
  peepMax: [5, 8] as Faixa,
  fcMax: 140,
  tre: { psv: [5, 7] as Faixa, minutos: [30, 60] as Faixa },
  falha: { fcAcima: 140, frAcima: 35, satAbaixo: 90, pasAcima: 180, pasAbaixo: 90 },
  pagina: 'Figura 5, p. 510',
}

export const DESMAME_SUBJETIVOS = ['Resolução do motivo que levou à intubação', 'Tosse e drive respiratório adequados']
export const DESMAME_OUTROS = ['Sem vasopressores ou com doses baixas', 'Equilíbrios acidobásico e hidroeletrolítico adequados', 'Melhora do nível de consciência', 'Ausência de febre, níveis adequados de hemoglobina']
export const FALHA_TRE_CLINICA = ['Agitação', 'Sudorese', 'Esforço respiratório importante', 'Rebaixamento do nível de consciência']

export type ItemCriterio = { texto: string; atende: boolean | null }

/**
 * Parâmetros objetivos numéricos da Figura 5. "PEEP ≤ 5 a 8" é impresso
 * assim: a tela mostra a posição em relação a 5 e a 8. null = não informado.
 */
export function criteriosObjetivosDesmame(v: { po2?: number; fio2Pct?: number; peep?: number; fc?: number }): ItemCriterio[] {
  const fio2 = valido(v.fio2Pct) ? v.fio2Pct / 100 : undefined
  const pf = valido(v.po2) && fio2 ? v.po2 / fio2 : undefined
  const peep = naoNeg(v.peep) ? v.peep : undefined
  return [
    { texto: 'PO2 ≥ 60 mmHg com FiO2 ≤ 0,4', atende: valido(v.po2) && fio2 !== undefined ? v.po2 >= DESMAME.po2Min && fio2 <= DESMAME.fio2Max + 1e-9 : null },
    { texto: `P/F ≥ 150${pf !== undefined ? ` (calculada: ${Math.round(pf)})` : ''}`, atende: pf !== undefined ? pf >= DESMAME.pfMin : null },
    { texto: `PEEP ≤ 5 a 8 cmH2O${peep !== undefined ? (peep <= 5 ? ' (≤ 5)' : peep <= 8 ? ' (entre 5 e 8: atende o "8", não o "5")' : ' (acima de 8)') : ''}`, atende: peep !== undefined ? peep <= DESMAME.peepMax[1] : null },
    { texto: 'FC < 140 bpm', atende: valido(v.fc) ? v.fc < DESMAME.fcMax : null },
  ]
}

/** Critérios numéricos de falência durante o TRE (Figura 5) atingidos. */
export function falhaTre(v: { fc?: number; fr?: number; sat?: number; pas?: number }): string[] {
  const f = DESMAME.falha
  const r: string[] = []
  if (valido(v.fc) && v.fc > f.fcAcima) r.push('FC > 140 bpm')
  if (valido(v.fr) && v.fr > f.frAcima) r.push('FR > 35 rpm')
  if (valido(v.sat) && v.sat < f.satAbaixo) r.push('SatO2 < 90%')
  if (valido(v.pas) && v.pas > f.pasAcima) r.push('PAS > 180 mmHg')
  if (valido(v.pas) && v.pas < f.pasAbaixo) r.push('PAS < 90 mmHg')
  return r
}

// ---------------------------------------------------------------- errata

export const ERRATA_VM = [
  'p. 499: resistência escrita "(Ppico – Pplatô/fluxo)" e complacência "volume corrente/Pplatô – PEEP", sem parênteses; a Figura 2 (p. 499) confirma (Ppico − Pplatô)/fluxo e VC/(Pplatô − PEEP) — conta refeita: (40 − 30)/1 = 10 cmH2O/L/s e 500/(30 − 5) = 20 mL/cmH2O, como impresso.',
  'Figura 4 (p. 509) remete a "Tabela 1" (ajuste inicial), "Tabela 5" (asma/DPOC) e "Tabela 6" (SDRA); no capítulo esses conteúdos estão nas Tabelas 2, 4 e 5 — numeração deslocada.',
  'Tabela 3 (p. 503–504): disparo ineficaz → "diminuição da sensibilidade" e autodisparo → "aumentar a sensibilidade" — sentido provavelmente trocado; mostrado como impresso, com aviso.',
  'Tabela 5 (p. 506): "Tins ≤ 1 s � relação I:E" — símbolo quebrado no PDF (a seta das outras linhas).',
  'Tabela 5 é intitulada "SARA" e o texto usa "SDRA" — mesma síndrome.',
  'Figura 5 (p. 510): "PEEP ≤ 5 a 8 cmH2O" — o livro não diz qual limite usar; a tela mostra a posição em relação aos dois.',
  'Vt em "mL/kg" (Tabelas 2, 4 e 5) sem dizer se é peso real, ideal ou predito; o livro não traz fórmula de peso predito (o cap. 87, p. 1182, escreve "peso ideal" e o cap. 7, p. 127, só "peso"). A conta usa o peso informado.',
  'Driving pressure: "evitar > 15" (cap. 37, p. 506) e "≤ 15" (cap. 7, Tabela 12, p. 127) — equivalentes. Alvo de SatO2: 93–97% no ajuste inicial (Tabela 2) e > 92% no obstruído e na SDRA (Tabelas 4 e 5).',
  'Berlim (p. 505): faixas inteiras (201–300, 101–200, ≤ 100); P/F fracionária entre 200 e 201 ou 100 e 101 fica sem classe, como impresso.',
]
