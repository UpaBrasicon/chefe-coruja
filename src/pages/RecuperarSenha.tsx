import * as React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, MailCheck } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { conferirSenha } from '@/lib/senha'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { ConfereSenha, RegrasSenha } from '@/components/seguranca/RegrasSenha'
import { ConfirmarSegundoFator } from '@/components/seguranca/SegundoFator'
import { LadoMarca, MarcaCompacta } from '@/pages/entrada/LadoMarca'
import '@/pages/entrada/entrada.css'

// Recuperação de senha, nas duas pontas:
//   1. pedir: e-mail → resetPasswordForEmail com retorno para esta rota. A
//      resposta é sempre a mesma, exista ou não a conta (não revela e-mail).
//   2. trocar: o link do e-mail volta aqui com `type=recovery` no hash (o
//      index.html grava sessionStorage['supabase_recovery']); a Supabase abre
//      uma sessão de recuperação e a pessoa escolhe a senha nova, com as
//      regras do primeiro acesso marcadas ao vivo. Se a conta tem segundo
//      fator, o Auth pode pedir aal2 para trocar a senha: aí o código do
//      autenticador é pedido antes.
// Ao terminar, TODAS as sessões da conta são encerradas e a pessoa volta ao
// login com aviso.

type Modo = 'pedir' | 'enviado' | 'conferindo' | 'trocar' | 'codigo' | 'expirado'

const MARCA_RECUPERACAO = 'supabase_recovery'
const CAMPO = 'min-h-11 bg-superficie px-[13px] py-[11px] text-corpo md:text-corpo'
const BOTAO =
  'mt-1.5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-controle bg-acao-pressionada px-[18px] text-corpo font-medium text-white hover:bg-[#0B3D3A] hover:text-white disabled:opacity-60'
const TITULO = 'mb-1.5 text-[26px] leading-[1.15] font-semibold tracking-[-0.026em] text-acao-pressionada'
const SUB = 'mb-[22px] text-corpo text-pretty text-tinta-apoio'

function marcaRecuperacao(): boolean {
  try {
    return sessionStorage.getItem(MARCA_RECUPERACAO) === '1'
  } catch {
    return false
  }
}
function limparMarca() {
  try {
    sessionStorage.removeItem(MARCA_RECUPERACAO)
  } catch {
    /* nada a limpar */
  }
}

function modoInicial(): Modo {
  const hash = window.location.hash
  if (/error_code=|error=/.test(hash)) return 'expirado'
  if (marcaRecuperacao() || hash.includes('type=recovery')) return 'conferindo'
  return 'pedir'
}

