import type { Ficha, Fonte } from '../ficha.ts'
import { fichaP4, type DoseLivro } from './fonteP4.ts'
import type { Faixa } from './fonteP2.ts'
import { comTeto, porPeso, porSC, positivoP5, type ItemLivro } from './fonteP5.ts'

// Emergências oncológicas na criança — livro do ICr, cap. 66 (p. 693–722).
// Síndrome de lise tumoral (Cairo-Bishop, hidratação por m², alopurinol,
// rasburicase, hipercalemia, hiperfosfatemia), hemocomponentes e limiares,
// hiperviscosidade, neutropenia febril (definições, alto risco, MASCC e a
// Tabela 11 do ICr com os máximos da própria tabela) e síndromes compressivas
// (Tabela 12). Superfície corpórea informada pelo médico. Sem valor neonatal.

// Versão .1 de 28/09/2026: neutropenia febril pela diretriz internacional
// pediátrica IPFNG 2023 (JCO; texto integral lido) ao lado do cap. 66.

export const IPFNG_2023: Fonte = {
  citacao: 'Lehrnbecher T, Robinson PD, Ammann RA, et al. Guideline for the Management of Fever and Neutropenia in Pediatric Patients With Cancer and Hematopoietic Cell Transplantation Recipients: 2023 Update. J Clin Oncol. 2023;41(9):1774–1785. Recomendações A1–A5, B1–B5 e C1–C6.',
  url: 'https://doi.org/10.1200/JCO.22.02224',
  pediatrica: true,
}

const baseOncologia = fichaP4('ped-emergencias-oncologicas', 'Emergências oncológicas — criança', 'cap. 66, p. 693–722; Apêndice, p. 898, 907, 909')

export const fichaOncologiaPed: Ficha = {
  ...baseOncologia,
  versao: '2026-09-28.1',
  fontes: [...baseOncologia.fontes, IPFNG_2023],
  revisadoEm: '28/09/2026 (IPFNG 2023 lida no texto; livro do ICr mantido como base)',
}

export const IPFNG_ITENS: { codigo: string; texto: string; forca: string }[] = [
  { codigo: 'Boa prática', texto: 'No paciente febril clinicamente instável, iniciar o antibacteriano empírico o mais cedo possível', forca: 'declaração de boa prática' },
  { codigo: 'A1', texto: 'Adotar estratégia validada de estratificação de risco na rotina', forca: 'forte, evidência baixa' },
  { codigo: 'A2–A3', texto: 'Hemoculturas de todos os lumens do cateter central; considerar hemocultura periférica simultânea (detecta 12% das bacteremias com central negativa)', forca: 'forte, baixa · condicional, moderada' },
  { codigo: 'A5', texto: 'Radiografia de tórax só com sinais ou sintomas respiratórios', forca: 'forte, evidência moderada' },
  { codigo: 'B1', texto: 'Respondendo ao esquema inicial: suspender a dupla cobertura para Gram-negativo ou o glicopeptídeo empírico após 24–72 h sem indicação microbiológica', forca: 'forte, evidência moderada' },
  { codigo: 'B2–B3', texto: 'Não ampliar o esquema só por febre persistente no estável; escalonar (Gram-negativo resistente, Gram-positivo e anaeróbios) se ficar instável', forca: 'forte, baixa · forte, muito baixa' },
  { codigo: 'B4', texto: 'Alto ou baixo risco, bem e afebril por ≥ 24 h, hemoculturas negativas em 48 h e recuperação medular: suspender o antibacteriano', forca: 'forte, evidência baixa' },
  { codigo: 'B5', texto: 'Baixo risco, bem e afebril por ≥ 24 h, hemoculturas negativas em 48 h, MESMO sem recuperação medular: considerar suspender (em 2017 eram 72 h)', forca: 'condicional, evidência moderada' },
  { codigo: 'C1', texto: 'Alto risco de doença fúngica invasiva: LMA, LLA de alto risco ou recaída, neutropenia prolongada, corticoide em dose alta, TCTH alogênico no 1º ano sem reconstituição T ou com corticoide/imunossupressores', forca: 'forte, evidência baixa' },
  { codigo: 'C2–C3', texto: 'Febre prolongada (≥ 96 h) no alto risco: considerar não usar galactomanana; não usar β-D-glucana nem PCR fúngica no sangue; fazer TC de pulmões; considerar ultrassom de abdome; sem TC de seios da face de rotina', forca: 'condicional/forte' },
  { codigo: 'C4', texto: 'Alto risco com febre ≥ 96 h sem resposta ao antibacteriano de amplo espectro: caspofungina ou anfotericina B lipossomal empírica, salvo se escolhida a abordagem preemptiva', forca: 'forte, evidência alta' },
  { codigo: 'C5–C6', texto: 'Preemptiva (só tratar se a avaliação sugerir doença fúngica) é opção no alto risco sem profilaxia antimofo e fora do TCTH; no baixo risco de doença fúngica, considerar não iniciar antifúngico empírico', forca: 'condicional, moderada · condicional, baixa' },
]

