import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity,
  BedDouble,
  Bell,
  CalendarClock,
  Eye,
  Hospital,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  Stethoscope,
  Users,
  X,
} from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { PAPEL_LABEL } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { usePlantao } from '@/hooks/usePlantao'
import { useWebPush } from '@/hooks/useWebPush'
import { ForaDoExpediente } from '@/pages/plantonista/ForaDoExpediente'
import { NotificacoesTurnoBanner } from '@/components/plantonista/NotificacoesTurnoBanner'
import { SinoAvisos } from '@/components/plantonista/SinoAvisos'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

type NavItem = {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
  badge?: number
}

export function AppShell() {
  const { signOut, perfil } = useAuth()
  const { ehAdmin, ehGestor, ehPlantonista, unidades, unidadeAtiva, papelAtivo, status } =
    useUnidade()
  const navigate = useNavigate()
  const [menuAberto, setMenuAberto] = React.useState(false)

  // T1: Web Push (base) — ativa notificações do navegador
  useWebPush(papelAtivo === 'plantonista')

  const itens: NavItem[] = []
  if (ehPlantonista) {
    itens.push({ to: '/plantonista', label: 'Central do Plantonista', icon: Stethoscope, end: true })
    itens.push({ to: '/plantao', label: 'Plantão', icon: Activity, end: true })
    itens.push({ to: '/internacao', label: 'Painel de Internação', icon: Hospital, end: true })
    itens.push({ to: '/observacao', label: 'Observação', icon: Eye, end: true })
    itens.push({ to: '/notificacoes', label: 'Avisos', icon: Bell, end: true })
  }
  if (ehGestor) {
    itens.push({ to: '/setores', label: 'Setores e Leitos', icon: BedDouble })
    itens.push({ to: '/escala', label: 'Escala', icon: CalendarClock, end: true })
    itens.push({ to: '/banners', label: 'Imagens da Unidade', icon: Images })
  }
  if (ehAdmin) {
    itens.push(
      { to: '/painel', label: 'Painel', icon: LayoutDashboard, end: true },
      { to: '/pessoas', label: 'Pessoas', icon: Users },
      { to: '/escala', label: 'Escala', icon: CalendarClock, end: true },
      { to: '/banners', label: 'Imagens da Unidade', icon: Images }
    )
  }
  if (ehPlantonista) {
    itens.push({ to: '/escala', label: 'Escala', icon: CalendarClock, end: true })
  }
  if (!ehPlantonista) {
    itens.push({ to: '/plantonista', label: 'Central Clínica', icon: Stethoscope })
  }

  async function handleSair() {
    await signOut()
    navigate('/login', { replace: true })
  }

  // Portão de plantão: plantonista só acessa a plataforma se estiver na escala
  // agora (relógio do servidor) ou com acesso pago.
  const { status: plantaoStatus } = usePlantao(
    papelAtivo === 'plantonista' ? unidadeAtiva?.unidade_id : undefined
  )

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
          {itens.map((item) => (
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
          ))}
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
          <Button variant="ghost" size="sm" onClick={handleSair}>
            <LogOut />
          </Button>
        </div>
      </div>

      {menuAberto && (
        <div className="fixed inset-0 top-14 z-30 bg-background md:hidden">
          <nav className="flex flex-col gap-1 p-3">
            {itens.map((item) => (
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
            ))}
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
              <Outlet />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
