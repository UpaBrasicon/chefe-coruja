import { useQuery } from '@tanstack/react-query'
import { DoorOpen, Pill, TriangleAlert } from 'lucide-react'
import * as React from 'react'

import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { Chip, Chips, TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { TabsPagina } from '@/components/TabsPagina'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useUnidade } from '@/contexts/UnidadeContext'
import type { CorRisco } from '@/domain/risco'
import { taxa } from '@/lib/evasao'
import { hora as fmtHora } from '@/lib/formato'
import { gargalo, tempo, type EtapaChave, type Paciente, type Porta } from '@/lib/portaAgora'
import { agruparPorEtapa, faixaDaFila } from '@/lib/portaFila'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import { GradeAcoes } from './GradeAcoes'

// Dashboard PS/UPA do gestor (Fase 1, tarefa 2 do BACKLOG): a porta agora,
// por etapa, com a espera mais antiga de cada uma, quem passou do tempo-alvo
// da cor e a etapa gargalo. A lista traz nome, setor e leito/poltrona (decisão
// do RT, 07/10/2026) — o banco registra o acesso na auditoria (migration
// 20261029000001). Atualiza sozinha a cada 15 segundos. Desde 27/10/2026 a
// página tem duas abas: "Agora" (esta) e a "Grade de ações" (GradeAcoes).

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

// Revisão do gestor (RT, 24/11/2026): M1 a fila numa faixa só, da triagem à
// observação, com a contagem de cada etapa; M2 a lista agrupada pela mesma
// etapa, com a cor discreta (ponto e nome; a cor é da enfermagem, só exibida).
const TOM_ETAPA: Record<Paciente['etapa'], string> = {
  triagem: 'bg-tinta-sussurro', aguardando_medico: 'bg-acao', em_atendimento: 'bg-suprimento', observacao: 'bg-observacao',
}
const PONTO_COR: Record<CorRisco, string> = {
  vermelho: 'bg-mts-vermelho', laranja: 'bg-mts-laranja', amarelo: 'bg-mts-amarelo', verde: 'bg-mts-verde', azul: 'bg-mts-azul',
}
function CorDiscreta({ cor }: { cor: CorRisco | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-tinta-apoio">
      <span className={cn('size-2.5 rounded-capsula', cor ? PONTO_COR[cor] : 'bg-campo ring-1 ring-fio')} aria-hidden />
      {cor ? cor : 'sem classificação'}
    </span>
  )
}