export const DIFERENCAS_NF_2023: string[] = [
  'Suspensão do antibiótico: o livro não fixa; a IPFNG 2023 permite suspender com 48 h de hemocultura negativa no paciente bem e afebril ≥ 24 h — com recuperação medular (forte) ou, no baixo risco, mesmo sem ela (condicional; era 72 h em 2017).',
  'Antifúngico empírico: o livro define neutropenia persistente como febre ≥ 96 h (p. 708–709) e traz caspofungina e anfotericina lipossomal na Tabela 11; a IPFNG 2023 confirma a indicação a partir de 96 h no alto risco (forte, alta) e acrescenta a via preemptiva.',
  'Estratificação: o livro usa MASCC (escore de adulto, Tabela 9) e critérios de alto risco (p. 709); a IPFNG pede regra validada em pediatria (A1) sem escolher uma.',
  'Radiografia de tórax e TC de seios da face: só com sinais/sintomas (A5, C3c) — o livro não trata.',
]

// ------------------------------------------------------------ lise tumoral

export type ExamesSlt = { acidoUrico: number; potassio: number; fosforo: number; calcio: number }

/**
 * Tabela 2 (p. 695), critérios laboratoriais de Cairo e Bishop (valor absoluto):
 * ácido úrico ≥ 8 mg/dL; potássio ≥ 6,0 mEq/L; fósforo ≥ 6,5 mg/dL (criança); cálcio ≤ 7 mg/dL.
 * O aumento/queda de 25% do basal também conta — marcado à parte pelo médico.
 */
export function criteriosLabSlt(v: ExamesSlt, variacao25: Set<string> = new Set()): string[] {
  const c: string[] = []
  if ((positivoP5(v.acidoUrico) && v.acidoUrico >= 8) || variacao25.has('acidoUrico')) c.push('ácido úrico')
  if ((positivoP5(v.potassio) && v.potassio >= 6) || variacao25.has('potassio')) c.push('potássio')
  if ((positivoP5(v.fosforo) && v.fosforo >= 6.5) || variacao25.has('fosforo')) c.push('fósforo')
  if ((positivoP5(v.calcio) && v.calcio <= 7) || variacao25.has('calcio')) c.push('cálcio')
  return c
}

/** SLTL = 2 ou mais critérios laboratoriais; SLTC = SLTL + 1 critério clínico (IRA, arritmia/morte súbita, convulsão). */
export function classificarSlt(nLab: number, clinico: boolean): 'SLTC' | 'SLTL' | 'sem critério' {
  if (nLab >= 2) return clinico ? 'SLTC' : 'SLTL'
  return 'sem critério'
}

/** Produto cálcio × fósforo (mg/dL); ≥ 70 é indicação de TSR na SLT (p. 697, 700). */
export function produtoCaP(calcio: number, fosforo: number): number | null {
  return positivoP5(calcio, fosforo) ? calcio * fosforo : null
}

/** Hidratação: 2.000 a 3.000 mL/m²/dia sem K, P ou Ca (texto, p. 699). */
export const hidratacaoSltMlDia = (scM2: number) => porSC([2000, 3000], scM2)

