import type { Ficha } from '../ficha.ts'
import { ESCALAS_DOR, type ItemDor } from '../triagem/dor.ts'

// Indicadores da aba "Avaliação e crescimento" (porte do protótipo, etapa 9):
// escolhe a escala, responde as perguntas, o resultado é a soma e a
// interpretação é a faixa da PRÓPRIA escala. Fica ao lado da curva porque as
// duas moram na mesma aba.
//
// O protótipo oferece Braden, Morse, Fugulin, NIPS e FLACC ("as escalas que o
// sistema já tem com fonte"). Entram aqui:
//   • NIPS e FLACC — pediatria. Itens, pontos e leitura são os mesmos da dor
//     na triagem (../triagem/dor.ts), com as mesmas fontes.
//   • Braden e Morse — adulto (14 anos ou mais). São escalas validadas no
//     adulto; na criança não se usam (nada se converte do adulto — casco).
//   • Fugulin fica FORA: o próprio protótipo manda "conferir com a versão
//     adotada pela unidade", e as faixas dele (alta dependência 23–27,
//     semi-intensivos 28–34) não batem com as do artigo citado (Fugulin 2005:
//     23–28 e 29–34). Entra quando a unidade disser qual versão usa.
// A intervenção por faixa é da unidade (o protótipo avisa que não há
// cadastro); nada aqui sugere conduta.
//
// Os mesmos itens, pontos e faixas estão em private.escala_avaliacao
// (migration 20261004000003): o servidor refaz a soma e a leitura.

export type EscalaAvaliacao = 'nips' | 'flacc' | 'braden' | 'morse'
export type Tom = 'conforme' | 'atencao' | 'alerta' | 'critico'
export type Faixa = { min: number; rotulo: string; tom: Tom }

export type DefinicaoAvaliacao = {
  id: EscalaAvaliacao
  nome: string
  publico: 'pediatrico' | 'adulto'
  faixaEtaria: string
  itens: ItemDor[]
  faixas: Faixa[]
  ficha: Ficha
}

const REVISADO = '29/09/2026 (porte do protótipo)'

export const fichaBraden: Ficha = {
  id: 'avaliacao-braden',
  titulo: 'Braden — risco de lesão por pressão',
  versao: '2026-09-29.1',
  publico: 'adulto',
  fontes: [
    { citacao: 'Bergstrom N, Braden BJ, Laguzza A, Holman V. The Braden Scale for predicting pressure sore risk. Nurs Res. 1987;36(4):205–210.' },
    { citacao: 'Versão brasileira: Paranhos WY, Santos VLCG. Avaliação de risco para úlceras de pressão por meio da Escala de Braden, na língua portuguesa. Rev Esc Enferm USP. 1999;33(nº esp.):191–206.' },
  ],
  revisadoEm: REVISADO,
}

export const fichaMorse: Ficha = {
  id: 'avaliacao-morse',
  titulo: 'Morse — risco de queda',
  versao: '2026-09-29.1',
  publico: 'adulto',
  fontes: [
    { citacao: 'Morse JM, Morse RM, Tylko SJ. Development of a scale to identify the fall-prone patient. Can J Aging. 1989;8(4):366–377.' },
    // o protótipo cita só autor, revista e páginas da versão brasileira; conferir a referência completa
    { citacao: 'Versão brasileira: Urbanetto JS, et al. Rev Gaúcha Enferm. 2013;34:21–8.' },
  ],
  revisadoEm: REVISADO,
}

const op = (pares: [number, string][]) => pares.map(([valor, rotulo]) => ({ valor, rotulo }))

