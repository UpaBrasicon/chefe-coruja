import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider } from '@/contexts/AuthContext'
import { UnidadeProvider, useUnidade } from '@/contexts/UnidadeContext'
import { RequireAuth } from '@/routes/RequireAuth'
import { RequireRole } from '@/routes/RequireRole'
import { RedirectHome } from '@/routes/RedirectHome'
import { Redirecionar } from '@/routes/Redirecionar'
import { AppShell } from '@/components/AppShell'
import { ErroBoundary } from '@/components/ErroBoundary'
import { Spinner } from '@/components/ui/spinner'

// ── Telas fora do shell: carregadas sob demanda ───────────────────────────────
const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })))
const Cadastro = lazy(() => import('@/pages/Cadastro').then((m) => ({ default: m.Cadastro })))
const LinkReceita = lazy(() =>
  import('@/pages/public/LinkReceita').then((m) => ({ default: m.LinkReceita }))
)
const AguardandoLiberacao = lazy(() =>
  import('@/pages/AguardandoLiberacao').then((m) => ({ default: m.AguardandoLiberacao }))
)
const SeletorUnidade = lazy(() =>
  import('@/pages/SeletorUnidade').then((m) => ({ default: m.SeletorUnidade }))
)

// ── Páginas agrupadas ─────────────────────────────────────────────────────────
const OrganizacaoGrupo = lazy(() => import('@/pages/grupos/OrganizacaoGrupo'))
const UnidadeGrupo = lazy(() => import('@/pages/grupos/UnidadeGrupo'))
const EscalaGrupo = lazy(() => import('@/pages/grupos/EscalaGrupo'))
const AgendaGrupo = lazy(() => import('@/pages/grupos/AgendaGrupo'))
const PlantaoHome = lazy(() => import('@/pages/plantao/PlantaoHome'))
const PlantaoSectionHome = lazy(() => import('@/pages/plantao/PlantaoSectionHome'))
const PlantaoToolRouter = lazy(() => import('@/pages/plantao/PlantaoToolRouter'))

