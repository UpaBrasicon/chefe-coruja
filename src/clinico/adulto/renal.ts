import { completo, escolha, somar, type Escore } from '../escore.ts'
import { NAHCO3_84_MEQ_POR_ML } from './acidobase.ts'
import { fichaAdulto } from './fonte.ts'

// Lesão renal aguda (cap. 61, p. 824–841) e rabdomiólise (cap. 63,
// p. 852–862) pelo Manual de Medicina de Emergência do HCFMUSP (3ª ed., 2022).
// A ferramenta estadia pelo KDIGO como a Tabela 1 escreve, calcula FENa, FEUr,
// Ur/Cr, o teste de furosemida e as soluções da Tabela 3 da rabdomiólise, e
// mostra as indicações de terapia de substituição renal. A decisão é do médico
// (ADR 0007).

export const fichaLesaoRenalAguda = fichaAdulto('adulto-lesao-renal-aguda', 'Lesão renal aguda — adulto', 'cap. 61 Lesão renal aguda, p. 824–841')
export const fichaRabdomiolise = fichaAdulto('adulto-rabdomiolise', 'Rabdomiólise — adulto', 'cap. 63 Rabdomiólise, p. 852–862')

export type Faixa = [number, number]
export type Referencia = { texto: string; pagina: string; errata?: string }

const valido = (x: number) => Number.isFinite(x) && x > 0
const fmt = (x: number, casas = 2) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')

// ── KDIGO (p. 824–825) ──────────────────────────────────────────────────────

export type EntradaKdigo = {
  crBasal?: number
  crAtual?: number
  /** aumento absoluto observado em 48 h (mg/dL), se conhecido */
  aumento48h?: number
  pesoKg?: number
  diureseMl?: number
  periodoH?: number
  anuriaH?: number
  tsr?: boolean
}

export type ResultadoKdigo = {
  estadioCreatinina: 0 | 1 | 2 | 3 | null
  estadioDiurese: 0 | 1 | 2 | 3 | null
  estadio: 0 | 1 | 2 | 3 | null
  razao: number | null
  mlKgH: number | null
  motivos: string[]
  avisos: string[]
}

/**
 * Tabela 1 (p. 825): I = 1,5–1,9 × ou ≥ 0,3 mg/dL ou DU < 0,5 mL/kg/h por 6–12 h;
 * II = 2–2,9 × ou DU < 0,5 por ≥ 12 h; III = 3 × ou ≥ 4 mg/dL ou DU < 0,3 por
 * ≥ 24 h ou anúria ≥ 12 h ou TSR. O estádio final é o maior dos dois critérios.
 */