function FaixaFila({ data, gargaloChave, critico }: { data: Porta; gargaloChave: EtapaChave | null; critico: boolean }) {
  const faixa = faixaDaFila(data)
  const total = faixa.reduce((a, s) => a + s.n, 0)
  return (
    <section aria-label="Fila por etapa" className="flex flex-col gap-3 rounded-container border border-fio bg-superficie px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-apoio font-semibold text-tinta">Fila agora</span>
        <span className="text-apoio text-tinta-sussurro">
          {total} {total === 1 ? 'paciente' : 'pacientes'} na porta · {data.etapas.medicacao_pendente.n} com medicação sem checagem · {data.etapas.altas_hoje.n} {data.etapas.altas_hoje.n === 1 ? 'alta' : 'altas'} hoje
        </span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-capsula bg-trilha" aria-hidden>
        {faixa.filter((s) => s.n > 0).map((s) => (
          <span key={s.chave} className={cn('h-full border-r-2 border-superficie last:border-r-0', TOM_ETAPA[s.chave])} style={{ width: `${s.parte * 100}%` }} />
        ))}
      </div>
      <ol className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
        {faixa.map((s) => {
          const destaque = gargaloChave === s.chave
          return (
            <li key={s.chave} className={cn('flex flex-col gap-0.5 border-l-2 pl-2.5', destaque ? (critico ? 'border-critico' : 'border-atencao') : 'border-trilha')}>
              <span className="flex items-center gap-1.5 text-rotulo text-tinta-apoio">
                <span className={cn('size-2 rounded-capsula', TOM_ETAPA[s.chave])} aria-hidden />{s.rotulo}
              </span>
              <span className="text-titulo leading-none font-semibold tabular text-tinta">{s.n}</span>
              <span className="text-rotulo text-tinta-sussurro">{s.esperaMaxMin != null ? `mais antiga: ${tempo(s.esperaMaxMin)}` : s.n ? '' : 'ninguém'}</span>
              {s.atrasados > 0 && (
                <span className="text-rotulo font-medium text-critico">{s.atrasados} {s.chave === 'observacao' ? 'acima de 6 h' : 'fora do alvo'}</span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
const FILTROS = ['Todos', 'Atrasados', 'Medicação pendente'] as const

function Agora() {
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
  const hora = data ? fmtHora(data.gerado_em) : null

  return (
    <div className="flex w-full flex-col gap-6">
      {hora && <p className="text-rotulo text-tinta-sussurro">Atualizado às {hora}, a cada 15 segundos.</p>}

      {isLoading && <div className="flex h-32 items-center justify-center"><Spinner /></div>}
      {error && <p role="alert" className="text-apoio text-critico">Não foi possível carregar a porta agora: {(error as Error).message}</p>}

      {data && (
        <>
          {g && (
            <div role="status" className={cn('flex items-center gap-2 rounded-container border px-4 py-3 text-apoio',
              g.critico ? 'border-critico/30 bg-alerta-critico text-critico' : 'border-atencao/30 bg-alerta-atencao text-atencao')}>
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              <span>
                <strong className="font-semibold">Gargalo: {ETAPAS.find((x) => x.chave === g.chave)?.rotulo}</strong> — {g.motivo}.
              </span>
            </div>
          )}

          <FaixaFila data={data} gargaloChave={g?.chave ?? null} critico={!!g?.critico} />

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
                    <span className="text-titulo leading-none font-semibold tabular text-tinta">{v.n}</span>
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
                <Table variante="referencia" className="w-full min-w-[720px] text-apoio">
                  <TableHeader className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
                    <TableRow>
                      <TableHead className="px-4 py-2 font-medium">Paciente</TableHead>
                      <TableHead className="px-3 py-2 font-medium">Cor</TableHead>
                      <TableHead className="px-3 py-2 font-medium">Setor</TableHead>
                      <TableHead className="px-3 py-2 font-medium">Leito / poltrona</TableHead>
                      <TableHead className="px-3 py-2 text-right font-medium">Espera</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agruparPorEtapa(lista).flatMap((grupo) => [
                      <TableRow key={grupo.chave} className="border-b border-trilha bg-campo">
                        <TableCell colSpan={5} className="px-4 py-1.5 text-rotulo font-medium text-tinta-apoio">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn('size-2 rounded-capsula', TOM_ETAPA[grupo.chave])} aria-hidden />
                            {ROTULO_ETAPA[grupo.chave]} · {grupo.pacientes.length}
                          </span>
                        </TableCell>
                      </TableRow>,
                      ...grupo.pacientes.map((p, i) => (
                      <TableRow key={`${grupo.chave}-${i}`} className="border-b border-trilha last:border-0">
                        <TableCell className="px-4 py-2 font-medium text-tinta">
                          {p.nome}
                          {p.medicacao_pendente && (
                            <span className="ml-2 inline-flex items-center gap-1 text-rotulo font-normal text-atencao">
                              <Pill className="size-3" aria-hidden /> medicação sem checagem
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2"><CorDiscreta cor={p.cor} /></TableCell>
                        <TableCell className="px-3 py-2 text-tinta-apoio">{p.setor ?? '—'}</TableCell>
                        <TableCell className="px-3 py-2 text-tinta-apoio">{p.leito ?? '—'}</TableCell>
                        <TableCell className={cn('px-3 py-2 text-right tabular', p.fora_alvo ? 'font-semibold text-critico' : 'text-tinta')}>
                          {tempo(p.espera_min)}{p.fora_alvo && <span className="sr-only"> (fora do alvo)</span>}
                        </TableCell>
                      </TableRow>
                      )),
                    ])}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default function PortaAgora() {
  return (
    <TabsPagina
      titulo="Porta"
      descricao="O pronto-socorro agora, da chegada à alta."
      icone={DoorOpen}
      abas={[
        { valor: 'agora', rotulo: 'Agora', conteudo: () => <Agora /> },
        { valor: 'grade', rotulo: 'Grade de ações', conteudo: () => <GradeAcoes /> },
      ]}
    />
  )
}
