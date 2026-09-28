import { fichaP4, type Referencia } from './fonteP4.ts'

// Bronquiolite — livro do ICr, cap. 29 (p. 300–306). O capítulo não traz
// escore de gravidade nem dose de medicamento (broncodilatador, epinefrina e
// corticoide não são recomendados de rotina). O que é numérico: fluxo da cânula
// nasal de alto fluxo (1 a 2 L/kg/min), critérios de internação e de
// palivizumabe. A ferramenta lista o que o livro diz; a decisão é do médico.

export const fichaBronquiolite = fichaP4('ped-bronquiolite', 'Bronquiolite — internação, CNAF e palivizumabe', 'cap. 29, p. 300–306')

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
