import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider } from '@/contexts/AuthContext'
import { UnidadeProvider, useUnidade } from '@/contexts/UnidadeContext'
import { RequireAuth } from '@/routes/RequireAuth'
import { RequireRole } from '@/routes/RequireRole'
import { RequireSuperAdmin } from '@/routes/RequireSuperAdmin'
import { RedirectHome } from '@/routes/RedirectHome'
import { Redirecionar } from '@/routes/Redirecionar'
import { AppShell } from '@/components/AppShell'
import { ErroBoundary } from '@/components/ErroBoundary'
import { ErroForcado } from '@/components/ErroForcado'
import { Spinner } from '@/components/ui/spinner'

// ── Telas fora do shell: carregadas sob demanda ───────────────────────────────
const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })))
const RecuperarSenha = lazy(() => import('@/pages/RecuperarSenha'))
const Cadastro = lazy(() => import('@/pages/Cadastro').then((m) => ({ default: m.Cadastro })))
const PapelEmPreparo = lazy(() => import('@/pages/PapelEmPreparo'))
const Farmacia = lazy(() => import('@/pages/farmacia/Farmacia'))
const Checagem = lazy(() => import('@/pages/enfermagem/Checagem'))
const ProntoSocorroEnfermagem = lazy(() => import('@/pages/enfermagem/ProntoSocorroEnfermagem'))
const InternacaoEnfermagem = lazy(() => import('@/pages/enfermagem/InternacaoEnfermagem'))
const InicioEnfermagem = lazy(() => import('@/pages/enfermagem/InicioEnfermagem'))
const Recepcao = lazy(() => import('@/pages/recepcao/Recepcao'))
const Triagem = lazy(() => import('@/pages/enfermagem/Triagem'))
const AtendimentoPorta = lazy(() => import('@/pages/plantao/AtendimentoPorta'))
const PainelChamada = lazy(() => import('@/pages/public/PainelChamada'))
const PacoteAlta = lazy(() => import('@/pages/public/PacoteAlta'))
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
const Plataformas = lazy(() => import('@/pages/admin/Plataformas'))
const PendenciasTecnicas = lazy(() => import('@/pages/admin/PendenciasTecnicas'))
const Servidores = lazy(() => import('@/pages/admin/Servidores'))
const ErrosEAlertas = lazy(() => import('@/pages/admin/ErrosEAlertas'))
const Indicadores = lazy(() => import('@/pages/Indicadores'))
const InternacaoPainel = lazy(() => import('@/pages/InternacaoPainel'))
const Notificacoes = lazy(() => import('@/pages/Notificacoes'))
const Perfil = lazy(() => import('@/pages/Perfil'))
const RevisaoClinica = lazy(() => import('@/pages/RevisaoClinica'))
const PedidosProntuario = lazy(() => import('@/pages/prontuario/PedidosProntuario'))
const ProntuarioLeitura = lazy(() => import('@/pages/prontuario/ProntuarioLeitura'))
const PainelGestor = lazy(() => import('@/pages/gestor/PainelGestor'))
const FarmaciaGestor = lazy(() => import('@/pages/gestor/FarmaciaGestor'))
const ProtocolosGestor = lazy(() => import('@/pages/gestor/Protocolos'))
const OlhoDeGaviao = lazy(() => import('@/pages/gestor/OlhoDeGaviao'))
const PortaAgora = lazy(() => import('@/pages/gestor/PortaAgora'))
const IntercorrenciasRelatorio = lazy(() => import('@/pages/gestor/IntercorrenciasRelatorio'))
const CadastrosDuplicados = lazy(() => import('@/pages/recepcao/CadastrosDuplicados'))
const Contingencia = lazy(() => import('@/pages/Contingencia'))
const AltaVigilancia = lazy(() => import('@/pages/farmacia/AltaVigilancia'))
const Interacoes = lazy(() => import('@/pages/farmacia/Interacoes'))
const ChamadosTecnicosGestor = lazy(() => import('@/pages/gestor/ChamadosTecnicos'))
const Auditoria = lazy(() => import('@/pages/gestor/Auditoria'))
const Teleinterconsulta = lazy(() => import('@/pages/telemedicina/Teleinterconsulta'))
const Telemedicina = lazy(() => import('@/pages/telemedicina/Telemedicina'))
const Pareceres = lazy(() => import('@/pages/parecer/Pareceres'))
const MeuPlantao = lazy(() => import('@/pages/MeuPlantao'))
const PlantonistaHome = lazy(() => import('@/pages/plantonista/PlantonistaHome'))
const SectionHome = lazy(() => import('@/pages/plantonista/SectionHome'))
const ToolRouter = lazy(() => import('@/pages/plantonista/ToolRouter').then((m) => ({ default: m.ToolRouter })))
const PreferenciasPrescricao = lazy(() => import('@/pages/PreferenciasPrescricao'))
const NotificacaoCompulsoria = lazy(() => import('@/pages/notificacao/NotificacaoCompulsoria'))
const PendenciasPep = lazy(() => import('@/pages/prontuario/PendenciasPep'))
const ImpressaoProntuario = lazy(() => import('@/pages/prontuario/ImpressaoProntuario'))

