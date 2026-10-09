// Fugulin — sistema de classificação de pacientes, versão de 12 áreas
// (Fase 2, tarefa 5 do BACKLOG). Decisão do RT (09/10/2026):
//   • versão de 12 áreas (as 9 de Fugulin et al. mais as 3 de feridas da
//     complementação de 2007), com intensivo acima de 34;
//   • o texto das graduações NÃO entra no produto (os artigos são CC BY-NC):
//     aqui fica um resumo nosso de cada graduação, com a citação;
//   • enfermeiro, uma vez por dia, na internação, com histórico.
// É instrumento do ADULTO (14 anos ou mais). A criança tem instrumento
// próprio (Dini, Fugulin et al., 2011), que não está no produto: nada se
// converte do adulto (casco).
// Faixas: a Tabela 2 da complementação é imagem no PDF; as faixas 12–17,
// 18–22, 23–28, 29–34 e acima de 34 vêm de quem aplicou a versão (de Brito e
// Guirardello, 2012) e da decisão do RT. Os mesmos dados estão no servidor
// (migration 20261031000006, private.fugulin_definicao), que refaz a soma.

import type { Ficha } from '../ficha'

export type AreaFugulin = { id: string; rotulo: string; niveis: [string, string, string, string] }
export type CategoriaFugulin = { min: number; rotulo: string; tom: 'conforme' | 'atencao' | 'alerta' | 'critico' }

export const fichaFugulin: Ficha = {
  id: 'fugulin-12-areas',
  titulo: 'Fugulin — classificação de pacientes (12 áreas)',
  versao: '2026-10-09.1',
  publico: 'adulto',
  fontes: [
    { citacao: 'Fugulin FMT, Gaidzinski RR, Kurcgant P. Sistema de classificação de pacientes: identificação do perfil assistencial dos pacientes das unidades de internação do HU-USP. Rev Latino-am Enfermagem. 2005;13(1):72–78.', url: 'https://doi.org/10.1590/s0104-11692005000100012' },
    { citacao: 'Santos F, Rogenski NMB, Baptista CMC, Fugulin FMT. Sistema de classificação de pacientes: proposta de complementação do instrumento de Fugulin et al. Rev Latino-am Enfermagem. 2007;15(5):980–985.', url: 'https://doi.org/10.1590/s0104-11692007000500015' },
    { citacao: 'Faixas da versão de 12 áreas: de Brito AP, Guirardello EB. Nível de complexidade assistencial dos pacientes em uma unidade de internação. Rev Bras Enferm. 2012;65(1):92–96.', url: 'https://doi.org/10.1590/s0034-71672012000100013' },
  ],
  revisadoEm: '09/10/2026 (decisão do RT: 12 áreas, resumo das graduações)',
}

/** Graduação 1 (menor dependência) a 4 (maior). Resumo nosso, não o texto do instrumento. */
export const AREAS_FUGULIN: AreaFugulin[] = [
  { id: 'estado_mental', rotulo: 'Estado mental', niveis: ['Orientado no tempo e no espaço', 'Desorientado por períodos', 'Inconsciente por períodos', 'Inconsciente'] },
  { id: 'oxigenacao', rotulo: 'Oxigenação', niveis: ['Sem oxigênio', 'Oxigênio intermitente (máscara ou cateter)', 'Oxigênio contínuo (máscara ou cateter)', 'Ventilação mecânica'] },
  { id: 'sinais_vitais', rotulo: 'Sinais vitais', niveis: ['Controle de rotina (8/8 h)', 'Controle de 6/6 h', 'Controle de 4/4 h', 'Controle a cada 2 h ou menos'] },
  { id: 'motilidade', rotulo: 'Motilidade', niveis: ['Movimenta todo o corpo', 'Movimentos limitados', 'Dificuldade de movimento; decúbito e movimento passivo com ajuda da enfermagem', 'Não se movimenta; decúbito e movimento passivo feitos pela enfermagem'] },
  { id: 'deambulacao', rotulo: 'Deambulação', niveis: ['Anda sozinho', 'Anda com ajuda', 'Cadeira de rodas', 'Restrito ao leito'] },
  { id: 'alimentacao', rotulo: 'Alimentação', niveis: ['Come sozinho', 'Pela boca, com ajuda', 'Por sonda nasogástrica', 'Por cateter central'] },
  { id: 'cuidado_corporal', rotulo: 'Cuidado corporal', niveis: ['Independente', 'Ajuda no banho de chuveiro ou na higiene oral', 'Banho de chuveiro e higiene oral feitos pela enfermagem', 'Banho no leito e higiene oral feitos pela enfermagem'] },
  { id: 'eliminacao', rotulo: 'Eliminação', niveis: ['Independente', 'Vaso sanitário com ajuda', 'Comadre ou eliminação no leito', 'Evacuação no leito e sonda vesical para diurese'] },
  { id: 'terapeutica', rotulo: 'Terapêutica', niveis: ['IM ou VO', 'EV intermitente', 'EV contínua ou por sonda', 'Droga vasoativa para manter a PA'] },
  { id: 'integridade_pele', rotulo: 'Integridade cutâneo-mucosa', niveis: ['Pele íntegra', 'Alteração de cor ou lesão superficial (epiderme, derme)', 'Lesão até subcutâneo ou músculo; incisão, estomia ou dreno', 'Lesão profunda com estruturas de suporte; evisceração'] },
  { id: 'curativo', rotulo: 'Curativo', niveis: ['Sem curativo (ou limpeza pelo próprio paciente no banho)', 'Uma vez ao dia, pela enfermagem', 'Duas vezes ao dia, pela enfermagem', 'Três vezes ao dia ou mais, pela enfermagem'] },
  { id: 'tempo_curativo', rotulo: 'Tempo do curativo', niveis: ['Sem curativo', '5 a 15 minutos', '15 a 30 minutos', 'Mais de 30 minutos'] },
]

export const CATEGORIAS_FUGULIN: CategoriaFugulin[] = [
  { min: 12, rotulo: 'Cuidados mínimos (12 a 17)', tom: 'conforme' },
  { min: 18, rotulo: 'Cuidados intermediários (18 a 22)', tom: 'atencao' },
  { min: 23, rotulo: 'Alta dependência (23 a 28)', tom: 'alerta' },
  { min: 29, rotulo: 'Cuidados semi-intensivos (29 a 34)', tom: 'critico' },
  { min: 35, rotulo: 'Cuidados intensivos (acima de 34)', tom: 'critico' },
]

export type RespostasFugulin = Record<string, number>

/** Soma só quando as 12 áreas estão respondidas (1 a 4). */
export function totalFugulin(r: RespostasFugulin): number | null {
  let t = 0
  for (const a of AREAS_FUGULIN) {
    const v = r[a.id]
    if (!Number.isInteger(v) || v < 1 || v > 4) return null
    t += v
  }
  return t
}

export function categoriaFugulin(total: number): CategoriaFugulin {
  let c = CATEGORIAS_FUGULIN[0]
  for (const x of CATEGORIAS_FUGULIN) if (total >= x.min) c = x
  return c
}
