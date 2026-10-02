import { Link, useLocation, useNavigate, type Location } from 'react-router-dom'
import * as React from 'react'
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Users } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { definirManterConectado, manterConectadoMarcado } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LadoMarca, MarcaCompacta } from '@/pages/entrada/LadoMarca'
import '@/pages/entrada/entrada.css'

// Login (login.html do protótipo): abas Entrar e Primeira vez, e o passo do
// código quando a conta tem segundo fator. "Criar conta" não existe: o
// acesso nasce de convite da unidade ou contrato da rede.
//
// Segundo fator: TOTP da própria Supabase (ADR 0010). Se a conta tem um fator
// verificado, a sessão nasce aal1 e o código é pedido aqui. Os erros são
// contados no servidor (ver ConfirmarSegundoFator).
//
// Movimento: vindo da landing, o verde que cresceu lá recolhe para a coluna
// da marca; ao entrar, avança e engole o formulário; "Voltar ao site" cobre a
// tela de novo. Sob prefers-reduced-motion, vai direto.

type Passo = 'entrar' | 'primeira-vez'
type Estado = { daLanding?: boolean; aviso?: string; email?: string; from?: Location } | null

const MARCA_ENTRADA = 'cc-entrou'
/** Mesmo id que a landing dá à onda verde (landing/Landing.tsx). */
const ID_ONDA = 'cc-onda-landing'
const ENTRADA_MS = 460
const VOLTA_MS = 720

const movimentoReduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const CAMPO = 'min-h-11 bg-superficie px-[13px] py-[11px] text-corpo md:text-corpo'

function Separador() {
  return (
    <div className="my-5 flex items-center gap-3 text-rotulo text-tinta-sussurro before:h-px before:flex-1 before:bg-fio after:h-px after:flex-1 after:bg-fio">
      ou
    </div>
  )
}

