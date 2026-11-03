// Envios à UPA do paciente (5A, tarefa 5, H3): na janela da consulta da UBS,
// o que já foi enviado e se o paciente chegou.
import { useQuery } from '@tanstack/react-query'
import { Ambulance } from 'lucide-react'

import { Estado } from '@/components/porta/Estado'
import { SITUACAO_ENVIO, type EnvioUpa } from '@/domain/encaminhamento'
import { diaMesHora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

export function EnviosDoPaciente({ pacienteId }: { pacienteId: string }) {
  const lista = useQuery({
    queryKey: ['encaminhamentos-upa', 'paciente', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('encaminhamentos_upa_do_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as EnvioUpa[]
    },
  })
  const envios = lista.data ?? []
  if (envios.length === 0) return null
  return (
    <section aria-label="Envios à UPA" className="flex flex-col gap-1.5">
      <h3 className="rotulo flex items-center gap-1.5 text-tinta-sussurro"><Ambulance className="size-3.5" aria-hidden /> Envios à UPA</h3>
      <ul className="flex flex-col gap-1">
        {envios.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-2 text-apoio text-tinta-apoio">
            <Estado tom={SITUACAO_ENVIO[e.situacao].tom}>{SITUACAO_ENVIO[e.situacao].rotulo}</Estado>
            <span>{e.unidade_destino} · {e.motivo}</span>
            <span className="text-rotulo text-tinta-sussurro">{diaMesHora(e.enviado_em)}{e.observacao_chegada ? ` · ${e.observacao_chegada}` : ''}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
