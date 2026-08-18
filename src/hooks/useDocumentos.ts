import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

/**
 * Persistência de documentos clínicos (documentos_clinicos) com versionamento.
 * Regra: retificação gera NOVA versão apontando para retificacao_de — nunca UPDATE/DELETE.
 * NGS1 / CFM 1.821/2007: preservar valor probatório.
 */

export type TipoDocumento =
  | 'admissao_anamnese'
  | 'evolucao'
  | 'prescricao'
  | 'sumario_alta'
  | 'sumario_obito'
  | 'atestado'
  | 'termo_consentimento'
  | 'boletim_emergencia'
  | 'partograma'

export type DocumentoClinico = {
  id: string
  documento_raiz_id: string
  versao: number
  paciente_id: string
  internacao_id: string | null
  tipo_documento: TipoDocumento
  conteudo: string
  conteudo_hash: string
  autor_id: string
  estado: 'rascunho' | 'ativo' | 'retificado' | 'assinado' | 'cancelado'
  retificacao_de: string | null
  motivo_retificacao: string | null
  assinado_em: string | null
  carimbo_tempo: string | null
  created_at: string
}

export type DocumentoInput = {
  paciente_id: string
  unidade_id: string
  internacao_id?: string | null
  tipo_documento: TipoDocumento
  conteudo: string
}

/**
 * Carrega os documentos de um paciente (por raiz, todas as versões).
 */
export function useDocumentos(pacienteId?: string) {
  return useQuery({
    queryKey: ['documentos-clinicos', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos_clinicos')
        .select('*')
        .eq('paciente_id', pacienteId!)
        .order('documento_raiz_id', { ascending: true })
        .order('versao', { ascending: true })
      if (error) throw error
      return (data ?? []) as DocumentoClinico[]
    },
  })
}

/**
 * Salva um documento: cria nova versão (retificação) se o conteúdo mudar.
 * A escrita exige internacao_id (o RLS só permite quem vê o episódio).
 */
export function useSalvarDocumento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: DocumentoInput) => {
      const { data, error } = await supabase.rpc('salvar_documento', {
        p_paciente: input.paciente_id,
        p_unidade: input.unidade_id,
        p_internacao: input.internacao_id ?? undefined,
        p_tipo: input.tipo_documento,
        p_conteudo: input.conteudo,
      })
      if (error) throw error
      return (data ?? '') as string
    },
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({ queryKey: ['documentos-clinicos', input.paciente_id] })
    },
  })
}

export function useCarimbarTempo() {
  return useMutation({
    mutationFn: async ({ id, assinado_em }: { id: string; assinado_em: string }) => {
      const { error } = await supabase
        .from('documentos_clinicos')
        .update({ assinado_em, carimbo_tempo: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
  })
}

export function useRegistrarAcessoProntuario() {
  return useMutation({
    mutationFn: async (input: {
      paciente_id: string
      unidade_id: string
      tipo_acesso?: string
      internacao_id?: string | null
    }) => {
      const { error } = await supabase.rpc('registrar_acesso_prontuario', {
        p_paciente: input.paciente_id,
        p_unidade: input.unidade_id,
        p_tipo_acesso: input.tipo_acesso ?? 'leitura_prontuario',
        p_internacao: input.internacao_id ?? undefined,
      })
      if (error) {
        // log de acesso nunca deve quebrar o fluxo assistencial
        console.error('Falha ao registrar acesso a prontuário:', error.message)
      }
    },
  })
}

export function useCriarInternacao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { paciente_id: string; unidade_id: string; setor_id?: string | null }) => {
      const { data, error } = await supabase.rpc('abrir_internacao', {
        p_paciente: input.paciente_id,
        p_unidade: input.unidade_id,
        p_setor: input.setor_id ?? undefined,
        p_leito: undefined,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['internacoes'] })
    },
  })
}

export function useRegistrarEventoAdt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      internacao_id: string
      tipo_evento: string
      setor_destino?: string | null
      leito_destino?: string | null
      motivo?: string | null
    }) => {
      const { error } = await supabase.rpc('registrar_evento_adt', {
        p_internacao: input.internacao_id,
        p_tipo_evento: input.tipo_evento,
        p_setor_destino: input.setor_destino ?? undefined,
        p_leito_destino: input.leito_destino ?? undefined,
        p_motivo: input.motivo ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['internacoes'] })
    },
  })
}

/** Consulta a internação ativa de um paciente (para vincular eventos/documentos). */
export function useInternacaoAtiva(pacienteId?: string) {
  return useQuery({
    queryKey: ['internacao-ativa', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internacoes')
        .select('*')
        .eq('paciente_id', pacienteId!)
        .in('status', ['admitido', 'em_observacao', 'internado'])
        .order('data_admissao', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as
        | {
            id: string
            status: string
            setor_atual_id: string | null
            leito_atual_id: string | null
            data_admissao: string
          }
        | null
    },
  })
}