export default function RecuperarSenha() {
  const navigate = useNavigate()
  const location = useLocation()
  const emailDoLogin = (location.state as { email?: string } | null)?.email ?? ''

  const [modo, setModo] = React.useState<Modo>(modoInicial)
  const [email, setEmail] = React.useState(emailDoLogin)
  const [emailConta, setEmailConta] = React.useState('')
  const [senha, setSenha] = React.useState('')
  const [confirmacao, setConfirmacao] = React.useState('')
  const [fatorId, setFatorId] = React.useState<string | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)

  React.useEffect(() => {
    document.title = 'Recuperar senha · Chefe Coruja'
  }, [])

  // Chegada pelo link: espera a Supabase ler o hash e confere a sessão.
  React.useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === 'PASSWORD_RECOVERY' && sessao) {
        setEmailConta(sessao.user.email ?? '')
        setModo('trocar')
      }
    })
    if (modo === 'conferindo') {
      void supabase.auth.getSession().then(({ data: s, error }) => {
        if (error || !s.session) {
          limparMarca()
          setModo('expirado')
          return
        }
        setEmailConta(s.session.user.email ?? '')
        setModo('trocar')
      })
    }
    return () => data.subscription.unsubscribe()
    // Só na montagem: o modo inicial decide se há link a conferir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const conferencia = conferirSenha(senha, confirmacao, emailConta)

  async function pedir(e: React.FormEvent) {
    e.preventDefault()
    const alvo = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alvo)) {
      setErro('Informe o e-mail da sua conta.')
      return
    }
    setErro(null)
    setOcupado(true)
    const { error } = await supabase.auth.resetPasswordForEmail(alvo, {
      redirectTo: `${window.location.origin}/recuperar-senha`,
    })
    setOcupado(false)
    // Conta inexistente e conta existente respondem igual. Só o que não é
    // sobre a conta (limite de envio, rede) vira aviso.
    if (error?.status === 429) {
      setErro('Muitos pedidos em pouco tempo. Espere alguns minutos e tente de novo.')
      return
    }
    if (error?.name === 'AuthRetryableFetchError') {
      setErro('Sem conexão com o servidor. Confira a rede e tente de novo.')
      return
    }
    setModo('enviado')
  }

  async function gravarSenha() {
    setErro(null)
    setOcupado(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (!error) {
      limparMarca()
      // Senha trocada: nenhuma sessão antiga (nem esta de recuperação) continua.
      await supabase.auth.signOut({ scope: 'global' })
      navigate('/login', { replace: true, state: { aviso: 'Senha trocada. Entre com a senha nova.', email: emailConta } })
      return
    }
    setOcupado(false)
    if (error.code === 'insufficient_aal') {
      const { data: fatores } = await supabase.auth.mfa.listFactors()
      const totp = fatores?.totp?.find((f) => f.status === 'verified')
      if (totp) {
        setFatorId(totp.id)
        setModo('codigo')
        return
      }
    }
    if (error.code === 'same_password') setErro('A senha nova precisa ser diferente da atual.')
    else if (error.code === 'weak_password') setErro('O servidor recusou a senha por ser fraca. Escolha outra.')
    else if (error.name === 'AuthRetryableFetchError') setErro('Sem conexão com o servidor. Confira a rede e tente de novo.')
    else setErro('Não foi possível trocar a senha agora. Peça um link novo se o problema continuar.')
  }

  async function trocar(e: React.FormEvent) {
    e.preventDefault()
    if (!conferencia.valida || ocupado) return
    await gravarSenha()
  }

  async function desistir(ev: React.MouseEvent<HTMLAnchorElement>) {
    // Sessão de recuperação aberta e abandonada: encerra antes de sair.
    if (modo === 'trocar' || modo === 'codigo') {
      ev.preventDefault()
      limparMarca()
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="grid min-h-dvh bg-campo lg:grid-cols-[46%_minmax(0,1fr)]">
      <LadoMarca />

      <main className="flex flex-col px-5 pt-6 pb-10 sm:px-12 sm:pt-7">
        <Link to="/login" onClick={desistir} className="cc-voltar inline-flex items-center gap-[7px] self-start text-controle text-tinta-sussurro hover:text-acao">
          <ArrowLeft className="size-[15px]" aria-hidden />
          Voltar ao login
        </Link>

        <div className="cc-entra m-auto w-full max-w-[420px] py-7">
          <MarcaCompacta />

          {modo === 'pedir' && (
            <section aria-labelledby="titulo-pedir">
              <h2 id="titulo-pedir" className={TITULO}>Esqueci a senha</h2>
              <p className={SUB}>Informe o e-mail da sua conta. Enviamos um link para você escolher uma senha nova.</p>
              <form onSubmit={pedir} noValidate className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rec-email" className="text-apoio font-medium text-tinta-apoio">E-mail corporativo</Label>
                  <Input id="rec-email" type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!erro} className={CAMPO} />
                </div>
                {erro && <p role="alert" className="text-controle text-critico">{erro}</p>}
                <button type="submit" disabled={ocupado} className={BOTAO}>
                  {ocupado ? 'Enviando…' : 'Enviar o link'}
                  <ArrowRight className="size-4" aria-hidden />
                </button>
              </form>
              <p className="mt-[22px] text-apoio text-pretty text-tinta-sussurro">
                A senha é pessoal: nem a coordenação nem a administração a veem ou trocam por você.
              </p>
            </section>
          )}

          {modo === 'enviado' && (
            <section aria-labelledby="titulo-enviado" role="status">
              <span className="mb-4 grid size-[42px] place-items-center rounded-controle bg-alerta-marca text-acao" aria-hidden>
                <MailCheck className="size-5" />
              </span>
              <h2 id="titulo-enviado" className={TITULO}>Confira o seu e-mail</h2>
              <p className={SUB}>
                Se houver conta com esse e-mail, enviamos o link para trocar a senha. Ele vale por 1 hora e só pode ser usado uma vez.
              </p>
              <p className="text-apoio text-pretty text-tinta-sussurro">
                Não chegou em alguns minutos? Veja a caixa de spam ou{' '}
                <button type="button" onClick={() => { setErro(null); setModo('pedir') }} className="font-medium text-acao hover:text-acao-pressionada">
                  peça de novo
                </button>
                .
              </p>
            </section>
          )}

          {modo === 'conferindo' && (
            <div className="flex justify-center py-10">
              <Spinner rotulo="Conferindo o link" />
            </div>
          )}

          {modo === 'expirado' && (
            <section aria-labelledby="titulo-expirado">
              <h2 id="titulo-expirado" className={TITULO}>O link não vale mais</h2>
              <p className={SUB}>O link de troca de senha expirou ou já foi usado. Peça um novo; ele chega em poucos minutos.</p>
              <button type="button" onClick={() => { window.history.replaceState(null, '', '/recuperar-senha'); setModo('pedir') }} className={BOTAO}>
                Pedir um link novo
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </section>
          )}

          {modo === 'trocar' && (
            <section aria-labelledby="titulo-trocar">
              <h2 id="titulo-trocar" className={TITULO}>Escolha a senha nova</h2>
              <p className={SUB}>
                {emailConta ? <>Para a conta <b className="font-semibold text-tinta">{emailConta}</b>. </> : null}
                Ao salvar, as sessões abertas em outros aparelhos são encerradas.
              </p>
              <form onSubmit={trocar} noValidate className="flex flex-col gap-3.5">
                {/* Campo oculto: gerenciadores de senha associam a senha nova à conta certa. */}
                <input type="email" autoComplete="username" value={emailConta} readOnly hidden />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rec-senha" className="text-apoio font-medium text-tinta-apoio">Senha nova</Label>
                  <Input id="rec-senha" type="password" autoComplete="new-password" autoFocus value={senha} onChange={(e) => setSenha(e.target.value)} aria-describedby="rec-regras" className={CAMPO} />
                  <RegrasSenha id="rec-regras" regras={conferencia.regras} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rec-senha2" className="text-apoio font-medium text-tinta-apoio">Repetir a senha</Label>
                  <Input id="rec-senha2" type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} aria-invalid={!!confirmacao && !conferencia.conferem} className={CAMPO} />
                  <ConfereSenha confirmacao={confirmacao} conferem={conferencia.conferem} />
                </div>
                {erro && <p role="alert" className="text-controle text-critico">{erro}</p>}
                <button type="submit" disabled={!conferencia.valida || ocupado} className={BOTAO}>
                  {ocupado ? 'Salvando…' : 'Salvar a senha nova'}
                  <ArrowRight className="size-4" aria-hidden />
                </button>
              </form>
            </section>
          )}

          {modo === 'codigo' && fatorId && (
            <section aria-labelledby="titulo-codigo-rec">
              <h2 id="titulo-codigo-rec" className={TITULO}>Confirme que é você</h2>
              <p className={SUB}>A sua conta tem segundo fator. Para trocar a senha, digite o código do aplicativo autenticador.</p>
              <ConfirmarSegundoFator fatorId={fatorId} onPronto={() => { setModo('trocar'); void gravarSenha() }} rotulo="Confirmar e salvar" />
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