export function kdigo(e: EntradaKdigo): ResultadoKdigo {
  const motivos: string[] = []
  const avisos: string[] = []
  let estCr: ResultadoKdigo['estadioCreatinina'] = null
  let razao: number | null = null
  if (e.crBasal !== undefined && e.crAtual !== undefined && valido(e.crBasal) && valido(e.crAtual)) {
    razao = e.crAtual / e.crBasal
    const delta = e.aumento48h !== undefined && Number.isFinite(e.aumento48h) ? e.aumento48h : null
    if (razao >= 3) { estCr = 3; motivos.push(`creatinina ${fmt(razao)} × o basal (3 ×)`) }
    else if (e.crAtual >= 4) { estCr = 3; motivos.push('creatinina ≥ 4 mg/dL') }
    else if (razao >= 2) { estCr = 2; motivos.push(`creatinina ${fmt(razao)} × o basal (2 a 2,9 ×)`) }
    else if (razao >= 1.5) { estCr = 1; motivos.push(`creatinina ${fmt(razao)} × o basal (1,5 a 1,9 ×)`) }
    else if (delta !== null && delta >= 0.3) { estCr = 1; motivos.push(`aumento de ${fmt(delta)} mg/dL em 48 h (≥ 0,3)`) }
    else estCr = 0
    if (razao >= 1.9 && razao < 2) avisos.push('Razão entre 1,9 e 2: a tabela escreve "1,5 a 1,9" e "2 a 2,9"; a ferramenta põe no estágio I.')
    if (razao >= 2.9 && razao < 3) avisos.push('Razão entre 2,9 e 3: a tabela escreve "2 a 2,9" e "3 ×"; a ferramenta põe no estágio II.')
    if (e.crAtual >= 4) avisos.push('A tabela escreve "elevação ≥ 4 mg/dL" sem repetir a exigência de aumento agudo; a ferramenta lê como creatinina ≥ 4.')
  }
  let estDu: ResultadoKdigo['estadioDiurese'] = null
  let mlKgH: number | null = null
  if (e.pesoKg !== undefined && e.diureseMl !== undefined && e.periodoH !== undefined && valido(e.pesoKg) && Number.isFinite(e.diureseMl) && e.diureseMl >= 0 && valido(e.periodoH)) {
    mlKgH = e.diureseMl / e.pesoKg / e.periodoH
    const h = e.periodoH
    if (mlKgH < 0.3 && h >= 24) { estDu = 3; motivos.push(`diurese ${fmt(mlKgH)} mL/kg/h por ${fmt(h, 0)} h (< 0,3 por ≥ 24 h)`) }
    else if (mlKgH < 0.5 && h >= 12) { estDu = 2; motivos.push(`diurese ${fmt(mlKgH)} mL/kg/h por ${fmt(h, 0)} h (< 0,5 por ≥ 12 h)`) }
    else if (mlKgH < 0.5 && h >= 6) { estDu = 1; motivos.push(`diurese ${fmt(mlKgH)} mL/kg/h por ${fmt(h, 0)} h (< 0,5 por 6–12 h)`) }
    else estDu = 0
    if (mlKgH < 0.5 && h < 6) avisos.push('Diurese < 0,5 mL/kg/h por menos de 6 h: ainda fora do critério (a definição pede mais de 6 h, p. 825).')
    if (h === 6) avisos.push('Exatamente 6 h: a definição diz "maior que 6 horas" (p. 825) e a Tabela 1 diz "6–12 horas"; a ferramenta usa a tabela.')
  }
  if (e.anuriaH !== undefined && e.anuriaH >= 12) { estDu = 3; motivos.push(`anúria por ${fmt(e.anuriaH, 0)} h (≥ 12 h)`) }
  if (e.tsr) motivos.push('início de terapia de substituição renal')
  const estadios = [estCr, estDu, e.tsr ? 3 : null].filter((x): x is 0 | 1 | 2 | 3 => x !== null)
  const estadio = estadios.length ? (Math.max(...estadios) as 0 | 1 | 2 | 3) : null
  return { estadioCreatinina: estCr, estadioDiurese: estDu, estadio, razao, mlKgH, motivos, avisos }
}

// ── Frações excretórias e índices (Tabela 2 p. 826–827; Tabela 3 p. 832) ────

export type Leitura = { valor: number; texto: string }

/** FENa (%) = (NaU × CrP) / (NaP × CrU) × 100 (p. 832). < 1% pré-renal; > 2% NTA. */
export function fena(naU: number, crP: number, naP: number, crU: number): Leitura | null {
  if (![naU, crP, naP, crU].every(valido)) return null
  const v = ((naU * crP) / (naP * crU)) * 100
  const texto = v < 1 ? '< 1%: pré-renal (Tabela 3, p. 832)' : v > 2 ? '> 2%: NTA (Tabela 3, p. 832)' : 'entre 1% e 2%: sem classe na Tabela 3'
  return { valor: v, texto }
}

/** FEUr (%) = (UrU × CrP) / (UrP × CrU) × 100 (p. 832). < 35% pré-renal; usar em quem recebe diurético. */
export function feur(urU: number, crP: number, urP: number, crU: number): Leitura | null {
  if (![urU, crP, urP, crU].every(valido)) return null
  const v = ((urU * crP) / (urP * crU)) * 100
  return { valor: v, texto: v < 35 ? '< 35%: pré-renal (Tabela 3, p. 832)' : '≥ 35%: o livro não traz interpretação acima de 35%' }
}

