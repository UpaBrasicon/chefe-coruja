import type { Ficha, Fonte } from '../ficha.ts'
import { LIVRO_ICR } from '../pediatria/fonteIcr.ts'
import { REGIOES_LB, type Regiao } from '../pediatria/queimadura.ts'

// Queimadura no adulto — reposição do choque do queimado (lacunas da Central,
// lote 2, 24/10/2026). O manual do HC não tem capítulo; a fonte é a diretriz da
// American Burn Association de 2024, lida no PDF enviado pelo RT (páginas da
// revista). Ela vale para adulto com 20% ou mais de SCQ nas primeiras 48 h.
// O que a diretriz NÃO traz e por isso não entra: divisão do volume nas primeiras
// 8 h e meta de diurese como recomendação (0,5 mL/kg/h aparece só como o alvo
// usado nos estudos). Conduta do médico (ADR 0007).
// SCQ (versão .2, pedido do RT em 24/10/2026): boneco de frente e costas com a
// coluna "Adulto" da Figura 1 (Lund e Browder) do livro do ICr, p. 160 — as
// mesmas superfícies da tela da criança. Os valores impressos (A, B e C = 3,5)
// somam 95%; o RT decidiu usá-los como impressos, com errata na tela. Nada da
// reposição da criança (Parkland do ICr) é usado no adulto.

export const ABA_2024: Fonte = {
  citacao: 'Cartotto R, Johnson LS, Savetamal A, et al. American Burn Association Clinical Practice Guidelines on Burn Shock Resuscitation. J Burn Care Res. 2024;45(3):565–589 (PMID 38051821): adultos com ≥ 20% de SCQ nas primeiras 48 h (p. 565–566); iniciar com 2 mL/kg/%SCQ (Questão 3, p. 580–581); albumina (resumo, p. 565; Questão 2, p. 580); monitorização seletiva da pressão intra-abdominal e intraocular, Ivy 250 mL/kg e 6 mL/kg/%SCQ em 24 h (Questão 10, p. 586).',
  url: 'https://doi.org/10.1093/jbcr/irad125',
}

export const LUND_BROWDER_ADULTO_ICR: Fonte = {
  citacao: `${LIVRO_ICR.citacao} Cap. 14, Figura 1 (esquema de Lund e Browder), p. 160: coluna "Adulto" (A = 3,5; B = 3,5; C = 3,5), com os valores fixos das superfícies.`,
}

export const fichaQueimaduraAdulto: Ficha = {
  id: 'adulto-queimadura',
  titulo: 'Queimadura — superfície queimada e reposição inicial (adulto)',
  versao: '2026-10-24.2',
  publico: 'adulto',
  fontes: [ABA_2024, LUND_BROWDER_ADULTO_ICR],
  revisadoEm: '24/10/2026 (lacunas da Central, lote 2; ABA 2024 conferida no PDF; coluna Adulto de Lund e Browder conferida na Figura 1 do ICr, com errata)',
}

/** Coluna "Adulto" da Figura 1 do ICr (p. 160), como impressa. */
export const COLUNA_ADULTO_LB = { a: 3.5, b: 3.5, c: 3.5 }

export function valorRegiaoAdulto(r: Regiao): number {
  if (typeof r.valor === 'number') return r.valor
  return r.valor === 'A' ? COLUNA_ADULTO_LB.a : r.valor === 'B' ? COLUNA_ADULTO_LB.b : COLUNA_ADULTO_LB.c
}

/** Soma de todas as superfícies na coluna do adulto (95% com os valores impressos). */
export function totalCorpoAdulto(): number {
  return REGIOES_LB.reduce((s, r) => s + valorRegiaoAdulto(r), 0)
}

/** SCQ (%) = Σ valor da superfície × fração queimada (0 a 1); só queimaduras de 2º e 3º graus. */
export function superficieQueimadaAdulto(fracoes: Record<string, number>): number | null {
  let soma = 0
  for (const [id, f] of Object.entries(fracoes)) {
    const r = REGIOES_LB.find((x) => x.id === id)
    if (!r || !Number.isFinite(f) || f < 0 || f > 1) return null
    soma += valorRegiaoAdulto(r) * f
  }
  return soma
}