export const ERRATA_HIDRATACAO =
  'Tabela 6 (p. 702, conferida no PDF): "200 a 3.000 mL/m²/dia"; o texto da p. 699 diz "2.000 a 3.000 mL/m²/dia". A ferramenta usa o texto (2.000 a 3.000).'

/** Diurese-alvo (p. 699): 4 a 6 mL/kg/h (≤ 10 kg) ou 80 a 100 mL/m²/h; densidade urinária < 1.010. */
export function diureseAlvoSlt(pesoKg: number, scM2: number): { mlKgH: Faixa | null; mlM2H: Faixa | null } {
  return { mlKgH: positivoP5(pesoKg) && pesoKg <= 10 ? porPeso([4, 6], pesoKg) : null, mlM2H: porSC([80, 100], scM2) }
}

/** Alopurinol por m² (p. 700, Tabela 6): 50 a 100 mg/m²/dose de 8/8 h, máximo 300 mg/m²/dia. */
export function alopurinolM2(scM2: number): { porDose: Faixa; dia: Faixa; maxDia: number } | null {
  const porDose = porSC([50, 100], scM2)
  if (!porDose) return null
  const maxDia = 300 * scM2
  return { porDose, dia: comTeto([porDose[0] * 3, porDose[1] * 3], maxDia), maxDia }
}

export const DOSES_SLT: DoseLivro[] = [
  { id: 'alopurinol', nome: 'Alopurinol (ácido úrico < 8 mg/dL antes da QT)', unidade: 'mg', porKgDia: [10, 10], doses: [3, 3], maxDia: 800, via: 'VO de 8/8 h', pagina: 'Tabela 6, p. 702',
    nota: 'Reduzir na IRA; interações (azatioprina, mercaptopurina, metotrexato, ciclosporina, ampicilina, amoxicilina, carbamazepina, diuréticos).' },
  { id: 'rasburicase', nome: 'Rasburicase (ácido úrico ≥ 8 mg/dL ou alto risco)', unidade: 'mg', porKgDose: [0.15, 0.2], doses: [1, 1], maxDose: 1.5, via: 'IV em 30 min, dose única; repetir só se ácido úrico > 8 mg/dL', pagina: 'p. 700; Tabela 6, p. 702',
    nota: 'Apêndice (p. 907): 0,2 mg/kg/dose, máx. 0,4 mg/kg/dia. Contraindicada na deficiência de G6PD, gestação e meta-hemoglobinemia; transportar a amostra em gelo.' },
  { id: 'insulina', nome: 'Insulina regular — hipercalemia', unidade: 'UI', porKgDose: [0.1, 0.1], maxDose: 10, via: 'IV com glicose 25% 2 mL/kg (0,5 g/kg), em 30 min', pagina: 'p. 701; Tabela 6, p. 702' },
  { id: 'glicose25', nome: 'Glicose 25% — com a insulina', unidade: 'mL', porKgDose: [2, 2], via: 'IV (0,5 g/kg)', pagina: 'p. 701; Tabela 6, p. 702' },
  { id: 'gluconato', nome: 'Gluconato de cálcio 10% — arritmia/alteração de ECG ou hipocalcemia sintomática', unidade: 'mg', porKgDose: [50, 100], via: 'IV em 5 a 10 min com ECG; não com bicarbonato', pagina: 'Tabela 6, p. 702',
    nota: 'O texto da hipercalemia (p. 701) dá 100 a 200 mg/kg; a Tabela 6 e o texto da hipocalcemia (p. 702) dão 50 a 100 mg/kg.' },
  { id: 'bic3', nome: 'Bicarbonato de sódio 3% — se acidose', unidade: 'mEq', porKgDose: [1, 2], maxDose: 50, via: 'IV em 5 a 10 min; repetir a cada 30 min s/n', pagina: 'p. 701; Tabela 6, p. 702' },
  { id: 'sorcal', nome: 'Poliestireno sulfonato de cálcio (Sorcal)', unidade: 'g', porKgDose: [0.5, 1], doses: [3, 4], maxDose: 15, via: 'VO ou VR, 3 a 4x/dia, com sorbitol 50%/lactulose ou PEG', pagina: 'Tabela 6, p. 702' },
  { id: 'furo', nome: 'Furosemida', unidade: 'mg', porKgDose: [0.5, 1], via: 'IV; pode agravar a IRA; contraindicada com risco de hiperviscosidade', pagina: 'p. 699; Tabela 6, p. 703' },
  { id: 'aloh', nome: 'Hidróxido de alumínio — hiperfosfatemia moderada', unidade: 'mg', porKgDia: [50, 150], doses: [4, 6], via: 'VO a cada 4 a 6 h, junto às refeições, no máximo 2 dias', pagina: 'p. 701; Tabela 6, p. 703' },
  { id: 'caco3', nome: 'Carbonato de cálcio — hiperfosfatemia', unidade: 'mg', porKgDose: [30, 40], via: 'VO às refeições (adolescentes 1 a 2 g)', pagina: 'Tabela 6, p. 703' },
]

