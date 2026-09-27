import { fichaAdulto } from './fonte.ts'
import { INFUSOES_ADULTO, concentracao } from './infusoes.ts'

// Estado de mal epiléptico convulsivo do adulto — cap. 46 do Manual de
// Medicina de Emergência do HCFMUSP (3ª ed., 2022), p. 627–631 (Tabelas 3, 4
// e 5). A ferramenta calcula dose, volume e tempo mínimo de infusão a partir do
// que o livro traz; a escolha da droga é do médico (ADR 0007).
// O mL/h das infusões de 3ª linha usa o preparo padrão do Anexo 1
// (p. 1482–1485), do mesmo livro; o tiopental não tem preparo lá.

export const fichaEstadoDeMalAdulto = fichaAdulto(
  'adulto-estado-de-mal-epileptico',
  'Estado de mal epiléptico — adulto',
  'cap. 46 Estado de mal epiléptico, p. 627–631 (Tabelas 3–5); preparo das infusões: Anexo 1, p. 1482–1485',
)

export type Faixa = [number, number]

export type Velocidade = { rotulo: string; mgMin: number }

export type DrogaAtaque = {
  id: string
  nome: string
  linha: 1 | 2
  /** dose por peso (mg/kg); ausente nas doses fixas */
  mgKg?: Faixa
  /** dose fixa em mg */
  fixaMg?: Faixa
  /** teto da dose, em mg */
  maxMg?: number
  /** concentração da apresentação citada no capítulo (mg/mL) */
  mgMl?: number
  apresentacao: string
  administracao: string
  velocidades?: Velocidade[]
  pagina: string
  errata?: string
  nota?: string
}

export const ATAQUE_ESTADO_DE_MAL: DrogaAtaque[] = [
  { id: 'diazepam', nome: 'Diazepam', linha: 1, fixaMg: [10, 10], apresentacao: 'não diluído, ou 1 ampola em 9 mL de SF',
    administracao: 'EV a 5 mg/min; o manual recomenda repetir até duas vezes', velocidades: [{ rotulo: '5 mg/min', mgMin: 5 }], pagina: 'p. 627 (Tabela 3)',
    errata: 'A Tabela 3 escreve "1 amp 10 mg/mL"; o próprio livro dá a apresentação como 5 mg/mL, ampola de 2 mL (Anexo, p. 1492). Por isso o volume diluído não é calculado; a dose (10 mg) e a velocidade (5 mg/min) não dependem disso.' },
  { id: 'midazolam-im', nome: 'Midazolam IM', linha: 1, fixaMg: [10, 10], apresentacao: 'sem diluição',
    administracao: 'intramuscular; 5 mg se peso de 13–40 kg; sem recomendação de repetição', pagina: 'p. 628 (Tabela 3)',
    nota: 'Primeira opção se o paciente não estiver com acesso venoso.' },
  { id: 'fenobarbital-1', nome: 'Fenobarbital (se nenhum benzodiazepínico disponível)', linha: 1, mgKg: [15, 15], mgMl: 100, apresentacao: '200 mg/2 mL',
    administracao: 'EV, dose única', pagina: 'p. 628 (dose); apresentação na Tabela 4, p. 630' },
  { id: 'fenitoina', nome: 'Fenitoína', linha: 2, mgKg: [20, 20], mgMl: 50, apresentacao: '250 mg/5 mL; diluir em SF (incompatível com soro glicosado); filtro de linha recomendado',
    administracao: 'velocidade máxima 50 mg/min; 20–25 mg/min em idosos e cardiopatas',
    velocidades: [{ rotulo: '50 mg/min (máxima)', mgMin: 50 }, { rotulo: '25 mg/min (idoso/cardiopata)', mgMin: 25 }, { rotulo: '20 mg/min (idoso/cardiopata)', mgMin: 20 }],
    pagina: 'p. 629 (Tabela 4)' },
  { id: 'valproato', nome: 'Ácido valproico', linha: 2, mgKg: [40, 40], maxMg: 3000, mgMl: 100, apresentacao: '500 mg/5 mL; diluir em 100 mL de SF',
    administracao: 'sugestão de infusão 100 mg/min', velocidades: [{ rotulo: '100 mg/min', mgMin: 100 }], pagina: 'p. 629 (Tabela 4)',
    errata: 'O livro sugere "100 mg/min ou 6 mg/kg/min", velocidades incompatíveis (6 mg/kg/min em 70 kg = 420 mg/min). O tempo é calculado só pelos 100 mg/min.',
    nota: 'O próprio manual registra que foi retirado do mercado brasileiro em 2017.' },
  { id: 'lacosamida', nome: 'Lacosamida', linha: 2, fixaMg: [200, 400], apresentacao: 'diluir em 100 a 250 mL de SF, SG ou Ringer',
    administracao: 'infusão em 5 a 15 min', pagina: 'p. 629 (Tabela 4)', nota: 'Pode prolongar o intervalo PR.' },
  { id: 'fenobarbital-2', nome: 'Fenobarbital (se nenhum dos anteriores disponível)', linha: 2, mgKg: [15, 20], mgMl: 100, apresentacao: '200 mg/2 mL',
    administracao: '50 a 100 mg/min', velocidades: [{ rotulo: '100 mg/min', mgMin: 100 }, { rotulo: '50 mg/min', mgMin: 50 }], pagina: 'p. 630 (Tabela 4)' },
]