export const ERRATA_LUND_BROWDER_ADULTO: string[] = [
  'Figura 1 (p. 160), coluna Adulto: com A, B e C = 3,5, o corpo soma 95%, enquanto as colunas de 0, 1 e 5 anos somam 100%. A diferença está na coxa (B, quatro superfícies). Os valores impressos são usados por decisão do RT; a SCQ das coxas pode ficar subestimada.',
  'Mãos: a mesma Figura traz "1" numa das mãos e "1¼" nas outras três faces; a ferramenta usa 1¼ nas quatro, como na tela da criança.',
]

export const QUEIMADURA = {
  /** a diretriz vale a partir de 20% de SCQ */
  scqMinima: 20,
  inicioMlKgScq: 2,
  /** Parkland, citado na diretriz como o valor esperado de 4 mL/kg/%SCQ (p. 580) */
  parklandMlKgScq: 4,
  /** "runaway resuscitation": 6 mL/kg/%SCQ em 24 h (p. 586) */
  alertaMlKgScq24h: 6,
  /** índice de Ivy: 250 mL/kg em 24 h (p. 586) */
  ivyMlKg24h: 250,
}

export type Reposicao = {
  aplica: boolean
  /** volume inicial previsto para 24 h a 2 mL/kg/%SCQ */
  volume24hMl: number
  /** para comparação, 4 mL/kg/%SCQ (Parkland) */
  parkland24hMl: number
  /** volume em 24 h a partir do qual a diretriz pede vigilância (o menor dos dois limites) */
  limiteVigilanciaMl: number
  limiteVigilancia: 'Ivy (250 mL/kg)' | '6 mL/kg/%SCQ'
}

/** Volume inicial pela ABA 2024, com os limites de vigilância. */
export function reposicaoQueimado(pesoKg: number, scq: number): Reposicao | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0 || !Number.isFinite(scq) || scq <= 0 || scq > 100) return null
  const q = QUEIMADURA
  const ivy = q.ivyMlKg24h * pesoKg
  const runaway = q.alertaMlKgScq24h * pesoKg * scq
  return {
    aplica: scq >= q.scqMinima,
    volume24hMl: q.inicioMlKgScq * pesoKg * scq,
    parkland24hMl: q.parklandMlKgScq * pesoKg * scq,
    limiteVigilanciaMl: Math.min(ivy, runaway),
    limiteVigilancia: ivy <= runaway ? 'Ivy (250 mL/kg)' : '6 mL/kg/%SCQ',
  }
}

/** Recomendações e pontos da ABA 2024. */
export const RECOMENDACOES_ABA: { texto: string; pagina: string }[] = [
  { texto: 'Considerar iniciar a reposição com 2 mL/kg/%SCQ para reduzir o volume total. A fórmula indica só a taxa inicial; a titulação pela resposta do paciente deve seguir.', pagina: 'Questão 3, p. 581' },
  { texto: 'Nos estudos que embasaram a recomendação, a infusão foi titulada para diurese de 0,5 mL/kg/h; a diretriz não fixa a meta como recomendação.', pagina: 'p. 580' },
  { texto: 'Considerar albumina humana, sobretudo nas queimaduras maiores, para reduzir o volume e melhorar a diurese. Iniciar a albumina nas primeiras 12 h, de preferência só em pesquisa.', pagina: 'p. 565; Questão 2, p. 580' },
  { texto: 'Monitorar a pressão intra-abdominal e a intraocular de forma seletiva: queimadura maciça, volume de 24 h real ou previsto perto de 6 mL/kg/%SCQ ou 250 mL/kg, sinais de síndrome compartimental; na intraocular, também queimadura periorbital profunda e extensa ou proptose.', pagina: 'Questão 10, p. 586' },
  { texto: 'Sem recomendação sobre vitamina C em dose alta, plasma fresco, hemodiálise contínua precoce ou vasopressor como adjuvantes; não usar variáveis de termodiluição transpulmonar para guiar a reposição.', pagina: 'p. 565' },
]