export function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const estado = location.state as Estado

  const [passo, setPasso] = React.useState<Passo>('entrar')
  const [email, setEmail] = React.useState(estado?.email ?? '')
  const [senha, setSenha] = React.useState('')
  const [manter, setManter] = React.useState(manterConectadoMarcado)
  const [erro, setErro] = React.useState<string | null>(null)
  const [carregando, setCarregando] = React.useState(false)
  const [veuChegada, setVeuChegada] = React.useState(() => !!estado?.daLanding && !movimentoReduzido())
  const [saida, setSaida] = React.useState<null | 'entrar' | 'voltar'>(null)
  const emailRef = React.useRef<HTMLInputElement>(null)

  // A onda da landing sai quando o véu daqui já cobre a tela (antes da pintura).
  React.useLayoutEffect(() => {
    document.getElementById(ID_ONDA)?.remove()
  }, [])

  // Se a animação não rodar (aba em segundo plano), o véu some mesmo assim.
  React.useEffect(() => {
    if (!veuChegada) return
    const id = window.setTimeout(() => setVeuChegada(false), 1200)
    return () => window.clearTimeout(id)
  }, [veuChegada])

  function mostrar(p: Passo) {
    setPasso(p)
    setErro(null)
    if (p === 'entrar') window.setTimeout(() => emailRef.current?.focus({ preventScroll: true }), 0)
  }

  function entrarNoSistema() {
    // Marca de ENTRADA: a pilha de avisos da casca dispara uma vez, não a cada recarga.
    try {
      sessionStorage.setItem(MARCA_ENTRADA, '1')
    } catch {
      /* sem sessionStorage a pilha só não dispara */
    }
    const de = estado?.from
    const destino = de && de.pathname !== '/login' ? `${de.pathname}${de.search ?? ''}` : '/'
    if (movimentoReduzido()) {
      navigate(destino, { replace: true })
      return
    }
    setSaida('entrar')
    window.setTimeout(() => navigate(destino, { replace: true }), ENTRADA_MS)
  }

  async function voltarAoSite(ev: React.MouseEvent<HTMLAnchorElement>) {
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return
    ev.preventDefault()
    if (saida) return
    if (movimentoReduzido()) {
      navigate('/')
      return
    }
    setSaida('voltar')
    window.setTimeout(() => navigate('/'), VOLTA_MS)
  }

  async function onEntrar(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.')
      return
    }
    setErro(null)
    setCarregando(true)
    // Onde a sessão vai morar: decidido ANTES de ela existir.
    definirManterConectado(manter)
    const r = await signIn(email.trim(), senha)
    if (r.error) {
      setCarregando(false)
      setErro(r.error === 'Invalid login credentials' ? 'E-mail ou senha não conferem.' : r.error)
      return
    }
    // O segundo fator é pedido no portão da casca, com o e-mail como primeira
    // opção e o autenticador como alternativa (decisão do usuário 02/10/2026).
    setCarregando(false)
    entrarNoSistema()
  }

  return (
    <div className="grid min-h-dvh bg-campo lg:grid-cols-[46%_minmax(0,1fr)]">
      {veuChegada && <div aria-hidden className="cc-veu-recolhe" onAnimationEnd={() => setVeuChegada(false)} />}
      {saida === 'entrar' && <div aria-hidden className="cc-veu-engole" />}
      {saida === 'voltar' && <div aria-hidden className="cc-veu-cobre" />}

      <LadoMarca />

      <main className="flex flex-col px-5 pt-6 pb-10 sm:px-12 sm:pt-7">
        <Link to="/" onClick={voltarAoSite} className="cc-voltar inline-flex items-center gap-[7px] self-start text-controle text-tinta-sussurro hover:text-acao">
          <ArrowLeft className="size-[15px]" aria-hidden />
          Voltar ao site
        </Link>

        <div className={cn('m-auto w-full max-w-[420px] py-7', saida === 'entrar' ? 'cc-recua' : 'cc-entra')}>
          <MarcaCompacta />

          {estado?.aviso && passo === 'entrar' && (
            <p role="status" className="mb-5 flex items-start gap-2 rounded-container bg-alerta-conforme px-3.5 py-3 text-controle text-[#14532D]">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              {estado.aviso}
            </p>
          )}

          <div role="tablist" aria-label="Entrar ou ativar convite" className="mb-[26px] grid grid-cols-2 gap-1 rounded-container bg-trilha p-1">
            {(['entrar', 'primeira-vez'] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                id={`aba-${p}`}
                aria-selected={passo === p}
                aria-controls={`painel-${p}`}
                onClick={() => mostrar(p)}
                className={cn(
                  'rounded-controle-sm px-3 py-[9px] text-corpo font-medium transition-[background,color,box-shadow] duration-150',
                  passo === p ? 'bg-superficie text-acao-pressionada shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-tinta-apoio hover:text-acao',
                )}
              >
                {p === 'entrar' ? 'Entrar' : 'Primeira vez'}
              </button>
            ))}
          </div>

          {passo === 'entrar' && (
            <section id="painel-entrar" role="tabpanel" aria-labelledby="aba-entrar">
              <h2 className="mb-1.5 text-[26px] leading-[1.15] font-semibold tracking-[-0.026em] text-acao-pressionada">Entrar no plantão</h2>
              <p className="mb-[22px] text-corpo text-pretty text-tinta-apoio">Use o e-mail da sua unidade. A senha é pessoal e não é compartilhada entre papéis.</p>

              <form onSubmit={onEntrar} noValidate className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email" className="text-apoio font-medium text-tinta-apoio">E-mail corporativo</Label>
                  <Input ref={emailRef} id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!erro} className={CAMPO} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="senha" className="text-apoio font-medium text-tinta-apoio">Senha</Label>
                  <Input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} aria-invalid={!!erro} className={CAMPO} />
                </div>
                <div className="mt-0.5 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-controle text-tinta-apoio">
                    <input type="checkbox" checked={manter} onChange={(e) => setManter(e.target.checked)} className="size-4 accent-marca" />
                    <span className="flex flex-col leading-tight">
                      Manter conectado neste aparelho
                      <span className="text-rotulo text-tinta-sussurro">Só no seu aparelho, por até 12 horas</span>
                    </span>
                  </label>
                  <Link to="/recuperar-senha" state={{ email: email.trim() }} className="text-controle">
                    Esqueci a senha
                  </Link>
                </div>
                {erro && <p role="alert" className="text-controle text-critico">{erro}</p>}
                <button
                  type="submit"
                  disabled={carregando}
                  className="mt-1.5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-controle bg-acao-pressionada px-[18px] text-corpo font-medium text-white hover:bg-[#0B3D3A] disabled:opacity-60"
                >
                  {carregando ? 'Entrando…' : 'Entrar'}
                  <ArrowRight className="size-4" aria-hidden />
                </button>
              </form>

              <Separador />
              <button
                type="button"
                onClick={() => mostrar('primeira-vez')}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-controle border border-fio bg-superficie px-[18px] text-corpo font-medium text-acao-pressionada hover:border-marca hover:text-acao"
              >
                Ativar um convite
              </button>

              <p className="mt-[22px] text-apoio text-pretty text-tinta-sussurro">
                Se o seu nome não estiver na escala de agora, a plataforma avisa o horário do seu próximo plantão em vez de abrir.
                <br />
                Quem configurou o aplicativo autenticador confirma a entrada com o código dele.
              </p>
            </section>
          )}

          {passo === 'primeira-vez' && (
            <section id="painel-primeira-vez" role="tabpanel" aria-labelledby="aba-primeira-vez">
              <h2 className="mb-1.5 text-[26px] leading-[1.15] font-semibold tracking-[-0.026em] text-acao-pressionada">Não existe cadastro próprio</h2>
              <p className="mb-[22px] text-corpo text-pretty text-tinta-apoio">
                A conta nasce de um convite da unidade ou do contrato da rede. Ninguém se cadastra sozinho: a plataforma lê escala e leito, e só a coordenação sabe quem está nelas.
              </p>
              <div className="mb-5 flex flex-col gap-2.5">
                <div className="grid grid-cols-[34px_minmax(0,1fr)] items-start gap-[13px] rounded-container border border-fio bg-superficie px-[15px] py-[13px]">
                  <span className="grid size-[34px] place-items-center rounded-[11px] bg-leitos text-white" aria-hidden><Users className="size-[17px]" /></span>
                  <span>
                    <b className="block text-controle font-semibold text-tinta">Equipe da unidade</b>
                    <span className="text-apoio leading-[1.5] text-pretty text-tinta-apoio">A coordenação avisa quando o acesso estiver pronto. Você ativa com o e-mail corporativo, cria a sua senha, e a coordenação libera o vínculo.</span>
                  </span>
                </div>
                <div className="grid grid-cols-[34px_minmax(0,1fr)] items-start gap-[13px] rounded-container border border-fio bg-superficie px-[15px] py-[13px]">
                  <span className="grid size-[34px] place-items-center rounded-[11px] bg-suprimento text-white" aria-hidden><Building2 className="size-[17px]" /></span>
                  <span>
                    <b className="block text-controle font-semibold text-tinta">Coordenação e administração</b>
                    <span className="text-apoio leading-[1.5] text-pretty text-tinta-apoio">Entram pelo contrato da rede. É a coordenação que depois libera as equipes.</span>
                  </span>
                </div>
              </div>
              <Link
                to="/cadastro"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-controle bg-acao-pressionada px-[18px] text-corpo font-medium text-white hover:bg-[#0B3D3A] hover:text-white"
              >
                Ir para o primeiro acesso
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <p className="mt-[22px] text-apoio text-pretty text-tinta-sussurro">
                Sem convite e sem contrato? Fale com a coordenação da sua unidade.
                <br />
                Já tem conta?{' '}
                <button type="button" onClick={() => mostrar('entrar')} className="font-medium text-acao hover:text-acao-pressionada">
                  Entrar no plantão
                </button>
                .
              </p>
            </section>
          )}

        </div>
      </main>
    </div>
  )
}
