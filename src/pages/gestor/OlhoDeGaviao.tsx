import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bird, CalendarClock, ClipboardList, Clock, Hourglass, MapPin, Minus, ShieldCheck, Stethoscope, TriangleAlert, TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import * as React from 'react'

import { Chip, Chips, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Spinner } from '@/components/ui/spinner'
import { useDesfazer } from '@/contexts/DesfazerContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

import { useLimitesUnidade } from './limites'

// Olho de Gavião do gestor (P/index.html 7023–7117): os apontamentos da
// varredura da unidade (sobrecarga, descanso, presença, documentação,
// operação e os alertas do Sentinela), cada um com evidência e recomendação,
// e a decisão do gestor — tratado, silenciar 7 dias, não procede (com motivo)
// — que fica no registro com autor, hora e motivo. As regras estão na
// migration 20261006000002; os limites (sobrecarga, descanso mínimo opcional,
// ocupação) são da unidade desde a 20261012000001.

type Apontamento = Database['public']['Functions']['gaviao_apontamentos']['Returns'][number]
type Registro = Database['public']['Functions']['gaviao_registro']['Returns'][number]
type Decisao = 'tratado' | 'silenciado' | 'descartado'

const MOTIVOS = [
  'A escala já foi refeita',
  'O plantonista trocou de setor',
  'O limite não se aplica a este vínculo',
  'Apontamento duplicado',
  'Erro de dado na varredura',
]

const ICONE: Record<string, LucideIcon> = {
  stethoscope: Stethoscope, clock: Clock, 'map-pin': MapPin, 'alert-triangle': TriangleAlert,
  'clipboard-list': ClipboardList, 'trending-up': TrendingUp, hourglass: Hourglass, 'calendar-clock': CalendarClock,
}
const SEV = {
  alta: { rotulo: 'Alta', cor: 'text-critico', fundo: 'bg-critico/[0.08]' },
  media: { rotulo: 'Média', cor: 'text-atencao', fundo: 'bg-atencao/[0.08]' },
  baixa: { rotulo: 'Baixa', cor: 'text-tinta-apoio', fundo: 'bg-trilha' },
} as const
const DECISAO: Record<Decisao, { rotulo: string; cor: string; icone: LucideIcon }> = {
  tratado: { rotulo: 'Tratado', cor: 'text-conforme', icone: ShieldCheck },
  silenciado: { rotulo: 'Silenciado por 7 dias', cor: 'text-tinta-apoio', icone: Clock },
  descartado: { rotulo: 'Não procede', cor: 'text-atencao', icone: Minus },
}
const FILTROS_REG = ['Todas', 'Tratadas', 'Silenciadas', 'Descartadas'] as const

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·')
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })

