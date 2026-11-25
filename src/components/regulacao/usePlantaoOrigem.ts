// Plantão da origem na regulação (decisão do RT de 25/11/2026, achado B-07 do
// teste de fluxo B): "a tela avisa antes e desliga o botão", como na cesta de
// exames. A regra é do servidor: fora do plantão, o médico e o NIR da origem
// não agem no pedido (migration 20270426000020). A tela pergunta por
// regulacao_por_que_nao_ajo (nulo = pode agir; senão, a frase do motivo) e
// mostra a frase como veio. O gestor da unidade nunca é barrado e o regulador
// da central não passa por aqui: sem o contexto, nada é desligado.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { primeiraRecusaDePlantao } from '@/lib/regulacaoPlantao'
import { supabase } from '@/lib/supabase'

const CHAVE = 'regulacao-plantao-origem'

/** O motivo que vale para as peças de dentro (nulo = pode agir). Quem põe é PlantaoOrigem. */
export const ContextoPlantaoOrigem = React.createContext<string | null>(null)

/**
 * Pergunta ao servidor por que a pessoa não age na regulação desta unidade
 * (com o paciente do pedido, quando houver). Nulo = pode agir ou ainda não sabe;
 * quem decide de verdade é a RPC da ação.
 */
export function useMotivoPlantaoOrigem(unidadeId: string | null | undefined, pacienteId?: string | null, ligado = true): string | null {
  const q = useQuery({
    queryKey: [CHAVE, unidadeId ?? '', pacienteId ?? null],
    enabled: ligado && !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_por_que_nao_ajo', { p_unidade: unidadeId!, p_paciente: pacienteId ?? undefined })
      if (error) throw error
      return data ?? null
    },
  })
  return ligado ? q.data ?? null : null
}

/**
 * Para a peça que tem o botão: `motivo` desliga o botão (vem de PlantaoOrigem);
 * `recusa` é a frase do servidor quando ele recusou a ação por plantão (entre
 * os erros passados), para mostrar como aviso no lugar do erro.
 */
export function usePlantaoOrigem(...erros: unknown[]): { motivo: string | null; recusa: string | null } {
  const motivo = React.useContext(ContextoPlantaoOrigem)
  const recusa = primeiraRecusaDePlantao(...erros)
  const qc = useQueryClient()
  // o servidor recusou: a pergunta de antes está velha (check-out feito, troca de setor)
  React.useEffect(() => {
    if (recusa) void qc.invalidateQueries({ queryKey: [CHAVE] })
  }, [recusa, qc])
  return { motivo, recusa }
}
