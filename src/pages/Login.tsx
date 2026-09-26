import { useNavigate, Link } from 'react-router-dom'
import * as React from 'react'
import { ArrowRight, Building2, CalendarClock, KeyRound, MapPin, ShieldCheck, Stethoscope } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Login (design_handoff/telas/17): duas abas — Entrar e Primeira vez — e o
// passo do código, que aparece quando a conta exige segundo fator.
// "Criar conta" saiu: o acesso nasce de convite da unidade ou contrato da rede.
//
// Segundo fator: TOTP da própria Supabase (ADR 0010). Se a conta tem um fator
// verificado, a sessão fica em aal1 e o código é pedido aqui. A janela diária
// e o aparelho confiável dependem da base da Fase 1 no banco.

type Passo = 'entrar' | 'primeira-vez' | 'codigo'

const MARCA_ENTRADA = 'cc-entrou'

function Argumento({ icone: Icone, titulo, texto, cor }: { icone: typeof MapPin; titulo: string; texto: string; cor: string }) {
  return (
    <li className="flex gap-3">
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-controle text-white', cor)} aria-hidden>
        <Icone className="size-[18px]" />
      </span>
      <span>
        <span className="block text-corpo font-semibold text-white">{titulo}</span>
        <span className="block text-apoio text-white/75">{texto}</span>
      </span>
    </li>
  )
}