export const INDICACOES_TSR_SLT: string[] = [
  'Hiperfosfatemia, hiperpotassemia, hiperuricemia ou hipocalcemia sintomática refratárias ou graves',
  'Produto Ca × P ≥ 70 mg²/dL²',
  'Sobrecarga hídrica intratável; hipertensão de difícil controle',
  'Oligúria acentuada ou anúria',
  'Acidose e/ou uremia grave com comprometimento do SNC',
]

// ------------------------------------------------------------ hematológicas

/** CH 10 a 20 mL/kg; cada 10 mL/kg eleva a Hb em 2 a 3 g/dL (p. 705); infusão até 3 a 4 h. */
export const chOncoMl = (pesoKg: number) => porPeso([10, 20], pesoKg)
/** Plaquetas 10 mL/kg em 30 a 60 min (p. 706). */
export const plaquetasOncoMl = (pesoKg: number) => porPeso([10, 10], pesoKg)
/** PFC 10 a 15 mL/kg (p. 706). */
export const pfcOncoMl = (pesoKg: number) => porPeso([10, 15], pesoKg)
/** Crioprecipitado 2 U/10 kg (p. 706) → unidades. */
export const crioOncoU = (pesoKg: number): number | null => (positivoP5(pesoKg) ? (2 * pesoKg) / 10 : null)

/** Tabela 7 (p. 705): gatilhos de Hb para CH. */
export const TABELA7_HB: [string, string, string][] = [
  ['Estável', 'Assintomático, iminente recuperação medular', '< 7'],
  ['Alteração de sinais vitais', 'Taquicardia, taquipneia, hipotensão', '< 8'],
  ['Trombocitopenia', 'Sangramento atual ou recente', '8–10'],
  ['Necessidade de procedimentos', 'Risco para perda sanguínea', '8–10'],
  ['Necessidade de anestesia', '', '< 7'],
  ['Necessidade de oxigênio', 'Comorbidades cardíacas ou pulmonares', '8–10'],
  ['Fadiga', 'Perda de qualidade de vida, principalmente em adolescentes', '8–10'],
  ['Lactente, anemia crônica', 'Impacto no crescimento e desenvolvimento', '8–10'],
]

/** Plaquetas (p. 706): quando transfundir, pelo texto. */
export const LIMIARES_PLAQUETAS: string[] = [
  'Estável: < 10 × 10⁹/L',
  'Procedimento de menor complexidade (cateter central, liquor, biópsia): < 50 × 10⁹/L',
  'Procedimento de maior complexidade (ressecção tumoral, SNC): < 100 × 10⁹/L',
  'Pequeno sangramento (epistaxe, gengivorragia): < 20 × 10⁹/L',
  'Sangramento intenso (GI, hemoptise, vesical, SNC): < 100 × 10⁹/L',
  'Febre, CIVD ou coagulopatia: < 20 a 50 × 10⁹/L; manter > 50 × 10⁹/L para punção lombar ou risco visceral/SNC',
]

