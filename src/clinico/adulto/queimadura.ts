import type { Ficha, Fonte } from '../ficha.ts'

// Queimadura no adulto — reposição do choque do queimado (lacunas da Central,
// lote 2, 24/10/2026). O manual do HC não tem capítulo; a fonte é a diretriz da
// American Burn Association de 2024, lida no PDF enviado pelo RT (páginas da
// revista). Ela vale para adulto com 20% ou mais de SCQ nas primeiras 48 h.
// O que a diretriz NÃO traz e por isso não entra: estimativa da SCQ (regra dos
// nove ou Lund-Browder), divisão do volume nas primeiras 8 h e meta de diurese
// como recomendação (0,5 mL/kg/h aparece só como o alvo usado nos estudos). A
// tela da criança (ICr) não é convertida para o adulto. Conduta do médico (ADR 0007).

export const ABA_2024: Fonte = {
  citacao: 'Cartotto R, Johnson LS, Savetamal A, et al. American Burn Association Clinical Practice Guidelines on Burn Shock Resuscitation. J Burn Care Res. 2024;45(3):565–589 (PMID 38051821): adultos com ≥ 20% de SCQ nas primeiras 48 h (p. 565–566); iniciar com 2 mL/kg/%SCQ (Questão 3, p. 580–581); albumina (resumo, p. 565; Questão 2, p. 580); monitorização seletiva da pressão intra-abdominal e intraocular, Ivy 250 mL/kg e 6 mL/kg/%SCQ em 24 h (Questão 10, p. 586).',
  url: 'https://doi.org/10.1093/jbcr/irad125',
}

export const fichaQueimaduraAdulto: Ficha = {
  id: 'adulto-queimadura',
  titulo: 'Queimadura — reposição inicial do choque (adulto)',
  versao: '2026-10-24.1',
  publico: 'adulto',
  fontes: [ABA_2024],
  revisadoEm: '24/10/2026 (lacunas da Central, lote 2; recomendações conferidas no PDF da ABA 2024, com página)',
}

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
