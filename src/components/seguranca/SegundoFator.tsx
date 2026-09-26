import { useQueryClient } from '@tanstack/react-query'
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useSegundoFator } from '@/hooks/useSegundoFator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

// Segundo fator (ADR 0010): TOTP de aplicativo autenticador, pedido uma vez a
// cada 24 horas e em todo login novo (o aal2 é da sessão). A exigência só
// vale quando a chave `exigir_segundo_fator` estiver ligada no banco.

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

/** Confirmação diária: código do autenticador já cadastrado. */
export function ConfirmarSegundoFator({ fatorId, onPronto }: { fatorId: string; onPronto: () => void }) {
  const [codigo, setCodigo] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (codigo.length !== 6) return
    setErro(null)
    setOcupado(true)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fatorId, code: codigo })
    setOcupado(false)
    if (error) {
      setErro('Código não confere. Confira o aplicativo autenticador e tente de novo.')
      return
    }
    onPronto()
  }

  return (
    <form onSubmit={confirmar} className="flex flex-col gap-4">
      <CampoCodigo valor={codigo} onChange={setCodigo} erro={erro} />
      <div>
        <Button type="submit" disabled={ocupado || codigo.length !== 6}>
          {ocupado ? <Spinner /> : <ShieldCheck />} Confirmar
        </Button>
      </div>
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