export function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [passo, setPasso] = React.useState<Passo>('entrar')
  const [email, setEmail] = React.useState('')
  const [senha, setSenha] = React.useState('')
  const [codigo, setCodigo] = React.useState('')
  const [fatorId, setFatorId] = React.useState<string | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [carregando, setCarregando] = React.useState(false)

  function entrarNoSistema() {
    // Marca de ENTRADA: a pilha de avisos dispara uma vez, não a cada recarga.
    try {
      sessionStorage.setItem(MARCA_ENTRADA, '1')
    } catch {
      /* sem sessionStorage a pilha só não dispara */
    }
    navigate('/', { replace: true })
  }

  async function onEntrar(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.')
      return
    }
    setErro(null)
    setCarregando(true)
    const r = await signIn(email.trim(), senha)
    if (r.error) {
      setCarregando(false)
      setErro(r.error === 'Invalid login credentials' ? 'E-mail ou senha não conferem.' : r.error)
      return
    }
    // A conta exige segundo fator? (fator TOTP verificado → aal2 pendente)
    const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (nivel && nivel.nextLevel === 'aal2' && nivel.currentLevel !== 'aal2') {
      const { data: fatores } = await supabase.auth.mfa.listFactors()
      const totp = fatores?.totp?.find((f) => f.status === 'verified')
      if (totp) {
        setFatorId(totp.id)
        setCarregando(false)
        setPasso('codigo')
        return
      }
    }
    setCarregando(false)
    entrarNoSistema()
  }

  async function onCodigo(e: React.FormEvent) {
    e.preventDefault()
    if (!fatorId) return
    if (!/^\d{6}$/.test(codigo)) {
      setErro('O código tem 6 dígitos.')
      return
    }
    setErro(null)
    setCarregando(true)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fatorId, code: codigo })
    setCarregando(false)
    if (error) {
      setErro('Código não confere. Confira o aplicativo autenticador e tente de novo.')
      return
    }
    entrarNoSistema()
  }

  async function usarOutroEmail() {
    await supabase.auth.signOut()
    setCodigo('')
    setFatorId(null)
    setErro(null)
    setPasso('entrar')
  }

  return (
    <div className="grid min-h-dvh bg-campo lg:grid-cols-[minmax(0,460px)_1fr]">
      {/* Painel da marca: a escala é a porta. */}
      <aside className="relative hidden overflow-hidden bg-[#0B3B34] px-12 py-10 lg:flex lg:flex-col">
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-40 h-[520px] w-[180px] rotate-[35deg] rounded-capsula bg-marca/35" />
        <div aria-hidden className="pointer-events-none absolute top-40 -right-10 h-[520px] w-[140px] rotate-[35deg] rounded-capsula bg-marca/20" />
        <div className="relative flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-controle bg-white/10 text-apoio font-semibold text-white">CC</span>
          <span className="text-corpo font-semibold text-white">Chefe Coruja</span>
        </div>
        <div className="relative mt-auto mb-auto pt-16">
          <h1 className="text-[40px] leading-[1.08] font-semibold tracking-[-0.02em] text-white">
            O turno começa <span className="text-[#5EEAD4]">quando a escala diz</span>
          </h1>
          <p className="mt-4 max-w-sm text-corpo text-white/80">
            A entrada é conferida contra a escala e o relógio do servidor. Fora do seu horário, a plataforma não abre.
          </p>
          <ul className="mt-8 flex max-w-sm flex-col gap-5">
            <Argumento icone={CalendarClock} cor="bg-leitos" titulo="Escala antes da senha" texto="O acesso vale para a janela do plantão, não para o dia inteiro." />
            <Argumento icone={MapPin} cor="bg-suprimento" titulo="Check-in dentro do raio" texto="A presença é confirmada na unidade; o horário fica registrado." />
            <Argumento icone={ShieldCheck} cor="bg-acao" titulo="Cada registro tem autor" texto="Quem escreve é quem está no login. Nada sai em nome de outro." />
          </ul>
        </div>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-[400px] lg:mt-10">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-8 place-items-center rounded-controle-sm bg-marca text-rotulo font-semibold text-white">CC</span>
            <span className="text-corpo font-semibold text-tinta">Chefe Coruja</span>
          </div>

          {passo !== 'codigo' && (
            <div role="tablist" aria-label="Acesso" className="mb-7 grid grid-cols-2 rounded-container bg-trilha p-1">
              {(['entrar', 'primeira-vez'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={passo === p}
                  onClick={() => { setPasso(p); setErro(null) }}
                  className={cn('rounded-controle py-2 text-apoio transition-colors', passo === p ? 'bg-superficie font-semibold text-acao shadow-repouso' : 'text-tinta-apoio hover:text-acao')}
                >
                  {p === 'entrar' ? 'Entrar' : 'Primeira vez'}
                </button>
              ))}
            </div>
          )}

          {passo === 'entrar' && (
            <form onSubmit={onEntrar} noValidate className="flex flex-col gap-4">
              <div>
                <h2 className="text-titulo leading-[1.1] font-semibold tracking-[-0.02em] text-tinta">Entrar no plantão</h2>
                <p className="mt-1.5 text-apoio text-tinta-sussurro">Use o e-mail da sua unidade. A senha é pessoal e não é compartilhada entre papéis.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="text-apoio font-medium text-grafite">E-mail</Label>
                <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!erro} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="senha" className="text-apoio font-medium text-grafite">Senha</Label>
                <Input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} aria-invalid={!!erro} />
              </div>
              {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
              <button type="submit" disabled={carregando} className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-controle bg-acao-pressionada text-corpo font-medium text-white hover:bg-acao disabled:opacity-60">
                {carregando ? 'Entrando…' : 'Entrar'}
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </form>
          )}

          {passo === 'primeira-vez' && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-titulo leading-[1.1] font-semibold tracking-[-0.02em] text-tinta">Não existe cadastro próprio</h2>
                <p className="mt-1.5 text-apoio text-tinta-sussurro">
                  O acesso nasce de um convite da unidade ou do contrato da rede. Ninguém se cadastra sozinho: só a coordenação sabe quem está na escala.
                </p>
              </div>
              <div className="flex gap-3 rounded-container border border-fio bg-superficie p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-controle bg-leitos text-white" aria-hidden><Stethoscope className="size-[18px]" /></span>
                <div>
                  <p className="text-corpo font-semibold text-tinta">Plantonista</p>
                  <p className="text-apoio text-tinta-sussurro">A coordenação da unidade avisa quando o acesso estiver pronto. Você cria a sua senha com o e-mail corporativo, e a coordenação libera o vínculo.</p>
                </div>
              </div>
              <div className="flex gap-3 rounded-container border border-fio bg-superficie p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-controle bg-suprimento text-white" aria-hidden><Building2 className="size-[18px]" /></span>
                <div>
                  <p className="text-corpo font-semibold text-tinta">Coordenação e administração</p>
                  <p className="text-apoio text-tinta-sussurro">Entram pelo contrato da rede. É a coordenação que depois libera as equipes.</p>
                </div>
              </div>
              <Link to="/cadastro" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-controle border border-fio bg-superficie text-corpo font-medium text-tinta-apoio hover:border-acao hover:text-acao">
                <KeyRound className="size-4" aria-hidden />
                Ativar meu acesso
              </Link>
            </div>
          )}

          {passo === 'codigo' && (
            <form onSubmit={onCodigo} noValidate className="flex flex-col gap-4">
              <div>
                <h2 className="text-titulo leading-[1.1] font-semibold tracking-[-0.02em] text-tinta">Confirme que é você</h2>
                <p className="mt-1.5 text-apoio text-tinta-sussurro">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="codigo" className="text-apoio font-medium text-grafite">Código de 6 dígitos</Label>
                {/* Sem placeholder: "000000" legível se confunde com valor digitado. */}
                <input
                  id="codigo"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  aria-invalid={!!erro}
                  className="min-h-[54px] rounded-controle border border-fio bg-campo text-center text-[24px] font-semibold tracking-[0.3em] text-tinta tabular outline-none focus-visible:border-marca"
                />
              </div>
              {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
              <button type="submit" disabled={carregando} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-controle bg-acao-pressionada text-corpo font-medium text-white hover:bg-acao disabled:opacity-60">
                {carregando ? 'Conferindo…' : 'Confirmar'}
              </button>
              <button type="button" onClick={usarOutroEmail} className="text-apoio text-tinta-sussurro hover:text-acao">
                Usar outro e-mail
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
