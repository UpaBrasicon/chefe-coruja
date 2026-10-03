import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'

import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { PAPEIS_POR_ESCALA, PAPEL_LABEL } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { DesfazerProvider } from '@/contexts/DesfazerContext'
import { AvisosFlutuantesProvider, useAvisosFlutuantes } from '@/contexts/AvisosFlutuantesContext'
import { usePlantao } from '@/hooks/usePlantao'
import { useFilaOffline } from '@/hooks/useFilaOffline'
import { useWebPush } from '@/hooks/useWebPush'
import { useBanners } from '@/hooks/useBanners'
import { useChatRealtimeGlobal, useTotalNaoLidas } from '@/hooks/useChat'
import { ChatDrawer } from '@/components/chat/ChatDrawer'
import { ChatFab } from '@/components/chat/ChatFab'
import { useAvisoDeMensagem } from '@/components/chat/useAvisoDeMensagem'
import { ForaDoExpediente } from '@/pages/plantonista/ForaDoExpediente'
import { AvisoCheckinPendente, GateCheckIn } from '@/components/GateCheckIn'
import { NotificacoesTurnoBanner } from '@/components/plantonista/NotificacoesTurnoBanner'
import { SinoAvisos } from '@/components/plantonista/SinoAvisos'
import { Spinner } from '@/components/ui/spinner'
import { ErroBoundary } from '@/components/ErroBoundary'
import { ABAS_ESTREITAS_PLANTONISTA, inicioDoPapel, itensDeNavegacao, type ItemNav } from '@/components/casca/navegacao'
import { useMeuPapelTecnico } from '@/hooks/useFerramentaClinica'
import { Paleta } from '@/components/casca/Paleta'
import { usePaleta } from '@/components/casca/usePaleta'
import { Lateral } from '@/components/casca/Lateral'
import { MenuUsuario } from '@/components/casca/MenuUsuario'
import { DialogoSaida, SessaoEncerrada, VeuSaida } from '@/components/casca/Saida'
import { TelaBloqueada } from '@/components/casca/Bloqueio'
import { useBloqueioOcioso } from '@/components/casca/useBloqueioOcioso'
import { ContextoTopo, FitaDoSinal, Topo, TopoEstreito } from '@/components/casca/Topo'
import { FaixaDoPapel } from '@/components/casca/FaixaDoPapel'
import { useNotasNav } from '@/components/casca/useNotasNav'
import { usePendenciasSaida } from '@/components/casca/usePendenciasSaida'
import { useSessaoPosPlantao } from '@/components/casca/useSessaoPosPlantao'
import { useSinal } from '@/components/casca/useSinal'
import { PortaoSegundoFator } from '@/components/seguranca/SegundoFator'
import { useSegundoFator } from '@/hooks/useSegundoFator'
import type { Papel } from '@/types/database'

// A casca do Monitor de Cabeceira (P/index.html 882–1366): lateral recolhida
// em ícones que abre por cima, topbar imóvel com o contexto do papel, pilha de
// avisos, régua de desfazer, chat em botão flutuante, paleta Ctrl+K e a fita
// do sinal. Abaixo de 1024px o plantonista ganha o topo próprio com quatro
// abas-bloco; os demais papéis, abaixo de 768px, a barra fixa inferior.

const CHAVE_DENSIDADE = 'chefe-coruja:densidade'
const MARCA_ENTRADA = 'cc-entrou'
const SAIDA_MS = 430

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

function useLarguraAte(px: number) {
  const consulta = `(max-width: ${px}px)`
  const [casa, setCasa] = React.useState(() => window.matchMedia(consulta).matches)
  React.useEffect(() => {
    const mq = window.matchMedia(consulta)
    const on = () => setCasa(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [consulta])
  return casa
}

function ItemInferior({ item, nota }: { item: ItemNav; nota?: number }) {
  const Icone = item.icone
  return (
    <NavLink
      to={item.to}
      end={item.exato}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-[52px] min-w-[64px] flex-1 flex-col items-center justify-center gap-1 rounded-container px-0.5 py-1.5 text-rotulo leading-[1.15] transition-colors',
          isActive ? 'bg-marca/10 font-semibold text-acao' : 'text-tinta-apoio',
        )
      }
    >
      <Icone className="size-5" aria-hidden />
      <span className="truncate text-center">{item.curto ?? item.rotulo}</span>
      {!!nota && (
        <span className="absolute top-[3px] right-1.5 rounded-capsula bg-nota px-[5px] text-rotulo leading-[15px] font-semibold text-atencao">{nota}</span>
      )}
    </NavLink>
  )
}