export type AtaqueCalculado = {
  mg: Faixa
  /** a dose por peso passou do teto e foi limitada */
  limitadoAoTeto: boolean
  ml: Faixa | null
  /** minutos para infundir a dose, por velocidade */
  tempos: { rotulo: string; minutos: Faixa }[]
}

const valido = (x: number) => Number.isFinite(x) && x > 0

/**
 * Dose de ataque para o peso. Dose fixa não depende do peso, exceto o
 * midazolam IM (5 mg entre 13 e 40 kg, p. 628). Peso inválido nas doses por
 * peso não calcula.
 */
export function calcularAtaque(d: DrogaAtaque, pesoKg: number): AtaqueCalculado | null {
  let mg: Faixa
  let limitado = false
  if (d.mgKg) {
    if (!valido(pesoKg)) return null
    mg = [d.mgKg[0] * pesoKg, d.mgKg[1] * pesoKg]
    if (d.maxMg !== undefined && mg[1] > d.maxMg) {
      limitado = true
      mg = [Math.min(mg[0], d.maxMg), d.maxMg]
    }
  } else {
    mg = [...d.fixaMg!] as Faixa
    if (d.id === 'midazolam-im' && valido(pesoKg) && pesoKg >= 13 && pesoKg <= 40) mg = [5, 5]
  }
  return {
    mg,
    limitadoAoTeto: limitado,
    ml: d.mgMl ? [mg[0] / d.mgMl, mg[1] / d.mgMl] : null,
    tempos: (d.velocidades ?? []).map((v) => ({ rotulo: v.rotulo, minutos: [mg[0] / v.mgMin, mg[1] / v.mgMin] as Faixa })),
  }
}

// ── 3ª linha: infusão contínua (Tabela 5, p. 630–631) ───────────────────────

export type DrogaTerceiraLinha = {
  id: string
  nome: string
  bolusMgKg: Faixa
  /** dose acumulada máxima dos bolus repetidos (mg/kg) */
  bolusAcumuladoMaxMgKg?: number
  repeticao: string
  manutencaoMgKgH: Faixa
  apresentacao: string
  /** id da infusão do Anexo 1 cujo preparo dá o mL/h */
  preparoAnexo?: string
  pagina: string
}