export const NOTAS_FRACOES: Referencia[] = [
  { texto: 'FENa falsamente elevada: diurético, DRC. Falsamente reduzida: ICC, hepatorrenal, grande queimado, rabdomiólise, nefropatia por contraste', pagina: 'cap. 61, Tabela 3, p. 832' },
  { texto: 'FENa < 1% só aparece em reduções importantes da TFG; não é específica de pré-renal', pagina: 'cap. 61, p. 831' },
  { texto: 'FEUr: quando utilizar — uso de diurético', pagina: 'cap. 61, Tabela 3, p. 832' },
  { texto: 'Na cirrose o livro usa outros cortes de FENa: pré-renal < 0,5%, SHR < 0,1–0,5%, NTA > 0,5–2%', pagina: 'cap. 58, Tabela 4, p. 793' },
]

/** Índices da Tabela 2 (p. 826–827): pré-renal x NTA. */
export function indicesUrinarios(e: { ureiaP?: number; crP?: number; naU?: number; osmU?: number }) {
  const r: { indice: string; valor: string; leitura: string }[] = []
  if (e.ureiaP !== undefined && e.crP !== undefined && valido(e.ureiaP) && valido(e.crP)) {
    const x = e.ureiaP / e.crP
    r.push({ indice: 'Ureia/creatinina', valor: fmt(x, 1), leitura: x > 40 ? '> 40: sugere pré-renal' : '≤ 40: sem corte de NTA na tabela' })
  }
  if (e.naU !== undefined && valido(e.naU)) {
    r.push({ indice: 'Sódio urinário', valor: `${fmt(e.naU, 0)} mEq/L`, leitura: e.naU < 20 ? '< 20: sugere pré-renal' : e.naU > 40 ? '> 40: sugere NTA' : '20–40: sem classe na tabela' })
  }
  if (e.osmU !== undefined && valido(e.osmU)) {
    r.push({ indice: 'Osmolaridade urinária', valor: `${fmt(e.osmU, 0)} mOsm/kg`, leitura: e.osmU > 500 ? '> 500: sugere pré-renal' : e.osmU < 350 ? '< 350: sugere NTA' : '350–500: sem classe na tabela' })
  }
  return r
}

// ── Teste de estresse com furosemida (p. 836) ───────────────────────────────

export const FUROSEMIDA_ESTRESSE = { mgKg: 1, mgKgUsoPrevio: 1.5, corteMl: 200, horas: 2, pagina: 'cap. 61, p. 836',
  texto: 'AKIN 1 ou 2, euvolêmico: furosemida EV 1 mg/kg (1,5 mg/kg se uso prévio). Diurese < 200 mL nas 2 horas seguintes prediz evolução para AKIN 3 (sensibilidade 87,1%, especificidade 84,1%)' }

export function furosemidaEstresse(pesoKg: number, usoPrevio: boolean): number | null {
  if (!valido(pesoKg)) return null
  return (usoPrevio ? FUROSEMIDA_ESTRESSE.mgKgUsoPrevio : FUROSEMIDA_ESTRESSE.mgKg) * pesoKg
}

// ── Terapia de substituição renal (Tabela 5, p. 837–838) ────────────────────

export const INDICACOES_TSR: Referencia[] = [
  { texto: 'Hipervolemia não responsiva a diurético', pagina: 'cap. 61, p. 837' },
  { texto: 'Acidose metabólica refratária (pH < 7,1) ao manejo clínico — não há ponto de corte de pH estabelecido', pagina: 'cap. 61, p. 837' },
  { texto: 'Hipercalemia refratária ao manejo clínico — sem ponto de corte específico (miocardiotoxicidade pouco provável com K < 6,5 mEq/L)', pagina: 'cap. 61, p. 838' },
  { texto: 'Síndrome urêmica (pericardite urêmica requer TSR urgente)', pagina: 'cap. 61, p. 838' },
  { texto: 'Intoxicação por droga ou toxina dialisável: lítio, etilenoglicol, salicilato, valproato, paracetamol, metanol, etanol, teofilina', pagina: 'cap. 61, p. 838' },
  { texto: 'Azotemia progressiva ou oligúria não responsiva a fluido — não há cutoffs estabelecidos', pagina: 'cap. 61, p. 838' },
]

