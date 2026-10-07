// ─────────────────────────────────────────────────────────────────────────────
// Setores com mapa de leitos (protótipo, aba Setores da Unidade, P/index.html
// 7446–7520; D11). Em ordem fixa de prioridade: ocupação por setor com o
// limite da unidade (padrão 85%), pacientes por plantonista escalado agora, o que venceu e os
// escores em banda de alerta, e o mapa de leitos. O gestor lê por leito: nome
// de paciente não entra; o leito ocupado abre o prontuário (com registro de
// acesso). Dados de mapa_leitos_gestor (migration 20261007000001).
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Spinner } from '@/components/ui/spinner'

type Leito = {
  id: string; identificador: string; status: string; ocupado: boolean; internacao_id: string | null
  paciente_id: string | null; desde: string | null; vencidas: number; banda: number | null
}
type Setor = { id: string; nome: string; tipo: string; leitos_total: number; leitos_ocupados: number; pacientes: number; sem_leito: number; leitos: Leito[] }
type Plantonista = { perfil_id: string; nome: string; setor: string; ate: string; pacientes: number }
type Alerta = { ordem: number; leito: string; setor: string; paciente_id: string; texto: string; nota: string | null; prazo?: string; selo: string }
type Mapa = { limite: number; setores: Setor[]; plantonistas: Plantonista[]; alertas: Alerta[] }

const SELO = 'shrink-0 whitespace-nowrap rounded-capsula px-2 py-[3px] text-rotulo font-semibold uppercase tracking-[0.03em]'
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

function Cabeca({ titulo, resumo, tom = 'neutro' }: { titulo: string; resumo: string; tom?: 'neutro' | 'atencao' | 'critico' | 'ok' }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 px-1 pb-2">
      <span className="text-rotulo font-semibold tracking-[0.05em] text-grafite uppercase">{titulo}</span>
      <span className={cn('text-apoio', tom === 'atencao' ? 'text-atencao' : tom === 'critico' ? 'text-critico' : tom === 'ok' ? 'text-conforme' : 'text-tinta-sussurro')}>{resumo}</span>
    </div>
  )
}

