import { Lock, LogOut } from 'lucide-react'
import { useState } from 'react'

import { supabase } from '@/lib/supabase'
import { useTurnstile } from '@/components/seguranca/Turnstile'

// A tela do bloqueio por inatividade (regras em useBloqueioOcioso.ts).

/** session_id do token atual (claim do JWT da Supabase), ou null. */
async function sessaoAtual(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    const parte = data.session?.access_token.split('.')[1]
    if (!parte) return null
    const json = JSON.parse(atob(parte.replace(/-/g, '+').replace(/_/g, '/'))) as { session_id?: unknown }
    return typeof json.session_id === 'string' ? json.session_id : null
  } catch {
    return null
  }
}

export function TelaBloqueada({
  nome,
  email,
  contexto,
  onDesbloquear,
  onSair,
}: {
  nome?: string
  email?: string | null
  contexto?: string
  onDesbloquear: () => void
  onSair: () => void
}) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const turnstile = useTurnstile()
  const [conferindo, setConferindo] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !senha || conferindo) return
    if (!turnstile.pronto) {
      setErro(turnstile.falha ?? 'Aguarde a verificação anti-robô terminar e tente de novo.')
      return
    }
    setConferindo(true)
    setErro(null)
    // id da sessão atual (já confirmada no segundo fator): o desbloqueio abre
    // uma sessão nova e herda essa confirmação (RT, 03/10/2026)
    const anterior = await sessaoAtual()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha, options: { captchaToken: turnstile.captchaToken } })
    // o token do Turnstile vale para uma tentativa só
    turnstile.resetar()
    if (!error && anterior) {
      // sem herdar (confirmação vencida, outra pessoa…), o portão pede o código
      await supabase.rpc('herdar_segundo_fator', { p_sessao_anterior: anterior })
      // a sessão anterior acaba aqui, e a chave dos rascunhos passa para a nova
      // (item 19: cada desbloqueio deixava uma sessão viva). Sem 2FA herdado o
      // banco recusa; aí quem encerra é a inatividade de 30 min do servidor.
      await supabase.rpc('encerrar_sessao_anterior', { p_sessao_anterior: anterior })
    }
    setConferindo(false)
    setSenha('')
    if (error) {
      setErro(/invalid login credentials/i.test(error.message) ? 'Senha não confere.' : /rate limit|too many/i.test(error.message)
        ? 'Muitas tentativas em pouco tempo. Espere alguns minutos.' : /captcha/i.test(error.message)
          ? 'A verificação anti-robô expirou. Tente de novo.' : 'Não foi possível conferir a senha agora. Confira a rede e tente de novo.')
      return
    }
    onDesbloquear()
  }

  return (
    <div
      data-cc-bloqueio
      role="dialog"
      aria-modal="true"
      aria-labelledby="cc-bloqueio-titulo"
      className="fixed inset-0 z-[1000] grid place-items-center bg-campo p-6"
    >
      <form onSubmit={enviar} className="flex w-full max-w-[380px] flex-col gap-3.5 rounded-[18px] border border-fio bg-superficie px-7 pt-7 pb-6 shadow-dialogo">
        <div className="grid size-11 place-items-center rounded-container bg-marca/10 text-acao">
          <Lock className="size-[22px]" aria-hidden />
        </div>
        <h2 id="cc-bloqueio-titulo" className="m-0 text-dialogo font-semibold tracking-[-0.02em] text-tinta">
          Tela bloqueada
        </h2>
        <p className="m-0 text-controle leading-[1.55] text-pretty text-tinta-apoio">
          {nome ? `Sessão de ${nome}` : 'Sessão em uso'}
          {contexto ? ` · ${contexto}` : ''}. Para continuar, digite a sua senha.
        </p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          aria-label="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="min-h-11 rounded-controle border border-fio bg-campo px-3 text-corpo text-tinta outline-none focus-visible:border-marca"
        />
        {turnstile.widget}
        {erro && (
          <p role="alert" className="m-0 text-controle text-critico">
            {erro}
          </p>
        )}
        <button
          type="submit"
          disabled={!senha || conferindo}
          className="inline-flex min-h-11 items-center justify-center rounded-controle bg-acao px-4 text-controle font-medium text-white hover:bg-acao-pressionada disabled:opacity-45"
        >
          {conferindo ? 'Conferindo…' : 'Desbloquear'}
        </button>
        <button type="button" onClick={onSair} className="inline-flex items-center justify-center gap-2 py-1 text-apoio text-tinta-sussurro hover:text-critico">
          <LogOut className="size-4" aria-hidden />
          Não sou {nome?.split(' ')[0] ?? 'eu'} — sair
        </button>
        <p className="m-0 text-rotulo leading-[1.45] text-pretty text-tinta-sussurro">
          A tela bloqueia depois de 10 minutos sem uso, e a sessão acaba em 30. O que já foi registrado não se perde.
        </p>
      </form>
    </div>
  )
}
