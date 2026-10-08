import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import { argsFiltros, escreverFiltros, lerFiltros, type FiltrosBi } from '@/lib/filtrosBi'
import { supabase } from '@/lib/supabase'

// Estado da barra de filtros da tela Indicadores (Fase 1, tarefa 7): lê e grava
// no endereço da página; as opções (setores, médicos) vêm de opcoes_filtros_bi.

export type ContextoFiltros = {
  filtros: FiltrosBi
  faixa: { de: string; ate: string }
  args: ReturnType<typeof argsFiltros>['args']
  /** nomes para o cabeçalho do CSV */
  nomes: { setor?: string; medico?: string }
}

export function useFiltrosBI(unidadeId: string | undefined): ContextoFiltros & { definir: (p: Partial<FiltrosBi>) => void; limpar: () => void; opcoes: { setores: { id: string; nome: string }[]; medicos: { id: string; nome: string }[] } } {
  const [q, setQ] = useSearchParams()
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const filtros = lerFiltros(q, hoje)
  const { faixa, args } = argsFiltros(filtros, hoje)

  const opcoes = useQuery({
    queryKey: ['opcoes-filtros-bi', unidadeId, faixa.de, faixa.ate],
    enabled: !!unidadeId && faixa.de <= faixa.ate,
    placeholderData: (anterior) => anterior,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('opcoes_filtros_bi', { p_unidade: unidadeId!, p_de: faixa.de, p_ate: faixa.ate })
      if (error) throw error
      return data as unknown as { setores: { id: string; nome: string }[]; medicos: { id: string; nome: string }[] }
    },
  })
  const ops = opcoes.data ?? { setores: [], medicos: [] }

  return {
    filtros, faixa, args, opcoes: ops,
    nomes: { setor: ops.setores.find((s) => s.id === filtros.setor)?.nome, medico: ops.medicos.find((m) => m.id === filtros.medico)?.nome },
    definir: (p) => setQ(escreverFiltros({ ...filtros, ...p }), { replace: true }),
    limpar: () => setQ(new URLSearchParams(), { replace: true }),
  }
}

