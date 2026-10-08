import { useQuery } from '@tanstack/react-query'
import { DoorOpen, Pill, TriangleAlert } from 'lucide-react'
import * as React from 'react'

import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { Chip, Chips, TituloPagina, TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import type { CorRisco } from '@/domain/risco'
import { taxa } from '@/lib/evasao'
import { gargalo, tempo, type EtapaChave, type Paciente, type Porta } from '@/lib/portaAgora'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// Dashboard PS/UPA do gestor (Fase 1, tarefa 2 do BACKLOG): a porta agora,
// por etapa, com a espera mais antiga de cada uma, quem passou do tempo-alvo
// da cor e a etapa gargalo. A lista traz nome, setor e leito/poltrona (decisão
// do RT, 07/10/2026) — o banco registra o acesso na auditoria (migration
// 20261029000001). Atualiza sozinha a cada 15 segundos.

const ETAPAS: { chave: EtapaChave; rotulo: string; desde: string }[] = [
  { chave: 'triagem', rotulo: 'Aguardando triagem', desde: 'desde a chegada' },
  { chave: 'aguardando_medico', rotulo: 'Aguardando médico', desde: 'desde a classificação' },
  { chave: 'em_atendimento', rotulo: 'Em atendimento', desde: 'desde o início' },
  { chave: 'medicacao_pendente', rotulo: 'Medicação pendente', desde: 'sem checagem' },
  { chave: 'observacao', rotulo: 'Em observação', desde: 'desde a entrada' },
  { chave: 'altas_hoje', rotulo: 'Altas hoje', desde: 'porta e observação' },
]
const ROTULO_ETAPA: Record<Paciente['etapa'], string> = {
  triagem: 'Aguardando triagem', aguardando_medico: 'Aguardando médico', em_atendimento: 'Em atendimento', observacao: 'Em observação',
}
const CORES: CorRisco[] = ['vermelho', 'laranja', 'amarelo', 'verde', 'azul']
const FILTROS = ['Todos', 'Atrasados', 'Medicação pendente'] as const

export default function PortaAgora() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const [filtro, setFiltro] = React.useState<(typeof FILTROS)[number]>('Todos')

  const { data, isLoading, error } = useQuery({
    queryKey: ['porta-agora', unidadeId],
    enabled: !!unidadeId,
    // 15 s: quem chega na recepção aparece logo (o teste do RT achou 1 min lento);
    // ao voltar para a aba, atualiza na hora
    refetchInterval: 15_000,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('porta_agora', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as Porta
    },
  })

  const g = data ? gargalo(data) : null
  const lista = (data?.pacientes ?? []).filter((p) =>
    filtro === 'Atrasados' ? p.fora_alvo : filtro === 'Medicação pendente' ? p.medicacao_pendente : true)
  const hora = data ? new Date(data.gerado_em).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="flex w-full flex-col gap-6">
      <TituloPagina
        icone={DoorOpen}
        titulo="Porta"
        descricao={`O pronto-socorro agora, da chegada à alta${hora ? ` · atualizado às ${hora}, a cada 15 segundos` : ''}.`}
      />

      {isLoading && <div className="flex h-32 items-center justify-center"><Spinner /></div>}
      {error && <p role="alert" className="text-apoio text-critico">Não foi possível carregar a porta agora: {(error as Error).message}</p>}

      {data && (
        <>
          {g && (
            <div role="status" className={cn('flex items-center gap-2 rounded-container border px-4 py-3 text-apoio',
              g.critico ? 'border-critico/30 bg-critico/[0.06] text-critico' : 'border-atencao/30 bg-atencao/[0.06] text-atencao')}>
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              <span>
                <strong className="font-semibold">Gargalo: {ETAPAS.find((x) => x.chave === g.chave)?.rotulo}</strong> — {g.motivo}.
              </span>
            </div>
          )}

          <section aria-label="Etapas da porta" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {ETAPAS.map((et) => {
              const v = data.etapas[et.chave]
              const destaque = g?.chave === et.chave
              return (
                <div key={et.chave} className={cn('flex flex-col gap-1 rounded-container border bg-superficie px-4 py-3',
                  destaque ? (g?.critico ? 'border-critico ring-1 ring-critico/40' : 'border-atencao ring-1 ring-atencao/40') : 'border-fio')}>
                  <span className="text-rotulo font-medium text-tinta-apoio">{et.rotulo}</span>
                  <span className="text-[28px] leading-none font-semibold tracking-[-0.03em] tabular text-tinta">{v.n}</span>
                  <span className="text-rotulo text-tinta-sussurro">
                    {v.espera_max_min != null ? `mais antiga: ${tempo(v.espera_max_min)}` : et.desde}
                  </span>
                  {et.chave === 'aguardando_medico' && (v.fora_alvo ?? 0) > 0 && (
                    <span className="text-rotulo font-medium text-critico">{v.fora_alvo} fora do alvo</span>
                  )}
                  {et.chave === 'observacao' && (v.acima_6h ?? 0) > 0 && (
                    <span className="text-rotulo font-medium text-critico">{v.acima_6h} acima de 6 h</span>
                  )}
                </div>
              )
            })}
          </section>

          {data.hoje && (
            <p className="text-apoio text-tinta-apoio">
              Hoje: <strong className="font-semibold text-tinta">{data.hoje.chegadas}</strong> chegadas ·{' '}
              <strong className={cn('font-semibold', data.hoje.evasoes > 0 ? 'text-critico' : 'text-tinta')}>{data.hoje.evasoes}</strong> evasões ({taxa(data.hoje.evasoes, data.hoje.chegadas)}) ·{' '}
              <strong className="font-semibold text-tinta">{data.hoje.alta_a_pedido}</strong> altas a pedido ({taxa(data.hoje.alta_a_pedido, data.hoje.chegadas)}).
              <span className="text-tinta-sussurro"> Detalhes em Indicadores.</span>
            </p>
          )}

          <section aria-label="Aguardando médico por cor" className="flex flex-col gap-2">
            <TituloSecao>Aguardando médico, por cor</TituloSecao>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {CORES.map((c) => {
                const v = data.aguardando_por_cor[c]
                return (
                  <div key={c} className="flex flex-col gap-1.5 rounded-container border border-fio bg-superficie px-3 py-2.5">
                    <PilulaRisco cor={c} className="self-start" />
                    <span className="text-[22px] leading-none font-semibold tabular text-tinta">{v.n}</span>
                    <span className={cn('text-rotulo', v.fora_alvo > 0 ? 'font-medium text-critico' : 'text-tinta-sussurro')}>
                      {v.fora_alvo > 0 ? `${v.fora_alvo} fora do alvo` : 'no prazo'} · alvo {v.alvo_min === 0 ? 'imediato' : `${v.alvo_min} min`}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          <section aria-label="Pacientes na porta" className="flex flex-col gap-2">
            <TituloSecao extra={<span className="text-rotulo text-tinta-sussurro">Acesso registrado na auditoria</span>}>Pacientes agora</TituloSecao>
            <Chips rotulo="Filtrar pacientes">
              {FILTROS.map((f) => (
                <Chip key={f} ativo={filtro === f} onClick={() => setFiltro(f)}
                  contagem={f === 'Todos' ? data.pacientes.length : f === 'Atrasados' ? data.pacientes.filter((p) => p.fora_alvo).length : data.pacientes.filter((p) => p.medicacao_pendente).length}>
                  {f}
                </Chip>
              ))}
            </Chips>
            {lista.length === 0 ? (
              <Vazio icone={DoorOpen} titulo={filtro === 'Todos' ? 'Ninguém na porta agora' : 'Nenhum paciente neste filtro'} />
            ) : (
              <div className="overflow-x-auto rounded-container border border-fio bg-superficie">
                <table className="w-full min-w-[720px] text-apoio">
                  <thead className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
                    <tr>
                      <th className="px-4 py-2 font-medium">Paciente</th>
                      <th className="px-3 py-2 font-medium">Etapa</th>
                      <th className="px-3 py-2 font-medium">Cor</th>
                      <th className="px-3 py-2 font-medium">Setor</th>
                      <th className="px-3 py-2 font-medium">Leito / poltrona</th>
                      <th className="px-3 py-2 text-right font-medium">Espera</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((p, i) => (
                      <tr key={i} className="border-b border-trilha last:border-0">
                        <td className="px-4 py-2 font-medium text-tinta">
                          {p.nome}
                          {p.medicacao_pendente && (
                            <span className="ml-2 inline-flex items-center gap-1 text-rotulo font-normal text-atencao">
                              <Pill className="size-3" aria-hidden /> medicação sem checagem
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-tinta-apoio">{ROTULO_ETAPA[p.etapa]}</td>
                        <td className="px-3 py-2"><PilulaRisco cor={p.cor} /></td>
                        <td className="px-3 py-2 text-tinta-apoio">{p.setor ?? '—'}</td>
                        <td className="px-3 py-2 text-tinta-apoio">{p.leito ?? '—'}</td>
                        <td className={cn('px-3 py-2 text-right tabular', p.fora_alvo ? 'font-semibold text-critico' : 'text-tinta')}>
                          {tempo(p.espera_min)}{p.fora_alvo && <span className="sr-only"> (fora do alvo)</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