export const DOSES_HEMATO_ONCO: DoseLivro[] = [
  { id: 'hidroxiureia', nome: 'Hidroxiureia — hiperviscosidade/citorredução', unidade: 'mg', porKgDia: [50, 100], doses: [2, 2], via: 'VO de 12/12 h', pagina: 'p. 707' },
]

/** Hiperviscosidade (p. 707): tratar LMA > 100.000/mL, LLA > 200.000/mL ou > 100.000/mL com sintomas. */
export function indicaCitorreducao(leucocitos: number, tipo: 'LMA' | 'LLA', sintomas: boolean): boolean | null {
  if (!positivoP5(leucocitos)) return null
  if (tipo === 'LMA') return leucocitos > 100_000
  return leucocitos > 200_000 || (sintomas && leucocitos > 100_000)
}

// ------------------------------------------------------------ neutropenia febril

/** Neutropenia (p. 708): ≤ 500/mm³, ou ≤ 1.000 com queda prevista a ≤ 500 em 24–48 h; profunda < 100. */
export function leituraNeutrofilos(n: number, quedaPrevista: boolean): 'profunda' | 'neutropenia' | 'sem' | null {
  if (!Number.isFinite(n) || n < 0) return null
  if (n < 100) return 'profunda'
  if (n <= 500 || (n <= 1000 && quedaPrevista)) return 'neutropenia'
  return 'sem'
}

/** Alto risco (p. 709). */
export const ALTO_RISCO_NF: { id: string; texto: string }[] = [
  { id: 'lma', texto: 'Leucemia mieloide aguda' },
  { id: 'lla-recaida', texto: 'Leucemia linfoblástica em recaída' },
  { id: 'hipotensao', texto: 'Hipotensão arterial' },
  { id: 'pcr', texto: 'PCR quantitativa ≥ 90 mg/L' },
  { id: 'qt-plaq', texto: 'QT há ≤ 7 dias com plaquetas < 50.000/mm³' },
]

/** MASCC (Tabela 9, p. 710–711): pontuação ≥ 21 = baixo risco de complicação. */
export const MASCC_GRAVIDADE: [number, string][] = [[5, 'Sintomas leves ou ausentes (5)'], [3, 'Sintomas moderados (3)'], [0, 'Sintomas graves (0)']]
export const MASCC_ITENS: { id: string; texto: string; pontos: number }[] = [
  { id: 'semHipotensao', texto: 'Sem hipotensão (PAS ≥ 90 mmHg)', pontos: 5 },
  { id: 'semDpoc', texto: 'Ausência de DPOC', pontos: 4 },
  { id: 'solido', texto: 'Tumor sólido/linfoma sem infecção fúngica prévia', pontos: 4 },
  { id: 'semDesidratacao', texto: 'Ausência de desidratação', pontos: 3 },
  { id: 'domicilio', texto: 'Em domicílio no início da febre', pontos: 3 },
  { id: 'idade', texto: 'Idade < 60 anos', pontos: 2 },
]
export function mascc(gravidade: number, marcados: Set<string>): { pontos: number; baixoRisco: boolean } {
  const pontos = gravidade + MASCC_ITENS.filter((i) => marcados.has(i.id)).reduce((s, i) => s + i.pontos, 0)
  return { pontos, baixoRisco: pontos >= 21 }
}

