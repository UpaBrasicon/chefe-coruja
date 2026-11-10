// Óbitos da unidade com algo por fazer (lacuna 5, O7): comunicação à família
// ou à polícia, conferência e liberação do corpo, vias da D.O. A lista vem do
// servidor (obitos_pendentes); cada linha abre o óbito com as ações.
import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { dataHora } from '@/lib/formato'
import { ROTULO_TIPO_MORTE, type ObitoRegistro } from '@/lib/obito'
import { supabase } from '@/lib/supabase'

import { PainelObito, SelosObito } from './PainelObito'

export function ObitosPendentes({ unidadeId }: { unidadeId: string | undefined }) {
  const [aberto, setAberto] = React.useState<string | null>(null)
  const { data, error } = useQuery({
    queryKey: ['obitos-pendentes', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('obitos_pendentes', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as unknown as ObitoRegistro[]
    },
  })
  if (error) return null
  const lista = data ?? []
  if (lista.length === 0) return null
  return (
    <section aria-label="Óbitos com pendência" className="flex flex-col gap-2 rounded-cartao border border-atencao/30 bg-alerta-atencao px-4 py-3.5">
      <span className="text-controle font-semibold text-tinta">Óbitos com pendência</span>
      {lista.map((o) => (
        <div key={o.id} className="flex flex-col gap-2 border-t border-fio pt-2 first:border-0 first:pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-apoio font-medium text-tinta">{o.paciente}</span>
            <span className="text-apoio text-tinta-apoio">
              {[dataHora(o.hora_obito), o.setor, o.leito_aguardando && o.leito ? `leito ${o.leito} aguardando liberação do corpo` : null, ROTULO_TIPO_MORTE[o.tipo_morte]]
                .filter(Boolean).join(' · ')}
            </span>
            <SelosObito pendencias={o.pendencias} />
            <Button size="xs" variant="ghost" onClick={() => setAberto(aberto === o.id ? null : o.id)}>{aberto === o.id ? 'Fechar' : 'Abrir'}</Button>
          </div>
          {aberto === o.id && <PainelObito pacienteId={o.paciente_id} />}
        </div>
      ))}
    </section>
  )
}
