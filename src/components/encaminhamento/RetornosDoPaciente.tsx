// Retornos do paciente (5A, tarefa 6, I4): na janela da consulta da UBS, as
// altas, evasões, transferências e óbitos na UPA ou no hospital da rede. O
// resumo abre na tela Encaminhados, aba Retornos (com registro de acesso).
import { useQuery } from '@tanstack/react-query'
import { CornerDownLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Estado } from '@/components/porta/Estado'
import { DESFECHO_RETORNO, SITUACAO_RETORNO, type Retorno } from '@/domain/encaminhamento'
import { diaMesHora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

export function RetornosDoPaciente({ pacienteId }: { pacienteId: string }) {
  const lista = useQuery({
    queryKey: ['contrarreferencias', 'paciente', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('contrarreferencias_do_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as Retorno[]
    },
  })
  const retornos = lista.data ?? []
  if (retornos.length === 0) return null
  return (
    <section aria-label="Retornos da UPA ou do hospital" className="flex flex-col gap-1.5">
      <h3 className="rotulo flex items-center gap-1.5 text-tinta-sussurro"><CornerDownLeft className="size-3.5" aria-hidden /> Retornos da UPA ou do hospital</h3>
      <ul className="flex flex-col gap-1">
        {retornos.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 text-apoio text-tinta-apoio">
            <Estado tom={SITUACAO_RETORNO[r.situacao].tom}>{SITUACAO_RETORNO[r.situacao].rotulo}</Estado>
            <span>{DESFECHO_RETORNO[r.desfecho] ?? r.desfecho} na {r.unidade_origem}</span>
            <span className="text-rotulo text-tinta-sussurro">{diaMesHora(r.saida_em)}{r.tem_orientacao ? ' · com orientação à UBS' : ''}</span>
            <Link to="/encaminhados?aba=retornos" className="text-rotulo font-medium text-acao hover:underline">Ver em Retornos</Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