export function MapaLeitos() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const mapa = useQuery({
    queryKey: ['mapa-leitos-gestor', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('mapa_leitos_gestor', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as Mapa
    },
  })
  if (mapa.isLoading) return <div className="flex justify-center py-6"><Spinner /></div>
  if (mapa.error) return <p className="text-apoio text-critico">{(mapa.error as Error).message}</p>
  const m = mapa.data
  if (!m) return null
  const lim = m.limite
  const taxa = (s: Setor) => (s.leitos_total ? s.leitos_ocupados / s.leitos_total : 0)
  const acima = m.setores.filter((s) => s.leitos_total && taxa(s) >= lim)
  const teto = Math.max(1, ...m.plantonistas.map((p) => p.pacientes))
  const nVenc = m.alertas.filter((a) => a.ordem === 0).length
  const nEsc = m.alertas.length - nVenc

  return (
    <div className="mb-8 flex flex-col gap-6">
      <div>
        <Cabeca titulo="Ocupação por setor" tom={acima.length ? 'atencao' : 'neutro'}
          resumo={acima.length ? `${acima.map((s) => s.nome).join(' e ')} acima do limite de ${Math.round(lim * 100)}%` : `Nenhum setor acima do limite de ${Math.round(lim * 100)}%`} />
        <div className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
          {m.setores.length === 0 && <p className="px-5 py-4 text-apoio text-tinta-sussurro">Nenhum setor de internação ou observação cadastrado.</p>}
          {m.setores.map((s) => {
            const t = taxa(s)
            const cor = t >= 0.95 ? ['text-critico', 'bg-critico'] : t >= lim ? ['text-atencao', 'bg-atencao'] : ['text-conforme', 'bg-conforme']
            const livres = s.leitos_total - s.leitos_ocupados
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-4 border-b border-trilha px-5 py-3 last:border-0">
                <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                  <span className="text-corpo font-medium text-tinta">{s.nome}</span>
                  <span className="text-apoio text-tinta-sussurro">
                    {s.leitos_total ? `${s.leitos_ocupados} de ${s.leitos_total} leitos · ${livres} ${livres === 1 ? 'livre' : 'livres'}` : 'sem leitos cadastrados'}
                    {s.sem_leito ? ` · ${s.sem_leito} ${s.sem_leito === 1 ? 'paciente sem leito' : 'pacientes sem leito'}` : ''}
                  </span>
                </div>
                <div className="flex w-[180px] shrink-0 flex-col items-end gap-1">
                  <span className={cn('text-secao font-semibold tabular-nums tracking-[-0.02em]', cor[0])}>{s.leitos_total ? `${Math.round(t * 100)}%` : '—'}</span>
                  <div className="relative h-[5px] w-full rounded-capsula bg-trilha" aria-hidden>
                    <div className={cn('absolute inset-y-0 left-0 rounded-capsula', cor[1])} style={{ width: `${Math.min(100, Math.round(t * 100))}%` }} />
                    <span className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded-sm bg-tinta/35" style={{ left: `${lim * 100}%` }} />
                  </div>
                  <span className="text-rotulo text-tinta-sussurro">limite {Math.round(lim * 100)}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <Cabeca titulo="Pacientes por plantonista" resumo="Escalados agora nos setores de internação e observação" />
        <div className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
          {m.plantonistas.length === 0 && <p className="px-5 py-4 text-apoio text-tinta-sussurro">Nenhum plantonista escalado agora nesses setores.</p>}
          {m.plantonistas.map((p) => (
            <div key={`${p.perfil_id}-${p.setor}`} className="flex flex-wrap items-center gap-4 border-b border-trilha px-5 py-3 last:border-0">
              <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                <span className="text-corpo font-medium text-tinta">{p.nome}</span>
                <span className="text-apoio text-tinta-sussurro">{p.setor} · até {hora(p.ate)}</span>
              </div>
              <div className="flex w-[180px] shrink-0 flex-col items-end gap-1">
                <span className="text-secao font-semibold tabular-nums text-tinta">{p.pacientes}</span>
                <div className="relative h-[5px] w-full rounded-capsula bg-trilha" aria-hidden>
                  <div className="absolute inset-y-0 left-0 rounded-capsula bg-grafite" style={{ width: `${Math.round((p.pacientes / teto) * 100)}%` }} />
                </div>
                <span className="text-rotulo text-tinta-sussurro">{p.pacientes === 1 ? 'paciente' : 'pacientes'} no setor</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Cabeca titulo="Vencidas e alertas ativos" tom={nVenc ? 'critico' : nEsc ? 'atencao' : 'ok'}
          resumo={m.alertas.length ? `${nVenc} ${nVenc === 1 ? 'pendência vencida' : 'pendências vencidas'} · ${nEsc} ${nEsc === 1 ? 'escore em alerta' : 'escores em alerta'}` : 'Nada vencido agora'} />
        <div className="cc-lista overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
          {m.alertas.length === 0 && (
            <div className="flex items-center gap-2 px-5 py-4 text-apoio text-conforme">
              <ShieldCheck className="size-4" aria-hidden /> Nenhuma pendência vencida e nenhum escore em banda de alerta.
            </div>
          )}
          {m.alertas.map((a, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-3 last:border-0">
              <span className="w-16 shrink-0 text-apoio font-semibold text-acao">{a.leito}</span>
              <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                <span className="text-corpo text-tinta">{a.texto}</span>
                <span className="text-apoio text-tinta-sussurro">{[a.setor, a.nota, a.prazo && `prazo ${hora(a.prazo)}`].filter(Boolean).join(' · ')}</span>
              </div>
              <span className={cn(SELO, a.ordem === 2 ? 'bg-atencao/[0.08] text-atencao' : 'bg-critico/[0.08] text-critico')}>{a.selo}</span>
              <Link to={`/prontuarios/${a.paciente_id}`} className="rounded-controle border border-fio px-3 py-1.5 text-apoio whitespace-nowrap text-tinta-apoio hover:border-marca hover:text-acao">Ver leito</Link>
            </div>
          ))}
        </div>
      </div>

      {m.setores.filter((s) => s.leitos.length).map((s) => (
        <div key={s.id} className="rounded-cartao border border-fio bg-superficie px-5 py-4 shadow-repouso">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-apoio font-semibold text-tinta">Leitos · {s.nome}</span>
            <div className="flex flex-wrap items-center gap-3 text-rotulo text-tinta-sussurro">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-conforme/30" />Livre</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-critico/30" />Ocupado</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-atencao/30" />Reservado</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-trilha" />Bloqueado ou em higienização</span>
              <span>Clique no leito ocupado para abrir o paciente</span>
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
            {s.leitos.map((l) => {
              const cls = cn('grid h-11 place-items-center rounded-[10px] border text-apoio font-medium tabular-nums',
                l.ocupado ? 'border-critico/20 bg-critico/[0.06] text-critico'
                  : l.status === 'livre' ? 'border-conforme/20 bg-conforme/[0.06] text-conforme'
                  : l.status === 'reservado' ? 'border-atencao/30 bg-atencao/[0.08] text-atencao'
                  : 'border-fio bg-trilha text-tinta-sussurro')
              const marca = (l.vencidas > 0 || (l.banda ?? 0) >= 1) && <span className="sr-only"> com alerta</span>
              const titulo = [l.status === 'higienizacao' ? 'em higienização' : l.status, l.vencidas ? `${l.vencidas} vencida(s)` : '', (l.banda ?? 0) >= 1 ? 'escore em alerta' : ''].filter(Boolean).join(' · ')
              return l.paciente_id ? (
                <Link key={l.id} to={`/prontuarios/${l.paciente_id}`} title={titulo} className={cn(cls, 'relative hover:ring-2 hover:ring-critico/30')}>
                  {l.identificador}{marca}
                  {(l.vencidas > 0 || (l.banda ?? 0) >= 1) && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-atencao" aria-hidden />}
                </Link>
              ) : (
                <span key={l.id} title={titulo} className={cls}>{l.identificador}</span>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
