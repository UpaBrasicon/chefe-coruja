import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Activity, LogOut, MessageSquare, Rows3, Search, UserRound } from 'lucide-react'
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'

import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { PAPEIS_POR_ESCALA, PAPEL_LABEL } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { DesfazerProvider } from '@/contexts/DesfazerContext'
import { usePlantao } from '@/hooks/usePlantao'
import { useFilaOffline } from '@/hooks/useFilaOffline'
import { useWebPush } from '@/hooks/useWebPush'
import { useChatRealtimeGlobal, useTotalNaoLidas } from '@/hooks/useChat'
import { ChatDrawer } from '@/components/chat/ChatDrawer'
import { ForaDoExpediente } from '@/pages/plantonista/ForaDoExpediente'
import { NotificacoesTurnoBanner } from '@/components/plantonista/NotificacoesTurnoBanner'
import { SinoAvisos } from '@/components/plantonista/SinoAvisos'
import { Spinner } from '@/components/ui/spinner'
import { ErroBoundary } from '@/components/ErroBoundary'
import { itensDeNavegacao, type ItemNav } from '@/components/casca/navegacao'
import { useMeuPapelTecnico } from '@/hooks/useFerramentaClinica'
import { Paleta } from '@/components/casca/Paleta'
import { usePaleta } from '@/components/casca/usePaleta'
import { PortaoSegundoFator } from '@/components/seguranca/SegundoFator'
import { useSegundoFator } from '@/hooks/useSegundoFator'

// A casca do Monitor de Cabeceira (design_handoff/telas/09-comum-casca.md):
// sidebar branca de 248px, topbar de 60px imóvel, coluna de conteúdo de 896px;
// abaixo de 768px a navegação vira barra fixa inferior. Densidade compacta,
// paleta Ctrl+K, fita "sem sinal" e régua de desfazer são globais.

const CHAVE_DENSIDADE = 'chefe-coruja:densidade'

function useDensidade() {
  const [compacto, setCompacto] = React.useState(() => {
    try {
      return window.localStorage.getItem(CHAVE_DENSIDADE) === 'compacta'
    } catch {
      return false
    }
  })
  const alternar = React.useCallback(() => {
    setCompacto((v) => {
      try {
        window.localStorage.setItem(CHAVE_DENSIDADE, v ? 'normal' : 'compacta')
      } catch {
        /* storage indisponível: a densidade vale só nesta sessão */
      }
      return !v
    })
  }, [])
  return { compacto, alternar }
}

/** Sem conexão: a fita vale para todos os papéis, inclusive o gestor. */
function useConectado() {
  const [online, setOnline] = React.useState(() => navigator.onLine)
  React.useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

function Marca({ papel }: { papel?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-controle-sm bg-marca text-[11px] font-semibold text-white" aria-hidden>
        CC
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-corpo font-semibold tracking-[-0.01em] text-tinta">Chefe Coruja</span>
        {papel && <span className="truncate text-rotulo text-tinta-sussurro">{papel}</span>}
      </span>
    </span>
  )
}

function ItemLateral({ item }: { item: ItemNav }) {
  const Icone = item.icone
  return (
    <NavLink
      to={item.to}
      end={item.exato}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-controle px-3 py-[9px] text-corpo transition-colors',
          isActive ? 'bg-marca/10 font-semibold text-acao' : 'text-tinta-apoio hover:bg-campo hover:text-tinta',
        )
      }
    >
      <Icone className="size-[17px] shrink-0" aria-hidden />
      <span className="truncate">{item.rotulo}</span>
    </NavLink>
  )
}

function ItemInferior({ item }: { item: ItemNav }) {
  const Icone = item.icone
  return (
    <NavLink
      to={item.to}
      end={item.exato}
      className={({ isActive }) =>
        cn(
          'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-container px-1 text-rotulo transition-colors',
          isActive ? 'bg-marca/10 font-semibold text-acao' : 'text-tinta-apoio',
        )
      }
    >
      <Icone className="size-5" aria-hidden />
      <span className="truncate">{item.curto ?? item.rotulo}</span>
    </NavLink>
  )
}

