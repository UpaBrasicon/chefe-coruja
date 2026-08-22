import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  Bell,
  Building2,
  CalendarClock,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  MessageSquare,
  ShieldCheck,
  Stethoscope,
  UserRound,
  X,
} from 'lucide-react'
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'

import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { PAPEL_LABEL } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { usePlantao } from '@/hooks/usePlantao'
import { useWebPush } from '@/hooks/useWebPush'
import { useChatRealtimeGlobal, useTotalNaoLidas } from '@/hooks/useChat'
import { ChatDrawer } from '@/components/chat/ChatDrawer'
import { GateCheckIn } from '@/components/GateCheckIn'
import { ForaDoExpediente } from '@/pages/plantonista/ForaDoExpediente'
import { NotificacoesTurnoBanner } from '@/components/plantonista/NotificacoesTurnoBanner'
import { SinoAvisos } from '@/components/plantonista/SinoAvisos'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { ErroBoundary } from '@/components/ErroBoundary'

type NavItem = {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
  badge?: number
  acao?: () => void
}

export function AppShell() {
  const { signOut, perfil } = useAuth()
  const { ehAdmin, ehGestor, ehPlantonista, unidades, unidadeAtiva, papelAtivo, status } =
    useUnidade()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuAberto, setMenuAberto] = React.useState(false)
  const [chatAberto, setChatAberto] = React.useState(false)

  // T1: Web Push (base) — ativa notificações do navegador
  useWebPush(papelAtivo === 'plantonista')

  // Chat: disponível para plantonista e gestor (NÃO para admin)
  const chatHabilitado = papelAtivo === 'plantonista' || papelAtivo === 'gestor'
  useChatRealtimeGlobal()
  const totalNaoLidas = useTotalNaoLidas()

  // Rota antiga /mensagens agora abre o drawer (Mensagens.tsx foi substituído).
  // O estado é derivado do pathname na renderização; o redirect usa um timer
  // (assíncrono) para não chamar setState síncrono dentro de effect.
  const mensagensSolicitadas = location.pathname === '/mensagens' && chatHabilitado
  const chatAbertoEfetivo = chatAberto || mensagensSolicitadas

  React.useEffect(() => {
    if (mensagensSolicitadas) {
      const t = setTimeout(() => {
        setChatAberto(true)
        navigate('/', { replace: true })
      }, 0)
      return () => clearTimeout(t)
    }
  }, [mensagensSolicitadas, navigate])

  // Navegação agrupada: cada item é um destino, e o detalhe vive nas abas
  // internas (com o estado na URL). Ver src/components/TabsPagina.tsx.
  const itens: NavItem[] = []
  if (ehPlantonista) {
    itens.push({ to: '/plantonista', label: 'Central do Plantonista', icon: Stethoscope })
    itens.push({ to: '/plantao', label: 'Plantão', icon: Activity })
    itens.push({ to: '/agenda', label: 'Minha Agenda', icon: CalendarClock, end: true })
    itens.push({ to: '/notificacoes', label: 'Avisos', icon: Bell, end: true })
  }
  if (ehGestor) {
    itens.push({ to: '/escala', label: 'Escala', icon: CalendarClock, end: true })
    itens.push({ to: '/unidade', label: 'Unidade', icon: Building2, end: true })
    itens.push({ to: '/indicadores', label: 'Indicadores', icon: LineChart, end: true })
  }
  if (ehAdmin) {
    itens.push(
      { to: '/painel', label: 'Organização', icon: LayoutDashboard, end: true },
      { to: '/escala', label: 'Escala', icon: CalendarClock, end: true },
      { to: '/gaviao', label: 'Gavião', icon: ShieldCheck, end: true }
    )
  }
  if (itens.length === 0) {
    itens.push({ to: '/plantonista', label: 'Central Clínica', icon: Stethoscope })
  }
  // Gestor e admin na mesma unidade duplicariam "Escala".
  const itensUnicos = itens.filter((item, i) => itens.findIndex((x) => x.to === item.to) === i)

  async function handleSair() {
    await signOut()
    navigate('/login', { replace: true })
  }

  // Portão de plantão: plantonista só acessa a plataforma se estiver na escala
  // agora (relógio do servidor) ou com acesso pago.
  const { status: plantaoStatus } = usePlantao(
    papelAtivo === 'plantonista' ? unidadeAtiva?.unidade_id : undefined
  )

  // Regra de ouro do check-in: plantonista em escala precisa fazer check-in
  // hoje antes de acessar qualquer coisa. O gate verifica a presença ativa;
  // sem ela, bloqueia com o overlay (GateCheckIn). O RPC registrar_checkin
  // revalida a escala no servidor (não confia só no frontend).
  // Sem filtro de data: robusto a fuso — o "ativo" é o último check-in sem
  // check-out (o servidor controla dia/turno via ON CONFLICT).
  const { data: presencaHoje } = useQuery({
    queryKey: ['shell-checkin-ativo', unidadeAtiva?.unidade_id, perfil?.id],
    enabled: papelAtivo === 'plantonista' && !!unidadeAtiva?.unidade_id && !!perfil,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('presenca_plantonista')
        .select('id, checkin_em, checkout_em')
        .eq('unidade_id', unidadeAtiva!.unidade_id)
        .eq('perfil_id', perfil!.id)
        .order('checkin_em', { ascending: false })
        .maybeSingle()
      if (error) throw error
      return data as { id: string; checkin_em: string | null; checkout_em: string | null } | null
    },
    refetchInterval: 30_000,
  })

  const checkinPendente =
    papelAtivo === 'plantonista' &&
    (plantaoStatus === 'escala' || plantaoStatus === 'acesso') &&
    !(presencaHoje && presencaHoje.checkin_em && !presencaHoje.checkout_em)

  if (papelAtivo === 'plantonista') {
    if (plantaoStatus === 'carregando') {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Spinner />
        </div>
      )
    }
    if (plantaoStatus === 'fora') {
      return <ForaDoExpediente />
    }
  }

  // Gate obrigatório: bloqueia TODO o sistema até o check-in de hoje.
  if (checkinPendente) {
    return <GateCheckIn />
  }

  const barraTopo = (
    <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
      {unidadeAtiva && status === 'ok' ? (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{unidadeAtiva.unidade.nome}</span>
          <span className="text-xs text-muted-foreground">
            {papelAtivo ? PAPEL_LABEL[papelAtivo] : ''}
          </span>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">Chefe Coruja</span>
      )}
      <div className="flex items-center gap-1">
        {unidades.length > 1 && (
          <Button variant="outline" size="sm" onClick={() => navigate('/seletor')}>
            Trocar unidade
          </Button>
        )}
        {ehPlantonista && <SinoAvisos unidadeId={unidadeAtiva?.unidade_id} habilitado />}
        {chatHabilitado && (
          <Button variant="ghost" size="sm" onClick={() => setChatAberto(true)} aria-label="Abrir chat">
            <MessageSquare />
            {totalNaoLidas > 0 && (
              <Badge variant="destructive" className="ml-0.5">
                {totalNaoLidas}
              </Badge>
            )}
          </Button>
        )}
        <NavLink to="/perfil" aria-label="Meu perfil">
          <span className="flex size-8 items-center justify-center overflow-hidden rounded-full border bg-muted transition-transform hover:scale-105">
            {perfil?.foto_url ? (
              <img src={perfil.foto_url} alt={perfil.nome_completo ?? 'Avatar'} className="h-full w-full object-cover" />
            ) : (
              <UserRound className="size-4 text-muted-foreground" />
            )}
          </span>
        </NavLink>
        <Button variant="ghost" size="sm" onClick={handleSair}>
          <LogOut />
          Sair
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-14 items-center gap-2.5 border-b px-4">
          <span className="flex size-6 items-center justify-center rounded-lg bg-primary text-[11px] font-bold text-primary-foreground">
            CC
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Chefe Coruja</span>
          {ehAdmin && <Badge variant="secondary">Admin</Badge>}
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {itensUnicos.map((item) =>
            item.acao ? (
              <button
                key={item.to}
                type="button"
                onClick={item.acao}
                className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <item.icon className="size-4 transition-colors group-hover:text-foreground" />
                {item.label}
                {item.badge ? (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )
                }
              >
                <item.icon
                  className={cn(
                    'size-4 transition-colors',
                    'group-hover:text-foreground'
                  )}
                />
                {item.label}
                {item.badge ? (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            )
          )}
        </nav>
        <div className="border-t p-3">
          <div className="mb-1 truncate text-sm font-medium">{perfil?.nome_completo}</div>
          <div className="truncate text-xs text-muted-foreground">{perfil?.email}</div>
        </div>
      </aside>

      {/* Mobile */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b bg-background px-4 py-3 md:hidden">
        <button
          aria-label="Abrir menu"
          className="rounded-md p-1"
          onClick={() => setMenuAberto((v) => !v)}
        >
          {menuAberto ? <X /> : <Menu />}
        </button>
        <span className="text-sm font-medium">
          {unidadeAtiva?.unidade.nome ?? 'Chefe Coruja'}
        </span>
        <div className="flex items-center gap-1">
          {ehPlantonista && <SinoAvisos unidadeId={unidadeAtiva?.unidade_id} habilitado />}
          {chatHabilitado && (
            <Button variant="ghost" size="sm" onClick={() => setChatAberto(true)} aria-label="Abrir chat">
              <MessageSquare />
              {totalNaoLidas > 0 && (
                <Badge variant="destructive" className="ml-0.5">
                  {totalNaoLidas}
                </Badge>
              )}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleSair}>
            <LogOut />
          </Button>
        </div>
      </div>

      {menuAberto && (
        <div className="fixed inset-0 top-14 z-30 bg-background md:hidden">
          <nav className="flex flex-col gap-1 p-3">
            {itensUnicos.map((item) =>
              item.acao ? (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => {
                    setMenuAberto(false)
                    item.acao?.()
                  }}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground"
                >
                  <item.icon className="size-4" />
                  {item.label}
                  {item.badge ? (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuAberto(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
                      isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                    )
                  }
                >
                  <item.icon className="size-4" />
                  {item.label}
                  {item.badge ? (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              )
            )}
            {unidades.length > 1 && (
              <button
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground"
                onClick={() => {
                  setMenuAberto(false)
                  navigate('/seletor')
                }}
              >
                Trocar unidade
              </button>
            )}
          </nav>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {status === 'ok' && <div className="hidden md:block">{barraTopo}</div>}
        <NotificacoesTurnoBanner
          unidadeId={papelAtivo === 'plantonista' ? unidadeAtiva?.unidade_id : undefined}
          habilitado={papelAtivo === 'plantonista'}
        />
        <main className="flex-1 px-4 py-6 md:px-8">
          <div className="mx-auto w-full max-w-6xl">
            {status === 'carregando' ? (
              <div className="flex h-40 items-center justify-center">
                <Spinner />
              </div>
            ) : (
              // key = rota: um erro em uma tela não contamina a próxima, e o
              // shell (menu, chat, avisos) continua de pé.
              <ErroBoundary key={location.pathname}>
                <React.Suspense
                  fallback={
                    <div className="flex h-40 items-center justify-center">
                      <Spinner />
                    </div>
                  }
                >
                  <Outlet />
                </React.Suspense>
              </ErroBoundary>
            )}
          </div>
        </main>
      </div>

      {chatHabilitado && (
        <ChatDrawer aberto={chatAbertoEfetivo} onFechar={() => setChatAberto(false)} />
      )}
    </div>
  )
}
