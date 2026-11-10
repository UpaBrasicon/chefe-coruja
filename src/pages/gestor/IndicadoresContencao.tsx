import { useQuery } from '@tanstack/react-query'

import { TituloSecao } from '@/components/monitor/Pagina'
import { Spinner } from '@/components/ui/spinner'
import { percentual, type RelatorioContencoes } from '@/lib/contencao'
import { numero } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

// Indicadores de contenção mecânica do gestor (lacuna 4, K8; migration
// 20270325000001), os da Nota Técnica ANVISA GVIMS/GGTES/DIRE5 nº 07/2026:
// taxa de uso, tempo médio, revisões no prazo e eventos adversos. Contam as
// contenções iniciadas no período; sem nome de paciente.

export function IndicadoresContencao({ unidadeId, de, ate }: { unidadeId: string | undefined; de: string; ate: string }) {
  const rel = useQuery({
    queryKey: ['relatorio-contencoes', unidadeId, de, ate],
    enabled: !!unidadeId && !!de && !!ate,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('relatorio_contencoes', { p_unidade: unidadeId!, p_de: de, p_ate: ate })
      if (error) throw error
      return data as unknown as RelatorioContencoes
    },
  })
  const r = rel.data
  return (
    <section aria-label="Contenção mecânica" className="flex flex-col gap-2">
      <TituloSecao>Contenção mecânica</TituloSecao>
      {rel.isLoading ? <Spinner /> : rel.error ? (
        <p role="alert" className="text-apoio text-critico">{(rel.error as Error).message}</p>
      ) : !r || r.contencoes === 0 ? (
        <p className="text-apoio text-tinta-sussurro">Nenhuma contenção iniciada no período.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Indicador rotulo="Taxa de uso" valor={percentual(r.pacientes, r.pacientes_atendidos) ?? '—'}
              nota={`${r.pacientes} de ${r.pacientes_atendidos} pacientes atendidos ou internados`} />
            <Indicador rotulo="Tempo médio em contenção" valor={r.tempo_medio_h != null ? `${numero(r.tempo_medio_h, 1)} h` : '—'}
              nota={`${r.encerradas} encerrada(s)${r.em_curso ? `, ${r.em_curso} em curso` : ''}`} />
            <Indicador rotulo="Revisões no prazo (até 1 h)" valor={percentual(r.revisoes_no_prazo, r.revisoes_previstas) ?? '—'}
              nota={`${r.revisoes_no_prazo} de ${r.revisoes_previstas} previstas`} />
            <Indicador rotulo="Eventos adversos" valor={percentual(r.pacientes_com_evento, r.pacientes) ?? '—'}
              nota={`${r.eventos_adversos} intercorrência(s) ligada(s), ${r.pacientes_com_evento} paciente(s)`} />
          </div>
          <span className="text-rotulo text-tinta-sussurro">
            {r.contencoes} contenção(ões) em {r.pacientes} paciente(s){r.pediatricas ? `, ${r.pediatricas} pediátrica(s)` : ''}.
            {' '}Iniciadas antes da prescrição: {r.iniciadas_sem_prescricao}; nunca prescritas: {r.nunca_prescritas}.
            {r.por_setor.length > 0 && ` Por setor: ${r.por_setor.map((s) => `${s.setor} ${s.total}`).join(' · ')}.`}
          </span>
        </>
      )}
    </section>
  )
}

function Indicador({ rotulo, valor, nota }: { rotulo: string; valor: string; nota: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-cartao border border-fio bg-superficie px-4 py-3">
      <span className="text-apoio text-tinta-sussurro">{rotulo}</span>
      <span className="text-titulo font-semibold text-tinta">{valor}</span>
      <span className="text-rotulo text-tinta-sussurro">{nota}</span>
    </div>
  )
}
