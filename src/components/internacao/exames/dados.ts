// Leituras da aba Exames do leito (modelo do RT, 25/11/2026): os pedidos desta
// internação (exames_pedidos) e as versões vigentes dos resultados
// (resultados_da_internacao: arquivos, "alterado" e analitos). As três vistas
// leem daqui; depois de qualquer gravação, `recarregar` atualiza as duas e as
// listas que dependem delas (impeditivos da alta, resumo do leito).
import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { GrupoExame } from '@/lib/exames'
import type { ResultadoLido } from '@/lib/examesAba'
import { supabase } from '@/lib/supabase'

export type PedidoLeito = {
  id: string; exame: string; procedimento: string | null; grupo: GrupoExame | null; tipo: string | null; situacao: string; urgencia: string
  observacao: string | null; indicacao: string | null; cid: string | null; pedido_em: string; critico: boolean; resultado_visto_em: string | null
  resultado: string | null; motivo_cancelamento: string | null
}

const COLUNAS = 'id, exame, procedimento, grupo, tipo, situacao, urgencia, observacao, indicacao, cid, pedido_em, critico, resultado_visto_em, resultado, motivo_cancelamento'

export function useExamesDaInternacao(internacaoId: string) {
  const qc = useQueryClient()
  const pedidos = useQuery({
    queryKey: ['exames-da-internacao', internacaoId],
    queryFn: async () => {
      const { data, error } = await supabase.from('exames_pedidos').select(COLUNAS).eq('internacao_id', internacaoId).order('pedido_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as PedidoLeito[]
    },
  })
  const resultados = useQuery({
    queryKey: ['resultados-da-internacao', internacaoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('resultados_da_internacao', { p_internacao: internacaoId })
      if (error) throw error
      return (data ?? []) as unknown as ResultadoLido[]
    },
  })
  const recarregar = () => {
    for (const k of ['exames-da-internacao', 'resultados-da-internacao', 'exames-pedidos', 'impeditivos', 'exame-detalhe', 'laudo-grupo']) {
      void qc.invalidateQueries({ queryKey: [k] })
    }
  }
  return { pedidos, resultados, recarregar }
}

/**
 * Quem lança valores na planilha (decisão do RT de 25/11/2026, B-09): o médico
 * com o paciente no plantão e o NIR de plantão na unidade. A resposta é do
 * servidor (posso_lancar_planilha); enquanto não chega, ou se falhar, o botão
 * não aparece.
 */
export function usePodeLancarPlanilha(internacaoId: string): boolean {
  const q = useQuery({
    queryKey: ['posso-lancar-planilha', internacaoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('posso_lancar_planilha', { p_internacao: internacaoId })
      if (error) throw error
      return data === true
    },
  })
  return q.data === true
}

export const PENDENTES = ['pedido', 'coletado', 'em_analise', 'realizado']
export const pendente = (p: { situacao: string }) => PENDENTES.includes(p.situacao)
