// O que o caderno do leito já sabe, para preencher rascunhos (RG2 regulação,
// AL2 sumário de alta, MA3 laudo de AIH; revisão da Internação, RT 24/11/2026):
// última evolução médica estruturada e os vitais da enfermagem (contexto da
// evolução), diagnósticos vigentes, exames do paciente e a prescrição
// vigente. As mesmas chaves das abas, para usar o cache. Só leitura.
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useContextoEvolucao } from '@/components/evolucao/dados'
import type { Diag, EvolucaoCrua, ExameCru, ItemPrescrito, SvCru } from '@/lib/doProntuario'

import { useDiagnosticos } from './diagnosticos'

export type DadosDoProntuario = {
  pronto: boolean
  evolucao: EvolucaoCrua | null
  sv: SvCru | null
  exames: ExameCru[]
  prescricao: ItemPrescrito[]
  diagnosticos: Diag[]
}

export function useDoProntuario(pacienteId: string | null | undefined, internacaoId: string | null | undefined): DadosDoProntuario {
  const ctx = useContextoEvolucao(internacaoId ?? '')
  const diag = useDiagnosticos(internacaoId)
  const exames = useQuery({
    queryKey: ['exames-pedidos', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await supabase.from('exames_pedidos').select('id, exame, situacao, resultado, motivo_cancelamento, pedido_em, procedimento, urgencia, critico, resultado_visto_em')
        .eq('paciente_id', pacienteId!).order('pedido_em', { ascending: false }).limit(40)
      if (error) throw error
      return (data ?? []) as ExameCru[]
    },
  })
  const presc = useQuery({
    queryKey: ['prescricao-vigente', pacienteId],
    enabled: !!pacienteId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('prescricao_vigente', { p_paciente: pacienteId! })
      if (error) throw error
      return (data ?? []) as unknown as ItemPrescrito[]
    },
  })
  const u = ctx.data?.ultima_estruturada
  const sv = ctx.data?.sv_enfermagem
  const lido = (q: { isLoading: boolean; fetchStatus?: string }) => !q.isLoading
  return {
    // pronto quando cada leitura terminou (com dado ou erro): o rascunho não espera o que falhou
    pronto: !!internacaoId && lido(ctx) && lido(diag) && lido(exames) && lido(presc),
    evolucao: u ? { a: u.dados.a, p: u.dados.p, s: u.dados.s, criado_em: u.criado_em } : null,
    sv: sv ? { pa: sv.pa, fc: sv.fc, fr: sv.fr, temp: sv.temp, spo2: sv.spo2, glic: sv.glic, condicao: sv.condicao, aferido_em: sv.aferido_em } : null,
    exames: exames.data ?? [],
    prescricao: presc.data ?? [],
    diagnosticos: (diag.data ?? []) as Diag[],
  }
}
