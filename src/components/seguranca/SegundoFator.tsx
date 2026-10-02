import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Laptop, LogOut, Mail, ShieldCheck, Trash2 } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { lerTentativasSegundoFator, MAX_TENTATIVAS_SEGUNDO_FATOR, useSegundoFator } from '@/hooks/useSegundoFator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

// Segundo fator: código por EMAIL (padrão) + dispositivo confiável, e TOTP de
// aplicativo autenticador como alternativa. Pedido em todo login de dispositivo
// novo; "confiar neste dispositivo" guarda um token (30 dias) que pula o email.
// A exigência só vale com a chave `exigir_segundo_fator` ligada no banco.
// Reversão consciente do ADR 0010 ("confiar no aparelho"): mitigada por
// dispositivos REVOGÁVEIS (seção abaixo) e token guardado só como hash.

// ── Dispositivo confiável (token no navegador) ───────────────────────────────
const CHAVE_DISPOSITIVO = 'cc_dispositivo_2fa'
function lerTokenDispositivo(): string | null {
  try { return localStorage.getItem(CHAVE_DISPOSITIVO) } catch { return null }
}
function salvarTokenDispositivo(t: string) {
  try { localStorage.setItem(CHAVE_DISPOSITIVO, t) } catch { /* modo privado */ }
}
function limparTokenDispositivo() {
  try { localStorage.removeItem(CHAVE_DISPOSITIVO) } catch { /* modo privado */ }
}
/** Rótulo amigável do dispositivo atual, para a lista de confiáveis. */
function rotuloDispositivo(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const so = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'dispositivo'
  const nav = /Edg/.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome'
    : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'navegador'
  return `${nav} em ${so}`
}

/** Mensagem legível a partir de um erro de Edge Function (lê o corpo JSON). */
async function mensagemErroFuncao(error: unknown, fallback: string): Promise<string> {
  try {
    const ctx = (error as { context?: Response }).context
    if (ctx) { const j = await ctx.json(); if (j?.erro) return String(j.erro) }
  } catch { /* corpo não-JSON */ }
  return fallback
}

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
 * Segundo fator por EMAIL: pede o envio do código, confere, e opcionalmente
 * guarda o dispositivo como confiável (pula o email nos próximos logins).
 */
export function ConfirmarSegundoFatorEmail({ onPronto }: { onPronto: () => void }) {
  const [etapa, setEtapa] = React.useState<'pedir' | 'codigo'>('pedir')
  const [codigo, setCodigo] = React.useState('')
  const [confiar, setConfiar] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)
  const [reenvioEm, setReenvioEm] = React.useState(0)
  const [agora, setAgora] = React.useState(() => Date.now())
  const enviando = React.useRef(false)

  React.useEffect(() => {
    if (!reenvioEm) return
    const id = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [reenvioEm])
  const faltaReenvio = Math.max(0, Math.ceil((reenvioEm - agora) / 1000))

  async function enviar() {
    setErro(null)
    setOcupado(true)
    const { error } = await supabase.functions.invoke('enviar-codigo-2fa', { body: {} })
    setOcupado(false)
    if (error) {
      setErro(await mensagemErroFuncao(error, 'Não foi possível enviar o código agora. Tente de novo.'))
      return
    }
    setEtapa('codigo')
    setReenvioEm(Date.now() + 60_000)
    setAgora(Date.now())
  }

  async function confirmar(valor: string) {
    if (enviando.current) return
    if (!/^\d{6}$/.test(valor)) {
      setErro('Digite os 6 dígitos do código.')
      return
    }
    enviando.current = true
    setErro(null)
    setOcupado(true)
    const { data, error } = await supabase.rpc('verificar_codigo_2fa', {
      p_codigo: valor,
      p_confiar: confiar,
      p_rotulo: rotuloDispositivo(),
    })
    enviando.current = false
    setOcupado(false)
    if (error || data === null) {
      // código errado volta como null (o banco guarda a tentativa; na 5ª o código morre)
      setErro(error?.message || 'Código não confere. Depois de 5 erros, peça um novo código.')
      setCodigo('')
      return
    }
    if (confiar && typeof data === 'string' && data.length >= 32) salvarTokenDispositivo(data)
    onPronto()
  }

  if (etapa === 'pedir') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-apoio text-tinta-apoio">
          Enviaremos um código de 6 dígitos para o seu email cadastrado. Ele vale por 10 minutos.
        </p>
        {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
        <div>
          <Button onClick={enviar} disabled={ocupado}>
            {ocupado ? <Spinner /> : <Mail />} Enviar código ao meu email
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void confirmar(codigo) }}
      noValidate
      className="flex flex-col gap-3.5"
    >
      <p className="text-apoio text-tinta-apoio">Enviamos um código ao seu email. Digite abaixo.</p>
      {/* antes do campo: colar ou digitar o 6º dígito já confere o código, então a
          escolha de confiar no aparelho precisa vir primeiro */}
      <label className="flex items-center gap-2 text-apoio text-tinta-apoio">
        <input type="checkbox" checked={confiar} onChange={(e) => setConfiar(e.target.checked)} className="size-4" />
        Confiar neste dispositivo por 30 dias (não pedir o código de novo aqui)
      </label>
      <CampoCodigo
        valor={codigo}
        onChange={(v) => {
          setCodigo(v)
          if (erro && v.length < 6) setErro(null)
          if (v.length === 6) void confirmar(v)
        }}
        erro={erro}
      />
      <button
        type="submit"
        disabled={ocupado || codigo.length !== 6}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-controle bg-acao-pressionada text-corpo font-medium text-white hover:bg-acao disabled:opacity-60"
      >
        {ocupado ? <Spinner /> : <ShieldCheck className="size-4" aria-hidden />}
        {ocupado ? 'Conferindo…' : 'Confirmar'}
      </button>
      <button
        type="button"
        onClick={() => void enviar()}
        disabled={ocupado || faltaReenvio > 0}
        className="text-apoio text-tinta-sussurro hover:text-acao disabled:opacity-60"
      >
        {faltaReenvio > 0 ? `Reenviar código em ${faltaReenvio}s` : 'Reenviar código'}
      </button>
    </form>
  )
}

