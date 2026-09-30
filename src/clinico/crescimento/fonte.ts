import type { Ficha, Fonte } from '../ficha.ts'

// Fontes da curva de crescimento (porte do protótipo, etapa 9). As tabelas LMS
// em ./dados vieram dos arquivos originais da OMS, sem digitação (protótipo,
// ESTADO.md, 26/09) e foram copiadas sem mudar valor. Cada arquivo diz de qual
// tabela da OMS saiu (campo "fonte").

export const OMS_2006: Fonte = {
  citacao:
    'WHO Multicentre Growth Reference Study Group. WHO Child Growth Standards: length/height-for-age, weight-for-age, weight-for-length, weight-for-height and body mass index-for-age — Methods and development. Geneva: World Health Organization; 2006. E: WHO Child Growth Standards — head circumference-for-age, arm circumference-for-age, triceps skinfold-for-age and subscapular skinfold-for-age. Geneva: WHO; 2007. Tabelas LMS (z-scores) de 0 a 5 anos.',
  url: 'https://www.who.int/tools/child-growth-standards/standards',
  pediatrica: true,
}

export const OMS_2007: Fonte = {
  citacao:
    'de Onis M, Onyango AW, Borghi E, Siyam A, Nishida C, Siekmann J. Development of a WHO growth reference for school-aged children and adolescents. Bull World Health Organ. 2007;85(9):660–667. WHO Growth Reference 2007 (5 a 19 anos): tabelas LMS de estatura e IMC para a idade até 19 anos e de peso para a idade até 10 anos.',
  url: 'https://www.who.int/tools/growth-reference-data-for-5to19-years',
  pediatrica: true,
}

export const LMS_COLE: Fonte = {
  citacao:
    'Cole TJ. The LMS method for constructing normalized growth standards. Eur J Clin Nutr. 1990;44(1):45–60. Cole TJ, Green PJ. Smoothing reference centile curves: the LMS method and penalized likelihood. Stat Med. 1992;11(10):1305–1319.',
  pediatrica: true,
}

/** A leitura do peso para a idade (só esse indicador tem classificação no protótipo). */
export const SISVAN_2011: Fonte = {
  citacao:
    'Brasil. Ministério da Saúde. Orientações para a coleta e análise de dados antropométricos em serviços de saúde: Norma Técnica do Sistema de Vigilância Alimentar e Nutricional — SISVAN. Brasília: Ministério da Saúde; 2011. Peso para a idade, crianças de 0 a 10 anos.',
  pediatrica: true,
}

export const fichaCurvaCrescimento: Ficha = {
  id: 'curva-crescimento-oms',
  titulo: 'Curva de crescimento (OMS 2006 e 2007)',
  versao: '2026-09-29.1',
  publico: 'pediatrico',
  fontes: [OMS_2006, OMS_2007, LMS_COLE, SISVAN_2011],
  revisadoEm: '29/09/2026 (porte do protótipo; valores conferidos contra as tabelas de escore-z publicadas pela OMS no teste)',
}
