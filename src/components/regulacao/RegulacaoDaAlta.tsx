// Regulação na alta por transferência (S4, decisão do RT em 07/11/2026;
// migration 20270307000006). Usada na porta, no encerramento da observação e
// na alta da internação: se o paciente tem regulação em curso que o leva para
// outra unidade, a tela a oferece; escolhida, o destino vem dela e a alta grava
// o id. "Sem regulação" volta ao destino escrito. Com uma só regulação, ela já
// vem escolhida.
import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { regulacoesDaAlta, rotuloRegulacaoAlta, type RegulacaoDoHistorico } from '@/lib/regulacaoAlta'
import { Chip } from '@/components/monitor/Pagina'

function useRegulacoesDaAlta(pacienteId: string) {
  return useQuery({
    queryKey: ['regulacao-historico', pacienteId],
    enabled: !!pacienteId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_historico_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as RegulacaoDoHistorico[]
    },
    select: (itens) => regulacoesDaAlta(itens),
  })
}

/**
 * `valor`: a regulação escolhida (null = sem regulação; undefined = ainda não
 * decidido). Sem regulação em curso (ou sem acesso ao histórico), não mostra nada.
 */
export function RegulacaoDaAlta({ pacienteId, valor, aoEscolher }: {
  pacienteId: string
  valor: RegulacaoDoHistorico | null | undefined
  aoEscolher: (r: RegulacaoDoHistorico | null) => void
}) {
  const lista = useRegulacoesDaAlta(pacienteId)
  const regs = lista.data ?? []
  const unica = regs.length === 1 ? regs[0] : null
  React.useEffect(() => {
    if (valor === undefined && unica) aoEscolher(unica)
  }, [valor, unica, aoEscolher])
  if (regs.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-apoio font-medium text-tinta-apoio">Regulação desta transferência</span>
      <div role="radiogroup" aria-label="Regulação desta transferência" className="flex flex-wrap gap-2">
        {regs.map((r) => (
          <Chip key={r.id} radio ativo={valor?.id === r.id} onClick={() => aoEscolher(r)}>{rotuloRegulacaoAlta(r)}</Chip>
        ))}
        <Chip radio ativo={valor === null} onClick={() => aoEscolher(null)}>Sem regulação</Chip>
      </div>
      <span className="text-rotulo text-tinta-sussurro">
        {valor ? 'O destino vem da regulação; a alta registra a saída do paciente.' : 'Sem regulação: escreva o serviço de destino.'}
      </span>
    </div>
  )
}
