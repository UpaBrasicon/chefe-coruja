import type { Ficha, Fonte } from '../ficha.ts'
import { fichaP4, type Referencia } from './fonteP4.ts'

// Bronquiolite — livro do ICr, cap. 29 (p. 300–306). O capítulo não traz
// escore de gravidade nem dose de medicamento (broncodilatador, epinefrina e
// corticoide não são recomendados de rotina). O que é numérico: fluxo da cânula
// nasal de alto fluxo (1 a 2 L/kg/min), critérios de internação e de
// palivizumabe. A ferramenta lista o que o livro diz; a decisão é do médico.
//
// Versão .1 de 28/09/2026: o nirsevimabe do MS substitui o palivizumabe
// (Portaria SECTICS nº 15/2025; Nota Técnica nº 109/2025-CGICI/DPNI/SVSA/MS;
// Guia de estratégia contra o VSR 2026, reproduzido no documento técnico da
// SMS-SP de 29/01/2026) e a diretriz australasiana de bronquiolite (atualização
// 2025) entra para O₂, alto fluxo, CPAP, salina, corticoide e alimentação.

export const NT_109_2025: Fonte = {
  citacao: 'Ministério da Saúde. Nota Técnica nº 109/2025-CGICI/DPNI/SVSA/MS: nirsevimabe para prevenção da infecção pelo VSR — indicação e registro. 29/09/2025.',
  url: 'https://sbim.org.br/images/Nirsevimabe_Nota_Tecnica_109.pdf_2025-10-02.pdf',
  pediatrica: true,
}

export const GUIA_VSR_2026: Fonte = {
  citacao: 'Ministério da Saúde. Guia de estratégia contra o VSR, 2026 — reproduzido em: SMS-São Paulo/PMI. Imunização contra o vírus sincicial respiratório para crianças prematuras e com comorbidades. 29/01/2026.',
  url: 'https://prefeitura.sp.gov.br/documents/d/saude/documento-tecnico-nirsevimabe_29-01-26-pdf',
  pediatrica: true,
}

export const AUSTRALASIA_2025: Fonte = {
  citacao: 'Australasian Bronchiolitis Guideline: 2025 Update (PREDICT). J Paediatr Child Health. 2025 (PMC12397848).',
  url: 'https://europepmc.org/article/PMC/PMC12397848',
  pediatrica: true,
}

const baseBronquiolite = fichaP4('ped-bronquiolite', 'Bronquiolite — internação, CNAF, nirsevimabe', 'cap. 29, p. 300–306')

export const fichaBronquiolite: Ficha = {
  ...baseBronquiolite,
  versao: '2026-09-28.1',
  fontes: [...baseBronquiolite.fontes, NT_109_2025, { ...GUIA_VSR_2026, citacao: `${GUIA_VSR_2026.citacao} p. 3–6, 10 e 13–14.` }, { ...AUSTRALASIA_2025, citacao: `${AUSTRALASIA_2025.citacao} Rec. 8–14, 18–20 e 23.` }],
  revisadoEm: '28/09/2026 (nirsevimabe MS 2025/2026 e Australásia 2025 conferidos; livro do ICr mantido como base)',
}

export const COMORBIDADES_NIRSEVIMABE = [
  { id: 'cardiopatia', texto: 'Cardiopatia congênita' },
  { id: 'broncodisplasia', texto: 'Broncodisplasia' },
  { id: 'imunocomprometimento', texto: 'Imunocomprometimento' },
  { id: 'down', texto: 'Síndrome de Down' },
  { id: 'fibrose', texto: 'Fibrose cística' },
  { id: 'neuromuscular', texto: 'Doença neuromuscular' },
  { id: 'viasAereas', texto: 'Anomalias congênitas das vias aéreas' },
]

export const NIRSEVIMABE = {
  prematuro: 'Prematuro com IG ≤ 36 semanas e 6 dias, qualquer peso: o ano todo, preferencialmente na maternidade',
  comorbidade: 'Criança < 24 meses (até 1 ano, 11 meses e 29 dias) com ≥ 1 comorbidade da lista: só no período sazonal (fevereiro a agosto); se a condição já existe ao nascer, pode ser ainda na maternidade',
  segundaSazonalidade: 'Na 2ª sazonalidade só as crianças com comorbidades (não o prematuro sem comorbidade)',
  apresentacao: 'Seringas de 0,5 mL e 1,0 mL conforme peso e sazonalidade (Quadro 4 do guia); não combinar duas de 0,5 mL para compor 1,0 mL',
  transicao: 'Temporada 2026: usar integralmente o palivizumabe remanescente e mantê-lo em quem já iniciou o esquema; sem intercambialidade entre palivizumabe e nirsevimabe na mesma temporada',
  onde: 'Rede de Imunobiológicos para Situações Especiais (RIE; Portaria GM/MS nº 6.623/2025), com maternidades como centros intermediários; disponível a partir de fevereiro de 2026',
  pagina: 'NT 109/2025, item 3 (p. 1); Guia VSR 2026 via SMS-SP, p. 3–6, 10 e 13–14',
}

