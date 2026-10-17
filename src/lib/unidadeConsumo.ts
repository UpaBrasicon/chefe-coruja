// Unidade de consumo do medicamento (Fase 5B, etapa 3.1): a lista fixa que o
// banco aceita (public.medicamento.unidade_consumo) e os rótulos da tela.

export const UNIDADES_CONSUMO = [
  ['ampola', 'Ampola'], ['frasco_ampola', 'Frasco-ampola'], ['frasco', 'Frasco'], ['bolsa', 'Bolsa'],
  ['comprimido', 'Comprimido'], ['capsula', 'Cápsula'], ['dragea', 'Drágea'], ['sache', 'Sachê'], ['envelope', 'Envelope'],
  ['bisnaga', 'Bisnaga'], ['adesivo', 'Adesivo'], ['supositorio', 'Supositório'], ['seringa_preenchida', 'Seringa preenchida'],
  ['caneta', 'Caneta'], ['flaconete', 'Flaconete'], ['outra', 'Outra'],
] as const
export type UnidadeConsumo = (typeof UNIDADES_CONSUMO)[number][0]

export function rotuloUnidade(u: string | null | undefined, outra?: string | null): string {
  if (!u) return 'sem unidade'
  if (u === 'outra') return outra?.trim() || 'outra'
  return UNIDADES_CONSUMO.find(([k]) => k === u)?.[1] ?? u
}

export type MedicamentoUnidade = {
  id: string; principio_ativo: string; apresentacao: string | null; concentracao: string | null
  unidade_consumo: UnidadeConsumo | null; unidade_consumo_outra: string | null
  conferida_em: string | null; conferida_por: string | null
}
