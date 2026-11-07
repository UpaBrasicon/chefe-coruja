// Dini — classificação de pacientes pediátricos (achado guardado de
// 09/10/2026; diagnóstico em docs/clinico/DINI-PEDIATRICO-DIAGNOSTICO.md).
// Decisão do RT (06/11/2026): A em D1 a D7.
//   • D1: versão aperfeiçoada de 2014 (Quadro 1 de Dini e Guirardello): 11
//     indicadores, soma de 11 a 44, 5 categorias, para toda criança até 13a
//     11m 29d, recém-nascido incluído;
//   • D2 e D3: o texto das situações NÃO entra no produto (o Quadro 1 é CC
//     BY-NC 3.0 e o produto é comercial): aqui fica um resumo nosso de cada
//     situação, aprovado pelo RT em 06/11/2026 sem correções, com a citação;
//   • D4: enfermeiro de plantão, uma vez por dia, na internação, com histórico;
//     corrigir no mesmo dia é retificar com motivo (igual ao Fugulin);
//   • D5: o servidor decide pela data de nascimento no dia: menos de 14 anos é
//     Dini, 14 anos ou mais é Fugulin; o instrumento errado é recusado;
//   • D6: criança com menos de 6 anos em mínimos ou intermediários ganha uma
//     nota com a observação dos autores; a categoria NÃO muda;
//   • D7: tabela própria (classificacoes_dini), espelho da do Fugulin.
// Faixas: RLAE 2014 (CC BY 4.0) e nota do Quadro 1 da REEUSP 2014. Os mesmos
// dados estão no servidor (migration 20270303000001, private.dini_definicao),
// que refaz a soma.

import type { Ficha } from '../ficha'

export type DominioDini = 'Família' | 'Paciente' | 'Procedimentos terapêuticos'
export type IndicadorDini = {
  dominio: DominioDini
  id: string
  rotulo: string
  /** explicação do indicador, do resumo aprovado */
  nota?: string
  situacoes: [string, string, string, string]
}
export type CategoriaDini = { min: number; rotulo: string; tom: 'conforme' | 'atencao' | 'alerta' | 'critico' }

export const fichaDini: Ficha = {
  id: 'dini-pediatrico',
  titulo: 'Dini — classificação de pacientes pediátricos (11 indicadores)',
  versao: '2026-11-06.1',
  publico: 'pediatrico',
  fontes: [
    { citacao: 'Dini AP, Guirardello EB. Pediatric patient classification system: improvement of an instrument (título em inglês do PubMed; artigo em português). Rev Esc Enferm USP. 2014;48(5):787–793 (PMID 25493481). Quadro 1: indicadores, situações e faixas (CC BY-NC 3.0; na tela, só o resumo nosso).', url: 'https://doi.org/10.1590/s0080-6234201400005000003', pediatrica: true },
    { citacao: 'Dini AP, Alves DFS, Oliveira HC, Guirardello EB. Validity and reliability of a pediatric patient classification instrument. Rev Latino-Am Enfermagem. 2014;22(4):598–603 (PMID 25296143, PMC4292659): 11 indicadores de 1 a 4 pontos, soma de 11 a 44 e faixas; alfa de Cronbach 0,92 no instrumento e 0,44 no domínio procedimentos terapêuticos (os autores pedem mais estudos).', url: 'https://doi.org/10.1590/0104-1169.3575.2457', pediatrica: true },
    { citacao: 'Dini AP, Fugulin FMT, Veríssimo MLÓR, Guirardello EB. Pediatric Patient Classification System: construction and validation of care categories (título em inglês do PubMed; artigo em português). Rev Esc Enferm USP. 2011;45(3):575–580 (PMID 21710060): as cinco categorias de cuidado.', url: 'https://doi.org/10.1590/s0080-62342011000300004', pediatrica: true },
  ],
  revisadoEm: '06/11/2026 (decisão do RT: A em D1 a D7; resumo das situações aprovado sem correções)',
}

