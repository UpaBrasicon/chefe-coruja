import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Plus, Search, Users, Video, X } from 'lucide-react'
import * as React from 'react'

import { cartao } from '@/components/admin/ui'
import { Campo, Texto } from '@/components/documentos/ui'
import { Abas, TituloCartao, TituloPagina, Vazio, VazioLinha } from '@/components/monitor/Pagina'
import { OpcaoLista, BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Gaveta, GavetaCabeca, GavetaPe } from '@/components/ui/gaveta'
import { Input } from '@/components/ui/input'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import {
  diasDaSemana, LIMITE_PAUTA, plataformaDoLink, problemaDaReuniao, somarDias,
  type Convidado, type FormReuniao, type Reuniao,
} from '@/domain/reuniao'
import { PAPEL_LABEL } from '@/lib/constants'
import { dataIso, dataPorExtenso, dataPura, diaMes, hora, semanaCurta, dia as diaDoMes } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Papel } from '@/types/database'

// Agenda do administrador (pedido do RT, 24/11/2026): no lugar da Escala, o
// dia a dia e as reuniões. Desenho aprovado (Refero: Cron, Amie): o dia ou a
// semana com os compromissos e o detalhe ao lado. v1: o link é colado (Meet,
// Zoom, Teams ou outra); os convidados recebem o aviso no app. Tudo no
// horário de Brasília.

type Visao = 'dia' | 'semana'

const meioDia = (iso: string) => `${iso}T12:00:00-03:00`

function useReunioes(de: string, ate: string) {
  return useQuery({
    queryKey: ['reunioes', de, ate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('minhas_reunioes', { p_de: de, p_ate: ate })
      if (error) throw error
      return (data ?? []).map((r) => ({ ...r, convidados: (r.convidados ?? []) as Convidado[] }) as Reuniao)
    },
  })
}