export const TERCEIRA_LINHA: DrogaTerceiraLinha[] = [
  { id: 'midazolam', nome: 'Midazolam', bolusMgKg: [0.2, 0.2], repeticao: 'pode ser repetido', manutencaoMgKgH: [0.1, 2],
    apresentacao: '15 mg/3 mL, 5 mg/mL, 50 mg/10 mL', preparoAnexo: 'midazolam', pagina: 'p. 630 (Tabela 5)' },
  { id: 'propofol', nome: 'Propofol', bolusMgKg: [2, 3], repeticao: 'pode ser repetido', manutencaoMgKgH: [4, 10],
    apresentacao: 'frasco-ampola 10 mg/mL ou 20 mg/mL', preparoAnexo: 'propofol', pagina: 'p. 630 (Tabela 5)' },
  { id: 'quetamina', nome: 'Quetamina (cetamina)', bolusMgKg: [1.5, 1.5], bolusAcumuladoMaxMgKg: 4.5, repeticao: 'repetido a cada 5 min até 4,5 mg/kg',
    manutencaoMgKgH: [2, 5], apresentacao: 'frasco-ampola 500 mg/10 mL', preparoAnexo: 'quetamina', pagina: 'p. 631 (Tabela 5)' },
  { id: 'tiopental', nome: 'Tiopental', bolusMgKg: [3, 5], repeticao: 'pode ser repetido a cada 2 a 3 minutos', manutencaoMgKgH: [3, 7],
    apresentacao: 'frascos de 0,5 a 1 g; diluir em SF', pagina: 'p. 631 (Tabela 5)' },
]

/** mg/mL do preparo padrão do Anexo 1 (propofol vem em µg/mL lá). */
export function mgMlDoAnexo(id: string): number | null {
  const i = INFUSOES_ADULTO.find((x) => x.id === id)
  if (!i) return null
  const c = concentracao(i)
  return i.numerador === 'mcg' ? c / 1000 : c
}

export type TerceiraLinhaCalculada = {
  bolusMg: Faixa
  bolusAcumuladoMaxMg: number | null
  manutencaoMgH: Faixa
  /** mL/h no preparo do Anexo 1; null quando o livro não traz preparo */
  manutencaoMlH: Faixa | null
  mgMlPreparo: number | null
}

export function calcularTerceiraLinha(d: DrogaTerceiraLinha, pesoKg: number): TerceiraLinhaCalculada | null {
  if (!valido(pesoKg)) return null
  const mgH: Faixa = [d.manutencaoMgKgH[0] * pesoKg, d.manutencaoMgKgH[1] * pesoKg]
  const c = d.preparoAnexo ? mgMlDoAnexo(d.preparoAnexo) : null
  return {
    bolusMg: [d.bolusMgKg[0] * pesoKg, d.bolusMgKg[1] * pesoKg],
    bolusAcumuladoMaxMg: d.bolusAcumuladoMaxMgKg ? d.bolusAcumuladoMaxMgKg * pesoKg : null,
    manutencaoMgH: mgH,
    manutencaoMlH: c ? [mgH[0] / c, mgH[1] / c] : null,
    mgMlPreparo: c,
  }
}

// Desmame (p. 631): o livro diz "manter 24 h em coma induzido" e "redução da
// infusão em 25% a cada 6 horas", sem dizer se os 25% são da dose inicial ou
// da corrente. Por isso o esquema não é calculado; a tela só reproduz o texto.
export const DESMAME_ESTADO_DE_MAL = {
  texto: 'Após controle (guiado por EEG), 24 h em coma induzido; depois, redução da infusão em 25% a cada 6 horas, com controle eletrográfico. Antes da redução, ao menos duas drogas antiepilépticas em dose terapêutica.',
  pagina: 'p. 631',
}

export const ESTABILIZACAO_ESTADO_DE_MAL = {
  texto: 'G50% 50 mL + tiamina 100 mg EV (se etilismo/desnutrição)',
  pagina: 'p. 627',
}

export const TEMPOS_ESTADO_DE_MAL = [
  { etapa: 'Estabilização', janela: 'primeiros 5 min', pagina: 'p. 627' },
  { etapa: '1ª linha', janela: '5–20 min', pagina: 'p. 627' },
  { etapa: '2ª linha', janela: '20–40 min', pagina: 'p. 628' },
  { etapa: '3ª linha (refratário)', janela: '40–60 min', pagina: 'p. 630' },
]