/** Elegibilidade ao nirsevimabe pelo MS (NT 109/2025; Guia 2026). */
export function criteriosNirsevimabe(p: { idadeMeses: number; igSemanas: number | null; comorbidades: Set<string>; periodoSazonal: boolean | null }): { elegivel: boolean; motivos: string[]; avisos: string[] } {
  const motivos: string[] = []
  const avisos: string[] = []
  if (!Number.isFinite(p.idadeMeses) || p.idadeMeses < 0) return { elegivel: false, motivos, avisos }
  const ig = p.igSemanas
  if (ig !== null && ig > 0 && ig < 37) motivos.push('Prematuro com IG ≤ 36 semanas e 6 dias (qualquer peso)')
  if (p.idadeMeses < 24 && p.comorbidades.size > 0) {
    motivos.push(`Menos de 24 meses com comorbidade (${[...p.comorbidades].map((id) => COMORBIDADES_NIRSEVIMABE.find((c) => c.id === id)?.texto ?? id).join(', ')})`)
    if (p.periodoSazonal === false) avisos.push('Com comorbidade a aplicação é só no período sazonal (fevereiro a agosto), salvo na maternidade se a condição já existir ao nascer.')
  }
  if (p.idadeMeses >= 24 && p.comorbidades.size > 0) avisos.push('Com 24 meses ou mais a comorbidade não confere elegibilidade pelo MS.')
  return { elegivel: motivos.length > 0, motivos, avisos }
}

/** Diretriz australasiana 2025 — o que muda ou reforça em relação ao livro. */
export const AUSTRALASIA_ITENS: Referencia[] = [
  { rotulo: 'O₂ suplementar', texto: 'Se SpO₂ persistentemente < 90% em lactente ≥ 6 semanas; < 92% se < 6 semanas ou < 12 meses com condição de base; suspender com SpO₂ ≥ 92% (rec. 12b).', pagina: 'Australásia 2025, rec. 12' },
  { rotulo: 'Alto fluxo', texto: 'Não usar de rotina no leve/moderado sem hipoxemia nem como 1ª linha de O₂; considerar após falha do O₂ de baixo fluxo e, no grave, antes do CPAP (rec. 14).', pagina: 'rec. 14' },
  { rotulo: 'CPAP', texto: 'Considerar na insuficiência respiratória iminente ou grave (rec. 18).', pagina: 'rec. 18' },
  { rotulo: 'Não usar', texto: 'Beta-2 em < 12 meses e adrenalina (forte); salina hipertônica nebulizada de rotina (fraca); corticoide sistêmico ou local (forte), exceto considerar corticoide + adrenalina no grave em UTI (condicional); fisioterapia; antibiótico de rotina.', pagina: 'rec. 8–11, 15, 19' },
  { rotulo: 'Hidratação', texto: 'Enteral (sonda nasogástrica ou oral) preferida quando tolerada, inclusive em alto fluxo; SNG contínua em CPAP sem risco iminente de intubação; se EV, glicose 10% ou monitorar glicemia com 5%.', pagina: 'rec. 20' },
  { rotulo: 'Prevenção', texto: 'Anticorpo monoclonal (palivizumabe ou nirsevimabe) na sazonalidade em doença pulmonar crônica, cardiopatia congênita e < 32 semanas; considerar nirsevimabe universal; vacina materna no pré-natal (rec. 23–24).', pagina: 'rec. 23–24' },
]

/** CNAF: 1 a 2 L/kg/min (p. 303). */
export const CNAF_L_KG_MIN: [number, number] = [1, 2]

export function fluxoCnafLMin(pesoKg: number): [number, number] | null {
  return Number.isFinite(pesoKg) && pesoKg > 0 ? [CNAF_L_KG_MIN[0] * pesoKg, CNAF_L_KG_MIN[1] * pesoKg] : null
}

export type Achado = { id: string; texto: string }

