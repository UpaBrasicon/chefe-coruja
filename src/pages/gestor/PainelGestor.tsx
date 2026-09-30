import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CircleDot, LayoutDashboard, MapPin, Search, TrendingUp } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { Chip, Chips, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Parametro } from '@/components/monitor/Parametros'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

import { chaveMedida, chavePainel, PAINEIS, usePanorama } from './panorama'

// Painel do Gestor (P/index.html 6879–7019): o Panorama da unidade em
// carrossel (os painéis e as medidas que o gestor escolheu em Indicadores), a
// pergunta sobre a gestão respondida pelo banco da unidade e a auditoria de
// check-in do dia, previsto × realizado.

type LinhaCheckin = Database['public']['Functions']['auditoria_checkin']['Returns'][number]
type Resposta = { entendida: boolean; tema: string | null; titulo: string; resposta: string; itens: { rotulo: string; valor: string }[]; link: string | null }

const PERGUNTAS = [
  'Qual foi a taxa de ocupação no último mês?',
  'Quem está com mais plantões que o limite?',
  'Onde estão os gargalos de alta?',
  'Quais medicamentos vão faltar esta semana?',
]

const ROTULO_LINK: Record<string, string> = {
  '/indicadores': 'Abrir Indicadores',
  '/gestao/gaviao': 'Abrir Olho de Gavião',
  '/internacao': 'Abrir Internação',
  '/observacao': 'Abrir Observação',
}

const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—'

