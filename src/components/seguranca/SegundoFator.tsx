import { useQueryClient } from '@tanstack/react-query'
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { lerTentativasSegundoFator, MAX_TENTATIVAS_SEGUNDO_FATOR, useSegundoFator } from '@/hooks/useSegundoFator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

// Segundo fator (ADR 0010): TOTP de aplicativo autenticador, pedido uma vez a
// cada 24 horas e em todo login novo (o aal2 é da sessão). A exigência só
// vale quando a chave `exigir_segundo_fator` estiver ligada no banco.
// Não existe "confiar neste aparelho por 30 dias" (regra do protótipo): o
// ADR 0010 a recusou — um celular roubado ficaria semanas com acesso clínico.

function CampoCodigo({ valor, onChange, erro }: { valor: string; onChange: (v: string) => void; erro: string | null }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="codigo-2fa" className="text-apoio font-medium text-grafite">Código de 6 dígitos</label>
      {/* Sem placeholder: "000000" legível se confunde com valor digitado. */}
      <input
        id="codigo-2fa"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        value={valor}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        aria-invalid={!!erro}
        className="min-h-[54px] rounded-controle border border-fio bg-campo text-center text-[24px] font-semibold tracking-[0.3em] text-tinta tabular outline-none focus-visible:border-marca"
      />
      {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
    </div>
  )
}