/** Indicações de internação (p. 302–303). */
export const INDICACOES_INTERNACAO: Achado[] = [
  { id: 'toxemia', texto: 'Toxemia, letargia, baixa aceitação alimentar' },
  { id: 'desidratacao', texto: 'Desidratação' },
  { id: 'desconforto', texto: 'Desconforto respiratório: retração intercostal, supraclavicular ou batimento de asa de nariz; cianose' },
  { id: 'hipoxemia', texto: 'SpO₂ persistentemente abaixo de 90% (quedas episódicas são frequentes, mesmo nos leves)' },
  { id: 'social', texto: 'Impossibilidade de a criança ser observada pelos pais em casa' },
  { id: 'apneia', texto: 'Apneia' },
]

/** FR > 70 é, no livro, um dos achados de desconforto que indicam internação (p. 302). */
export const FR_INTERNACAO = 70
/** FR > 60: diminui a ingesta e pode exigir hidratação EV (preferir isotônicos) ou sonda (p. 303). */
export const FR_HIDRATACAO = 60

/** Fatores que pesam na decisão (p. 303). */
export const FATORES_RISCO: Achado[] = [
  { id: 'prematuro', texto: 'Prematuro (< 35 semanas)' },
  { id: 'menor12sem', texto: 'Menor de 12 semanas de vida' },
  { id: 'cronica', texto: 'Doença crônica: pulmonar, cardíaca com repercussão hemodinâmica ou imunodeficiência' },
]

/** Achados marcados que o livro lista como indicação de internação (inclui FR > 70). */
export function indicacoesPresentes(marcados: Set<string>, fr: number | null): string[] {
  const out = INDICACOES_INTERNACAO.filter((a) => marcados.has(a.id)).map((a) => a.texto)
  if (fr !== null && Number.isFinite(fr) && fr > FR_INTERNACAO) out.push(`FR > ${FR_INTERNACAO} (FR informada: ${fr})`)
  return out
}

/**
 * Palivizumabe (Portaria SAS-SCTIE/MS n. 23/2018, citada na p. 304): < 1 ano
 * nascido com IG ≤ 28 semanas; ou até 2 anos com doença pulmonar crônica da
 * prematuridade ou cardiopatia congênita com repercussão hemodinâmica. "Até 2
 * anos" é lido como até 24 meses completos (inclusive) — o livro não precisa
 * o limite; a tela diz isso.
 */
export function criteriosPalivizumabe(p: { idadeMeses: number; igSemanas: number | null; dpc: boolean; cardiopatia: boolean }): string[] {
  const out: string[] = []
  if (!Number.isFinite(p.idadeMeses) || p.idadeMeses < 0) return out
  if (p.idadeMeses < 12 && p.igSemanas !== null && p.igSemanas > 0 && p.igSemanas <= 28) out.push('Menos de 1 ano e IG ≤ 28 semanas')
  if (p.idadeMeses <= 24 && (p.dpc || p.cardiopatia)) out.push('Até 2 anos com doença pulmonar crônica da prematuridade ou cardiopatia congênita com repercussão hemodinâmica')
  return out
}

export const REFERENCIAS_BRONQUIOLITE: Referencia[] = [
  { rotulo: 'Definição', texto: 'Sibilância em criança < 2 anos com sinais de infecção viral e sem atopia; alguns autores limitam ao 1º episódio em < 1 ano. Pico de gravidade no 3º–4º dia.', pagina: 'p. 300–301' },
  { rotulo: 'Apneia', texto: 'Mais suscetíveis: lactentes de termo com menos de 1 mês e pré-termos com IG corrigida < 48 semanas.', pagina: 'p. 301' },
  { rotulo: 'Radiografia', texto: 'Não é rotina; associada a pneumonia: SpO₂ < 92%, alteração focal na ausculta e febre > 39 °C.', pagina: 'p. 302' },
  { rotulo: 'Oxigênio', texto: 'Pouco benefício com SpO₂ > 90% em hígidos com boa aceitação e desconforto leve; alvo acima de 90% (cânula, máscara, oxitenda ou CNAF). CPAP e CNAF são intercambiáveis.', pagina: 'p. 303' },
  { rotulo: 'Sem recomendação de rotina', texto: 'Broncodilatadores, epinefrina inalatória, corticoide (1ª sibilância por VRS sem doença pulmonar), fisioterapia respiratória; anti-histamínicos, descongestionantes e antitussígenos não devem ser usados. Salina hipertônica 3 ou 5%: prática heterogênea.', pagina: 'p. 303–304' },
  { rotulo: 'Palivizumabe — 2º ano de vida', texto: 'Considerar na sazonalidade: cardiopatia congênita ainda com repercussão e medicamentos específicos; doença pulmonar crônica da prematuridade com O₂ ou corticoide nos últimos 6 meses.', pagina: 'p. 304' },
]
