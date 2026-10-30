// ─────────────────────────────────────────────────────────────────────────────
// Aba Escala dos papéis que não são plantonista, gestor nem administrador
// (entrega E3, opção A do RT em 28/10/2026): o mês com o dia ao lado, só de
// leitura, no mesmo desenho da Escala do gestor. No mês, os dias em que eu
// trabalho; ao lado, o dia escolhido com a equipe da minha categoria (resposta
// 2 do RT: a própria escala e a da equipe inteira da categoria). Dos colegas,
// só nome, setor e horário. Abre também fora do plantão (ForaDoExpediente).
// Dados de escala_da_unidade (migrations 20270202000001 e 20270202000002).
// E4 (opção A do RT em 28/10/2026): no dia em que trabalho, "Seu plantão" com
// Trocar, Passar e Justificar falta; a vaga da categoria em âmbar no mês, com
// "Candidatar-me" no dia; o plantão com pedido pendente leva a ampulheta.
// Ajuste da E4 (opção A do RT em 28/10/2026): as ações do próximo plantão no
// cartão do alto, as vagas abertas da categoria ao lado e, no dia que já passou,
// a explicação com o atalho para o próximo plantão.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Hourglass } from 'lucide-react'
import * as React from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { PAPEL_LABEL } from '@/lib/constants'
import { dataIso, dataPorExtenso, hora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { ProximoPlantao } from '@/components/casca/ProximoPlantao'
import { AcoesDoPlantao, SeuPlantao, SeusPedidos, VagasDoDia } from '@/components/escala/PedidosEscala'
import { type PlantaoEquipe, usePedidosDaEquipe } from '@/hooks/usePedidosDaEquipe'
import { TituloPagina } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'

type Plantao = PlantaoEquipe

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/**
 * M11 (teste ponta a ponta da escala): a telemedicina trabalha em várias unidades,
 * e o mês acima é o da unidade ativa. Aqui, os próximos plantões dela em todas as
 * unidades, como na antiga "Minha agenda" (decisão 10 do RT: a agenda virou a aba
 * Escala comum). Lê tele_minha_escala, que já atende todas as unidades.
 */
function TeleTodasUnidades({ de, ate }: { de: string; ate: string }) {
  const lista = useQuery({
    queryKey: ['tele-minha-escala', de, ate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tele_minha_escala', { p_de: de, p_ate: ate })
      if (error) throw error
      return data ?? []
    },
  })
  // a hora em que a tela abriu, como no resto da aba
  const [agora] = React.useState(() => Date.now())
  const proximos = (lista.data ?? []).filter((p) => new Date(p.fim).getTime() > agora)
  return (
    <section aria-label="Seus plantões em todas as unidades" className="overflow-hidden rounded-cartao border border-fio bg-superficie">
      <div className="flex items-center gap-2 border-b border-trilha px-4 py-2.5">
        <span className="text-apoio font-semibold text-tinta">Seus plantões em todas as unidades</span>
        <span className="ml-auto text-rotulo text-tinta-sussurro">próximos 60 dias</span>
      </div>
      {lista.isLoading && <div className="flex justify-center py-4"><Spinner /></div>}
      {lista.error && <MensagemErro className="m-3" texto={(lista.error as Error).message} />}
      {lista.data && proximos.length === 0 && <p className="px-4 py-3 text-apoio text-tinta-sussurro">Nenhum plantão nos próximos 60 dias.</p>}
      <ul className="flex flex-col">
        {proximos.map((p) => (
          <li key={p.escala_id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-trilha px-4 py-2 text-apoio last:border-b-0">
            <span className="truncate text-tinta">{dataPorExtenso(`${p.data}T12:00:00Z`)} · {p.unidade} · {p.setor}</span>
            <span className="text-rotulo tabular-nums text-tinta-sussurro">
              {p.agora ? <span className="font-semibold text-acao">agora · </span> : null}{hora(p.inicio)}–{hora(p.fim)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
// a faixa do plantão: o diurno de 12 h é "Dia"
const faixa = (p: Plantao) => (p.turno === 'noite' ? 'Noite' : p.duracao_min >= 720 ? 'Dia' : p.turno === 'tarde' ? 'Tarde' : 'Manhã')
const horario = (p: Plantao) => `${hora(p.inicio)}–${hora(new Date(new Date(p.inicio).getTime() + p.duracao_min * 60_000))}`

export function EscalaEquipe({ titulo = true }: { titulo?: boolean }) {
  const { unidadeAtiva, papeisDaUnidade } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id
  const hoje = dataIso()
  const [mes, setMes] = React.useState(() => hoje.slice(0, 7))
  const [dia, setDia] = React.useState<string | null>(null)
  // a hora em que a tela abriu (o próximo plantão é o primeiro que ainda não terminou)
  const [agora] = React.useState(() => Date.now())
  const [ano, mesNum] = mes.split('-').map(Number)
  const diasNoMes = new Date(ano, mesNum, 0).getDate()
  const de = `${mes}-01`
  const ate = `${mes}-${String(diasNoMes).padStart(2, '0')}`

  const escala = useQuery({
    queryKey: ['escala-equipe', unidadeId, de, ate],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('escala_da_unidade', { p_unidade: unidadeId!, p_de: de, p_ate: ate })
      if (error) throw error
      return (data ?? []) as Plantao[]
    },
  })
  const setores = useQuery({
    queryKey: ['escala-setores', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('setores').select('id, nome').eq('unidade_id', unidadeId!).eq('ativo', true).order('ordem', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  // os próximos 60 dias, para achar o meu próximo plantão nesta unidade e os plantões de colegas para a troca
  const ateProximos = new Date(new Date(`${hoje}T12:00:00Z`).getTime() + 60 * 86_400_000).toISOString().slice(0, 10)
  const proximos = useQuery({
    queryKey: ['escala-equipe', unidadeId, hoje, ateProximos],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('escala_da_unidade', { p_unidade: unidadeId!, p_de: hoje, p_ate: ateProximos })
      if (error) throw error
      return (data ?? []) as Plantao[]
    },
  })
  const pedidos = usePedidosDaEquipe(unidadeId)
  const vagasNoDia = (d: string) => pedidos.vagas.filter((v) => v.data === d)

  // a minha categoria na unidade (todo papel menos gestor e administrador)
  const categorias = papeisDaUnidade.filter((p) => p !== 'gestor' && p !== 'admin')
  const equipe = categorias.length ? categorias.map((p) => PAPEL_LABEL[p]).join(' e ') : 'Sua categoria'
  const plantoes = escala.data ?? []
  const meus = plantoes.filter((p) => p.perfil_id === perfil?.id)
  const meuNoDia = new Map<string, Plantao[]>()
  for (const p of meus) meuNoDia.set(p.data, [...(meuNoDia.get(p.data) ?? []), p])
  const primeiro = new Date(ano, mesNum - 1, 1).getDay()
  const celulas: (string | null)[] = [...Array(primeiro).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`)]
  while (celulas.length % 7) celulas.push(null)
  const diaSel = dia ?? (hoje.startsWith(mes) ? hoje : de)
  const doDia = plantoes.filter((p) => p.data === diaSel).sort((a, b) => a.inicio.localeCompare(b.inicio))
  const nomeSetor = (id: string) => setores.data?.find((s) => s.id === id)?.nome ?? 'Setor'
  const setoresDoDia = [...new Set(doDia.map((p) => p.setor_id))]
    .sort((a, b) => (setores.data ?? []).findIndex((s) => s.id === a) - (setores.data ?? []).findIndex((s) => s.id === b))
  // o meu próximo plantão nesta unidade (o que ainda não terminou)
  const meuProximo = (proximos.data ?? [])
    .filter((p) => p.perfil_id === perfil?.id && new Date(p.inicio).getTime() + p.duracao_min * 60_000 > agora)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))[0]
  const irParaProximo = meuProximo
    ? { rotulo: `Ir para o próximo plantão (${meuProximo.data.slice(8, 10)}/${meuProximo.data.slice(5, 7)})`, ir: () => { setMes(meuProximo.data.slice(0, 7)); setDia(meuProximo.data) } }
    : undefined
  const vagasAbertas = [...pedidos.vagas].sort((a, b) => a.inicio.localeCompare(b.inicio))
  const mudarMes = (n: number) => {
    const d = new Date(ano, mesNum - 1 + n, 1)
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    setDia(null)
  }

  return (
    <div className="flex flex-col gap-3">
      {titulo && <TituloPagina titulo="Escala" descricao={`Seus plantões e os da sua categoria na unidade (${equipe}).`} />}
      <div className={cn('grid gap-3', vagasAbertas.length > 0 && 'md:grid-cols-[minmax(0,1fr)_340px]')}>
        <ProximoPlantao rodape={(inicio) => unidadeId && meuProximo && new Date(meuProximo.inicio).getTime() === inicio.getTime() ? (
          <AcoesDoPlantao unidadeId={unidadeId} plantao={meuProximo} equipe={proximos.data ?? []} faixa={faixa} nomeSetor={nomeSetor}
            pendente={pedidos.pendentes.has(meuProximo.id)} />
        ) : null} />
        {vagasAbertas.length > 0 && (
          <div className="overflow-hidden rounded-container border border-fio bg-superficie [&>div]:border-b-0">
            <VagasDoDia vagas={vagasAbertas} titulo={`Vagas abertas da sua categoria (${vagasAbertas.length})`} comData />
          </div>
        )}
      </div>
      <section aria-label="Escala do mês" className="grid overflow-hidden rounded-cartao border border-fio bg-superficie md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col border-fio md:border-r">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-trilha px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon-sm" aria-label="Mês anterior" onClick={() => mudarMes(-1)}><ChevronLeft /></Button>
              <span className="min-w-[140px] text-center text-apoio font-semibold text-tinta">{MESES[mesNum - 1][0].toUpperCase() + MESES[mesNum - 1].slice(1)} de {ano}</span>
              <Button variant="outline" size="icon-sm" aria-label="Próximo mês" onClick={() => mudarMes(1)}><ChevronRight /></Button>
            </div>
            {escala.data && <span className="text-rotulo text-tinta-sussurro">{plural(meus.length, 'plantão seu', 'plantões seus')} no mês</span>}
          </div>
          {escala.isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
          {escala.error && <MensagemErro className="m-3" texto={(escala.error as Error).message} />}
          {escala.data && (
            <div className="grid grid-cols-7 gap-px bg-trilha" role="grid" aria-label={`Dias de ${MESES[mesNum - 1]}`}>
              {SEMANA.map((s) => <span key={s} role="columnheader" className="bg-superficie py-1.5 text-center text-rotulo text-tinta-sussurro">{s}</span>)}
              {celulas.map((d, i) => {
                if (!d) return <span key={i} className="bg-superficie" />
                const meusDia = meuNoDia.get(d) ?? []
                return (
                  <BotaoLinha key={d} variante="linha" onClick={() => setDia(d)} aria-pressed={d === diaSel}
                    aria-label={`${Number(d.slice(8))} de ${MESES[mesNum - 1]}: ${meusDia.length ? meusDia.map((p) => `${faixa(p)} no ${nomeSetor(p.setor_id)}`).join(', ') : 'sem plantão seu'}`}
                    className={cn('min-h-[68px] flex-col items-stretch gap-1 rounded-none border-0 bg-superficie px-1.5 py-1.5 sm:px-2',
                      d === diaSel && 'bg-alerta-marca ring-2 ring-acao ring-inset hover:bg-alerta-marca', d < hoje && d !== diaSel && 'text-tinta-sussurro')}>
                    <span className="flex items-center justify-between text-apoio tabular-nums">
                      <span className={cn(d === hoje ? 'font-semibold text-tinta' : 'text-tinta')}>{Number(d.slice(8))}</span>
                      {d === hoje && <span className="hidden text-rotulo text-acao sm:inline">hoje</span>}
                    </span>
                    <span className="mt-auto flex min-w-0 flex-col gap-0.5">
                      {meusDia.map((p) => (
                        <span key={p.id} className="flex min-w-0 items-center gap-1 rounded-controle bg-acao/10 px-1.5 text-rotulo font-medium text-acao">
                          {pedidos.pendentes.has(p.id) && <Hourglass className="size-3 shrink-0" aria-label="pedido aguardando" />}
                          <span className="sm:hidden">{faixa(p)[0]}</span>
                          <span className="hidden truncate sm:inline">{faixa(p)} · {nomeSetor(p.setor_id)}</span>
                        </span>
                      ))}
                      {vagasNoDia(d).length > 0 && (
                        <span className="truncate rounded-controle bg-alerta-atencao px-1.5 text-rotulo font-medium text-atencao">
                          vaga<span className="hidden sm:inline"> · {vagasNoDia(d)[0].setor_nome}</span>
                        </span>
                      )}
                    </span>
                  </BotaoLinha>
                )
              })}
            </div>
          )}
        </div>

        {escala.data && (
          <aside aria-label={`Equipe de ${dataPorExtenso(`${diaSel}T12:00:00Z`)}`} className="flex flex-col border-t border-fio md:border-t-0">
            <div className="border-b border-trilha px-4 py-2.5">
              <span className="text-apoio font-semibold text-tinta">{dataPorExtenso(`${diaSel}T12:00:00Z`)}</span>
              <span className="block text-rotulo text-tinta-sussurro">{equipe} · {plural(doDia.length, 'plantão', 'plantões')}</span>
            </div>
            {unidadeId && (
              <SeuPlantao unidadeId={unidadeId} meusDoDia={(meuNoDia.get(diaSel) ?? [])} equipe={plantoes}
                faixa={faixa} horario={horario} nomeSetor={nomeSetor} pendentes={pedidos.pendentes}
                irParaProximo={meuProximo && meuProximo.data !== diaSel ? irParaProximo : undefined} />
            )}
            <VagasDoDia vagas={vagasNoDia(diaSel)} />
            {doDia.length === 0 && <p className="px-4 py-3 text-apoio text-tinta-sussurro">Ninguém da equipe neste dia.</p>}
            {setoresDoDia.map((s) => (
              <div key={s} className="flex flex-col gap-1.5 border-b border-trilha px-4 py-2.5 last:border-b-0">
                <span className="text-rotulo font-semibold text-tinta-sussurro">{nomeSetor(s)}</span>
                {doDia.filter((p) => p.setor_id === s).map((p) => (
                  <span key={p.id} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-baseline gap-x-2 text-apoio">
                    <span className="text-tinta-sussurro">{faixa(p)}</span>
                    <span className={cn('truncate text-tinta', p.perfil_id === perfil?.id && 'font-semibold')}>
                      {p.nome_completo ?? 'Profissional'}
                      {p.perfil_id === perfil?.id && <span className="ml-1.5 text-rotulo font-normal text-acao">você</span>}
                    </span>
                    <span className="text-rotulo tabular-nums text-tinta-sussurro">{horario(p)}</span>
                  </span>
                ))}
              </div>
            ))}
            <SeusPedidos minhas={pedidos.minhas} trocas={pedidos.trocas} plantoes={plantoes} />
            <p className="mt-auto border-t border-trilha bg-campo px-4 py-2 text-rotulo text-pretty text-tinta-sussurro">
              Vagas da sua categoria em âmbar no mês. Troca e passagem só dentro da categoria; a coordenação aprova.
            </p>
          </aside>
        )}
      </section>
      {categorias.includes('telemedicina') && <TeleTodasUnidades de={hoje} ate={ateProximos} />}
    </div>
  )
}