export const ESCALAS_AVALIACAO: Record<EscalaAvaliacao, DefinicaoAvaliacao> = {
  nips: {
    id: 'nips', nome: 'NIPS · dor', publico: 'pediatrico', faixaEtaria: ESCALAS_DOR.nips.faixa,
    itens: ESCALAS_DOR.nips.itens,
    faixas: [
      { min: 0, rotulo: 'Sem dor pela NIPS (0 a 3)', tom: 'conforme' },
      { min: 4, rotulo: 'Dor (4 ou mais)', tom: 'critico' },
    ],
    ficha: ESCALAS_DOR.nips.ficha,
  },
  flacc: {
    id: 'flacc', nome: 'FLACC · dor', publico: 'pediatrico', faixaEtaria: ESCALAS_DOR.flacc.faixa,
    itens: ESCALAS_DOR.flacc.itens,
    faixas: [
      { min: 0, rotulo: 'Relaxado e confortável (0)', tom: 'conforme' },
      { min: 1, rotulo: 'Desconforto leve (1 a 3)', tom: 'atencao' },
      { min: 4, rotulo: 'Dor moderada (4 a 6)', tom: 'alerta' },
      { min: 7, rotulo: 'Dor intensa (7 a 10)', tom: 'critico' },
    ],
    ficha: ESCALAS_DOR.flacc.ficha,
  },
  braden: {
    id: 'braden', nome: 'Braden · risco de lesão por pressão', publico: 'adulto', faixaEtaria: 'adulto',
    itens: [
      { id: 'percepcao', rotulo: 'Percepção sensorial', opcoes: op([[1, 'Totalmente limitado'], [2, 'Muito limitado'], [3, 'Levemente limitado'], [4, 'Nenhuma limitação']]) },
      { id: 'umidade', rotulo: 'Umidade', opcoes: op([[1, 'Completamente molhado'], [2, 'Muito molhado'], [3, 'Ocasionalmente molhado'], [4, 'Raramente molhado']]) },
      { id: 'atividade', rotulo: 'Atividade', opcoes: op([[1, 'Acamado'], [2, 'Confinado à cadeira'], [3, 'Anda ocasionalmente'], [4, 'Anda frequentemente']]) },
      { id: 'mobilidade', rotulo: 'Mobilidade', opcoes: op([[1, 'Totalmente imóvel'], [2, 'Bastante limitado'], [3, 'Levemente limitado'], [4, 'Não apresenta limitações']]) },
      { id: 'nutricao', rotulo: 'Nutrição', opcoes: op([[1, 'Muito pobre'], [2, 'Provavelmente inadequada'], [3, 'Adequada'], [4, 'Excelente']]) },
      { id: 'friccao', rotulo: 'Fricção e cisalhamento', opcoes: op([[1, 'Problema'], [2, 'Problema em potencial'], [3, 'Nenhum problema aparente']]) },
    ],
    faixas: [
      { min: 0, rotulo: 'Risco muito alto (9 ou menos)', tom: 'critico' },
      { min: 10, rotulo: 'Risco alto (10 a 12)', tom: 'alerta' },
      { min: 13, rotulo: 'Risco moderado (13 a 14)', tom: 'atencao' },
      { min: 15, rotulo: 'Risco baixo (15 a 18)', tom: 'conforme' },
      { min: 19, rotulo: 'Sem risco (19 a 23)', tom: 'conforme' },
    ],
    ficha: fichaBraden,
  },
  morse: {
    id: 'morse', nome: 'Morse · risco de queda', publico: 'adulto', faixaEtaria: 'adulto',
    itens: [
      { id: 'quedas', rotulo: 'Histórico de quedas', opcoes: op([[0, 'Não'], [25, 'Sim']]) },
      { id: 'diagnostico', rotulo: 'Diagnóstico secundário', opcoes: op([[0, 'Não'], [15, 'Sim']]) },
      { id: 'auxilio', rotulo: 'Auxílio na deambulação', opcoes: op([[0, 'Nenhum, acamado ou auxiliado por profissional'], [15, 'Muletas, bengala ou andador'], [30, 'Apoia-se no mobiliário']]) },
      { id: 'terapia_ev', rotulo: 'Terapia endovenosa ou cateter heparinizado', opcoes: op([[0, 'Não'], [20, 'Sim']]) },
      { id: 'marcha', rotulo: 'Marcha', opcoes: op([[0, 'Normal, sem deambulação ou acamado'], [10, 'Fraca'], [20, 'Comprometida ou cambaleante']]) },
      { id: 'estado_mental', rotulo: 'Estado mental', opcoes: op([[0, 'Orientado e ciente da própria capacidade'], [15, 'Superestima a capacidade ou esquece limitações']]) },
    ],
    faixas: [
      { min: 0, rotulo: 'Risco baixo (0 a 24)', tom: 'conforme' },
      { min: 25, rotulo: 'Risco moderado (25 a 44)', tom: 'atencao' },
      { min: 45, rotulo: 'Risco alto (45 ou mais)', tom: 'critico' },
    ],
    ficha: fichaMorse,
  },
}

/** Escalas oferecidas pelo grupo etário: pediatria só NIPS e FLACC; adulto, Braden e Morse. */
export function escalasDoPublico(publico: 'adulto' | 'pediatrico' | null): EscalaAvaliacao[] {
  if (publico === 'pediatrico') return ['nips', 'flacc']
  if (publico === 'adulto') return ['braden', 'morse']
  return []
}

export type Respostas = Record<string, number>

/** Soma das respostas; null enquanto faltar item ou houver valor fora das opções. */
export function totalAvaliacao(escala: EscalaAvaliacao, resp: Respostas): number | null {
  let t = 0
  for (const it of ESCALAS_AVALIACAO[escala].itens) {
    const v = resp[it.id]
    if (v === undefined || !it.opcoes.some((o) => o.valor === v)) return null
    t += v
  }
  return t
}

/** A faixa da própria escala em que o total cai. */
export function faixaDe(escala: EscalaAvaliacao, total: number): Faixa {
  const fx = ESCALAS_AVALIACAO[escala].faixas
  let r = fx[0]
  for (const f of fx) if (total >= f.min) r = f
  return r
}

export const respondidas = (escala: EscalaAvaliacao, resp: Respostas) =>
  ESCALAS_AVALIACAO[escala].itens.filter((it) => resp[it.id] !== undefined).length