/**
 * Portão da casca: com a exigência ligada e a sessão sem segundo fator válido,
 * primeiro tenta o dispositivo confiável; senão pede o código por email (ou o
 * aplicativo autenticador, se a pessoa tiver um cadastrado).
 */
export function PortaoSegundoFator({ fatorId, onSair }: { fatorId: string | null; onSair: () => void }) {
  const queryClient = useQueryClient()
  const [metodo, setMetodo] = React.useState<'email' | 'totp'>('email')
  const [tentandoDispositivo, setTentandoDispositivo] = React.useState(() => !!lerTokenDispositivo())
  const pronto = () => {
    // A sessão foi marcada no banco (email/dispositivo) ou ganhou aal2 (TOTP);
    // relê tudo que estava negado.
    void queryClient.invalidateQueries()
  }

  // Login novo: tenta o token do dispositivo confiável antes de pedir código.
  React.useEffect(() => {
    let vivo = true
    const token = lerTokenDispositivo()
    if (!token) return // sem token o estado já nasce falso
    void supabase.rpc('verificar_dispositivo_2fa', { p_token: token }).then(({ data, error }) => {
      if (!vivo) return
      // dispositivo confiável: libera; se o portão não virar, a tela de código aparece em vez de girar
      if (!error && data === true) { pronto(); setTentandoDispositivo(false); return }
      limparTokenDispositivo()
      setTentandoDispositivo(false)
    })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (tentandoDispositivo) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-campo p-4">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-campo p-4">
      <section className="w-full max-w-[460px] rounded-cartao border border-fio bg-superficie p-6 shadow-repouso">
        <span className="grid size-[42px] place-items-center rounded-controle bg-marca/10 text-acao" aria-hidden>
          <ShieldCheck className="size-5" />
        </span>
        <h1 className="mt-4 text-titulo leading-[1.1] font-semibold tracking-[-0.02em] text-tinta">
          Confirme que é você
        </h1>
        <p className="mt-1.5 mb-5 text-apoio text-tinta-sussurro">
          {metodo === 'email'
            ? 'Este é um login novo neste dispositivo. Confirme com o código enviado ao seu email.'
            : 'Digite o código do seu aplicativo autenticador.'}
        </p>
        {metodo === 'email'
          ? <ConfirmarSegundoFatorEmail onPronto={pronto} />
          : <ConfirmarSegundoFator fatorId={fatorId!} onPronto={pronto} />}
        {fatorId && (
          <button
            type="button"
            onClick={() => setMetodo((m) => (m === 'email' ? 'totp' : 'email'))}
            className="mt-4 text-apoio text-tinta-sussurro hover:text-acao"
          >
            {metodo === 'email' ? 'Estou sem e-mail: quero ir pelo autenticador' : 'Voltar ao código por e-mail'}
          </button>
        )}
        <button type="button" onClick={onSair} className="mt-5 flex items-center gap-1.5 text-apoio text-tinta-sussurro hover:text-acao">
          <LogOut className="size-4" aria-hidden /> Sair
        </button>
      </section>
    </div>
  )
}

type Dispositivo = { id: string; rotulo: string | null; criado_em: string; ultimo_uso: string | null; expira_em: string }

/** Lista de dispositivos confiáveis, com remoção (corta um aparelho perdido). */
function DispositivosConfiaveis() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['dispositivos-2fa'],
    queryFn: async (): Promise<Dispositivo[]> => {
      const { data, error } = await supabase
        .from('dispositivos_confiaveis')
        .select('id, rotulo, criado_em, ultimo_uso, expira_em')
        .order('criado_em', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
  const [removendo, setRemovendo] = React.useState<string | null>(null)
  const [erroRemover, setErroRemover] = React.useState<string | null>(null)

  async function remover(id: string) {
    setRemovendo(id)
    setErroRemover(null)
    const { error } = await supabase.from('dispositivos_confiaveis').delete().eq('id', id)
    setRemovendo(null)
    // sem isto, uma recusa do banco deixava o aparelho confiável sem aviso
    if (error) setErroRemover('Não foi possível remover o aparelho: ' + error.message)
    void queryClient.invalidateQueries({ queryKey: ['dispositivos-2fa'] })
  }

  return (
    <section aria-label="Dispositivos confiáveis" className="rounded-cartao border border-fio bg-superficie p-5 shadow-repouso">
      {erroRemover && <p role="alert" className="mb-2 text-apoio text-critico">{erroRemover}</p>}
      <div className="mb-3 flex items-center gap-2">
        <Laptop className="size-4 text-tinta-apoio" aria-hidden />
        <h2 className="text-secao font-semibold tracking-[-0.01em] text-tinta">Dispositivos confiáveis</h2>
      </div>
      <p className="mb-3 text-apoio text-tinta-apoio">
        Aparelhos onde você marcou “confiar neste dispositivo” não pedem o código por 30 dias. Perdeu um aparelho? Remova-o aqui para cortar o acesso na hora.
      </p>
      {isLoading ? (
        <Spinner />
      ) : !data || data.length === 0 ? (
        <p className="text-apoio text-tinta-sussurro">Nenhum dispositivo confiável.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 rounded-controle border border-fio px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-apoio font-medium text-tinta">{d.rotulo || 'Dispositivo'}</p>
                <p className="text-rotulo text-tinta-sussurro">
                  Confiado em {new Date(d.criado_em).toLocaleDateString('pt-BR')}
                  {d.ultimo_uso && ` · último uso ${new Date(d.ultimo_uso).toLocaleDateString('pt-BR')}`}
                </p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => void remover(d.id)} disabled={removendo === d.id}>
                <Trash2 className="size-4" /> Remover
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
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
    <div className="flex flex-col gap-5">
      <section aria-label="Segundo fator" className="rounded-cartao border border-fio bg-superficie p-5 shadow-repouso">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ShieldCheck className="size-4 text-tinta-apoio" aria-hidden />
          <h2 className="text-secao font-semibold tracking-[-0.01em] text-tinta">Segundo fator</h2>
          {data?.exigido && <Badge variant="secondary">Exigido pela plataforma</Badge>}
        </div>
        <div className="flex items-start gap-2 text-apoio text-tinta-apoio">
          <Mail className="mt-0.5 size-4 shrink-0 text-tinta-apoio" aria-hidden />
          <p>
            Por padrão, em um login de dispositivo novo enviamos um código ao seu email. Nada a configurar — você pode marcar “confiar neste dispositivo” para não repetir por 30 dias.
          </p>
        </div>
      </section>

      <section aria-label="Aplicativo autenticador" className="rounded-cartao border border-fio bg-superficie p-5 shadow-repouso">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <KeyRound className="size-4 text-tinta-apoio" aria-hidden />
          <h2 className="text-secao font-semibold tracking-[-0.01em] text-tinta">Aplicativo autenticador</h2>
          {data?.fatorId ? <Badge variant="success">Ativo</Badge> : <Badge variant="secondary">Opcional</Badge>}
        </div>
        {isLoading ? (
          <Spinner />
        ) : data?.fatorId ? (
          <div className="flex flex-col gap-2 text-apoio text-tinta-apoio">
            <p>
              Alternativa ao email: use o código do aplicativo autenticador.
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
          <div className="flex flex-col gap-2 text-apoio text-tinta-apoio">
            <p>Prefere um aplicativo autenticador (mais seguro que email)? Configure aqui.</p>
            <CadastroSegundoFator onPronto={atualizar} />
          </div>
        )}
      </section>

      <DispositivosConfiaveis />
    </div>
  )
}