export const OUTROS_LRA: Referencia[] = [
  { texto: 'Hiperfosfatemia grave (> 6 mg/dL): quelantes à base de cálcio ou sevelamer', pagina: 'cap. 61, p. 837' },
  { texto: 'Relação proteína/creatinina urinária > 0,21: solicitar proteinúria de 24 h; > 2 g/24 h sugere glomerulopatia', pagina: 'cap. 61, Tabela 4, p. 833–834' },
  { texto: 'Dopamina em "dose renal" (0,5–3 µg/kg/min): sem benefício', pagina: 'cap. 61, p. 836' },
  { texto: 'Bicarbonato (BICAR): "sugere-se alvo de pH > 7,2 para indicar reposição"', pagina: 'cap. 61, p. 837',
    errata: 'Frase invertida: no estudo citado o bicarbonato foi dado com pH ≤ 7,20 (ver inventário). A ferramenta não usa esse número em conta.' },
]

// ── Rabdomiólise (cap. 63) ──────────────────────────────────────────────────

export const RABDO_DIAGNOSTICO: Referencia[] = [
  { texto: 'Estímulo miotóxico agudo ou urina escura + elevação aguda da CPK (> 5–10 × LSN, usualmente > 1.000 UI/L); não há corte rigoroso', pagina: 'cap. 63, p. 854' },
  { texto: 'Dipstick positivo para "sangue" com < 5 hemácias/campo na microscopia', pagina: 'cap. 63, p. 854' },
  { texto: 'Lesão renal aguda em 15–50%; menor risco se CPK < 15.000–20.000 UI/L na apresentação', pagina: 'cap. 63, p. 855' },
  { texto: 'CPK < 5 × LSN em mais de uma dosagem em 12–24 h: rabdomiólise afastada', pagina: 'cap. 63, Figura 1, p. 860' },
]

export function cpkVezesLsn(cpk: number, lsn: number): { vezes: number; texto: string } | null {
  if (!valido(cpk) || !valido(lsn)) return null
  const vezes = cpk / lsn
  const texto = vezes > 10 ? '> 10 × LSN' : vezes > 5 ? 'entre 5 e 10 × LSN (o livro dá "5–10 ×")' : '< 5 × LSN (Figura 1: afastada se repetido em 12–24 h)'
  return { vezes, texto }
}

export const FLUIDO_RABDO = {
  inicialMlH: [400, 1000] as Faixa,
  manutencaoMlH: [200, 300] as Faixa,
  alvoDuMlH: [200, 300] as Faixa,
  alvoDuMlKgH: [1, 3] as Faixa,
  cpkIndicacao: 5000,
  cpkParar: 5000,
  pagina: 'cap. 63, Tabela 3, p. 857',
  texto: 'SF 0,9% 400 mL–1 L/hora inicial; após restauração volêmica, manutenção de 200–300 mL/hora; alvo de débito urinário 200–300 mL/h (1–3 mL/kg/hora); para CPK > 5.000 UI/L ou em ascensão; interromper com CPK < 5.000 UI/L',
  nota: 'A velocidade não é regra rígida: varia com a causa, comorbidades e sinais de congestão. Não há contraindicação a Ringer lactato.',
}

/** Alvo de diurese em mL/h pelo peso (1–3 mL/kg/h), ao lado do alvo fixo de 200–300 mL/h. */
export function alvoDiureseRabdo(pesoKg: number) {
  if (!valido(pesoKg)) return null
  const porPeso: Faixa = [FLUIDO_RABDO.alvoDuMlKgH[0] * pesoKg, FLUIDO_RABDO.alvoDuMlKgH[1] * pesoKg]
  const discordante = porPeso[0] > FLUIDO_RABDO.alvoDuMlH[1] || porPeso[1] < FLUIDO_RABDO.alvoDuMlH[0]
  return { porPesoMlH: porPeso, fixoMlH: FLUIDO_RABDO.alvoDuMlH, discordante }
}