function Cartao({ a, pedindo, onPedir, onDecidir, ocupado }: {
  a: Apontamento; pedindo: boolean; onPedir: (v: boolean) => void; onDecidir: (d: Decisao, motivo?: string) => void; ocupado: boolean
}) {
  const sev = SEV[a.severidade as keyof typeof SEV] ?? SEV.baixa
  const Icone = ICONE[a.icone] ?? TriangleAlert
  const dec = a.decisao ? DECISAO[a.decisao as Decisao] : null
  return (
    <article className={cn('flex gap-[13px] rounded-cartao border border-fio px-5 py-[17px] shadow-repouso', dec ? 'bg-campo' : 'bg-superficie')}>
      <span className={cn('grid size-[34px] shrink-0 place-items-center rounded-controle', dec ? 'bg-trilha text-tinta-sussurro' : cn(sev.fundo, sev.cor))} aria-hidden>
        <Icone className="size-[17px]" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-capsula px-[7px] py-0.5 text-rotulo font-semibold tracking-[0.04em] uppercase', dec ? 'bg-trilha text-tinta-sussurro' : cn(sev.fundo, sev.cor))}>
            {sev.rotulo}
          </span>
          <span className="text-rotulo font-semibold tracking-[0.04em] text-tinta-sussurro uppercase">{a.tipo}</span>
        </div>
        <h3 className="text-corpo leading-[1.3] font-semibold tracking-[-0.01em] text-tinta">{a.titulo}</h3>
        <p className="text-apoio leading-[1.5] text-pretty text-tinta-apoio">{a.evidencia}</p>
        <div className="flex items-start gap-[7px] rounded-controle border border-fio bg-campo px-3 py-2.5">
          <ShieldCheck className="mt-px size-[15px] shrink-0 text-marca" aria-hidden />
          <span className="text-apoio leading-[1.45] text-pretty text-grafite">{a.recomendacao}</span>
        </div>
        {dec ? (
          <div className="mt-[3px] flex flex-col gap-[3px]">
            <span className={cn('flex items-center gap-[7px] text-apoio font-medium', dec.cor)}>
              <dec.icone className="size-3.5" aria-hidden />
              {dec.rotulo} · {quando(a.decidido_em!)}
              {a.decisao === 'silenciado' && a.silenciado_ate && ` · volta em ${dia(a.silenciado_ate)}`}
            </span>
            <span className="text-apoio text-tinta-sussurro">{a.motivo ? `${a.motivo} · ${a.decidido_por}` : `Registrado por ${a.decidido_por}`}</span>
          </div>
        ) : pedindo ? (
          <div className="mt-[3px] flex flex-col gap-2 rounded-container border border-fio bg-campo px-[15px] py-[13px]">
            <span className="text-apoio font-medium text-grafite">Por que não procede?</span>
            <div className="flex flex-wrap gap-[7px]">
              {MOTIVOS.map((m) => (
                <button key={m} type="button" disabled={ocupado} onClick={() => onDecidir('descartado', m)}
                  className="rounded-capsula border border-fio bg-superficie px-[13px] py-1.5 text-apoio text-tinta-apoio hover:border-fio-forte hover:text-tinta disabled:opacity-60">
                  {m}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => onPedir(false)} className="self-start text-apoio text-tinta-sussurro hover:text-tinta">Cancelar</button>
          </div>
        ) : (
          <div className="mt-[3px] flex flex-wrap items-center gap-2">
            <button type="button" disabled={ocupado} onClick={() => onDecidir('tratado')}
              className="flex items-center gap-1.5 rounded-[9px] bg-acao px-[13px] py-[7px] text-apoio font-medium text-white hover:bg-acao-pressionada disabled:opacity-60">
              <ShieldCheck className="size-3.5" aria-hidden /> Tratado
            </button>
            <button type="button" disabled={ocupado} onClick={() => onDecidir('silenciado')}
              className="rounded-[9px] border border-fio bg-superficie px-[13px] py-[7px] text-apoio text-tinta-apoio hover:border-fio-forte disabled:opacity-60">
              Silenciar 7 dias
            </button>
            <button type="button" disabled={ocupado} onClick={() => onPedir(true)}
              className="rounded-[9px] border border-fio bg-superficie px-[13px] py-[7px] text-apoio text-tinta-apoio hover:border-fio-forte disabled:opacity-60">
              Não procede
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

export default function OlhoDeGaviao() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const qc = useQueryClient()
  const { fazer } = useDesfazer()
  const [pedindo, setPedindo] = React.useState<string | null>(null)
  const [filtro, setFiltro] = React.useState<(typeof FILTROS_REG)[number]>('Todas')
  const [erro, setErro] = React.useState<string | null>(null)

  const ap = useQuery({
    queryKey: ['gaviao-apontamentos', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('gaviao_apontamentos', { p_unidade: unidadeId! })
      if (error) throw error
      return { lista: data ?? [], em: new Date().toISOString() }
    },
  })
  const reg = useQuery({
    queryKey: ['gaviao-registro', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('gaviao_registro', { p_unidade: unidadeId! })
      if (error) throw error
      return data ?? []
    },
  })
  // limites da unidade (Unidade › Configurações): o descanso só é apontado se a unidade o exige
  const { limites } = useLimitesUnidade(unidadeId)
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['gaviao-apontamentos', unidadeId] })
    void qc.invalidateQueries({ queryKey: ['gaviao-registro', unidadeId] })
  }

  const decidir = useMutation({
    mutationFn: async ({ a, d, motivo }: { a: Apontamento; d: Decisao; motivo?: string }) => {
      const { data, error } = await supabase.rpc('decidir_apontamento_gaviao', {
        p_unidade: unidadeId!, p_chave: a.chave, p_decisao: d, p_motivo: motivo,
      })
      if (error) throw error
      return { id: data, a, d }
    },
    onMutate: () => setErro(null),
    onSuccess: ({ id, a, d }) => {
      setPedindo(null)
      recarregar()
      fazer(`Apontamento ${DECISAO[d].rotulo.toLowerCase()}: ${a.titulo}`, async () => {
        const { error } = await supabase.rpc('desfazer_decisao_gaviao', { p_id: id })
        if (error) throw error
        recarregar()
      })
    },
    onError: (e) => setErro((e as Error).message),
  })

  if (!unidadeId || ap.isLoading) return <div className="flex h-40 items-center justify-center"><Spinner /></div>
  if (ap.error) return <p className="text-apoio text-critico">Falha ao carregar o Olho de Gavião: {(ap.error as Error).message}</p>

  const lista = ap.data?.lista ?? []
  const abertos = lista.filter((a) => !a.decisao)
  const cont = (s: string) => abertos.filter((a) => a.severidade === s).length
  const registro = (reg.data ?? []).filter((r: Registro) =>
    filtro === 'Todas' || (filtro === 'Tratadas' ? r.decisao === 'tratado' : filtro === 'Silenciadas' ? r.decisao === 'silenciado' : r.decisao === 'descartado'))
  const varredura = ap.data ? new Date(ap.data.em).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div className="mx-auto flex w-full max-w-[896px] flex-col">
      <TituloPagina
        icone={Bird}
        titulo="Olho de Gavião"
        descricao={`Alertas de escala, carga horária e presença na unidade · varredura às ${varredura} · ${abertos.length === 1 ? '1 apontamento aberto' : `${abertos.length} apontamentos abertos`}`}
        acoes={
          <span className="flex items-center gap-1.5 rounded-capsula bg-marca/10 px-2 py-[3px] text-rotulo font-semibold tracking-[0.04em] text-acao uppercase">
            <span className="size-1.5 rounded-full bg-marca" aria-hidden /> Varredura ativa
          </span>
        }
      />

      <div className="mb-5 flex flex-wrap overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
        {(['alta', 'media', 'baixa'] as const).map((s, k) => (
          <div key={s} className={cn('flex min-w-[120px] flex-1 flex-col gap-0.5 px-5 py-[15px]', k > 0 && 'border-l border-trilha')}>
            <span className="text-rotulo font-semibold tracking-[0.06em] text-tinta-sussurro uppercase">Severidade {SEV[s].rotulo}</span>
            <span className={cn('text-titulo font-semibold tabular', SEV[s].cor)}>{cont(s)}</span>
          </div>
        ))}
      </div>

      {erro && <p role="alert" className="mb-3 text-apoio text-critico">{erro}</p>}

      {lista.length === 0 ? (
        <Vazio icone={ShieldCheck} titulo="Nenhum apontamento agora"
          texto={`A varredura não encontrou sobrecarga (mais de ${limites.sobrecarga_horas} h em 7 dias)${limites.descanso_ativo ? `, descanso menor que ${limites.descanso_horas} h` : ''}, falha de presença, evolução em atraso nem setor acima de ${limites.ocupacao_pct}% de ocupação.`} />
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map((a) => (
            <Cartao key={a.chave} a={a} pedindo={pedindo === a.chave} ocupado={decidir.isPending}
              onPedir={(v) => setPedindo(v ? a.chave : null)}
              onDecidir={(d, motivo) => decidir.mutate({ a, d, motivo })} />
          ))}
        </div>
      )}

      <div className="mt-9 mb-1 flex flex-wrap items-baseline gap-3">
        <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-tinta">Registro das decisões</h2>
        <span className="text-apoio text-tinta-sussurro">{registro.length === 1 ? '1 decisão' : `${registro.length} decisões`}</span>
      </div>
      <p className="mb-3.5 text-apoio text-pretty text-tinta-sussurro">Toda decisão sobre um apontamento fica aqui, com autor, hora e motivo. A desfeita continua no registro, marcada.</p>
      <Chips rotulo="Filtrar decisões">
        {FILTROS_REG.map((f) => <Chip key={f} ativo={filtro === f} onClick={() => setFiltro(f)}>{f}</Chip>)}
      </Chips>
      <div className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
        {registro.length === 0 ? (
          <div className="px-[18px] py-[26px] text-center text-apoio text-tinta-sussurro">Nenhuma decisão com esse filtro.</div>
        ) : registro.map((r, i) => {
          const d = DECISAO[r.decisao as Decisao]
          return (
            <div key={r.id} className={cn('grid grid-cols-1 items-start gap-x-3.5 gap-y-1 px-[18px] py-[13px] sm:grid-cols-[132px_1fr_168px]', i > 0 && 'border-t border-trilha', r.desfeita_em && 'opacity-60')}>
              <span className="text-apoio text-tinta-sussurro tabular">{quando(r.criado_em)}</span>
              <div className="flex min-w-0 flex-col gap-[3px]">
                <span className={cn('text-[14px] leading-[1.35] font-medium text-pretty text-tinta', r.desfeita_em && 'line-through')}>{r.titulo}</span>
                {r.motivo && <span className="text-apoio leading-[1.4] text-pretty text-tinta-sussurro">{r.motivo}</span>}
                <span className="text-apoio text-tinta-sussurro">
                  {r.meu ? 'Você' : r.autor_nome}{r.desfeita_em ? ` · desfeita às ${quando(r.desfeita_em)}` : ''}
                </span>
              </div>
              <span className={cn('justify-self-start rounded-capsula px-2 py-[3px] text-rotulo leading-[1.3] font-semibold tracking-[0.03em] whitespace-nowrap uppercase sm:justify-self-end',
                d?.cor, r.decisao === 'tratado' ? 'bg-conforme/10' : r.decisao === 'descartado' ? 'bg-atencao/10' : 'bg-trilha')}>
                {d?.rotulo ?? r.decisao}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