/**
 * Situação 1 (menor demanda) a 4 (maior), na ordem do Quadro 1, por domínio.
 * Resumo nosso, aprovado pelo RT, não o texto do instrumento.
 */
export const INDICADORES_DINI: IndicadorDini[] = [
  {
    dominio: 'Família', id: 'participacao_acompanhante', rotulo: 'Participação do acompanhante',
    situacoes: [
      'Reconhece e atende às necessidades físicas e emocionais da criança.',
      'Está disposto a aprender informações e habilidades novas para o cuidado.',
      'Tem dificuldade ou não se dispõe a aprender, ou mostra ansiedade, medo, raiva ou retraimento.',
      'Está ausente, indisponível ou agressivo, ou a criança precisa de cuidado técnico de alta complexidade.',
    ],
  },
  {
    dominio: 'Família', id: 'rede_apoio', rotulo: 'Rede de apoio e suporte familiar',
    situacoes: [
      'Acompanhante envolvido no cuidado o tempo todo.',
      'Acompanhante envolvido mais de 12 horas por dia.',
      'Acompanhante envolvido menos de 12 horas por dia.',
      'Sem suporte familiar, ou acompanhante com doença psiquiátrica, ou estressado ou alheio ao cuidado.',
    ],
  },
  {
    dominio: 'Paciente', id: 'atividade', rotulo: 'Atividade',
    situacoes: [
      'Mostra afeto e interesse e faz atividades da idade (brincar, jogos, escola, leitura).',
      'Mostra afeto e interesse, com limitação para as atividades da idade.',
      'Desinteresse (por dor, tristeza, raiva, agitação ou apatia), dificuldade de linguagem, deficiência visual ou atraso do desenvolvimento.',
      'Paralisia cerebral grave, coma vigil, inconsciência ou sedação total.',
    ],
  },
  {
    dominio: 'Paciente', id: 'oxigenacao', rotulo: 'Oxigenação',
    situacoes: [
      'Respira sozinho, sem oxigênio e sem desobstrução.',
      'Respira sozinho e precisa de desobstrução com instilação de soro.',
      'Respira sozinho e precisa de aspiração de secreções ou de oxigênio.',
      'Ventilação mecânica, invasiva ou não invasiva.',
    ],
  },
  {
    dominio: 'Paciente', id: 'mobilidade', rotulo: 'Mobilidade e deambulação',
    situacoes: [
      'Anda sem ajuda.',
      'Fica no leito e se mobiliza sem ajuda.',
      'Fica no leito e se mobiliza com ajuda, ou anda com supervisão direta.',
      'Restrito ao leito, totalmente dependente para a mudança de decúbito.',
    ],
  },
  {
    dominio: 'Paciente', id: 'alimentacao', rotulo: 'Alimentação e hidratação',
    situacoes: [
      'Via oral independente ou amamentação eficaz.',
      'Via oral com ajuda, e a criança colabora.',
      'Sonda (gástrica ou enteral) ou gastrostomia; ou via oral sem colaboração ou com risco de aspiração; ou amamentação ineficaz.',
      'Nutrição ou hidratação parenteral.',
    ],
  },
  {
    dominio: 'Paciente', id: 'eliminacoes', rotulo: 'Eliminações',
    situacoes: [
      'Vaso sanitário sem ajuda.',
      'Vaso sanitário com ajuda.',
      'Treino de esfíncteres, fralda, comadre ou urinol.',
      'Sonda vesical ou estomia.',
    ],
  },
  {
    dominio: 'Paciente', id: 'higiene', rotulo: 'Higiene e cuidado corporal',
    situacoes: [
      'Banho de chuveiro sem ajuda.',
      'Banho de chuveiro com ajuda parcial.',
      'Banho de imersão, em cadeira, ou com ajuda total.',
      'Banho no leito, na incubadora ou em berço aquecido.',
    ],
  },
  {
    dominio: 'Procedimentos terapêuticos', id: 'intervalo_controles', rotulo: 'Intervalo de aferição de controles',
    nota: 'Os controles são sinais vitais, saturação, pressão venosa central, glicemia capilar, diálise peritoneal e balanço hídrico.',
    situacoes: [
      'A cada 6 horas.',
      'A cada 4 horas.',
      'A cada 2 horas.',
      'Menos de 2 horas, ou monitorização contínua.',
    ],
  },
  {
    dominio: 'Procedimentos terapêuticos', id: 'terapeutica', rotulo: 'Terapêutica medicamentosa',
    situacoes: [
      'Sem medicamento.',
      'Via tópica, ocular ou oral, e a criança colabora.',
      'Via parenteral, enteral ou inalatória; ou tópica, ocular ou oral sem colaboração.',
      'Hemoderivado, quimioterápico ou uso obrigatório de bomba de infusão.',
    ],
  },
  {
    dominio: 'Procedimentos terapêuticos', id: 'integridade_pele', rotulo: 'Integridade cutâneo-mucosa',
    situacoes: [
      'Pele íntegra em todo o corpo.',
      'Cuidado de baixa complexidade: hidratação da pele, dermatite simples, troca da fixação de acesso periférico.',
      'Curativo de média complexidade: ferida limitada à derme, inserção de dreno, traqueostomia, gastrostomia ou cateter central.',
      'Cuidado de alta complexidade: desbridamento, dermatite disseminada, queimadura extensa, estomia complexa, ferida com fáscia, osso ou evisceração.',
    ],
  },
]