export const NOTA_ALVO_DU = 'O livro põe "200–300 mL/h" e "1–3 mL/kg/hora" como o mesmo alvo; os dois só coincidem em parte conforme o peso. A tela mostra os dois.'

export const BICARBONATO_RABDO = {
  mlNaHCO3: 150,
  diluenteMl: 1000,
  diluente: 'SG 5%',
  velocidadeMlH: 200,
  pagina: 'cap. 63, Tabela 3, p. 858',
  indicacao: 'CPK > 5.000 UI/L ou lesão muscular grave + CPK em ascensão',
  alvo: 'pH urinário > 6,5',
  parar: 'pH urinário < 6,5 mesmo após 4–6 horas; hipocalcemia sintomática; pH sérico > 7,5; bicarbonato > 30 mEq/L; ou CPK < 5.000 UI/L',
  cuidado: 'monitorizar cálcio iônico de 2/2 h',
}

/** Conta da solução da Tabela 3: 150 mL de NaHCO3 8,4% (1 mEq/mL, p. 938) + 1.000 mL de SG 5% a 200 mL/h. */
export function solucaoBicarbonatoRabdo() {
  const b = BICARBONATO_RABDO
  const meq = b.mlNaHCO3 * NAHCO3_84_MEQ_POR_ML
  const volume = b.mlNaHCO3 + b.diluenteMl
  const meqMl = meq / volume
  return { meq, volumeMl: volume, meqPorMl: meqMl, meqPorHora: meqMl * b.velocidadeMlH, horasPorBolsa: volume / b.velocidadeMlH }
}

export const MANITOL_RABDO = {
  mlPorLitro: 50,
  gKgDia: [1, 2] as Faixa,
  cpk: 30000,
  duMlH: 200,
  pararGapOsmolar: 55,
  pagina: 'cap. 63, Tabela 3, p. 858',
  texto: 'Não utilizado de rotina. Manitol 20%: adicionar 50 mL por litro de solução salina; dose 1–2 g/kg/dia. Considerar com CPK > 30.000 UI/L e débito urinário > 200 mL/h (benefício questionável). Contraindicado na oligoanúria; interromper com gap osmolar > 55 mOsm/kg',
}

/** 50 mL de manitol 20% (20 g/100 mL) = 10 g por litro de salina; e a faixa de g/dia pelo peso. */
export function manitolRabdo(pesoKg: number) {
  const gPorLitro = MANITOL_RABDO.mlPorLitro * 0.2
  if (!valido(pesoKg)) return { gPorLitro, gDia: null }
  return { gPorLitro, gDia: [MANITOL_RABDO.gKgDia[0] * pesoKg, MANITOL_RABDO.gKgDia[1] * pesoKg] as Faixa }
}

export const OUTROS_RABDO: Referencia[] = [
  { texto: 'Furosemida: não utilizada de rotina, salvo congestão; pode piorar a hipocalcemia', pagina: 'cap. 63, p. 859' },
  { texto: 'Indicações de diálise iguais às da LRA: hipervolemia, hipercalemia, acidose e uremia; hemodiálise não remove pigmento para prevenir IRA', pagina: 'cap. 63, p. 859' },
  { texto: 'Cálcio só em hipocalcemia sintomática ou cardioproteção na hipercalemia (risco de hipercalcemia rebote)', pagina: 'cap. 63, p. 861' },
]

// ── Escore de McMahon (Tabela 2, p. 856–857) ────────────────────────────────

export const fichaMcMahon = fichaAdulto('adulto-mcmahon-rabdomiolise', 'Escore de McMahon — rabdomiólise (adulto)', 'cap. 63, p. 856–857')

const opm = (rotulo: string, valor: number) => ({ rotulo: `${rotulo} — ${String(valor).replace('.', ',')} ${valor === 1 ? 'ponto' : 'pontos'}`, valor })