/** A pilha de avisos da entrada: os três últimos avisos da unidade, uma vez. */
function AvisosDeEntrada({ unidadeId }: { unidadeId?: string }) {
  const { avisar } = useAvisosFlutuantes()
  const { data: avisos, isSuccess } = useBanners(unidadeId)
  const feito = React.useRef(false)
  React.useEffect(() => {
    if (feito.current || !isSuccess) return
    let entrou = false
    try {
      entrou = window.sessionStorage.getItem(MARCA_ENTRADA) === '1'
      if (entrou) window.sessionStorage.removeItem(MARCA_ENTRADA)
    } catch {
      /* sem storage, sem pilha */
    }
    feito.current = true
    if (!entrou) return
    avisar(
      (avisos ?? [])
        .filter((a) => a.titulo || a.descricao)
        .slice(0, 3)
        .map((a) => ({
          tag: 'Da unidade',
          titulo: a.titulo ?? 'Aviso da unidade',
          texto: a.descricao ?? undefined,
          quando: new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }),
        })),
    )
  }, [isSuccess, avisos, avisar])
  return null
}

/** Liga o aviso flutuante de mensagem nova (precisa do canal global do chat). */
function AvisoDeMensagem() {
  useAvisoDeMensagem()
  return null
}

type MeuPlantao = { setor_nome: string; turno: string; inicio: string; fim: string }

export function AppShell() {
  return (
    <AvisosFlutuantesProvider>
      <DesfazerProvider>
        <Casca />
      </DesfazerProvider>
    </AvisosFlutuantesProvider>
  )
}

