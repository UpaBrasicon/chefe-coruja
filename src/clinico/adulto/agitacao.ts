import { completo, escolha, type Escore } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// Paciente agitado (cap. 76, p. 1005–1016) e agitação no delirium (cap. 8,
// p. 130–138) do Manual de Medicina de Emergência do HCFMUSP (3ª ed., 2022).
// Só adulto: o trecho de crianças (p. 1014–1015) é qualitativo e sem dose, e
// não entra. A ferramenta mostra o que o livro traz e faz as contas por peso;
// a escolha da droga é do médico (ADR 0007).

export const fichaAgitacaoAdulto = fichaAdulto(
  'adulto-agitacao',
  'Paciente agitado, delirium e síndrome neuroléptica maligna — adulto',
  'cap. 76 O paciente agitado, p. 1005–1016 (Tabelas 3–5); cap. 8 Delirium, p. 136–138 (Tabela 7)',
)

export type Faixa = [number, number]

const valido = (x: number) => Number.isFinite(x) && x > 0

// ---------------------------------------------------------------------------
// BARS (Tabela 1, p. 1006)

const NIVEIS_BARS = [
  { rotulo: '1 — Dificuldade para despertar ou não desperta', conduta: 'Transferência imediata para o departamento de emergência' },
  { rotulo: '2 — Bastante sonolento, porém responde normalmente ao estímulo físico e verbal', conduta: 'Transferência para o departamento de emergência' },
  { rotulo: '3 — Sonolento, aparenta estar sedado', conduta: 'Transferência para o departamento de emergência' },
  { rotulo: '4 — Quieto e acordado (normal)', conduta: 'Sem condutas' },
  { rotulo: '5 — Sinais de agitação psicomotora, se acalma com comandos', conduta: 'Descalonamento verbal e modificação do ambiente' },
  { rotulo: '6 — Extremamente agitado, mas sem necessidade de contenção imediata', conduta: 'Descalonamento verbal e modificação do ambiente' },
  { rotulo: '7 — Violento, necessita de contenção imediata', conduta: 'Transferência para o departamento de emergência' },
]