export const DOMINIOS_DINI: DominioDini[] = ['Família', 'Paciente', 'Procedimentos terapêuticos']

export const CATEGORIAS_DINI: CategoriaDini[] = [
  { min: 11, rotulo: 'Cuidados mínimos (11 a 17)', tom: 'conforme' },
  { min: 18, rotulo: 'Cuidados intermediários (18 a 23)', tom: 'atencao' },
  { min: 24, rotulo: 'Alta dependência (24 a 30)', tom: 'alerta' },
  { min: 31, rotulo: 'Cuidados semi-intensivos (31 a 36)', tom: 'critico' },
  { min: 37, rotulo: 'Cuidados intensivos (37 a 44)', tom: 'critico' },
]

export type RespostasDini = Record<string, number>

/** Soma só quando os 11 indicadores estão respondidos (1 a 4). */
export function totalDini(r: RespostasDini): number | null {
  let t = 0
  for (const a of INDICADORES_DINI) {
    const v = r[a.id]
    if (!Number.isInteger(v) || v < 1 || v > 4) return null
    t += v
  }
  return t
}

export function categoriaDini(total: number): CategoriaDini {
  let c = CATEGORIAS_DINI[0]
  for (const x of CATEGORIAS_DINI) if (total >= x.min) c = x
  return c
}

// D6: observação dos autores na discussão da RLAE 2014. Não é regra do
// instrumento: a categoria fica a que a soma dá.
export const DINI_IDADE_NOTA_ANOS = 6
/** Até aqui (exclusive) vão as categorias de mínimos e intermediários. */
const DINI_ACIMA_DE_INTERMEDIARIOS = 24
export const NOTA_DINI_MENOR_DE_6 =
  'Criança com menos de 6 anos em cuidados mínimos ou intermediários: os autores observam que essas categorias não refletem a necessidade real de cuidado nessa idade, porque as horas que o COFEN dá a elas são poucas. A categoria do instrumento não muda (Dini et al., Rev Latino-Am Enfermagem 2014).'

/** A nota D6, ou nulo. `anos` = idade em anos completos no dia (nulo = sem data de nascimento). */
export function notaDiniMenorDe6(total: number, anos: number | null): string | null {
  if (anos === null || anos >= DINI_IDADE_NOTA_ANOS) return null
  return total < DINI_ACIMA_DE_INTERMEDIARIOS ? NOTA_DINI_MENOR_DE_6 : null
}
