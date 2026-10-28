// A fila no banco: as três funções da 5C-5.3a, chamadas com a chave de serviço.
// O serviço não lê tabela nenhuma.
import { createClient } from '@supabase/supabase-js'
import type { DocumentoCarregado, Fila, ItemLote, Registro } from './ciclo.ts'

export function filaSupabase(url: string, chaveServico: string): Fila {
  const db = createClient(url, chaveServico, { auth: { persistSession: false, autoRefreshToken: false } })
  return {
    async pegarLote(limite) {
      const { data, error } = await db.rpc('rnds_pegar_lote', { p_limite: limite })
      if (error) throw new Error(`rnds_pegar_lote: ${error.message}`)
      return (data ?? []) as ItemLote[]
    },
    async dados(item) {
      const { data, error } = await db.rpc('rnds_dados_documento', { p_item: item })
      // "retido: …" chega aqui como a mensagem do erro, sem prefixo
      if (error) throw new Error(error.message)
      return data as DocumentoCarregado
    },
    async registrar(item, r: Registro) {
      const { error } = await db.rpc('rnds_registrar_resultado', {
        p_item: item,
        p_resultado: r.resultado,
        p_id_rnds: r.idRnds ?? null,
        p_bundle: r.bundle ?? null,
        p_resposta: r.resposta ?? null,
        p_erro: r.erro ?? null,
      })
      if (error) throw new Error(`rnds_registrar_resultado: ${error.message}`)
    },
  }
}