export default function AgendaAdmin() {
  const [visao, setVisao] = React.useState<Visao>('semana')
  const [dia, setDia] = React.useState(() => dataIso())
  const [escolhida, setEscolhida] = React.useState<string | null>(null)
  const [editando, setEditando] = React.useState<Reuniao | 'nova' | null>(null)

  const semana = diasDaSemana(dia)
  const reunioes = useReunioes(semana[0], semana[6])
  const lista = reunioes.data ?? []
  const doDia = (d: string) => lista.filter((r) => dataIso(r.inicio) === d)
  const atual = lista.find((r) => r.id === escolhida) ?? null
  const hoje = dataIso()
  const passo = visao === 'dia' ? 1 : 7

  const periodo = visao === 'dia'
    ? dataPorExtenso(meioDia(dia))
    : `${diaMes(meioDia(semana[0]))} a ${diaMes(meioDia(semana[6]))}`

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col">
      <TituloPagina
        icone={CalendarDays}
        titulo="Agenda"
        descricao="Reuniões e compromissos do dia a dia, no horário de Brasília."
        acoes={<Button onClick={() => setEditando('nova')}><Plus /> Nova reunião</Button>}
      />

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <Abas
          rotulo="Visão da agenda"
          className="mb-0"
          valor={visao}
          onChange={setVisao}
          abas={[['dia', 'Dia'], ['semana', 'Semana']] as const}
        />
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="icon" aria-label={visao === 'dia' ? 'Dia anterior' : 'Semana anterior'} onClick={() => setDia(somarDias(dia, -passo))}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" onClick={() => setDia(hoje)} disabled={dia === hoje}>Hoje</Button>
          <Button variant="outline" size="icon" aria-label={visao === 'dia' ? 'Próximo dia' : 'Próxima semana'} onClick={() => setDia(somarDias(dia, passo))}>
            <ChevronRight />
          </Button>
        </div>
        <span className="basis-full text-corpo font-medium text-tinta" aria-live="polite">{periodo}</span>
      </div>

      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className={cartao} aria-label="Compromissos">
          {reunioes.isLoading && <div className="px-5 py-5"><Spinner /></div>}
          {reunioes.error && <MensagemErro className="m-4" texto={(reunioes.error as Error).message} />}
          {reunioes.data && (visao === 'dia' ? (
            <ListaDoDia reunioes={doDia(dia)} escolhida={escolhida} onEscolher={setEscolhida} vazio="Nenhuma reunião neste dia." />
          ) : (
            <div className="grid divide-y divide-trilha md:grid-cols-7 md:divide-x md:divide-y-0">
              {semana.map((d) => (
                <div key={d} className="flex min-w-0 flex-col">
                  <BotaoLinha
                    variante="linha"
                    onClick={() => { setDia(d); setVisao('dia') }}
                    className={cn('items-baseline gap-1.5 border-b border-trilha px-3 py-2.5 md:flex-col md:items-start md:gap-0', d === hoje && 'text-acao')}
                    aria-label={`Abrir o dia ${dataPura(d)}`}
                  >
                    <span className="text-rotulo text-tinta-sussurro">{semanaCurta(meioDia(d))}</span>
                    <span className={cn('text-secao font-semibold tabular-nums', d === hoje ? 'text-acao' : 'text-tinta')}>{diaDoMes(meioDia(d))}</span>
                  </BotaoLinha>
                  <div className="flex flex-col gap-1.5 p-2">
                    {doDia(d).map((r) => (
                      <CartaoReuniao key={r.id} r={r} compacto ativa={r.id === escolhida} onClick={() => setEscolhida(r.id)} />
                    ))}
                    {doDia(d).length === 0 && <span className="px-1 py-1 text-rotulo text-tinta-sussurro md:hidden">Livre</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
          {reunioes.data && visao === 'semana' && lista.length === 0 && (
            <p className="border-t border-trilha px-5 py-4 text-center text-apoio text-tinta-sussurro">
              Nenhuma reunião nesta semana. Use "Nova reunião" para marcar a primeira.
            </p>
          )}
        </section>

        <aside className="lg:sticky lg:top-4" aria-label="Detalhe da reunião">
          {atual ? (
            <Detalhe r={atual} agora={reunioes.dataUpdatedAt} onEditar={() => setEditando(atual)} onFechar={() => setEscolhida(null)} />
          ) : (
            <Vazio icone={Video} titulo="Escolha uma reunião" texto="O detalhe aparece aqui: horário, link para entrar, pauta e convidados." />
          )}
        </aside>
      </div>

      {editando && (
        <FormularioReuniao
          reuniao={editando === 'nova' ? null : editando}
          diaInicial={dia < hoje ? hoje : dia}
          onFechar={() => setEditando(null)}
          onSalva={(id) => { setEscolhida(id); setEditando(null) }}
        />
      )}
    </div>
  )
}

// ── lista e cartões ──────────────────────────────────────────────────────────

function ListaDoDia({ reunioes, escolhida, onEscolher, vazio }: {
  reunioes: Reuniao[]; escolhida: string | null; onEscolher: (id: string) => void; vazio: string
}) {
  if (reunioes.length === 0) return <VazioLinha className="px-5 py-6 text-center">{vazio}</VazioLinha>
  return (
    <div className="flex flex-col gap-2 p-3">
      {reunioes.map((r) => (
        <div key={r.id} className="flex items-stretch gap-3">
          <span className="w-12 shrink-0 pt-2.5 text-right text-apoio tabular-nums text-tinta-sussurro">{hora(r.inicio)}</span>
          <CartaoReuniao r={r} ativa={r.id === escolhida} onClick={() => onEscolher(r.id)} />
        </div>
      ))}
    </div>
  )
}

function CartaoReuniao({ r, ativa, compacto, onClick }: { r: Reuniao; ativa: boolean; compacto?: boolean; onClick: () => void }) {
  return (
    <BotaoLinha
      onClick={onClick}
      aria-pressed={ativa}
      className={cn('w-full min-w-0 border-l-[3px]', ativa ? 'border-acao bg-alerta-marca' : 'border-l-acao', r.cancelada && 'border-l-fio-forte opacity-70')}
    >
      <span className="text-rotulo tabular-nums text-tinta-sussurro">{hora(r.inicio)}–{hora(r.fim)}</span>
      <span className={cn('w-full truncate font-medium text-tinta', compacto ? 'text-apoio' : 'text-corpo', r.cancelada && 'line-through')}>{r.titulo}</span>
      {!compacto && (
        <span className="text-rotulo text-tinta-sussurro">
          {r.cancelada ? 'Cancelada' : r.plataforma ?? 'Sem link'} · {r.convidados.length === 1 ? '1 convidado' : `${r.convidados.length} convidados`}
        </span>
      )}
    </BotaoLinha>
  )
}

// ── detalhe ──────────────────────────────────────────────────────────────────

function Detalhe({ r, agora, onEditar, onFechar }: { r: Reuniao; agora: number; onEditar: () => void; onFechar: () => void }) {
  const qc = useQueryClient()
  // o estado vale para a reunião em que foi ligado (trocar de reunião desliga)
  const [confirmarId, setConfirmarId] = React.useState<string | null>(null)
  const [copiadoId, setCopiadoId] = React.useState<string | null>(null)
  const confirmar = confirmarId === r.id
  const copiado = copiadoId === r.id
  const setConfirmar = (v: boolean) => setConfirmarId(v ? r.id : null)

  const cancelar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('cancelar_reuniao', { p_id: r.id })
      if (error) throw error
    },
    onSuccess: () => { setConfirmar(false); void qc.invalidateQueries({ queryKey: ['reunioes'] }) },
  })
  const terminou = new Date(r.fim).getTime() < agora

  return (
    <section className={cn(cartao, 'flex flex-col')}>
      <div className="flex items-start gap-3 border-b border-trilha px-5 pt-4 pb-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <TituloCartao className="mb-0">{r.titulo}</TituloCartao>
          <span className="text-apoio text-tinta-apoio">{dataPorExtenso(r.inicio)}, das {hora(r.inicio)} às {hora(r.fim)}</span>
          {r.cancelada && <span className="text-apoio font-medium text-critico">Reunião cancelada</span>}
          {!r.cancelada && terminou && <span className="text-apoio text-tinta-sussurro">Já terminou</span>}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Fechar o detalhe" onClick={onFechar}><X /></Button>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-apoio font-medium text-grafite">Onde</span>
          {r.link ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-corpo text-tinta">{r.plataforma ?? 'Link'}</span>
                {!r.cancelada && (
                  <Button size="sm" render={<a href={r.link} target="_blank" rel="noopener noreferrer" />}>
                    <Video /> Entrar
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(r.link!); setCopiadoId(r.id) }}>
                  <Copy /> {copiado ? 'Copiado' : 'Copiar link'}
                </Button>
              </div>
              <span className="text-rotulo break-all text-tinta-sussurro">{r.link}</span>
            </>
          ) : (
            <span className="text-apoio text-tinta-sussurro">Sem link. Presencial ou a combinar.</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-apoio font-medium text-grafite">Pauta</span>
          <p className="text-apoio whitespace-pre-line text-pretty text-tinta-apoio">{r.pauta || 'Sem pauta.'}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-apoio font-medium text-grafite">
            Convidados {r.convidados.length > 0 && <span className="tabular-nums text-tinta-sussurro">({r.convidados.length})</span>}
          </span>
          {r.convidados.length === 0 ? (
            <span className="text-apoio text-tinta-sussurro">Ninguém convidado.</span>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {r.convidados.map((c) => (
                <li key={c.id} className="rounded-capsula border border-fio bg-campo px-2.5 py-[3px] text-apoio text-tinta-apoio">{c.nome}</li>
              ))}
            </ul>
          )}
          <span className="text-rotulo text-tinta-sussurro">{r.sou_criador ? 'Você marcou esta reunião.' : `Marcada por ${r.criador_nome}.`}</span>
        </div>
      </div>

      {r.sou_criador && !r.cancelada && (
        <div className="flex flex-wrap items-center gap-2 border-t border-trilha bg-campo px-5 py-3">
          {confirmar ? (
            <>
              <span className="min-w-0 flex-[1_1_160px] text-apoio text-tinta-apoio">Cancelar e avisar os convidados?</span>
              <Button variant="outline" size="sm" onClick={() => setConfirmar(false)}>Voltar</Button>
              <Button variant="destructive" size="sm" disabled={cancelar.isPending} onClick={() => cancelar.mutate()}>
                {cancelar.isPending && <Spinner className="size-4" />} Cancelar reunião
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={onEditar}>Editar</Button>
              <Button variant="destructive" size="sm" onClick={() => setConfirmar(true)}>Cancelar reunião</Button>
            </>
          )}
          {cancelar.error && <MensagemErro formato="linha" className="basis-full" texto={(cancelar.error as Error).message} />}
        </div>
      )}
    </section>
  )
}

// ── nova reunião / editar ───────────────────────────────────────────────────

function FormularioReuniao({ reuniao, diaInicial, onFechar, onSalva }: {
  reuniao: Reuniao | null; diaInicial: string; onFechar: () => void; onSalva: (id: string) => void
}) {
  const qc = useQueryClient()
  const { unidadeAtiva } = useUnidade()
  const [titulo, setTitulo] = React.useState(reuniao?.titulo ?? '')
  const [data, setData] = React.useState(reuniao ? dataIso(reuniao.inicio) : diaInicial)
  const [inicio, setInicio] = React.useState(reuniao ? hora(reuniao.inicio) : '09:00')
  const [fim, setFim] = React.useState(reuniao ? hora(reuniao.fim) : '10:00')
  const [link, setLink] = React.useState(reuniao?.link ?? '')
  const [pauta, setPauta] = React.useState(reuniao?.pauta ?? '')
  const [convidados, setConvidados] = React.useState<Convidado[]>(reuniao?.convidados ?? [])
  const [erro, setErro] = React.useState<string | null>(null)

  const plataforma = plataformaDoLink(link)
  const form: FormReuniao = { titulo, data, inicio, fim, link, pauta, convidados: convidados.map((c) => c.id) }

  const salvar = useMutation({
    mutationFn: async () => {
      const { data: id, error } = await supabase.rpc('salvar_reuniao', {
        p_id: reuniao?.id ?? null,
        p_unidade: unidadeAtiva?.unidade_id ?? null,
        p_titulo: titulo.trim(),
        p_data: data,
        p_inicio: inicio,
        p_fim: fim,
        p_link: link.trim() || null,
        p_pauta: pauta.trim() || null,
        p_convidados: form.convidados,
      })
      if (error) throw error
      return id as string
    },
    onSuccess: (id) => { void qc.invalidateQueries({ queryKey: ['reunioes'] }); onSalva(id) },
    onError: (e: Error) => setErro(e.message),
  })

  function enviar() {
    const p = problemaDaReuniao(form)
    if (p) return setErro(p)
    setErro(null)
    salvar.mutate()
  }

  return (
    <Gaveta aberta onAbertaChange={(v) => { if (!v) onFechar() }} rotulo={reuniao ? 'Editar reunião' : 'Nova reunião'}>
      <GavetaCabeca
        sobre="Agenda"
        titulo={reuniao ? 'Editar reunião' : 'Nova reunião'}
        detalhe="Os convidados recebem o aviso no app. Horário de Brasília."
      />
      <div className="flex flex-col gap-4 px-[22px] py-5">
        <Texto id="re-titulo" rotulo="Título" valor={titulo} onChange={setTitulo} dica="Ex.: reunião da rede, escala de dezembro" largura="cheio" />
        <div className="flex flex-wrap gap-3">
          <Texto id="re-dia" rotulo="Dia" tipo="date" valor={data} onChange={setData} largura="cheio" />
          <Texto id="re-inicio" rotulo="Início" tipo="time" valor={inicio} onChange={setInicio} largura="curto" />
          <Texto id="re-fim" rotulo="Fim" tipo="time" valor={fim} onChange={setFim} largura="curto" />
        </div>
        <Texto
          id="re-link"
          rotulo="Link da reunião (opcional)"
          valor={link}
          onChange={setLink}
          dica="Cole o link do Meet, Zoom, Teams ou outra"
          largura="cheio"
          ajuda={!link.trim()
            ? 'Sem link, a reunião fica como presencial ou a combinar.'
            : plataforma ? <span className="text-conforme">{plataforma}: os convidados entram por este link.</span>
              : <span className="text-critico">O link precisa começar com https:// e ter o endereço completo.</span>}
        />
        <Texto id="re-pauta" rotulo="Pauta (opcional)" valor={pauta} onChange={setPauta} longo linhas={3}
          ajuda={pauta.length > LIMITE_PAUTA - 200 ? `${pauta.length} de ${LIMITE_PAUTA} letras` : undefined} />
        <BuscaConvidados escolhidos={convidados} onMudar={setConvidados} unidadeId={unidadeAtiva?.unidade_id ?? null} />
      </div>
      <GavetaPe className="flex flex-wrap items-center gap-2.5">
        <span role={erro ? 'alert' : undefined} className="min-w-0 flex-[1_1_160px] text-apoio text-critico">{erro}</span>
        <Button variant="outline" onClick={onFechar}>Voltar</Button>
        <Button onClick={enviar} disabled={salvar.isPending}>
          {salvar.isPending && <Spinner className="size-4" />} {reuniao ? 'Salvar e avisar' : 'Marcar reunião'}
        </Button>
      </GavetaPe>
    </Gaveta>
  )
}

/** Convidados por busca, com fichas do escolhido (sem parede de checkbox). */
function BuscaConvidados({ escolhidos, onMudar, unidadeId }: {
  escolhidos: Convidado[]; onMudar: (c: Convidado[]) => void; unidadeId: string | null
}) {
  const [busca, setBusca] = React.useState('')
  const [termo, setTermo] = React.useState('')
  React.useEffect(() => {
    const t = setTimeout(() => setTermo(busca.trim()), 250)
    return () => clearTimeout(t)
  }, [busca])

  const pessoas = useQuery({
    queryKey: ['pessoas-reuniao', unidadeId, termo],
    enabled: !!unidadeId && termo.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pessoas_para_reuniao', { p_unidade: unidadeId!, p_busca: termo })
      if (error) throw error
      return data ?? []
    },
  })
  const ids = new Set(escolhidos.map((c) => c.id))
  const sugestoes = (pessoas.data ?? []).filter((p) => !ids.has(p.perfil_id))
  const papeis = (lista: string[]) => lista.map((p) => PAPEL_LABEL[p as Papel] ?? p).join(', ')

  return (
    <Campo id="re-convidados" rotulo="Convidados" largura="cheio" ajuda="Pessoas da organização. Busque pelo nome.">
      {escolhidos.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Convidados escolhidos">
          {escolhidos.map((c) => (
            <li key={c.id} className="inline-flex items-center gap-1 rounded-capsula border border-acao/40 bg-alerta-marca py-[2px] pr-1 pl-2.5 text-apoio text-tinta">
              {c.nome}
              <Button variant="ghost" size="icon-xs" aria-label={`Tirar ${c.nome}`} onClick={() => onMudar(escolhidos.filter((x) => x.id !== c.id))}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
        <Input id="re-convidados" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite ao menos 2 letras do nome"
          className="pl-8 md:text-corpo" autoComplete="off" role="combobox" aria-expanded={sugestoes.length > 0} aria-controls="re-convidados-lista" />
      </div>
      {termo.length >= 2 && (
        <div className="relative z-30 h-0">
          <div id="re-convidados-lista" role="listbox" className="absolute inset-x-0 top-0 flex max-h-[260px] flex-col overflow-y-auto rounded-controle border border-fio bg-superficie shadow-popover">
            {pessoas.isLoading && <span className="px-3 py-2 text-apoio text-tinta-sussurro">Buscando...</span>}
            {pessoas.error && <span className="px-3 py-2 text-apoio text-critico">{(pessoas.error as Error).message}</span>}
            {pessoas.data && sugestoes.length === 0 && (
              <span className="flex items-center gap-2 px-3 py-2 text-apoio text-tinta-sussurro"><Users className="size-4" aria-hidden /> Ninguém com esse nome na organização.</span>
            )}
            {sugestoes.map((p) => (
              <OpcaoLista key={p.perfil_id} className="flex-col gap-0 hover:bg-alerta-marca"
                onClick={() => { onMudar([...escolhidos, { id: p.perfil_id, nome: p.nome }]); setBusca(''); setTermo('') }}>
                <span className="text-controle text-tinta">{p.nome}</span>
                <span className="text-rotulo text-tinta-sussurro">{papeis(p.papeis)} · {p.unidades.join(', ')}</span>
              </OpcaoLista>
            ))}
          </div>
        </div>
      )}
    </Campo>
  )
}
