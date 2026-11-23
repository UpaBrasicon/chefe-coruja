// Demanda espontânea na agenda do dia (refinamento da UBS, RF2 = A do RT em
// 23/11/2026): quem veio sem marcar aparece na Agenda de consultas de hoje, numa
// faixa própria, sem ocupar horário da grade, na ordem da fila do consultório
// (vermelho e amarelo primeiro; depois pela prioridade legal e pela chegada). Os dados vêm da agenda_dia de hoje.
import { Footprints } from 'lucide-react'

import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { Vazio } from '@/components/monitor/Pagina'
import { ordemFilaUbs } from '@/domain/aps'
import { rotuloIdade } from '@/domain/idade'
import type { CorRisco } from '@/domain/risco'
import { useAgendaDia } from '@/hooks/useAgenda'
import { hora } from '@/lib/formato'

export function DemandaEspontaneaDoDia({ unidadeId, hoje }: { unidadeId: string; hoje: string }) {
  const agenda = useAgendaDia(unidadeId, hoje)
  const lista = [...(agenda.data?.demanda_espontanea ?? [])].sort(ordemFilaUbs)
  if (!agenda.data) return null
  return (
    <section aria-label="Demanda espontânea de hoje" className="overflow-hidden rounded-cartao border border-fio bg-superficie">
      <div className="flex flex-wrap items-baseline gap-x-2.5 border-b border-trilha bg-campo px-4 py-2.5">
        <span className="text-controle font-semibold text-tinta">Demanda espontânea</span>
        <span className="text-controle font-medium tabular-nums text-tinta-sussurro">{lista.length}</span>
        <span className="ml-auto text-apoio text-tinta-sussurro">sem horário marcado · na ordem da fila</span>
      </div>
      {lista.length === 0 ? (
        <div className="p-4"><Vazio icone={Footprints} titulo="Ninguém sem marcar" texto="Quem chegar sem consulta marcada aparece aqui." /></div>
      ) : (
        <ul aria-label="Demanda espontânea">
          {lista.map((d) => (
            <li key={d.episodio_id} className="flex flex-wrap items-center gap-3 border-b border-trilha px-4 py-2.5 last:border-0">
              {d.cor_atual ? <PilulaRisco cor={d.cor_atual as CorRisco} /> : null}
              <span className="min-w-0 flex-1 text-apoio text-tinta">
                <strong className="font-semibold">{d.nome_social || d.nome}</strong>
                {d.data_nascimento && <span className="text-tinta-sussurro"> · {rotuloIdade(d.data_nascimento, hoje)}</span>}
                <span className="block text-rotulo text-tinta-sussurro">chegou às {hora(d.chegada_em)}</span>
              </span>
              <span className="text-apoio text-tinta-apoio">
                {d.em_atendimento ? 'Em atendimento' : d.etapa === 'triagem' ? 'Aguarda a escuta' : 'Aguarda a consulta'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
