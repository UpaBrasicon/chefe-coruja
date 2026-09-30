// ─────────────────────────────────────────────────────────────────────────────
// Encaminhamento interno — dados e vocabulário (separado dos componentes para
// o fast refresh do Vite). Toda regra mora no banco
// (20261004000003_encaminhamento_interno_avaliacao.sql): pendências que
// impedem, um pendente por paciente, quem pode responder, motivo ≥ 10.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export type EstadoEncaminhamento = 'pendente' | 'aceito' | 'recusado' | 'atendido' | 'cancelado'

export type Encaminhamento = {
  id: string
  paciente_id: string
  episodio_id: string | null
  internacao_id: string | null
  especialidade: string
  medico_destino_id: string | null
  medico_destino: string | null
  servico: string | null
  justificativa: string
  estado: EstadoEncaminhamento
  encaminhado_por_id: string
  encaminhado_por: string | null
  encaminhado_em: string
  respondido_por: string | null
  respondido_em: string | null
  motivo_recusa: string | null
  atendido_em: string | null
  cancelado_por: string | null
  cancelado_em: string | null
  motivo_cancelamento: string | null
  sou_quem_encaminhou: boolean
  sou_quem_aceitou: boolean
  posso_responder: boolean
}

export type EncaminhamentoRecebido = Encaminhamento & { paciente: string; data_nascimento: string | null; sexo: string | null }

/** Lista do protótipo (ESPECIALIDADES): sugestão no campo, o texto é livre. */
export const ESPECIALIDADES = [
  'Anestesiologia', 'Angiologia', 'Cardiologia', 'Cirurgia cardiovascular', 'Cirurgia geral', 'Cirurgia pediátrica',
  'Cirurgia plástica', 'Cirurgia torácica', 'Cirurgia vascular', 'Clínica médica', 'Coloproctologia', 'Dermatologia',
  'Endocrinologia', 'Gastroenterologia', 'Geriatria', 'Ginecologia e obstetrícia', 'Hematologia', 'Infectologia',
  'Medicina intensiva', 'Nefrologia', 'Neurocirurgia', 'Neurologia', 'Nutrologia', 'Oftalmologia', 'Oncologia',
  'Ortopedia e traumatologia', 'Otorrinolaringologia', 'Pediatria', 'Pneumologia', 'Psiquiatria', 'Reumatologia',
  'Urologia', 'Cuidados paliativos', 'Fisioterapia', 'Fonoaudiologia', 'Nutrição', 'Psicologia', 'Serviço social',
]

/** Serviços do protótipo (SERV); a mesma lista está na CHECK do banco. */
export const SERVICOS = ['Consultório', 'Sala de emergência', 'Observação', 'Sala de procedimentos', 'Pediatria'] as const

export const ROTULO_ESTADO: Record<EstadoEncaminhamento, string> = {
  pendente: 'Aguardando aceite',
  aceito: 'Aceito',
  recusado: 'Recusado',
  atendido: 'Atendido',
  cancelado: 'Cancelado',
}

export const quando = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : ''
export const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export const chaveEncaminhamentos = (pacienteId: string) => ['encaminhamentos', pacienteId] as const
export const CHAVE_RECEBIDOS = ['encaminhamentos-recebidos'] as const

export function useEncaminhamentos(pacienteId: string) {
  return useQuery({
    queryKey: chaveEncaminhamentos(pacienteId),
    staleTime: 10_000,
    queryFn: async (): Promise<Encaminhamento[]> => {
      const { data, error } = await supabase.rpc('encaminhamentos_do_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return (data as unknown as Encaminhamento[]) ?? []
    },
  })
}

export function usePendenciasEncaminhar(pacienteId: string, episodioId?: string | null, internacaoId?: string | null) {
  return useQuery({
    queryKey: ['encaminhamento-pendencias', pacienteId, episodioId ?? null, internacaoId ?? null],
    staleTime: 10_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc('pendencias_para_encaminhar', {
        p_paciente: pacienteId, p_episodio: episodioId ?? undefined, p_internacao: internacaoId ?? undefined,
      })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useMedicosParaEncaminhar(pacienteId: string) {
  return useQuery({
    queryKey: ['encaminhamento-medicos', pacienteId],
    staleTime: 60_000,
    queryFn: async (): Promise<{ id: string; nome: string; registro: string | null }[]> => {
      const { data, error } = await supabase.rpc('medicos_para_encaminhar', { p_paciente: pacienteId })
      if (error) throw error
      return (data as unknown as { id: string; nome: string; registro: string | null }[]) ?? []
    },
  })
}

export function useEncaminhamentosRecebidos() {
  return useQuery({
    queryKey: CHAVE_RECEBIDOS,
    staleTime: 10_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<EncaminhamentoRecebido[]> => {
      const { data, error } = await supabase.rpc('encaminhamentos_recebidos')
      if (error) throw error
      return (data as unknown as EncaminhamentoRecebido[]) ?? []
    },
  })
}

/** Recarrega tudo o que o encaminhamento mexe (lista do paciente, recebidos, pendências). */
export function useRecarregarEncaminhamentos() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['encaminhamentos'] })
    void qc.invalidateQueries({ queryKey: CHAVE_RECEBIDOS })
    void qc.invalidateQueries({ queryKey: ['encaminhamento-pendencias'] })
  }
}