// ── Panorama em carrossel ───────────────────────────────────────────────────
function Panorama({ unidadeId }: { unidadeId: string }) {
  const { data, isLoading, error } = usePanorama(unidadeId)
  const [i, setI] = React.useState(0)
  const [pausado, setPausado] = React.useState(false)

  const fora = React.useMemo(() => new Set(data?.fora ?? []), [data?.fora])
  const lista = PAINEIS.filter((p) => !fora.has(chavePainel(p.chave)))
  const total = lista.length

  // 8 s por painel, como no protótipo; para sob o ponteiro ou o foco.
  React.useEffect(() => {
    if (pausado || total < 2) return
    const t = window.setInterval(() => setI((x) => (x + 1) % total), 8000)
    return () => window.clearInterval(t)
  }, [pausado, total])

  if (error) return <p className="text-apoio text-critico">Falha ao carregar o panorama: {(error as Error).message}</p>
  if (isLoading || !data) return <div className="flex h-40 items-center justify-center rounded-cartao border border-fio bg-superficie"><Spinner /></div>

  const atual = total ? lista[i % total] : null
  const medidas = atual ? atual.medidas(data.n).filter((m) => !fora.has(chaveMedida(atual.chave, m.chave))) : []
  const Icone = atual?.icone ?? LayoutDashboard

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Panorama da unidade"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      className="mb-[22px] overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso"
    >
      <div className="flex items-center gap-[11px] border-b border-trilha px-5 py-[15px]">
        <span className="grid size-[34px] shrink-0 place-items-center rounded-controle bg-marca/10 text-acao" aria-hidden>
          <Icone className="size-[17px]" />
        </span>
        <h2 className="min-w-0 flex-1 text-corpo font-semibold tracking-[-0.01em] text-tinta">
          Panorama da unidade
          {atual && <span className="font-normal text-tinta-apoio"> — {atual.titulo}</span>}
        </h2>
        {total > 1 && (
          <div className="flex gap-[7px]">
            <button type="button" aria-label="Painel anterior" onClick={() => setI((x) => (x - 1 + total) % total)}
              className="grid size-[30px] place-items-center rounded-[9px] border border-fio bg-superficie text-tinta-sussurro hover:border-marca hover:text-acao">
              <ChevronLeft className="size-[15px]" />
            </button>
            <button type="button" aria-label="Próximo painel" onClick={() => setI((x) => (x + 1) % total)}
              className="grid size-[30px] place-items-center rounded-[9px] border border-fio bg-superficie text-tinta-sussurro hover:border-marca hover:text-acao">
              <ChevronRight className="size-[15px]" />
            </button>
          </div>
        )}
      </div>

      {!atual || medidas.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3.5 p-5">
          <span className="text-corpo text-pretty text-tinta-apoio">
            {atual ? 'Este painel está sem medidas escolhidas.' : 'Nenhum painel escolhido para o carrossel.'}
          </span>
          <Link to="/indicadores" className="flex items-center gap-[7px] rounded-controle border border-fio bg-superficie px-[13px] py-2 text-apoio font-medium text-tinta-apoio hover:border-marca hover:text-acao">
            <TrendingUp className="size-[15px]" /> Escolher em Indicadores
          </Link>
        </div>
      ) : (
        <div aria-live={pausado ? 'polite' : 'off'} className="grid grid-cols-2 lg:grid-cols-4 [&>*]:border-trilha [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+3)]:border-t-0 lg:[&>*:nth-child(n+5)]:border-t [&>*:nth-child(even)]:border-l lg:[&>*:not(:nth-child(4n+1))]:border-l">
          {medidas.map((m) => (
            <Parametro key={m.chave} grandeza={m.grandeza} icone={CircleDot} rotulo={m.rotulo} valor={m.valor}
              estado={m.estado} nivel={m.nivel} pct={m.pct} limite={m.limite} />
          ))}
        </div>
      )}

      {total > 0 && atual && (
        <div className="flex items-center justify-between gap-3 border-t border-trilha bg-campo px-5 py-3">
          <span className="text-apoio text-tinta-apoio">{atual.nota(data.n)}</span>
          <div className="flex items-center gap-[5px]">
            {lista.map((p, k) => (
              <button key={p.chave} type="button" aria-label={`Painel ${k + 1} de ${total}: ${p.titulo}`} aria-current={k === i % total}
                onClick={() => setI(k)}
                className={cn('h-1.5 rounded-capsula transition-[width] duration-200', k === i % total ? 'w-[18px] bg-marca' : 'w-1.5 bg-fio-forte')} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

// ── Pergunta sobre a gestão ─────────────────────────────────────────────────
function Pergunta({ unidadeId }: { unidadeId: string }) {
  const [texto, setTexto] = React.useState('')
  const perguntar = useMutation({
    mutationFn: async (q: string) => {
      const { data, error } = await supabase.rpc('perguntar_gestao', { p_unidade: unidadeId, p_pergunta: q })
      if (error) throw error
      return data as unknown as Resposta
    },
  })
  const enviar = (q: string) => {
    const t = q.trim()
    if (t.length >= 3) perguntar.mutate(t)
  }
  const r = perguntar.data

  return (
    <section className="mb-[26px] rounded-cartao border border-fio bg-superficie px-5 py-4 shadow-repouso">
      <form onSubmit={(e) => { e.preventDefault(); enviar(texto) }}
        className="flex items-center gap-2.5 rounded-controle border border-fio bg-campo px-3.5 py-[11px] focus-within:border-marca">
        <Search className="size-[17px] shrink-0 text-tinta-sussurro" aria-hidden />
        <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300}
          placeholder="Pergunte sobre a gestão da unidade" aria-label="Pergunte sobre a gestão da unidade"
          className="min-w-0 flex-1 border-0 bg-transparent text-corpo text-tinta outline-none placeholder:text-tinta-sussurro" />
        <button type="submit" disabled={perguntar.isPending || texto.trim().length < 3}
          className="rounded-[9px] bg-acao px-[13px] py-[7px] text-apoio font-medium whitespace-nowrap text-white hover:bg-acao-pressionada disabled:opacity-60">
          {perguntar.isPending ? 'Consultando…' : 'Perguntar'}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="mr-0.5 text-rotulo font-semibold tracking-[0.06em] text-tinta-sussurro uppercase">Exemplos</span>
        {PERGUNTAS.map((p) => (
          <button key={p} type="button" onClick={() => { setTexto(p); enviar(p) }}
            className="rounded-capsula border border-fio bg-superficie px-3 py-[5px] text-apoio text-tinta-apoio hover:border-marca hover:bg-marca/5 hover:text-acao">
            {p}
          </button>
        ))}
      </div>
      {perguntar.error && <p className="mt-3 text-apoio text-critico">{(perguntar.error as Error).message}</p>}
      {r && (
        <div role="status" className={cn('mt-3.5 flex flex-col gap-2 rounded-controle border px-3.5 py-3', r.entendida ? 'border-fio bg-campo' : 'border-[#FDE68A] bg-[#FFFBEB]')}>
          <span className="text-corpo font-semibold text-tinta">{r.titulo}</span>
          <p className="text-apoio text-pretty text-tinta-apoio">{r.resposta}</p>
          {r.itens.length > 0 && (
            <ul className="flex flex-col divide-y divide-trilha rounded-controle border border-trilha bg-superficie">
              {r.itens.map((it, k) => (
                <li key={k} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-apoio">
                  <span className="font-medium text-tinta">{it.rotulo}</span>
                  <span className="text-tinta-apoio tabular">{it.valor}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-rotulo text-tinta-sussurro">Respondido com os dados da unidade, agora. Nenhum nome de paciente sai daqui.</span>
            {r.link && <Link to={r.link} className="text-apoio font-medium text-acao hover:underline">{ROTULO_LINK[r.link] ?? 'Abrir'}</Link>}
          </div>
        </div>
      )}
    </section>
  )
}

// ── Auditoria de check-in ───────────────────────────────────────────────────
const SITUACAO: Record<string, { rotulo: string; tom: 'ok' | 'atencao' | 'neutro' }> = {
  confere: { rotulo: 'Confere', tom: 'ok' },
  atraso: { rotulo: 'Atraso', tom: 'atencao' },
  fora_do_raio: { rotulo: 'Local divergente', tom: 'atencao' },
  atraso_fora_do_raio: { rotulo: 'Atraso e local divergente', tom: 'atencao' },
  sem_checkin: { rotulo: 'Sem check-in', tom: 'atencao' },
  sem_escala: { rotulo: 'Check-in sem plantão na escala', tom: 'atencao' },
  aguardando: { rotulo: 'Aguardando (na tolerância)', tom: 'neutro' },
  a_comecar: { rotulo: 'A começar', tom: 'neutro' },
}
const FILTROS = ['Todos', 'Divergências', 'Em conformidade'] as const
const TURNO: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', madrugada: 'Madrugada' }

function local(l: LinhaCheckin) {
  if (!l.realizado) return '—'
  if (l.dentro === false) return `Fora do raio${l.distancia_m != null ? ` · ${l.distancia_m.toLocaleString('pt-BR')} m` : ''}`
  if (l.dentro === true) return 'Dentro do raio'
  return 'Sem cerca geográfica'
}

function AuditoriaCheckin({ unidadeId }: { unidadeId: string }) {
  const [filtro, setFiltro] = React.useState<(typeof FILTROS)[number]>('Todos')
  const { data, isLoading, error } = useQuery({
    queryKey: ['auditoria-checkin', unidadeId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('auditoria_checkin', { p_unidade: unidadeId })
      if (error) throw error
      return data ?? []
    },
  })
  const linhas = (data ?? []).filter((l) => filtro === 'Todos' || (filtro === 'Divergências' ? l.divergente : l.situacao === 'confere'))
  const contaveis = (data ?? []).filter((l) => l.situacao !== 'a_comecar')
  const div = contaveis.filter((l) => l.divergente).length

  return (
    <section className="mb-[26px]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex items-center gap-2.5">
          <MapPin className="size-[17px] text-marca" aria-hidden />
          <h2 className="text-secao font-semibold tracking-[-0.01em] text-tinta">Auditoria de check-in</h2>
        </div>
        {data && <span className={cn('text-apoio', div ? 'text-atencao' : 'text-tinta-sussurro')}>{div} de {contaveis.length} com divergência hoje</span>}
      </div>
      <Chips rotulo="Filtrar check-ins">
        {FILTROS.map((f) => <Chip key={f} ativo={filtro === f} onClick={() => setFiltro(f)}>{f}</Chip>)}
      </Chips>
      {error ? (
        <p className="text-apoio text-critico">Falha ao carregar a auditoria: {(error as Error).message}</p>
      ) : isLoading ? (
        <div className="flex h-24 items-center justify-center"><Spinner /></div>
      ) : linhas.length === 0 ? (
        <Vazio icone={MapPin} titulo={data?.length ? 'Nenhum check-in neste filtro' : 'Nenhum plantão na escala de hoje'}
          texto="A auditoria compara a escala do dia com o check-in de cada profissional." />
      ) : (
        <div className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
          <div className="hidden items-center gap-3 border-b border-fio bg-campo px-5 py-[11px] text-rotulo font-semibold tracking-[0.05em] text-tinta-sussurro uppercase md:flex">
            <span className="flex-1">Profissional</span>
            <span className="w-[66px]">Previsto</span>
            <span className="w-[96px]">Realizado</span>
            <span className="w-[196px]">Situação</span>
          </div>
          {linhas.map((l) => {
            const s = SITUACAO[l.situacao] ?? { rotulo: l.situacao, tom: 'neutro' as const }
            return (
              <div key={`${l.plantao_id ?? 'x'}-${l.presenca_id ?? 'y'}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-trilha px-5 py-[13px] last:border-0 hover:bg-campo">
                <div className="flex min-w-[180px] flex-1 flex-col gap-0.5">
                  <span className="text-corpo font-medium text-tinta">{l.nome}</span>
                  <span className="text-apoio text-tinta-sussurro">{[l.setor, TURNO[l.turno] ?? l.turno].filter(Boolean).join(' · ')}</span>
                </div>
                <span className="w-[66px] text-apoio text-tinta-sussurro tabular"><span className="md:hidden">Previsto </span>{hora(l.previsto)}</span>
                <div className="flex w-[96px] flex-col gap-px">
                  <span className={cn('text-corpo font-semibold tabular', l.realizado ? 'text-tinta' : 'text-tinta-sussurro')}>{hora(l.realizado)}</span>
                  {l.diferenca_min != null && (
                    <span className={cn('text-apoio tabular', l.situacao === 'confere' ? 'text-tinta-apoio' : 'text-atencao')}>
                      {l.diferenca_min > 0 ? '+' : l.diferenca_min < 0 ? '−' : ''}{Math.abs(l.diferenca_min)} min
                    </span>
                  )}
                </div>
                <div className="flex w-[196px] flex-col items-start gap-1">
                  <span className={cn('rounded-capsula px-2 py-[3px] text-rotulo leading-[1.3] font-semibold tracking-[0.03em] uppercase',
                    s.tom === 'ok' ? 'bg-conforme/10 text-conforme' : s.tom === 'atencao' ? 'bg-atencao/10 text-atencao' : 'bg-trilha text-tinta-sussurro')}>
                    {s.rotulo}
                  </span>
                  <span className={cn('text-apoio', l.dentro === false ? 'text-atencao' : 'text-tinta-apoio')}>{local(l)}</span>
                  {l.justificativa && <span className="text-rotulo text-pretty text-tinta-sussurro">“{l.justificativa}”</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default function PainelGestor() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  if (!unidadeId) return <div className="flex h-40 items-center justify-center"><Spinner /></div>

  return (
    <div className="mx-auto flex w-full max-w-[896px] flex-col">
      <TituloPagina icone={LayoutDashboard} titulo="Painel do Gestor" descricao={unidadeAtiva?.unidade?.nome} />
      <Panorama unidadeId={unidadeId} />
      <Pergunta unidadeId={unidadeId} />
      <AuditoriaCheckin unidadeId={unidadeId} />
    </div>
  )
}