// ── Telas que continuam avulsas ───────────────────────────────────────────────
const GaviaoPainel = lazy(() => import('@/pages/admin/GaviaoPainel').then((m) => ({ default: m.GaviaoPainel })))
const Indicadores = lazy(() => import('@/pages/Indicadores'))
const InternacaoPainel = lazy(() => import('@/pages/InternacaoPainel'))
const Notificacoes = lazy(() => import('@/pages/Notificacoes'))
const Perfil = lazy(() => import('@/pages/Perfil'))
const MeuPlantao = lazy(() => import('@/pages/MeuPlantao'))
const PlantonistaHome = lazy(() => import('@/pages/plantonista/PlantonistaHome'))
const SectionHome = lazy(() => import('@/pages/plantonista/SectionHome'))
const ToolRouter = lazy(() => import('@/pages/plantonista/ToolRouter').then((m) => ({ default: m.ToolRouter })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function UnidadeLayout() {
  return (
    <UnidadeProvider>
      <Outlet />
    </UnidadeProvider>
  )
}

/**
 * O reagrupamento mudou o destino de algumas telas conforme o papel: o
 * plantonista passou a acessá-las por dentro de um agrupador, enquanto
 * gestor/admin continuam na tela avulsa. Esta rota escolhe entre os dois sem
 * alterar quem pode ver o quê.
 */
function PorPapel({ plantonista, gestao }: { plantonista: ReactNode; gestao: ReactNode }) {
  const { papeisDaUnidade } = useUnidade()
  const ehGestao = papeisDaUnidade.includes('gestor') || papeisDaUnidade.includes('admin')
  return <>{ehGestao ? gestao : plantonista}</>
}

/**
 * `/mensagens` é rota legada: o chat vive no drawer do AppShell, que abre
 * sozinho ao detectar este pathname. Para quem não tem chat (admin), sai daqui.
 */
function RotaMensagens() {
  const { papeisDaUnidade } = useUnidade()
  const temChat = papeisDaUnidade.includes('plantonista') || papeisDaUnidade.includes('gestor')
  return temChat ? null : <Redirecionar para="/" />
}

function Carregando() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ErroBoundary>
            <Suspense fallback={<Carregando />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/cadastro" element={<Cadastro />} />
                <Route path="/r/:tipo/:token" element={<LinkReceita />} />

                <Route element={<RequireAuth />}>
                  <Route path="/aguardando" element={<AguardandoLiberacao />} />

                  <Route element={<UnidadeLayout />}>
                    <Route path="/seletor" element={<SeletorUnidade />} />

                    <Route element={<AppShell />}>
                      {/* ── Admin ──────────────────────────────────────── */}
                      <Route element={<RequireRole papeis={['admin']} />}>
                        <Route path="/painel" element={<OrganizacaoGrupo />} />
                        <Route path="/gaviao" element={<GaviaoPainel />} />
                        {/* legado */}
                        <Route path="/pessoas" element={<Redirecionar para="/painel?aba=pessoas" />} />
                      </Route>

                      {/* ── Gestor (e admin, com abas filtradas) ───────── */}
                      <Route element={<RequireRole papeis={['gestor', 'admin']} />}>
                        <Route path="/unidade" element={<UnidadeGrupo />} />
                        <Route path="/indicadores" element={<Indicadores />} />
                        {/* legado */}
                        <Route path="/setores" element={<Redirecionar para="/unidade?aba=setores" />} />
                        <Route
                          path="/configuracao"
                          element={<Redirecionar para="/unidade?aba=configuracoes" />}
                        />
                        <Route path="/banners" element={<Redirecionar para="/unidade?aba=imagens" />} />
                        <Route
                          path="/historico-escala"
                          element={<Redirecionar para="/escala?aba=historico" />}
                        />
                      </Route>

                      {/* ── Plantonista + gestão ───────────────────────── */}
                      <Route element={<RequireRole papeis={['plantonista', 'gestor', 'admin']} />}>
                        <Route path="/plantonista" element={<PlantonistaHome />} />
                        <Route path="/plantonista/:section" element={<SectionHome />} />
                        <Route path="/plantonista/:section/:tool" element={<ToolRouter />} />
                        <Route path="/agenda" element={<AgendaGrupo />} />
                        <Route path="/notificacoes" element={<Notificacoes />} />
                        <Route path="/perfil" element={<Perfil />} />

                        <Route
                          path="/escala"
                          element={
                            <PorPapel
                              plantonista={<Redirecionar para="/agenda?aba=escala" />}
                              gestao={<EscalaGrupo />}
                            />
                          }
                        />
                        <Route
                          path="/internacao"
                          element={
                            <PorPapel
                              plantonista={<Redirecionar para="/plantao/internacao/pacientes" />}
                              gestao={<InternacaoPainel modo="internacao" />}
                            />
                          }
                        />
                        <Route
                          path="/observacao"
                          element={
                            <PorPapel
                              plantonista={<Redirecionar para="/plantao/observacao" />}
                              gestao={<InternacaoPainel modo="observacao" />}
                            />
                          }
                        />
                        <Route
                          path="/meu-plantao"
                          element={
                            <PorPapel
                              plantonista={<Redirecionar para="/plantao/check-in" />}
                              gestao={<MeuPlantao />}
                            />
                          }
                        />

                        {/* legado */}
                        <Route path="/mensagens" element={<RotaMensagens />} />
                        <Route
                          path="/minha-agenda"
                          element={<Redirecionar para="/agenda?aba=todas-unidades" />}
                        />
                        <Route path="/vagas" element={<Redirecionar para="/agenda?aba=vagas" />} />
                        <Route path="/extrato" element={<Redirecionar para="/agenda?aba=extrato" />} />
                        <Route
                          path="/prescricao-teste"
                          element={<Redirecionar para="/plantonista/farmacia/consulta-medicamentos" />}
                        />
                        <Route
                          path="/referencia-diluicao"
                          element={<Redirecionar para="/plantonista/farmacia/referencia-diluicao" />}
                        />
                      </Route>

                      {/* ── Plantonista exclusivo ──────────────────────── */}
                      <Route element={<RequireRole papeis={['plantonista']} />}>
                        <Route path="/plantao" element={<PlantaoHome />} />
                        <Route path="/plantao/:secao" element={<PlantaoSectionHome />} />
                        <Route path="/plantao/:secao/:tool" element={<PlantaoToolRouter />} />
                      </Route>
                    </Route>

                    <Route path="/" element={<RedirectHome />} />
                    <Route path="*" element={<RedirectHome />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </ErroBoundary>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