/** Tabela 11 (p. 714–715): antimicrobianos do ICr para o neutropênico febril, com os máximos da própria tabela. */
export const DOSES_NEUTROPENIA: DoseLivro[] = [
  { id: 'cefepima', nome: 'Cefepima', unidade: 'mg', porKgDia: [150, 150], doses: [3, 3], maxDia: 6000, via: 'IV de 8/8 h', pagina: 'p. 714' },
  { id: 'meropenem', nome: 'Meropenem', unidade: 'mg', porKgDia: [120, 120], doses: [3, 3], maxDia: 6000, via: 'IV de 8/8 h', pagina: 'p. 714' },
  { id: 'piptazo-menor6m', nome: 'Piperacilina-tazobactam — < 6 meses', unidade: 'mg', porKgDia: [150, 300], doses: [3, 4], maxDose: 4500, via: 'IV a cada 6 a 8 h', pagina: 'p. 714',
    nota: 'Máximo impresso "4,5 g, IV, 6/6 horas" (aplicado por dose). A mesma linha diz "Indicado para crianças > 2 anos de idade", em conflito com as faixas < 6 meses e > 6 meses.' },
  { id: 'piptazo-maior6m', nome: 'Piperacilina-tazobactam — > 6 meses', unidade: 'mg', porKgDia: [300, 400], doses: [3, 4], maxDose: 4500, via: 'IV a cada 6 a 8 h', pagina: 'p. 714' },
  { id: 'vancomicina', nome: 'Vancomicina', unidade: 'mg', porKgDia: [60, 60], doses: [4, 4], maxDose: 1000, via: 'IV de 6/6 h', pagina: 'p. 714',
    nota: 'Apêndice (p. 909): 10 a 15 mg/kg/dose, máx. 2.000 mg/dia — a Tabela 11 do ICr traz 1 g/dose.' },
  { id: 'teicoplanina', nome: 'Teicoplanina', unidade: 'mg', porKgDia: [10, 20], doses: [2, 2], maxDose: 400, fonteMaximo: 'máx. do Apêndice: 400 mg/dose (p. 909)', via: 'IV de 12/12 h', pagina: 'p. 715' },
  { id: 'linezolida', nome: 'Linezolida', unidade: 'mg', porKgDia: [30, 30], doses: [3, 3], maxDose: 600, via: 'IV ou VO de 8/8 h (máx. 600 mg/dose de 12/12 h)', pagina: 'p. 715' },
  { id: 'metronidazol', nome: 'Metronidazol', unidade: 'mg', porKgDia: [30, 30], doses: [4, 4], maxDia: 4000, via: 'IV ou VO de 6/6 h', pagina: 'p. 715' },
  { id: 'cipro-iv', nome: 'Ciprofloxacina IV', unidade: 'mg', porKgDia: [20, 30], doses: [2, 3], maxDia: 800, via: 'IV de 8/8 ou 12/12 h', pagina: 'p. 715' },
  { id: 'cipro-vo', nome: 'Ciprofloxacina VO — tratamento domiciliar', unidade: 'mg', porKgDia: [20, 40], doses: [2, 2], maxDia: 1500, via: 'VO de 12/12 h', pagina: 'p. 715' },
  { id: 'levo', nome: 'Levofloxacina', unidade: 'mg', porKgDia: [10, 20], doses: [2, 2], maxDia: 750, via: 'IV ou VO de 12/12 h', pagina: 'p. 715' },
  { id: 'tmp', nome: 'Trimetoprim-sulfametoxazol — P. jirovecii', unidade: 'mg', porKgDia: [20, 20], doses: [4, 4], via: 'IV ou VO de 6/6 h; dose do trimetoprim', pagina: 'p. 715' },
  { id: 'anfo-lipo', nome: 'Anfotericina lipossomal', unidade: 'mg', porKgDia: [3, 5], doses: [1, 1], via: 'IV a cada 24 h em 1 a 2 h', pagina: 'p. 715' },
  { id: 'vori-ataque', nome: 'Voriconazol — ataque (indicado > 12 anos)', unidade: 'mg', porKgDose: [9, 9], doses: [2, 2], via: 'IV de 12/12 h, 2 doses', pagina: 'p. 715' },
  { id: 'vori-man', nome: 'Voriconazol — manutenção (indicado > 12 anos)', unidade: 'mg', porKgDose: [4, 8], doses: [2, 2], maxDia: 600, via: 'de 12/12 h', pagina: 'p. 715' },
  { id: 'aciclovir', nome: 'Aciclovir', unidade: 'mg', porKgDia: [30, 45], doses: [3, 3], via: 'IV de 8/8 h; doses maiores (1.500 mg/m²/dia) com função renal diária', pagina: 'p. 715' },
  { id: 'ganciclovir', nome: 'Ganciclovir', unidade: 'mg', porKgDia: [5, 7.5], doses: [2, 2], via: 'IV de 12/12 h', pagina: 'p. 715',
    nota: 'Apêndice (p. 902): 10 mg/kg/dia de 12/12 h — divergência com a Tabela 11.' },
  { id: 'amicacina', nome: 'Amicacina', unidade: 'mg', porKgDia: [15, 30], doses: [1, 1], via: 'IV a cada 24 h', pagina: 'p. 715' },
]

