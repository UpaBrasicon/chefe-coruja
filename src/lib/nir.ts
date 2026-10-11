// NIR — Núcleo Interno de Regulação (Fase 4, tarefa 11): tipos e filtros do
// painel de pendências. Migration 20261117000002_nir.sql.

export type GrupoNir = 'aih' | 'apac' | 'regulacao'
export const GRUPOS_NIR: Record<GrupoNir, string> = { aih: 'AIH', apac: 'APAC', regulacao: 'Regulação' }

export type PendenciaNir = {
  tipo: string; grupo: GrupoNir; ref_id: string; titulo: string; desde: string; parado_seg: number
  paciente: string | null; responsavel: string | null; responsaveis: string[]; pode_cobrar: boolean
  ultima_cobranca: { em: string; por: string | null; vezes: number } | null
}

/** Pendências do assunto escolhido, mais antigas primeiro. */
export function filtrarPendencias(itens: PendenciaNir[], grupo: GrupoNir | 'todos'): PendenciaNir[] {
  return itens
    .filter((p) => grupo === 'todos' || p.grupo === grupo)
    .slice()
    .sort((a, b) => b.parado_seg - a.parado_seg)
}

/** Categoria dos Avisos para as cobranças do NIR (o tipo do aviso diz o assunto). */
export function categoriaCobranca(tipo: string): 'AIH' | 'APAC' | null {
  if (tipo.startsWith('nir_aih_')) return 'AIH'
  if (tipo.startsWith('nir_apac_')) return 'APAC'
  return null
}