// O servidor recusa toda chamada sem segundo fator válido (portão do 2FA,
// migration 20261023000001). Passadas as 24 h no meio do uso, a primeira
// recusa já relê o estado e o portão aparece, sem esperar o intervalo do hook.
function seSegundoFatorVenceu(erro: unknown) {
  if (!(erro instanceof Object && 'message' in erro && String(erro.message).startsWith('SEGUNDO_FATOR'))) return
  // com o portão já na tela, as recusas das telas de fundo são esperadas
  if (queryClient.getQueryData<{ valido: boolean }>(['segundo-fator'])?.valido) {
    void queryClient.invalidateQueries({ queryKey: ['segundo-fator'] })
  }
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: seSegundoFatorVenceu }),
  mutationCache: new MutationCache({ onError: seSegundoFatorVenceu }),
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

/**
 * Link de recuperação de senha que caiu na raiz (retorno não autorizado no
 * Auth cai no site_url): o index.html já marcou a chegada; leva à troca de
 * senha em vez de abrir o app com a sessão de recuperação.
 */
function DesvioRecuperacao({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  let marca = false
  try {
    marca = sessionStorage.getItem('supabase_recovery') === '1'
  } catch {
    /* sem sessionStorage, sem desvio */
  }
  return marca && pathname === '/' ? <Navigate to="/recuperar-senha" replace /> : <>{children}</>
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
            <ErroForcado />
            <Suspense fallback={<Carregando />}>
              <DesvioRecuperacao>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/recuperar-senha" element={<RecuperarSenha />} />
                <Route path="/cadastro" element={<Cadastro />} />
                <Route path="/r/:tipo/:token" element={<LinkReceita />} />
                <Route path="/painel/:token" element={<PainelChamada />} />
                <Route path="/alta/:token" element={<PacoteAlta />} />

                <Route element={<RequireAuth />}>
                  <Route path="/aguardando" element={<AguardandoLiberacao />} />

                  <Route element={<UnidadeLayout />}>
                    <Route path="/seletor" element={<SeletorUnidade />} />

                    <Route element={<AppShell />}>
                      {/* Papéis novos cujas telas chegam nas próximas fases —
                          fora de RequireRole para não virar laço de redirecionamento. */}
                      <Route path="/em-preparo" element={<PapelEmPreparo />} />

                      {/* ── Admin ──────────────────────────────────────── */}
                      {/* Ficha: Recepção, ou quem está de plantão na porta quando não há Recepção */}
                      <Route element={<RequireRole papeis={['plantonista', 'enfermeiro', 'gestor']} />}>
                        {/* Fase 1, tarefa 12: período de contingência em papel */}
                        <Route path="/contingencia" element={<Contingencia />} />
                      </Route>
                      <Route element={<RequireRole papeis={['recepcao', 'gestor']} />}>
                        {/* Fase 1, tarefa 9: unificação de cadastros duplicados */}
                        <Route path="/cadastros-duplicados" element={<CadastrosDuplicados />} />
                      </Route>
                      <Route element={<RequireRole papeis={['recepcao', 'plantonista', 'gestor']} />}>
                        <Route path="/recepcao" element={<Recepcao />} />
                        {/* Porte, onda 8: as telas da Recepção na lateral */}
                        <Route path="/recepcao/:tela" element={<Recepcao />} />
                      </Route>

                      {/* Enfermagem: checagem da prescrição (Fase 4.6) */}
                      <Route element={<RequireRole papeis={['enfermeiro', 'tecnico_enfermagem']} />}>
                        <Route path="/checagem" element={<Checagem />} />
                        {/* Porte: Pronto Socorro e Internação da enfermagem (com a passagem de plantão) */}
                        <Route path="/enfermagem" element={<InicioEnfermagem />} />
                        <Route path="/enfermagem/pronto-socorro" element={<ProntoSocorroEnfermagem />} />
                        <Route path="/enfermagem/internacao" element={<InternacaoEnfermagem />} />
                      </Route>

                      {/* Notificação compulsória (LNNC): o banco confere plantão e papel */}
                      <Route element={<RequireRole papeis={['plantonista', 'enfermeiro', 'gestor']} />}>
                        <Route path="/notificacao-compulsoria" element={<NotificacaoCompulsoria />} />
                      </Route>

                      {/* Avisos: de quem trabalha no plantão (a lista é do próprio perfil) */}
                      <Route element={<RequireRole papeis={['plantonista', 'gestor', 'admin', 'enfermeiro', 'tecnico_enfermagem']} />}>
                        <Route path="/notificacoes" element={<Notificacoes />} />
                      </Route>

                      {/* Alta vigilância: administradas sem liberação e lista da unidade (Fase 2, tarefa 1) */}
                      <Route element={<RequireRole papeis={['farmaceutico', 'enfermeiro', 'gestor']} />}>
                        <Route path="/alta-vigilancia" element={<AltaVigilancia />} />
                      </Route>
                      {/* Interações críticas: lista curada da unidade (Fase 2, tarefa 3) */}
                      <Route element={<RequireRole papeis={['farmaceutico', 'gestor', 'plantonista']} />}>
                        <Route path="/interacoes" element={<Interacoes />} />
                      </Route>

                      {/* Farmacêutico: validação, disponibilidade, faltas e diluição padrão (Fase 4.5/4.9) */}
                      <Route element={<RequireRole papeis={['farmaceutico']} />}>
                        <Route path="/farmacia" element={<Farmacia />} />
                      </Route>

                      {/* Atendimento médico da porta: SOAP, reclassificação e desfecho */}
                      <Route element={<RequireRole papeis={['plantonista']} />}>
                        <Route path="/atendimento" element={<AtendimentoPorta />} />
                        {/* PEP: rascunhos a emitir, impeditivos de alta e cópia do prontuário (onda 6) */}
                        <Route path="/pendencias-pep" element={<PendenciasPep />} />
                        <Route path="/impressao-prontuario" element={<ImpressaoProntuario />} />
                      </Route>

                      {/* Classificação de risco é do enfermeiro (CONTEXT.md) */}
                      <Route element={<RequireRole papeis={['enfermeiro']} />}>
                        <Route path="/triagem" element={<Triagem />} />
                      </Route>

                      <Route element={<RequireRole papeis={['admin']} />}>
                        <Route path="/painel" element={<OrganizacaoGrupo />} />
                        <Route path="/gaviao" element={<GaviaoPainel />} />
                        {/* Porte, onda 8: Plataformas, Pendências técnicas e Servidores */}
                        <Route path="/plataformas" element={<Plataformas />} />
                        <Route path="/pendencias-tecnicas" element={<PendenciasTecnicas />} />
                        <Route path="/servidores" element={<Servidores />} />
                        {/* legado */}
                        <Route path="/pessoas" element={<Redirecionar para="/painel?aba=pessoas" />} />
                      </Route>

                      {/* Administrador geral (super admin): erros do app e verificações da rede */}
                      <Route element={<RequireSuperAdmin />}>
                        <Route path="/erros-e-alertas" element={<ErrosEAlertas />} />
                      </Route>

                      {/* Fase 6: prontuário fora da escala — pedido ao gestor, 24 h, só leitura */}
                      <Route element={<RequireRole papeis={['plantonista', 'telemedicina', 'enfermeiro', 'tecnico_enfermagem', 'farmaceutico']} />}>
                        <Route path="/prontuarios" element={<PedidosProntuario />} />
                      </Route>
                      <Route element={<RequireRole papeis={['plantonista', 'telemedicina', 'enfermeiro', 'tecnico_enfermagem', 'farmaceutico', 'gestor']} />}>
                        <Route path="/prontuarios/:pacienteId" element={<ProntuarioLeitura />} />
                      </Route>

                      {/* Fase 7: teleinterconsulta — presencial solicita, telemedicina responde */}
                      <Route element={<RequireRole papeis={['plantonista', 'gestor', 'telemedicina']} />}>
                        <Route path="/teleinterconsulta" element={<Teleinterconsulta />} />
                      </Route>
                      {/* Onda 8: as outras telas do médico de telemedicina */}
                      <Route element={<RequireRole papeis={['telemedicina']} />}>
                        <Route path="/telemedicina/:tela" element={<Telemedicina />} />
                      </Route>

                      {/* Porte, onda 4: parecer médico — fila do especialista (o banco confere a especialidade) */}
                      <Route element={<RequireRole papeis={['plantonista', 'gestor', 'telemedicina']} />}>
                        <Route path="/pareceres" element={<Pareceres />} />
                      </Route>

                      {/* Fase 6: painel e auditoria são do GESTOR; o administrador vê só agregado */}
                      <Route element={<RequireRole papeis={['gestor']} />}>
                        <Route path="/gestao" element={<PainelGestor />} />
                        {/* Onda 8, gestor parte 2: farmácia (só leitura) e protocolos da unidade */}
                        <Route path="/gestao/farmacia" element={<FarmaciaGestor />} />
                        <Route path="/gestao/protocolos" element={<ProtocolosGestor />} />
                        <Route path="/gestao/gaviao" element={<OlhoDeGaviao />} />
                        {/* Fase 1, tarefa 2: Dashboard PS/UPA */}
                        <Route path="/gestao/porta" element={<PortaAgora />} />
                        {/* Fase 2, tarefa 4: relatório de intercorrências */}
                        <Route path="/gestao/intercorrencias" element={<IntercorrenciasRelatorio />} />
                        {/* 30/09/2026: o gestor abre e acompanha chamado técnico da unidade */}
                        <Route path="/gestao/chamados" element={<ChamadosTecnicosGestor />} />
                        <Route path="/auditoria" element={<Auditoria />} />
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

                      {/* Todo papel: o perfil tem a gestão do 2FA (dispositivos confiáveis), e a
                          Revisão Clínica é da nomeação de RT, não do papel na unidade (o banco confere). */}
                      <Route path="/perfil" element={<Perfil />} />
                      <Route path="/revisao-clinica" element={<RevisaoClinica />} />

                      {/* ── Plantonista + gestão ───────────────────────── */}
                      <Route element={<RequireRole papeis={['plantonista', 'gestor', 'admin']} />}>
                        <Route path="/plantonista" element={<PlantonistaHome />} />
                        <Route path="/plantonista/:section" element={<SectionHome />} />
                        <Route path="/plantonista/:section/:tool" element={<ToolRouter />} />
                        <Route path="/agenda" element={<AgendaGrupo />} />

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
                        {/* Favoritos de prescrição pessoais (D6); o link fica no menu do usuário */}
                        <Route path="/preferencias-prescricao" element={<PreferenciasPrescricao />} />
                      </Route>
                    </Route>

                    <Route path="/" element={<RedirectHome />} />
                    <Route path="*" element={<RedirectHome />} />
                  </Route>
                </Route>
              </Routes>
              </DesvioRecuperacao>
            </Suspense>
          </ErroBoundary>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