/** Caspofungina (Tabela 11): ataque 70 mg/m², manutenção 50 mg/m² a cada 24 h, máximo 70 mg/dia. */
export function caspofungina(scM2: number): { ataque: number; manutencao: number } | null {
  if (!positivoP5(scM2)) return null
  return { ataque: Math.min(70 * scM2, 70), manutencao: Math.min(50 * scM2, 70) }
}

/** Oseltamivir (Tabela 11): < 15 kg 30 mg; 15–23 kg 45 mg; 23–40 kg 60 mg; > 40 kg 75 mg, 12/12 h. 23 kg cai nas duas faixas. */
export function oseltamivirMg(pesoKg: number): number[] | null {
  if (!positivoP5(pesoKg)) return null
  if (pesoKg < 15) return [30]
  if (pesoKg < 23) return [45]
  if (pesoKg === 23) return [45, 60]
  if (pesoKg <= 40) return [60]
  return [75]
}

// ------------------------------------------------------------ compressivas (Tabela 12, p. 717–720)

export const DOSES_COMPRESSIVAS: DoseLivro[] = [
  { id: 'dexa-sms', nome: 'Dexametasona — mediastino superior / veia cava superior', unidade: 'mg', porKgDia: [1, 2], doses: [4, 4], via: 'IV de 6/6 h', pagina: 'p. 717; Tabela 12, p. 720',
    nota: 'O texto da p. 717 dá 2 mg/kg/dia; a Tabela 12 dá 1 a 2 mg/kg/dia.' },
  { id: 'enoxa-svcs', nome: 'Enoxaparina — trombose na SVCS', unidade: 'mg', porKgDose: [1, 1.5], doses: [2, 2], via: 'SC de 12/12 h, com monitoramento', pagina: 'p. 717' },
  { id: 'dexa-cce-ataque', nome: 'Dexametasona — compressão do cordão, ataque', unidade: 'mg', porKgDose: [1, 2], maxDose: 10, via: 'IV dose única até o diagnóstico', pagina: 'p. 718' },
  { id: 'dexa-cce-man', nome: 'Dexametasona — compressão do cordão, manutenção', unidade: 'mg', porKgDose: [0.25, 0.5], doses: [4, 4], maxDose: 4, via: 'IV de 6/6 h', pagina: 'p. 718' },
  { id: 'manitol', nome: 'Manitol 20% — HIC por tumor', unidade: 'g', porKgDose: [0.25, 1], via: 'IV em bolo, a cada 6 a 8 h s/n; osmolaridade 300–310 mOsm/L', pagina: 'p. 719; Tabela 12, p. 720' },
  { id: 'nacl3-bolo', nome: 'NaCl 3% — HIC por tumor, bolo', unidade: 'mL', porKgDose: [2, 6], via: 'IV em bolo; manutenção 0,1 a 1 mL/kg/h (PIC < 20 mmHg)', pagina: 'p. 719; Tabela 12, p. 720' },
  { id: 'dexa-hic-ataque', nome: 'Dexametasona — HIC por tumor, ataque', unidade: 'mg', porKgDose: [1, 2], via: 'IV', pagina: 'p. 719' },
  { id: 'dexa-hic-man', nome: 'Dexametasona — HIC por tumor, manutenção', unidade: 'mg', porKgDia: [1, 2], doses: [4, 4], maxDia: 16, via: 'IV de 6/6 h', pagina: 'p. 719' },
  { id: 'fenitoina-ataque', nome: 'Fenitoína — tumor com convulsão, ataque', unidade: 'mg', porKgDose: [10, 15], maxDose: 1500, via: 'IV, até 50 mg/min', pagina: 'p. 720; Tabela 12',
    nota: 'A Tabela 12 escreve "máx. 1.500 mg/dia" para o ataque.' },
  { id: 'fenitoina-man', nome: 'Fenitoína — manutenção', unidade: 'mg', porKgDia: [4, 8], doses: [2, 2], via: 'IV de 12/12 h', pagina: 'p. 720' },
  { id: 'fenitoina-prof', nome: 'Fenitoína — profilática (só se o especialista recomendar)', unidade: 'mg', porKgDose: [5, 5], maxDose: 300, via: 'máx. 300 mg/dia', pagina: 'p. 720' },
  { id: 'midaz-iv', nome: 'Midazolam IV — crise estabelecida', unidade: 'mg', porKgDose: [0.05, 0.1], maxDose: 10, via: 'IV', pagina: 'p. 720; Tabela 12' },
  { id: 'midaz-im', nome: 'Midazolam IM', unidade: 'mg', porKgDose: [0.1, 0.2], maxDose: 5, via: 'IM', pagina: 'Tabela 12, p. 720' },
  { id: 'midaz-in', nome: 'Midazolam IN', unidade: 'mg', porKgDose: [0.2, 0.3], maxDose: 7.5, via: 'intranasal', pagina: 'Tabela 12, p. 720' },
]