export const bars: Escore = {
  ficha: fichaAdulto('adulto-bars', 'BARS — escala de atividade comportamental (adulto)', 'cap. 76 O paciente agitado, p. 1005–1006 (Tabela 1)'),
  descricao: 'Behavioral Activity Rating Scale, de 1 a 7, com a triagem pré-hospitalar da Tabela 1 do manual do HC.',
  itens: [
    { tipo: 'escolha', id: 'nivel', rotulo: 'Comportamento observado', opcoes: NIVEIS_BARS.map((n, i) => ({ rotulo: n.rotulo, valor: i + 1 })) },
  ],
  calcular(r) {
    if (!completo(bars, r)) return null
    const v = escolha(bars, r, 'nivel')!.valor
    const n = NIVEIS_BARS[v - 1]
    return {
      rotulo: 'BARS',
      valor: String(v),
      unidade: 'de 7',
      nota: v === 4 ? 'quieto e acordado' : v > 4 ? 'agitação' : 'sonolência / sedação',
      estado: v === 4 ? 0 : v === 1 || v === 7 ? 2 : 1,
      derivados: [['Triagem pré-hospitalar da Tabela 1 (p. 1006)', n.conduta]],
      cuidados: [
        'A Tabela 1 é de triagem pré-hospitalar (p. 1005). No hospital o livro classifica a agitação em leve, moderada e grave pela descrição clínica (p. 1006).',
        'Leve: conversa e colabora; moderada: disruptivo, sem perigo iminente; grave: combativo (p. 1006).',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// Contenção mecânica (Tabela 3, p. 1008–1010)

export const CONTENCAO_MECANICA = [
  { texto: '4 ou 5 pontos de restrição de movimento (errado: apenas dois pontos)', pagina: 'p. 1008' },
  { texto: 'Cabeceira elevada em 30º, posição supina; nunca prona', pagina: 'p. 1009' },
  { texto: 'Monitorização de consciência, sinais vitais, pele e circulação com regularidade nunca superior a 1 hora (Resolução Cofen n. 427/2012)', pagina: 'p. 1009' },
  { texto: 'Contenção física (imobilização pela equipe): cinco profissionais treinados', pagina: 'p. 1010' },
]

// ---------------------------------------------------------------------------
// Contenção química (Tabela 4 e texto, p. 1011)

export type NivelAgitacao = 'leve' | 'moderada' | 'grave'

export const CONTENCAO_QUIMICA: { nivel: NivelAgitacao; escolha: string; segundaLinha: string }[] = [
  { nivel: 'leve', escolha: 'Lorazepam 1-2 mg SL', segundaLinha: 'Antipsicóticos orais' },
  { nivel: 'moderada', escolha: 'Midazolam 2-5 mg IM', segundaLinha: 'Haloperidol 5-10 mg IM' },
  { nivel: 'grave', escolha: 'Quetamina 5 mg/kg IM', segundaLinha: 'Midazolam 5 mg IM, haloperidol 5 mg IM' },
]

export const COMBINACOES_AGITACAO = [
  { nome: 'Haloperidol + prometazina', dose: 'haloperidol 5-10 mg e prometazina 25-50 mg', nota: 'sedação mais rápida; segura e superior ao haloperidol sozinho quanto a efeitos colaterais', pagina: 'p. 1011' },
  { nome: 'Midazolam + haloperidol', dose: 'midazolam 5 mg e haloperidol 5 mg', nota: 'melhora a eficácia da sedação, sem aumento de efeitos adversos', pagina: 'p. 1011' },
]

export const TEMPOS_AGITACAO = [
  { droga: 'Midazolam', texto: 'início 1-5 min IV e 13-18 min IM; sedação média de 80-100 min', pagina: 'p. 1011' },
  { droga: 'Quetamina', texto: 'início 2-3 min IV e 4-5 min IM; sedação média de 5-30 min', pagina: 'p. 1011' },
]

/** Quetamina na agitação: 5 mg/kg IM na Tabela 4; 1-2 mg/kg IV e 4-6 mg/kg IM no texto (p. 1011). Sem dose máxima no livro. */
export const QUETAMINA_AGITACAO = { tabelaImMgKg: 5, imMgKg: [4, 6] as Faixa, ivMgKg: [1, 2] as Faixa, diluicaoIvMl: 10, pagina: 'p. 1011' }

export type DoseQuetamina = { tabelaImMg: number; imMg: Faixa; ivMg: Faixa }

export function quetaminaAgitacao(pesoKg: number): DoseQuetamina | null {
  if (!valido(pesoKg)) return null
  const q = QUETAMINA_AGITACAO
  return {
    tabelaImMg: q.tabelaImMgKg * pesoKg,
    imMg: [q.imMgKg[0] * pesoKg, q.imMgKg[1] * pesoKg],
    ivMg: [q.ivMgKg[0] * pesoKg, q.ivMgKg[1] * pesoKg],
  }
}

/** Idosos: iniciar com metade da dose inicial típica (p. 1014). */
export const metadeDaDose = (f: Faixa): Faixa => [f[0] / 2, f[1] / 2]

/** Shock index (FC / PAS); o livro usa > 0,7 como achado de choque na Tabela 5 (p. 1013). A fórmula não está no livro: é a definição do índice. */
export function shockIndex(fc: number, pas: number): { valor: number; acimaDoCorte: boolean } | null {
  if (!valido(fc) || !valido(pas)) return null
  const valor = fc / pas
  return { valor, acimaDoCorte: valor > 0.7 }
}

/** Cortes numéricos da Tabela 5 (causas orgânicas de agitação, p. 1012–1014). */
export const CORTES_CAUSAS_ORGANICAS = [
  { causa: 'Hipercapnia', corte: 'PaCO2 > 45 mmHg', pagina: 'p. 1013' },
  { causa: 'Hipoglicemia', corte: 'glicose sérica ou capilar < 70 mg/dL', pagina: 'p. 1013' },
  { causa: 'Hipotermia', corte: 'temperatura corporal < 35 ºC', pagina: 'p. 1013' },
  { causa: 'Choque', corte: 'shock index > 0,7', pagina: 'p. 1013' },
]

// ---------------------------------------------------------------------------
// Delirium: Tabela 7 (p. 136–137) e titulação (p. 138)

export type AntipsicoticoDelirium = { id: string; nome: string; inicialMg: Faixa; maximaMg: number; vias: string; nota?: string }

export const DELIRIUM_TABELA7: AntipsicoticoDelirium[] = [
  { id: 'haloperidol', nome: 'Haloperidol', inicialMg: [0.25, 0.5], maximaMg: 3, vias: 'oral, IM, IV', nota: 'Risco de sintomas extrapiramidais maior acima de 3 mg; preferencialmente IM (p. 136).' },
  { id: 'risperidona', nome: 'Risperidona', inicialMg: [0.25, 0.5], maximaMg: 3, vias: 'oral, IM',
    nota: 'Divergência interna: no cap. 76 (p. 1015) o livro diz que a risperidona só tem formulação VO.' },
  { id: 'olanzapina', nome: 'Olanzapina', inicialMg: [2.5, 5], maximaMg: 20, vias: 'oral, SL, IM', nota: 'Mais sedativa que o haloperidol; via oral menos efetiva nos sintomas agudos (p. 137).' },
  { id: 'quetiapina', nome: 'Quetiapina', inicialMg: [12.5, 25], maximaMg: 50, vias: 'oral', nota: 'Risco de hipotensão; cuidado no parkinsonismo (p. 137).' },
  { id: 'lorazepam', nome: 'Lorazepam', inicialMg: [0.25, 0.5], maximaMg: 2, vias: 'oral, IM, IV', nota: 'Segunda linha: abstinência de sedativos ou álcool, ou história de síndrome neuroléptica maligna (p. 137).' },
]

export const TITULACAO_DELIRIUM = { repetirMin: [30, 60] as Faixa, manutencaoVezesDia: [2, 3] as Faixa, pagina: 'p. 138' }

/**
 * Quanto falta para a dose máxima da Tabela 7, somando as doses já feitas.
 * O livro não diz se a "máxima" é por dia ou por episódio (errata/nota).
 */
export function restanteAteMaxima(maximaMg: number, dosesFeitasMg: number[]): { somaMg: number; restanteMg: number; atingiu: boolean } | null {
  if (!valido(maximaMg) || dosesFeitasMg.some((d) => !Number.isFinite(d) || d < 0)) return null
  const somaMg = dosesFeitasMg.reduce((s, d) => s + d, 0)
  return { somaMg, restanteMg: Math.max(0, maximaMg - somaMg), atingiu: somaMg >= maximaMg }
}

// ---------------------------------------------------------------------------
// Síndrome neuroléptica maligna (p. 1015–1016)

export const SNM = {
  cpkUiL: 1000,
  volumeLDia: [3, 4] as Faixa,
  dantroleno: { doseMg: 50, maxMgKgDia: 10, via: 'EV, conforme a necessidade' },
  bromocriptina: { doseMg: [2.5, 10] as Faixa, vezesDia: 3, maxMgDia: 40, dias: 10 },
  pagina: 'p. 1016',
}

export type ContaSnm = { dantrolenoMaxMgDia: number; dosesDe50AteMax: number; volumeMlH: Faixa }

/** Dantroleno: teto de 10 mg/kg/dia em doses de 50 mg; volume de 3-4 L/dia em mL/h (p. 1016). */
export function contaSnm(pesoKg: number): ContaSnm | null {
  if (!valido(pesoKg)) return null
  const max = SNM.dantroleno.maxMgKgDia * pesoKg
  return {
    dantrolenoMaxMgDia: max,
    dosesDe50AteMax: Math.floor(max / SNM.dantroleno.doseMg),
    volumeMlH: [(SNM.volumeLDia[0] * 1000) / 24, (SNM.volumeLDia[1] * 1000) / 24],
  }
}

export const ERRATA_AGITACAO = [
  'p. 1011 — quetamina IM: 5 mg/kg na Tabela 4 e 4-6 mg/kg no texto da mesma página; as duas aparecem.',
  'p. 1015 — título "síndrome neurológica maligna" (é neuroléptica) e "dinefidramina" (difenidramina).',
  'p. 136–137 — a Tabela 7 não diz se a dose máxima é por dia ou por episódio.',
  'p. 1016 — bromocriptina "2,5 a 10 mg, 3 vezes ao dia" e "máximo de 40 mg ao dia, sendo 10 mg a cada 6 horas": 10 mg 3×/dia = 30 mg; o teto de 40 mg corresponde a 10 mg 6/6 h.',
]
