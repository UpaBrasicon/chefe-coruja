// Cadastro de medicamentos pela farmácia (telas do farmacêutico, ponto 4;
// decisões do RT de 27/10/2026). O item novo vale só na unidade de quem
// cadastrou (medicamento.unidades_locais); outra unidade o usa quando escolhe
// "Usar nesta unidade". A forma farmacêutica é a lista fixa que o banco aceita.
// Migration 20270106000001_cadastro_medicamentos.sql.

export const FORMAS_FARMACEUTICAS = [
  ['solucao_injetavel', 'Solução injetável'], ['po_para_solucao_injetavel', 'Pó para solução injetável'],
  ['suspensao_injetavel', 'Suspensão injetável'], ['emulsao_injetavel', 'Emulsão injetável'],
  ['comprimido', 'Comprimido'], ['comprimido_revestido', 'Comprimido revestido'], ['capsula', 'Cápsula'], ['dragea', 'Drágea'],
  ['solucao_oral', 'Solução oral'], ['solucao_oral_gotas', 'Solução oral em gotas'], ['suspensao_oral', 'Suspensão oral'],
  ['po_para_suspensao_oral', 'Pó para suspensão oral'], ['xarope', 'Xarope'], ['creme', 'Creme'], ['pomada', 'Pomada'], ['gel', 'Gel'],
  ['solucao_topica', 'Solução tópica'], ['colirio', 'Colírio'], ['adesivo_transdermico', 'Adesivo transdérmico'],
  ['supositorio', 'Supositório'], ['aerossol', 'Aerossol'], ['solucao_para_nebulizacao', 'Solução para nebulização'],
  ['spray_nasal', 'Spray nasal'], ['outra', 'Outra'],
] as const
export type FormaFarmaceutica = (typeof FORMAS_FARMACEUTICAS)[number][0]

export function rotuloForma(f: string | null | undefined, outra?: string | null): string {
  if (!f) return 'sem forma'
  if (f === 'outra') return outra?.trim() || 'outra'
  return FORMAS_FARMACEUTICAS.find(([k]) => k === f)?.[1] ?? f
}

/**
 * Filtro do PostgREST (`.or(...)`) para as buscas no cadastro: os itens da
 * rede e os que a unidade ativa usa. O banco barra gravar item de outra
 * unidade; o filtro só evita oferecê-lo.
 */
export function filtroDaUnidade(unidadeId: string | null | undefined): string {
  return unidadeId ? `unidades_locais.is.null,unidades_locais.cs.{${unidadeId}}` : 'unidades_locais.is.null'
}

/** Um item da lista de parecidos (medicamentos_parecidos). */
export type Parecido = {
  id: string; principio_ativo: string; apresentacao: string | null; concentracao: string | null
  forma_farmaceutica: string | null; forma_farmaceutica_outra: string | null
  unidade_consumo: string | null; unidade_consumo_outra: string | null
  na_unidade: boolean; da_rede: boolean; origem: string | null
}