export const ERRATA_PIC_ONCO =
  'p. 719 (conferido no PDF): "tolerar PIC entre 50 e 60 mmHg" — pelo contexto (e pela Tabela 9 do cap. 41), o valor é de pressão de PERFUSÃO cerebral; a PIC-alvo do mesmo parágrafo é < 20 mmHg. Não usado em cálculo.'

export const REFERENCIAS_ONCO: ItemLivro[] = [
  { texto: 'SLT: fatores predisponentes — ácido úrico > 7,5 mg/dL antes do tratamento, disfunção renal, tumor volumoso (> 10 cm, leucócitos > 25.000/mL ou DHL 2× o normal), sensibilidade à QT, hipovolemia/urina ácida.', pagina: 'p. 695–696' },
  { texto: 'SLT: começar a hidratação 1 a 2 dias antes da QT; controles a cada 6 h e, com boa evolução, a cada 8 h. Alcalinização da urina só sem rasburicase e com baixo risco de fosfato de cálcio.', pagina: 'p. 699–701' },
  { texto: 'Hiperfosfatemia grave (P > 10 mg/dL) e sintomática: terapia de substituição renal.', pagina: 'p. 701' },
  { texto: 'Febre no neutropênico: axilar ≥ 38,5 °C ou ≥ 38 °C sustentada por 1 h (texto); a Figura 2 usa oral ≥ 38,3 °C (axilar ≥ 38 °C) ou oral ≥ 38 °C (axilar ≥ 37,8 °C) por mais de 1 h.', pagina: 'p. 709, 716' },
  { texto: 'Neutropenia febril sem sepse no ICr: cefepima (ou piperacilina-tazobactam) na primeira hora; ampliar com glicopeptídeo se febre persistente ou piora. Com sepse: piperacilina-tazobactam ou meropenem ± amicacina + teicoplanina ou vancomicina.', pagina: 'p. 713' },
  { texto: 'Neutropenia persistente: < 500/mm³ com febre ≥ 96 h; prolongada: < 500/mm³ por mais de 10 dias.', pagina: 'p. 708–709' },
  { texto: 'Plaquetas: sem risco de sangramento acima de 100 × 10⁹/L; mucocutâneo com 20–30 × 10⁹/L; hematúria, hemoptise, GI e SNC abaixo de 20 × 10⁹/L.', pagina: 'p. 706' },
  { texto: 'Síndrome da veia cava superior: cabeceira a 15–30°, remover cateter se trombose associada, acessos nos membros inferiores; evitar paralisia e sedação profunda na obstrução de via aérea.', pagina: 'p. 717' },
]