/** Cadastro do autenticador: QR, chave manual e confirmação com o primeiro código. */
export function CadastroSegundoFator({ onPronto }: { onPronto: () => void }) {
  const [cadastro, setCadastro] = React.useState<{ id: string; qr: string; segredo: string } | null>(null)
  const [codigo, setCodigo] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)

  async function iniciar() {
    setErro(null)
    setOcupado(true)
    // Um cadastro que ficou pela metade (não verificado) é descartado antes.
    const { data: fatores } = await supabase.auth.mfa.listFactors()
    for (const f of fatores?.all ?? []) {
      if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Autenticador ${new Date().toLocaleDateString('pt-BR')}` })
    setOcupado(false)
    if (error || !data) {
      setErro(error?.message ?? 'Não foi possível iniciar o cadastro.')
      return
    }
    setCadastro({ id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret })
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!cadastro || codigo.length !== 6) return
    setErro(null)
    setOcupado(true)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: cadastro.id, code: codigo })
    setOcupado(false)
    if (error) {
      setErro('Código não confere. Confira a hora do celular e o código atual do aplicativo.')
      return
    }
    onPronto()
  }

  if (!cadastro) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-apoio text-tinta-apoio">
          Use um aplicativo autenticador (Google Authenticator, Microsoft Authenticator, Authy ou outro). O código é pedido uma vez a cada 24 horas e sempre que você entrar por outro aparelho.
        </p>
        {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
        <div>
          <Button onClick={iniciar} disabled={ocupado}>
            {ocupado ? <Spinner /> : <KeyRound />} Configurar o autenticador
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={confirmar} className="flex flex-col gap-4">
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-apoio text-tinta-apoio">
        <li>Abra o aplicativo autenticador e escolha adicionar conta.</li>
        <li>Aponte a câmera para o código abaixo (ou digite a chave).</li>
        <li>Digite o código de 6 dígitos que o aplicativo mostrar.</li>
      </ol>
      <div className="flex flex-wrap items-center gap-4">
        <img src={cadastro.qr} alt="QR code para o aplicativo autenticador" className="size-44 rounded-controle border border-fio bg-white p-2" />
        <div className="min-w-0 flex-1">
          <p className="rotulo text-tinta-sussurro">Chave para digitar à mão</p>
          <p className="mt-1 font-mono text-apoio break-all text-tinta select-all">{cadastro.segredo}</p>
        </div>
      </div>
      <CampoCodigo valor={codigo} onChange={setCodigo} erro={erro} />
      <div>
        <Button type="submit" disabled={ocupado || codigo.length !== 6}>
          {ocupado ? <Spinner /> : <ShieldCheck />} Confirmar e ativar
        </Button>
      </div>
    </form>
  )
}

const horaCurta = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

function falta(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Confirmação do código do autenticador já cadastrado (login e portão da
 * casca). Confere sozinho ao digitar o 6º dígito. Os erros são contados NO
 * SERVIDOR (hook de verificação do Auth): 3 seguidos bloqueiam por 15 min, e
 * durante o bloqueio nem o código certo passa — a tela só espelha isso.
 */
export function ConfirmarSegundoFator({
  fatorId,
  onPronto,
  rotulo = 'Confirmar',
}: {
  fatorId: string
  onPronto: () => void
  rotulo?: string
}) {
  const [codigo, setCodigo] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)
  const [bloqueadoAte, setBloqueadoAte] = React.useState<Date | null>(null)
  const [agora, setAgora] = React.useState(() => Date.now())
  const enviando = React.useRef(false)
  const campo = React.useRef<HTMLInputElement>(null)

  const bloqueado = !!bloqueadoAte && bloqueadoAte.getTime() > agora

  // Quem chega com a conta já bloqueada vê o bloqueio antes de digitar.
  React.useEffect(() => {
    let vivo = true
    void lerTentativasSegundoFator().then((t) => {
      if (vivo && t?.bloqueadoAte && t.bloqueadoAte.getTime() > Date.now()) {
        setBloqueadoAte(t.bloqueadoAte)
        setErro(`Muitos códigos errados. Tente de novo depois de ${horaCurta(t.bloqueadoAte)}.`)
      }
    })
    return () => {
      vivo = false
    }
  }, [])

  // Relógio do bloqueio: conta até o fim e libera o campo sozinho.
  React.useEffect(() => {
    if (!bloqueadoAte) return
    const id = window.setInterval(() => {
      const t = Date.now()
      setAgora(t)
      if (t >= bloqueadoAte.getTime()) {
        window.clearInterval(id)
        setBloqueadoAte(null)
        setErro(null)
        window.setTimeout(() => campo.current?.focus(), 0)
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [bloqueadoAte])

  async function confirmar(valor: string) {
    if (enviando.current || bloqueado) return
    if (!/^\d{6}$/.test(valor)) {
      setErro('Digite os 6 dígitos do código.')
      return
    }
    enviando.current = true
    setErro(null)
    setOcupado(true)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fatorId, code: valor })
    if (!error) {
      onPronto()
      return
    }
    const semRede = error.name === 'AuthRetryableFetchError'
    const t = semRede ? null : await lerTentativasSegundoFator()
    enviando.current = false
    setOcupado(false)
    if (semRede) {
      setErro('Sem conexão com o servidor. Confira a rede e tente de novo.')
    } else if (t?.bloqueadoAte && t.bloqueadoAte.getTime() > Date.now()) {
      setAgora(Date.now())
      setBloqueadoAte(t.bloqueadoAte)
      setCodigo('')
      setErro(`Três códigos errados. Por segurança, o código fica bloqueado até ${horaCurta(t.bloqueadoAte)}.`)
      return
    } else if (t && t.restantes < MAX_TENTATIVAS_SEGUNDO_FATOR) {
      setErro(t.restantes === 1 ? 'Código não confere. Resta 1 tentativa.' : `Código não confere. Restam ${t.restantes} tentativas.`)
    } else {
      setErro('Código não confere. Confira o aplicativo autenticador e tente de novo.')
    }
    window.setTimeout(() => campo.current?.select(), 0)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void confirmar(codigo)
      }}
      noValidate
      className="flex flex-col gap-3.5"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="codigo-2fa" className="text-apoio font-medium text-grafite">Código de 6 dígitos</label>
        {/* Sem placeholder: "000000" legível se confunde com valor digitado. */}
        <input
          ref={campo}
          id="codigo-2fa"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          disabled={bloqueado}
          readOnly={ocupado}
          value={codigo}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 6)
            setCodigo(v)
            if (erro && v.length < 6 && !bloqueado) setErro(null)
            if (v.length === 6) void confirmar(v)
          }}
          aria-invalid={!!erro}
          aria-describedby="codigo-2fa-ajuda"
          className="min-h-[54px] rounded-controle border border-fio bg-campo text-center indent-[0.26em] text-[26px] font-semibold tracking-[0.26em] text-tinta tabular outline-none focus-visible:border-marca disabled:bg-trilha disabled:text-tinta-sussurro"
        />
        <span id="codigo-2fa-ajuda" className="text-rotulo text-tinta-sussurro">
          {bloqueado && bloqueadoAte
            ? `Liberado em ${falta(bloqueadoAte.getTime() - agora)}.`
            : 'O código muda a cada 30 segundos no aplicativo; confere sozinho ao digitar o 6º dígito.'}
        </span>
        {erro && <p role="alert" className="mt-1 text-controle text-pretty text-critico">{erro}</p>}
      </div>
      <button
        type="submit"
        disabled={ocupado || bloqueado}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-controle bg-acao-pressionada text-corpo font-medium text-white hover:bg-acao disabled:opacity-60"
      >
        {ocupado ? <Spinner /> : <ShieldCheck className="size-4" aria-hidden />}
        {ocupado ? 'Conferindo…' : rotulo}
      </button>
    </form>
  )
}

/**
 * Portão da casca: com a exigência ligada e a sessão sem segundo fator válido,
 * pede o cadastro (quem ainda não tem) ou o código (quem já tem).
 */
export function PortaoSegundoFator({ fatorId, onSair }: { fatorId: string | null; onSair: () => void }) {
  const queryClient = useQueryClient()
  const pronto = () => {
    // O token novo (aal2) já está na sessão; tudo que foi negado é relido.
    void queryClient.invalidateQueries()
  }
  return (
    <div className="flex min-h-dvh items-center justify-center bg-campo p-4">
      <section className="w-full max-w-[460px] rounded-cartao border border-fio bg-superficie p-6 shadow-repouso">
        <span className="grid size-[42px] place-items-center rounded-controle bg-marca/10 text-acao" aria-hidden>
          <ShieldCheck className="size-5" />
        </span>
        <h1 className="mt-4 text-titulo leading-[1.1] font-semibold tracking-[-0.02em] text-tinta">
          {fatorId ? 'Confirme que é você' : 'Ative o segundo fator'}
        </h1>
        <p className="mt-1.5 mb-5 text-apoio text-tinta-sussurro">
          {fatorId
            ? 'Faz 24 horas desde a última confirmação, ou este é um login novo. Digite o código do seu aplicativo autenticador.'
            : 'O acesso a dados de paciente exige um segundo fator. Configure o aplicativo autenticador uma vez; depois o código é pedido a cada 24 horas.'}
        </p>
        {fatorId ? <ConfirmarSegundoFator fatorId={fatorId} onPronto={pronto} /> : <CadastroSegundoFator onPronto={pronto} />}
        <button type="button" onClick={onSair} className="mt-5 flex items-center gap-1.5 text-apoio text-tinta-sussurro hover:text-acao">
          <LogOut className="size-4" aria-hidden /> Sair
        </button>
      </section>
    </div>
  )
}

/** Seção do Perfil: estado do segundo fator e cadastro do autenticador. */
export function SecaoSegundoFator() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useSegundoFator()
  const [removendo, setRemovendo] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const atualizar = () => void queryClient.invalidateQueries({ queryKey: ['segundo-fator'] })

  async function remover() {
    if (!data?.fatorId) return
    setErro(null)
    setRemovendo(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: data.fatorId })
    setRemovendo(false)
    if (error) setErro('Para remover o autenticador, confirme o código dele primeiro (saia e entre de novo).')
    atualizar()
  }

  return (
    <section aria-label="Segundo fator" className="rounded-cartao border border-fio bg-superficie p-5 shadow-repouso">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ShieldCheck className="size-4 text-tinta-apoio" aria-hidden />
        <h2 className="text-secao font-semibold tracking-[-0.01em] text-tinta">Segundo fator</h2>
        {data?.fatorId ? <Badge variant="success">Ativo</Badge> : <Badge variant="warning">Não configurado</Badge>}
        {data?.exigido && <Badge variant="secondary">Exigido pela plataforma</Badge>}
      </div>
      {isLoading ? (
        <Spinner />
      ) : data?.fatorId ? (
        <div className="flex flex-col gap-2 text-apoio text-tinta-apoio">
          <p>
            O código do aplicativo autenticador é pedido uma vez a cada 24 horas e em todo login novo.
            {data.verificadoEm && ` Última confirmação: ${data.verificadoEm.toLocaleString('pt-BR')}.`}
          </p>
          {erro && <p role="alert" className="text-critico">{erro}</p>}
          <div>
            <Button variant="destructive" size="sm" onClick={remover} disabled={removendo}>
              Remover autenticador
            </Button>
          </div>
        </div>
      ) : (
        <CadastroSegundoFator onPronto={atualizar} />
      )}
    </section>
  )
}
