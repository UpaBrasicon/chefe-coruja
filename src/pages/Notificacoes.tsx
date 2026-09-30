import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CalendarClock, Clock, MessageSquare, ShieldCheck, TriangleAlert, Users, type LucideIcon } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { itensDeNavegacao } from '@/components/casca/navegacao'
import { Chip, Chips, TituloPagina } from '@/components/monitor/Pagina'
import { Spinner } from '@/components/ui/spinner'
import { useDesfazer } from '@/contexts/DesfazerContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { MinhaNotificacao } from '@/types/database'

// Avisos (P/index.html 9561–9598): filtros por categoria, "Marcar como lido"
// por aviso e "Marcar todas como lidas", com desfazer que volta no servidor
// (marcar_avisos_lidos / reabrir_avisos). A categoria sai do tipo do aviso.

type Categoria = 'Turno' | 'Observação' | 'Escala' | 'Candidatura' | 'Mensagem' | 'Outros'

function categoria(tipo: string): Categoria {
  if (/^(noite|manha|tarde|turno)_/.test(tipo)) return 'Turno'
  if (tipo.startsWith('obs_')) return 'Observação'
  if (tipo.startsWith('solic_') || tipo.startsWith('vaga_')) return 'Escala'
  if (tipo.startsWith('cand_')) return 'Candidatura'
  if (tipo.startsWith('chat_')) return 'Mensagem'
  return 'Outros'
}

const VISUAL: Record<Categoria, { icone: LucideIcon; cor: string; acao?: { to: string; rotulo: string } }> = {
  Turno: { icone: Clock, cor: 'text-marca bg-marca/10', acao: { to: '/plantao', rotulo: 'Abrir Plantão' } },
  Observação: { icone: TriangleAlert, cor: 'text-atencao bg-atencao/10', acao: { to: '/observacao', rotulo: 'Abrir Observação' } },
  Escala: { icone: CalendarClock, cor: 'text-tinta-apoio bg-trilha', acao: { to: '/agenda', rotulo: 'Ver escala' } },
  Candidatura: { icone: Users, cor: 'text-tinta-apoio bg-trilha', acao: { to: '/agenda', rotulo: 'Ver vagas' } },
  Mensagem: { icone: MessageSquare, cor: 'text-tinta-apoio bg-trilha' },
  Outros: { icone: Bell, cor: 'text-tinta-apoio bg-trilha' },
}
const FILTROS = ['Todos', 'Não lidos', 'Turno', 'Observação', 'Escala', 'Candidatura'] as const

function haQuanto(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  if (h < 48) return 'ontem'
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
}

export default function Notificacoes() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const qc = useQueryClient()
  const { fazer } = useDesfazer()
  const [filtro, setFiltro] = React.useState<string>('Todos')
  const chave = ['minhas-notificacoes', unidadeId]

  const { data: notificacoes, isLoading } = useQuery({
    queryKey: chave,
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('minhas_notificacoes', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as MinhaNotificacao[]
    },
    refetchInterval: 60_000,
  })
  const recarregar = () => void qc.invalidateQueries({ queryKey: chave })

  const marcar = useMutation({
    mutationFn: async (ids: string[] | null) => {
      const { data, error } = await supabase.rpc('marcar_avisos_lidos', { p_unidade: unidadeId!, p_ids: ids ?? undefined })
      if (error) throw error
      return data ?? []
    },
    onSuccess: (ids) => {
      recarregar()
      if (!ids.length) return
      fazer(ids.length === 1 ? 'Aviso marcado como lido' : `${ids.length} avisos marcados como lidos`, async () => {
        const { error } = await supabase.rpc('reabrir_avisos', { p_ids: ids })
        if (error) throw error
        recarregar()
      })
    },
  })

  const rotas = new Set(itensDeNavegacao(papelAtivo).map((i) => i.to))
  const todos = notificacoes ?? []
  const categorias = new Set(todos.map((n) => categoria(n.tipo)))
  const filtros = [...FILTROS, ...(categorias.has('Mensagem') ? ['Mensagem'] : []), ...(categorias.has('Outros') ? ['Outros'] : [])]
  const lista = todos.filter((n) => filtro === 'Todos' || (filtro === 'Não lidos' ? !n.lida : categoria(n.tipo) === filtro))
  const naoLidos = todos.filter((n) => !n.lida).length

  return (
    <div className="mx-auto flex w-full max-w-[896px] flex-col">
      <TituloPagina
        icone={Bell}
        titulo="Avisos"
        descricao={naoLidos ? `${naoLidos} não ${naoLidos === 1 ? 'lido' : 'lidos'}` : 'Tudo lido'}
        acoes={
          <button type="button" disabled={!naoLidos || marcar.isPending} onClick={() => marcar.mutate(null)}
            className="flex items-center gap-[7px] rounded-controle border border-fio bg-superficie px-[13px] py-2 text-apoio text-tinta-apoio hover:border-marca hover:text-acao disabled:opacity-60">
            <ShieldCheck className="size-[15px]" aria-hidden /> Marcar todas como lidas
          </button>
        }
      />
      <Chips rotulo="Filtrar avisos">
        {filtros.map((f) => <Chip key={f} ativo={filtro === f} onClick={() => setFiltro(f)}>{f}</Chip>)}
      </Chips>
      {marcar.error && <p role="alert" className="mb-3 text-apoio text-critico">{(marcar.error as Error).message}</p>}

      <div className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
        {isLoading ? (
          <div className="flex h-24 items-center justify-center"><Spinner /></div>
        ) : lista.length === 0 ? (
          <div className="px-5 py-[26px] text-center text-apoio text-tinta-sussurro">Nenhum aviso nesse filtro.</div>
        ) : lista.map((n) => {
          const cat = categoria(n.tipo)
          const v = VISUAL[cat]
          const acao = v.acao && rotas.has(v.acao.to) ? v.acao : null
          return (
            <div key={n.id} className={cn('flex items-start gap-[13px] border-b border-trilha px-5 py-[15px] last:border-0', !n.lida && 'bg-marca/[0.04]')}>
              <span className={cn('mt-[7px] size-[7px] shrink-0 rounded-full', n.lida ? 'bg-transparent' : 'bg-marca')} aria-hidden />
              <span className={cn('grid size-[34px] shrink-0 place-items-center rounded-controle', v.cor)} aria-hidden>
                <v.icone className="size-[17px]" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-rotulo font-semibold tracking-[0.04em] text-tinta-sussurro uppercase">{cat}</span>
                <span className={cn('text-corpo text-pretty text-tinta', n.lida ? 'font-normal' : 'font-semibold')}>{n.mensagem}</span>
                {(acao || !n.lida) && (
                  <div className="mt-0.5 flex flex-wrap items-center gap-3.5">
                    {acao && (
                      <Link to={acao.to} onClick={() => { if (!n.lida) marcar.mutate([n.id]) }} className="text-apoio font-medium text-acao hover:underline">
                        {acao.rotulo}
                      </Link>
                    )}
                    {!n.lida && (
                      <button type="button" disabled={marcar.isPending} onClick={() => marcar.mutate([n.id])}
                        className="text-apoio text-tinta-sussurro hover:text-tinta-apoio">
                        Marcar como lido
                      </button>
                    )}
                  </div>
                )}
              </div>
              <span className="shrink-0 text-apoio whitespace-nowrap text-tinta-sussurro" title={new Date(n.created_at).toLocaleString('pt-BR')}>
                {haQuanto(n.created_at)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
