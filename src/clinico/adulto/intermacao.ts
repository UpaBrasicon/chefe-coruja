import type { Ficha, Fonte } from '../ficha.ts'

// Intermação (heat stroke) no adulto (lacunas da Central, lote 2, 24/10/2026). O
// manual do HC não tem capítulo; a fonte é a diretriz da Society of Critical Care
// Medicine de 2025, lida no texto completo da revista: Recomendações 1 e 2, Boas
// Práticas 1 a 5 e a declaração de pesquisa. A WMS 2024 não foi lida (acesso
// bloqueado) e fica de fora. O resfriamento e a meta são do médico (ADR 0007): a
// conta mostra a taxa alcançada e quanto falta para o alvo.

export const SCCM_INTERMACAO_2025: Fonte = {
  citacao: 'Barletta JF, Palmieri TL, Toomey SA, et al. Society of Critical Care Medicine Guidelines for the Treatment of Heat Stroke. Crit Care Med. 2025;53(2):e490–e500 (PMID 39982186): definição (> 40 °C com alteração do SNC); Recomendação 1 (resfriamento ativo, alvo < 39 °C) e 2 (contra dantroleno); Boas Práticas 1–5 (imersão em água gelada 1–5 °C ou fria 9–12 °C; alvo em até 30 min; taxa ≥ 0,155 °C/min; sem antitérmico).',
  url: 'https://doi.org/10.1097/CCM.0000000000006551',
}

export const fichaIntermacaoAdulto: Ficha = {
  id: 'adulto-intermacao',
  titulo: 'Intermação — resfriamento e meta (adulto)',
  versao: '2026-10-24.1',
  publico: 'adulto',
  fontes: [SCCM_INTERMACAO_2025],
  revisadoEm: '24/10/2026 (lacunas da Central, lote 2; recomendações conferidas no texto completo da SCCM 2025)',
}

/** Números da diretriz. */
export const INTERMACAO = {
  definicaoC: 40,
  alvoC: 39,
  minutosAteAlvo: 30,
  taxaMinimaCMin: 0.155,
}

export type Resfriamento = {
  /** °C por minuto entre a primeira e a última medida (positivo = esfriando) */
  taxaCMin: number
  noAlvo: boolean
  taxaSuficiente: boolean
  /** minutos que faltam para o alvo, mantida a taxa; null se não está esfriando */
  minutosAteAlvo: number | null
  /** taxa necessária para chegar ao alvo nos 30 min desde o início */
  taxaNecessariaCMin: number | null
}

const temp = (x: number) => Number.isFinite(x) && x >= 30 && x <= 46

/** Taxa de resfriamento entre duas medidas de temperatura central. */
export function avaliarResfriamento(inicialC: number, atualC: number, minutos: number): Resfriamento | null {
  if (!temp(inicialC) || !temp(atualC) || !Number.isFinite(minutos) || minutos <= 0) return null
  const taxa = (inicialC - atualC) / minutos
  const noAlvo = atualC < INTERMACAO.alvoC
  const restante = minutos < INTERMACAO.minutosAteAlvo ? INTERMACAO.minutosAteAlvo - minutos : null
  return {
    taxaCMin: taxa,
    noAlvo,
    taxaSuficiente: taxa >= INTERMACAO.taxaMinimaCMin,
    minutosAteAlvo: noAlvo ? 0 : taxa > 0 ? (atualC - INTERMACAO.alvoC) / taxa : null,
    taxaNecessariaCMin: noAlvo || restante === null ? null : (atualC - INTERMACAO.alvoC) / restante,
  }
}

/** Taxa necessária, a partir da temperatura inicial, para chegar abaixo de 39 °C em 30 min. */
export function taxaParaAlvo(inicialC: number): number | null {
  if (!temp(inicialC)) return null
  return Math.max(0, (inicialC - INTERMACAO.alvoC) / INTERMACAO.minutosAteAlvo)
}

/** Recomendações da SCCM 2025, como a diretriz traz. */
export const RECOMENDACOES_SCCM: { texto: string; grau: string }[] = [
  { texto: 'Intermação: temperatura central acima de 40 °C com alteração do sistema nervoso central.', grau: 'definição' },
  { texto: 'Resfriamento ativo em vez de passivo; a imersão em água fria ou gelada é a mais rápida e chega antes ao alvo (abaixo de 39 °C).', grau: 'Recomendação 1, forte' },
  { texto: 'Priorizar a imersão em água gelada (1–5 °C) ou fria (9–12 °C).', grau: 'Boa prática 1' },
  { texto: 'Mesma estratégia na intermação clássica e na de esforço.', grau: 'Boa prática 2' },
  { texto: 'Chegar ao alvo em até 30 minutos do reconhecimento dos sintomas.', grau: 'Boa prática 3' },
  { texto: 'Priorizar métodos com taxa de resfriamento de 0,155 °C/min ou mais; sem imersão, escolher o método ou a combinação mais rápida disponível.', grau: 'Boa prática 4' },
  { texto: 'Não usar dantroleno.', grau: 'Recomendação 2, forte' },
  { texto: 'Evitar paracetamol, AINE e salicilatos para baixar a temperatura.', grau: 'Boa prática 5' },
  { texto: 'Antibiótico ou anticonvulsivante profiláticos só em pesquisa.', grau: 'só em pesquisa' },
]