function BotaoTopo({ rotulo, icone: Icone, onClick, children, ativo }: {
  rotulo: string
  icone: React.ComponentType<{ className?: string }>
  onClick: () => void
  children?: React.ReactNode
  ativo?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      aria-pressed={ativo}
      className={cn(
        'relative inline-flex min-h-8 items-center gap-1.5 rounded-controle border border-transparent px-2.5 text-apoio transition-colors hover:text-acao',
        ativo ? 'text-acao' : 'text-tinta-apoio',
      )}
    >
      <Icone className="size-4" />
      {children}
    </button>
  )
}

export function AppShell() {
  const { signOut, perfil } = useAuth()
  const { unidades, unidadeAtiva, papelAtivo, papeisDaUnidade, status } = useUnidade()
  const navigate = useNavigate()
  const location = useLocation()
  const [chatAberto, setChatAberto] = React.useState(false)
  const { compacto, alternar: alternarDensidade } = useDensidade()
  const online = useConectado()
  const paleta = usePaleta()
  const segundoFator = useSegundoFator()

  // Web Push — só o plantonista recebe avisos de turno no aparelho.
  useWebPush(papelAtivo === 'plantonista')

  // Chat: plantonista e gestor. Administrador não tem chat.
  const chatHabilitado = papelAtivo === 'plantonista' || papelAtivo === 'gestor'
  useChatRealtimeGlobal()
  const totalNaoLidas = useTotalNaoLidas()

  // Rota antiga /mensagens abre o drawer do chat.
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

  const { data: papelTecnico } = useMeuPapelTecnico()
  const ehRt = !!papelTecnico?.some((p) => p.tipo === 'medico')
  const itens = React.useMemo(() => itensDeNavegacao(papeisDaUnidade, ehRt), [papeisDaUnidade, ehRt])
  const ehPlantonista = papeisDaUnidade.includes('plantonista')
  const ehAdmin = papeisDaUnidade.includes('admin')

  async function handleSair() {
    await signOut()
    navigate('/login', { replace: true })
  }

  // A escala é a porta (ADR 0003): o plantonista só entra se estiver na escala
  // agora, pelo relógio do servidor. Sem conexão, segue quem já estava em
  // plantão neste aparelho, nos limites do ADR 0009.
  // Vale para todo papel assistencial: recepção, técnico, enfermeiro,
  // plantonista e telemedicina. Farmacêutico, gestor e admin não entram por escala.
  const entraPorEscala = !!papelAtivo && PAPEIS_POR_ESCALA.includes(papelAtivo)
  const { status: plantaoStatus } = usePlantao(entraPorEscala ? unidadeAtiva?.unidade_id : undefined)
  const fila = useFilaOffline()

  // Lembrete de check-in (a trava foi adiada em 23/08). O último check-in sem
  // check-out é o ativo; `limit(1)` evita o erro do maybeSingle com dois ou
  // mais registros, que deixava o lembrete aceso para sempre.
  const { data: presencaAtiva } = useQuery({
    queryKey: ['shell-checkin-ativo', unidadeAtiva?.unidade_id, perfil?.id],
    enabled: papelAtivo === 'plantonista' && !!unidadeAtiva?.unidade_id && !!perfil,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('presenca_plantonista')
        .select('id, checkin_em, checkout_em')
        .eq('unidade_id', unidadeAtiva!.unidade_id)
        .eq('perfil_id', perfil!.id)
        .order('checkin_em', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as { id: string; checkin_em: string | null; checkout_em: string | null } | null
    },
    refetchInterval: 30_000,
  })

  const checkinPendente =
    papelAtivo === 'plantonista' &&
    (plantaoStatus === 'escala' || plantaoStatus === 'acesso') &&
    !(presencaAtiva && presencaAtiva.checkin_em && !presencaAtiva.checkout_em)

  // Segundo fator (ADR 0010): com a exigência ligada, nada da casca aparece
  // antes do código — dado de paciente só com aal2 confirmado nas últimas 24 h.
  if (segundoFator.data?.exigido && !segundoFator.data.valido) {
    return <PortaoSegundoFator fatorId={segundoFator.data.fatorId} onSair={handleSair} />
  }

  if (entraPorEscala) {
    if (plantaoStatus === 'carregando') {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Spinner />
        </div>
      )
    }
    if (plantaoStatus === 'fora') return <ForaDoExpediente />
  }

  const papelTexto = papeisDaUnidade.map((p) => PAPEL_LABEL[p]).join(' · ')
  const avatar = (
    <NavLink to="/perfil" aria-label="Meu perfil" className="shrink-0 rounded-capsula">
      <span className="flex size-8 items-center justify-center overflow-hidden rounded-capsula border border-fio bg-campo">
        {perfil?.foto_url ? (
          <img src={perfil.foto_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <UserRound className="size-4 text-tinta-sussurro" />
        )}
      </span>
    </NavLink>
  )

  return (
    <DesfazerProvider>
      <div className={cn('min-h-dvh bg-campo md:flex', compacto && 'cc-den')} data-densidade={compacto ? 'compacta' : 'normal'}>
        {/* Sidebar ≥768px */}
        <aside className="sticky top-0 hidden h-dvh w-[var(--cc-lateral)] shrink-0 flex-col border-r border-fio bg-superficie md:flex">
          <button type="button" onClick={() => navigate(itens[0]?.to ?? '/')} className="flex h-[var(--cc-topo)] items-center border-b border-fio px-4 text-left">
            <Marca papel={papelTexto} />
          </button>
          <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
            {itens.map((item) => <ItemLateral key={item.to} item={item} />)}
          </nav>
          <div className="border-t border-fio p-3">
            <div className="truncate px-1 text-apoio font-medium text-tinta">{perfil?.nome_completo}</div>
            <div className="truncate px-1 text-rotulo text-tinta-sussurro">{perfil?.email}</div>
            <button type="button" onClick={handleSair} className="mt-2 flex w-full items-center gap-2 rounded-controle px-1 py-1.5 text-apoio text-tinta-sussurro hover:text-critico">
              <LogOut className="size-4" aria-hidden />
              Sair
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col md:h-dvh">
          {/* Topbar: imóvel a partir de 1024px; abaixo, rola com a página. */}
          <header className="z-10 border-b border-fio bg-superficie lg:sticky lg:top-0">
            <div className="flex min-h-[var(--cc-topo)] flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 md:px-6">
              <div className="md:hidden">
                <Marca />
              </div>
              {unidadeAtiva && status === 'ok' && (
                <div className="hidden min-w-0 flex-col leading-tight md:flex">
                  <span className="truncate text-apoio font-semibold text-tinta">{unidadeAtiva.unidade.nome}</span>
                  <span className="truncate text-rotulo text-tinta-sussurro">{papelTexto}</span>
                </div>
              )}
              {unidades.length > 1 && !ehAdmin && (
                <button type="button" onClick={() => navigate('/seletor')} className="hidden rounded-controle border border-fio px-2.5 py-1 text-rotulo text-tinta-apoio hover:border-acao hover:text-acao md:inline-flex">
                  Trocar unidade
                </button>
              )}
              <div className="ml-auto flex items-center gap-0.5">
                {(!fila.online || fila.pendentes > 0 || fila.recusados > 0) && (
                  <span
                    role="status"
                    className={cn(
                      'mr-2 inline-flex items-center gap-1.5 rounded-capsula border px-2.5 py-1 text-rotulo font-medium',
                      fila.recusados > 0 ? 'border-critico/30 text-critico' : 'border-atencao/30 text-atencao'
                    )}
                  >
                    <span className={cn('size-2 rounded-capsula', fila.online ? 'bg-atencao' : 'bg-critico')} aria-hidden />
                    {!fila.online ? 'Sem conexão' : 'Enviando'}
                    {fila.pendentes > 0 && ` · ${fila.pendentes} no aparelho`}
                    {fila.recusados > 0 && ` · ${fila.recusados} recusado${fila.recusados > 1 ? 's' : ''}`}
                  </span>
                )}
                <BotaoTopo rotulo="Buscar (Ctrl+K)" icone={Search} onClick={() => paleta.setAberta(true)}>
                  <span className="hidden min-[900px]:inline">Buscar</span>
                  <kbd className="hidden rounded-[5px] border border-fio px-1 font-mono text-[11px] text-tinta-sussurro min-[900px]:inline">Ctrl K</kbd>
                </BotaoTopo>
                <BotaoTopo rotulo="Modo compacto" icone={Rows3} onClick={alternarDensidade} ativo={compacto}>
                  <span className="hidden min-[1100px]:inline">Compacto</span>
                </BotaoTopo>
                {ehPlantonista && <SinoAvisos unidadeId={unidadeAtiva?.unidade_id} habilitado />}
                {chatHabilitado && (
                  <BotaoTopo rotulo={totalNaoLidas ? `Abrir chat, ${totalNaoLidas} não lidas` : 'Abrir chat'} icone={MessageSquare} onClick={() => setChatAberto(true)}>
                    {totalNaoLidas > 0 && (
                      <span className="absolute top-0.5 right-0.5 grid min-w-4 place-items-center rounded-capsula bg-critico px-1 text-[10px] font-semibold text-white tabular">
                        {totalNaoLidas}
                      </span>
                    )}
                  </BotaoTopo>
                )}
                <span className="ml-1">{avatar}</span>
                <BotaoTopo rotulo="Sair" icone={LogOut} onClick={handleSair}>
                  <span className="hidden min-[1100px]:inline">Sair</span>
                </BotaoTopo>
              </div>
            </div>
            {!online && (
              <div role="status" className="flex flex-wrap items-center gap-2.5 border-t border-fio px-4 py-2 text-rotulo text-tinta-apoio md:px-6">
                Sem conexão. O que aparece na tela é a última leitura recebida; nada novo chega até a rede voltar.
              </div>
            )}
          </header>

          <NotificacoesTurnoBanner
            unidadeId={papelAtivo === 'plantonista' ? unidadeAtiva?.unidade_id : undefined}
            habilitado={papelAtivo === 'plantonista'}
          />
          {checkinPendente && (
            <div className="flex items-center justify-between gap-3 border-b border-fio bg-atencao/[0.08] px-4 py-2 text-apoio text-atencao md:px-6">
              <span className="flex items-center gap-2">
                <Activity className="size-4 shrink-0" aria-hidden />
                Você ainda não fez check-in no plantão de hoje.
              </span>
              <NavLink to="/plantao/check-in" className="shrink-0 rounded-controle bg-acao px-3 py-1 text-rotulo font-medium text-white hover:bg-acao-pressionada hover:text-white">
                Fazer check-in
              </NavLink>
            </div>
          )}

          {/* De 768px para cima só a topbar fica fora da área que rola. */}
          <main className="flex-1 pb-[calc(96px+env(safe-area-inset-bottom))] md:overflow-y-auto md:pb-[72px]">
            <div className="mx-auto w-full max-w-[var(--cc-coluna)] px-4 pt-5 md:px-7 md:pt-7 min-[1280px]:max-w-[1200px] [.cc-den_&]:pt-4">
              {status === 'carregando' ? (
                <div className="flex h-40 items-center justify-center">
                  <Spinner />
                </div>
              ) : (
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

        {/* Barra inferior ≤767px */}
        <nav
          aria-label="Navegação principal"
          className="fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t border-fio bg-superficie px-2 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] md:hidden"
        >
          {itens.slice(0, 5).map((item) => <ItemInferior key={item.to} item={item} />)}
        </nav>

        <Paleta
          aberta={paleta.aberta}
          onAbertaChange={paleta.setAberta}
          telas={itens}
          comFerramentas={ehPlantonista || papeisDaUnidade.includes('gestor')}
          comPlantao={ehPlantonista}
        />

        {chatHabilitado && <ChatDrawer aberto={chatAbertoEfetivo} onFechar={() => setChatAberto(false)} />}
      </div>
    </DesfazerProvider>
  )
}