function Casca() {
  const { signOut, perfil } = useAuth()
  const { unidades, unidadeAtiva, papelAtivo, setPapelAtivo, papeisDaUnidade, status, ehSuperAdmin } = useUnidade()
  const navigate = useNavigate()
  const location = useLocation()
  const [chatAberto, setChatAberto] = React.useState(false)
  const { compacto, alternar: alternarDensidade } = useDensidade()
  const paleta = usePaleta()
  const segundoFator = useSegundoFator()
  const { sinal, tentar } = useSinal()
  const estreito = useLarguraAte(1023)
  const [saidaAberta, setSaidaAberta] = React.useState(false)
  const [saindo, setSaindo] = React.useState(false)
  const unidadeId = unidadeAtiva?.unidade_id

  // Web Push — só o plantonista recebe avisos de turno no aparelho.
  useWebPush(papelAtivo === 'plantonista')

  // Chat: plantonista, gestor e farmacêutico (P/index.html chatTemAcesso).
  const chatHabilitado = papelAtivo === 'plantonista' || papelAtivo === 'gestor' || papelAtivo === 'farmaceutico'
  useChatRealtimeGlobal()
  const totalNaoLidas = useTotalNaoLidas()

  // Rota antiga /mensagens abre a gaveta do chat.
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
  const itens = React.useMemo(() => itensDeNavegacao(papelAtivo, ehRt), [papelAtivo, ehRt])
  const inicio = inicioDoPapel(papelAtivo)
  const notas = useNotasNav(unidadeId, papelAtivo)
  const ehPlantonista = papelAtivo === 'plantonista'
  const ehAdmin = papelAtivo === 'admin'
  const ehGestor = papelAtivo === 'gestor'
  const ehTele = papelAtivo === 'telemedicina'
  const topoEstreito = ehPlantonista && estreito

  // A escala é a porta (ADR 0003): quem entra por escala só entra se estiver
  // nela agora, pelo relógio do servidor. Sem conexão, segue quem já estava em
  // plantão neste aparelho, nos limites do ADR 0009.
  // O administrador geral da plataforma não passa pela escala nem pelo
  // check-in, em nenhum papel (decisão do usuário, 30/09/2026).
  const entraPorEscala = !!papelAtivo && PAPEIS_POR_ESCALA.includes(papelAtivo) && !ehSuperAdmin
  const { status: plantaoStatus, checkin: situacaoCheckin, recarregar: recarregarPlantao } = usePlantao(entraPorEscala ? unidadeId : undefined)
  const [checkinAberto, setCheckinAberto] = React.useState(false)
  const fila = useFilaOffline()

  const { data: meuPlantao } = useQuery({
    queryKey: ['meu-plantao-agora', perfil?.id],
    enabled: entraPorEscala && !!perfil,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('meu_plantao_agora')
      if (error) throw error
      const lista = (data ?? []) as MeuPlantao[]
      return lista.find((p) => p) ?? null
    },
  })
  const fimTurno = meuPlantao ? new Date(meuPlantao.fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : undefined
  // a tolerância de 20 min conta do fim do turno (decisão do RT 03/10/2026)
  const sessao = useSessaoPosPlantao(plantaoStatus, entraPorEscala, meuPlantao?.fim ?? null)

  // Check-in pendente (antes da tolerância): o aviso mostra quanto falta, pelo
  // relógio do servidor. Passada a tolerância, o servidor fecha a porta e a
  // casca mostra só a tela de check-in (status 'checkin', abaixo).
  const checkinPendente = entraPorEscala && plantaoStatus === 'escala' && !!situacaoCheckin?.pendente
  const aposCheckin = React.useCallback(() => {
    setCheckinAberto(false)
    recarregarPlantao()
  }, [recarregarPlantao])

  // Contexto da topbar por papel.
  const { data: painelGestor } = useQuery({
    queryKey: ['painel-gestor', unidadeId],
    enabled: ehGestor && !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('painel_gestor', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as { ocupacao?: { escalados_agora: number }[]; pedidos_acesso_pendentes?: number }
    },
  })
  const { data: rede } = useQuery({
    queryKey: ['painel-organizacao-lateral'],
    enabled: ehAdmin,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('painel_organizacao', { p_dias: 7 })
      if (error) throw error
      return (data ?? []) as { profissionais_em_expediente?: number | null }[]
    },
  })

  const emPlantao = entraPorEscala && (plantaoStatus === 'escala' || plantaoStatus === 'sem_conexao')
  const pendenciasSaida = usePendenciasSaida(saidaAberta, unidadeId, perfil?.id, emPlantao)

  const sair = React.useCallback(async () => {
    await signOut()
    navigate('/login', { replace: true })
  }, [signOut, navigate])
  const encerrarPorInatividade = React.useCallback(() => void sair(), [sair])
  const bloqueio = useBloqueioOcioso(!!perfil, encerrarPorInatividade)

  function confirmarSaida() {
    if (saindo) return
    setSaidaAberta(false)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      void sair()
      return
    }
    setSaindo(true)
    window.setTimeout(() => void sair(), SAIDA_MS)
  }

  function trocarPapel(p: Papel) {
    setPapelAtivo(p)
    navigate(inicioDoPapel(p))
  }

  const papelTexto = papelAtivo ? PAPEL_LABEL[papelAtivo] : ''
  const podeTrocarUnidade = unidades.length > 1 && !ehAdmin
  const registro = perfil?.crm ? `CRM ${perfil.crm}${perfil.uf_crm ? `/${perfil.uf_crm}` : ''}` : null

  const menu = (tamanho: 32 | 38) => (
    <MenuUsuario
      nome={perfil?.nome_completo}
      registro={registro}
      fotoUrl={perfil?.foto_url}
      unidade={!ehAdmin && !ehTele ? unidadeAtiva?.unidade.nome : undefined}
      podeTrocarUnidade={podeTrocarUnidade}
      papeis={papeisDaUnidade}
      papelAtivo={papelAtivo}
      onTrocarPapel={trocarPapel}
      onSair={() => setSaidaAberta(true)}
      onBloquear={bloqueio.bloquear}
      tamanho={tamanho}
    />
  )

  const dialogosDeSaida = (
    <>
      <DialogoSaida
        aberto={saidaAberta}
        onAbertoChange={setSaidaAberta}
        emPlantao={emPlantao}
        fimTurno={fimTurno}
        pendencias={pendenciasSaida.data ?? []}
        carregando={pendenciasSaida.isFetching}
        onConfirmar={confirmarSaida}
      />
      {saindo && <VeuSaida />}
      {bloqueio.bloqueada && !sessao.encerrada && (
        <TelaBloqueada
          nome={perfil?.nome_completo}
          email={perfil?.email}
          contexto={unidadeAtiva?.unidade.nome}
          onDesbloquear={bloqueio.desbloquear}
          onSair={() => void sair()}
        />
      )}
      {sessao.encerrada && (
        <SessaoEncerrada texto="O plantão terminou e passaram os 20 minutos de tolerância. Por segurança, a sessão foi encerrada. Para continuar, peça ao gestor para liberar." onReentrar={() => void sair()} />
      )}
    </>
  )

  // Segundo fator (ADR 0010): com a exigência ligada, nada da casca aparece
  // antes do código — dado de paciente só com aal2 confirmado nas últimas 24 h.
  if (segundoFator.data?.exigido && !segundoFator.data.valido) {
    return <PortaoSegundoFator fatorId={segundoFator.data.fatorId} onSair={() => void sair()} />
  }

  if (entraPorEscala) {
    if (plantaoStatus === 'carregando') {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Spinner />
        </div>
      )
    }
    if (plantaoStatus === 'fora') {
      return (
        <>
          <ForaDoExpediente />
          {dialogosDeSaida}
        </>
      )
    }
    // Tolerância vencida sem check-in: só a tela de check-in (e sair).
    if (plantaoStatus === 'checkin') {
      return (
        <>
          <GateCheckIn situacao={situacaoCheckin} bloqueado onFeito={aposCheckin} onSair={() => void sair()} />
          {dialogosDeSaida}
        </>
      )
    }
  }

  const contexto = ehAdmin ? 'Rede — todas as unidades' : ehTele ? `Telemedicina — ${perfil?.nome_completo ?? ''}${registro ? ` · ${registro}` : ''}` : (unidadeAtiva?.unidade.nome ?? '')
  const escaladosAgora = (painelGestor?.ocupacao ?? []).reduce((n, s) => n + (s.escalados_agora ?? 0), 0)
  const plantaoRede = rede?.some((u) => u.profissionais_em_expediente == null) ? null : (rede ?? []).reduce((n, u) => n + (u.profissionais_em_expediente ?? 0), 0)
  const extraTopo = ehGestor && painelGestor ? (
    <ContextoTopo>{`${escaladosAgora} em plantão agora`}</ContextoTopo>
  ) : ehAdmin && rede ? (
    <ContextoTopo icone={Building2}>{`${rede.length} unidade${rede.length === 1 ? '' : 's'} · ${plantaoRede === null ? '< 5' : plantaoRede} em plantão`}</ContextoTopo>
  ) : ehTele ? (
    <NavLink
      to="/teleinterconsulta"
      title="Plantão remoto"
      className={cn(
        'flex h-8 items-center gap-2 rounded-capsula border px-3 text-apoio font-medium whitespace-nowrap',
        emPlantao ? 'border-conforme/30 bg-conforme/[0.06] text-conforme' : 'border-fio text-tinta-sussurro',
      )}
    >
      <span className={cn('size-2 rounded-capsula', emPlantao ? 'bg-conforme' : 'bg-fio-forte')} aria-hidden />
      {emPlantao ? 'Em plantão' : 'Fora do plantão'}
      {fimTurno && (
        <>
          <span className="h-3 w-px bg-fio-forte" aria-hidden />
          <span className="tabular">até {fimTurno}</span>
        </>
      )}
    </NavLink>
  ) : null

  const pilulaFila = (!fila.online || fila.pendentes > 0 || fila.recusados > 0) && (
    <span
      role="status"
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-capsula border px-2.5 text-rotulo font-medium whitespace-nowrap',
        fila.recusados > 0 ? 'border-critico/30 text-critico' : 'border-atencao/30 text-atencao',
      )}
    >
      <span className={cn('size-2 rounded-capsula', fila.online ? 'bg-atencao' : 'bg-critico')} aria-hidden />
      {!fila.online ? 'Sem conexão' : 'Enviando'}
      {fila.pendentes > 0 && ` · ${fila.pendentes} no aparelho`}
      {fila.recusados > 0 && ` · ${fila.recusados} recusado${fila.recusados > 1 ? 's' : ''}`}
    </span>
  )

  return (
    <div className={cn('cc-shell min-h-dvh bg-campo md:flex', compacto && 'cc-den')} data-densidade={compacto ? 'compacta' : 'normal'}>
      {!topoEstreito && (
        <Lateral
          itens={itens}
          notas={notas}
          papelTexto={papelTexto}
          inicio={inicio}
          unidadeId={unidadeId}
          ehGestor={ehGestor}
          ehAdmin={ehAdmin}
          onSair={() => setSaidaAberta(true)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col md:h-dvh">
        {topoEstreito ? (
          <TopoEstreito
            inicio={inicio}
            plantao={{ em: emPlantao, rotulo: fimTurno ? `Plantão até ${fimTurno}` : 'Plantão', to: '/plantao' }}
            avatar={menu(38)}
            onSair={() => setSaidaAberta(true)}
            abas={ABAS_ESTREITAS_PLANTONISTA}
            notas={notas}
          />
        ) : (
          <Topo
            contexto={contexto}
            extra={extraTopo}
            compacto={compacto}
            onBuscar={() => paleta.setAberta(true)}
            onCompacto={alternarDensidade}
            sino={ehPlantonista ? <SinoAvisos unidadeId={unidadeId} habilitado /> : undefined}
            fila={pilulaFila}
            avatar={menu(32)}
            trocarUnidade={podeTrocarUnidade ? () => navigate('/seletor') : undefined}
          />
        )}
        <FitaDoSinal sinal={sinal} onTentar={() => void tentar()} />

        <NotificacoesTurnoBanner unidadeId={ehPlantonista ? unidadeId : undefined} habilitado={ehPlantonista} />
        {checkinPendente && situacaoCheckin && (
          <AvisoCheckinPendente situacao={situacaoCheckin} onAbrir={() => setCheckinAberto(true)} onVencer={recarregarPlantao} />
        )}
        {checkinPendente && checkinAberto && (
          <GateCheckIn situacao={situacaoCheckin} bloqueado={false} onFeito={aposCheckin} onFechar={() => setCheckinAberto(false)} onSair={() => void sair()} />
        )}

        {/* De 768px para cima só a topbar fica fora da área que rola. */}
        <main className="flex-1 pb-[calc(96px+env(safe-area-inset-bottom))] md:overflow-y-auto md:overscroll-contain md:pb-[72px]">
          <div className="cc-pagina cc-coluna mx-auto w-full px-4 pt-5 md:px-7 md:pt-7">
            {status === 'carregando' ? (
              <div className="flex h-40 items-center justify-center">
                <Spinner />
              </div>
            ) : (
              <ErroBoundary key={location.pathname}>
                {/* Faixa de parâmetros: só na página inicial do farmacêutico, do administrador e da telemedicina. */}
                {(ehAdmin || ehTele || papelAtivo === 'farmaceutico') && location.pathname === inicio && (
                  <FaixaDoPapel papel={papelAtivo} unidadeId={unidadeId} />
                )}
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

      {/* Barra inferior ≤767px (os papéis sem topo próprio): todos os itens, rolando se não couberem. */}
      {!topoEstreito && (
        <nav
          aria-label="Navegação principal"
          className="fixed inset-x-0 bottom-0 z-40 flex gap-0.5 overflow-x-auto border-t border-fio bg-superficie px-[5px] pt-[5px] pb-[calc(5px+env(safe-area-inset-bottom))] [scrollbar-width:none] md:hidden"
        >
          {itens.map((item) => (
            <ItemInferior key={item.to} item={item} nota={item.nota ? notas[item.nota] : undefined} />
          ))}
        </nav>
      )}

      <Paleta
        aberta={paleta.aberta}
        onAbertaChange={paleta.setAberta}
        telas={itens}
        comFerramentas={ehPlantonista || ehGestor}
        comPlantao={ehPlantonista}
      />

      {chatHabilitado && (
        <>
          {!chatAbertoEfetivo && <ChatFab naoLidas={totalNaoLidas} onAbrir={() => setChatAberto(true)} />}
          <ChatDrawer aberto={chatAbertoEfetivo} onFechar={() => setChatAberto(false)} />
          <AvisoDeMensagem />
        </>
      )}
      <AvisosDeEntrada unidadeId={unidadeId} />
      {dialogosDeSaida}
    </div>
  )
}