export const ERRATA_MCMAHON = 'O inventário do projeto aponta que, no escore publicado, fósforo > 5,4 mg/dL vale 3 pontos; o livro imprime 2 (conferido no PDF, p. 856). A soma usa o livro.'

export const mcmahon: Escore = {
  ficha: fichaMcMahon,
  descricao: 'Risco de óbito ou diálise na lesão muscular pela Tabela 2 do manual do HC (p. 856–857).',
  itens: [
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade', opcoes: [opm('≤ 50 anos (sem linha na tabela)', 0), opm('> 50 a ≤ 70 anos', 1.5), opm('> 70 a ≤ 80 anos', 2.5), opm('> 80 anos', 3)] },
    { tipo: 'escolha', id: 'sexo', rotulo: 'Sexo', opcoes: [opm('Masculino (sem linha na tabela)', 0), opm('Feminino', 1)] },
    { tipo: 'escolha', id: 'cr', rotulo: 'Creatinina inicial', opcoes: [opm('< 1,4 mg/dL (sem linha na tabela)', 0), opm('1,4–2,2 mg/dL', 1.5), opm('> 2,2 mg/dL', 3)] },
    { tipo: 'escolha', id: 'ca', rotulo: 'Cálcio total inicial', opcoes: [opm('≥ 7,5 mg/dL (sem linha na tabela)', 0), opm('< 7,5 mg/dL', 2)] },
    { tipo: 'escolha', id: 'cpk', rotulo: 'CPK inicial', opcoes: [opm('≤ 40.000 UI/L (sem linha na tabela)', 0), opm('> 40.000 UI/L', 2)] },
    { tipo: 'escolha', id: 'causa', rotulo: 'Causa de base', opcoes: [opm('Convulsão, síncope, exercício, estatina ou miosite', 0), opm('Diferente dessas', 3)] },
    { tipo: 'escolha', id: 'fosforo', rotulo: 'Fósforo inicial', opcoes: [opm('< 4 mg/dL (sem linha na tabela)', 0), opm('4–5,4 mg/dL', 1.5), opm('> 5,4 mg/dL', 2)] },
    { tipo: 'escolha', id: 'bic', rotulo: 'Bicarbonato', opcoes: [opm('≥ 19 mEq/L (sem linha na tabela)', 0), opm('< 19 mEq/L', 2)] },
  ],
  calcular(r) {
    if (!completo(mcmahon, r)) return null
    const total = somar(mcmahon, r)
    const faixa = total < 5 ? '< 5 pontos: risco de óbito ou diálise de 2,3%' : total > 10 ? '> 10 pontos: risco de óbito ou diálise de 61%' : '5 a 10 pontos: o livro não dá o risco desta faixa'
    return {
      rotulo: 'McMahon',
      valor: total.toLocaleString('pt-BR'),
      unidade: 'de 18',
      nota: `${faixa} (p. 857)`,
      estado: total > 10 ? 2 : total >= 5 ? 1 : 0,
      derivados: [
        ['Corte de 5 pontos', 'valor preditivo negativo 98% e positivo 27% (p. 857)'],
        ['Fósforo', escolha(mcmahon, r, 'fosforo')!.rotulo],
      ],
      cuidados: [
        ERRATA_MCMAHON,
        'O livro diz que o escore ainda precisa de mais estudos para validação clínica (p. 857).',
        'Escore prognóstico: não define conduta. Sem referência pediátrica declarada.',
      ],
    }
  },
}

export const FORA_RENAL = [
  'Creatinina basal quando não há exame prévio: o cap. 61 não traz fórmula de estimativa.',
  'Doses de quelante de fósforo e de bicarbonato na LRA: não informadas no cap. 61.',
  'Cortes numéricos de ureia ou de potássio para iniciar TSR: o livro diz que não existem.',
  'Tratamento da hipercalemia com doses: cap. 67 (já no produto, ReposicaoPotassio/hiperpotassemia).',
]
