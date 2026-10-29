// A fila e o cofre no banco: as funções da 5C-5.3a e da 5.4, chamadas com a
// chave de serviço. O serviço não lê tabela nenhuma.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { DocumentoCarregado, Fila, ItemLote, Registro } from './ciclo.ts'
import type { BancoDoCofre, CertificadoNoBanco } from './cofre.ts'

export function clienteSupabase(url: string, chaveServico: string): SupabaseClient {
  return createClient(url, chaveServico, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function filaSupabase(db: SupabaseClient): Fila {
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

export function cofreSupabase(db: SupabaseClient): BancoDoCofre {
  const chamar = async (funcao: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(funcao, args)
    if (error) throw new Error(`${funcao}: ${error.message}`)
    return data
  }
  return {
    async registrarChave(id, jwk) {
      await chamar('rnds_registrar_chave_publica', { p_id: id, p_jwk: jwk })
    },
    async certificadoDaUnidade(unidade) {
      return ((await chamar('rnds_certificado_da_unidade', { p_unidade: unidade })) ?? null) as CertificadoNoBanco | null
    },
    async aguardando(limite) {
      return ((await chamar('rnds_certificados_aguardando', { p_limite: limite })) ?? []) as CertificadoNoBanco[]
    },
    async registrarCertificado(credencial, l) {
      await chamar('rnds_registrar_certificado', {
        p_credencial: credencial,
        p_situacao: l.situacao,
        p_titular: l.titular ?? null,
        p_documento: l.documento ?? null,
        p_valido_ate: l.validoAte ? l.validoAte.toISOString() : null,
        p_impressao: l.impressao ?? null,
        p_erro: l.erro ?? null,
      })
    },
  }
}
