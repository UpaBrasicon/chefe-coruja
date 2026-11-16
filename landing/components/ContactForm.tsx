'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { track } from '@/lib/analytics'
import { useTurnstile } from '@/components/Turnstile'

/**
 * Formulário de contato — validação client-side + honeypot anti-spam.
 * Checklist itens 3, 4, 20.
 *
 * S10 (H3 = A, 16/11/2026): o envio vai à função pedir-demonstracao do Supabase,
 * a mesma do formulário do app em www. Ela confere o Turnstile, o campo-isca e o
 * limite de 3 pedidos por hora por endereço de rede, e manda o e-mail para
 * contato@ pela Resend. A rota própria /api/contato saiu.
 */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '') || ''
const URL_FUNCAO = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/pedir-demonstracao` : ''

const AVISO_CAMPO: Record<'nome' | 'email' | 'telefone', string> = {
  nome: 'Informe seu nome.',
  email: 'Informe um e-mail válido.',
  telefone: 'Informe um telefone com DDD.',
}

/** Traduz a resposta da função em mensagem para a tela. */
function mensagemDeErro(status: number): string {
  if (status === 403) return 'Não conseguimos confirmar que você não é um robô. Tente enviar de novo.'
  if (status === 429) return 'Muitos pedidos deste endereço; tente de novo em uma hora.'
  if (status === 504) return 'O envio demorou. Tente de novo em instantes.'
  return 'Não foi possível enviar agora. Tente de novo em instantes.'
}

function LinkEmail() {
  return (
    <a href="mailto:contato@chefecoruja.com.br" className="underline">
      contato@chefecoruja.com.br
    </a>
  )
}

export function ContactForm() {
  // Sem a site key do Turnstile (ou sem o endereço do Supabase) a função recusaria
  // todo envio: em vez de um formulário que sempre falha, mostra o e-mail.
  if (!SITE_KEY || !URL_FUNCAO) {
    return (
      <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        O formulário está indisponível no momento. Escreva para <LinkEmail /> que respondemos por lá.
      </p>
    )
  }
  return <Formulario sitekey={SITE_KEY} urlFuncao={URL_FUNCAO} />
}

function Formulario({ sitekey, urlFuncao }: { sitekey: string; urlFuncao: string }) {
  const router = useRouter()
  const turnstile = useTurnstile(sitekey)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [unidade, setUnidade] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [honeypot, setHoneypot] = useState('') // campo escondido — bot não preenche
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)

  function validar() {
    const e: Record<string, string> = {}
    if (nome.trim().length < 2) e.nome = AVISO_CAMPO.nome
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = AVISO_CAMPO.email
    if (telefone.replace(/\D/g, '').length < 10) e.telefone = AVISO_CAMPO.telefone
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (honeypot) return // bot detectado — ignora silenciosamente
    if (!validar()) return
    setFalha(null)
    if (!turnstile.token) {
      setFalha('Aguarde a verificação anti-robô terminar e envie de novo.')
      return
    }
    setEnviando(true)

    // Evento de conversão (submit_form, item 20): disparado só depois do envio
    // certo; só vai para "Mensagem recebida" se a função respondeu 200
    let enviado = false
    try {
      const r = await fetch(urlFuncao, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, telefone, unidade, mensagem, website: honeypot, token: turnstile.token }),
      })
      if (r.ok) {
        enviado = true
      } else {
        const corpo = (await r.json().catch(() => null)) as { campo?: string } | null
        const campo = corpo?.campo
        if (r.status === 400 && (campo === 'nome' || campo === 'email' || campo === 'telefone')) {
          setErros({ [campo]: AVISO_CAMPO[campo] })
        } else {
          setFalha(mensagemDeErro(r.status))
        }
      }
    } catch {
      setFalha('Sem conexão. Confira a internet e tente de novo.')
    } finally {
      setEnviando(false)
      turnstile.resetar() // o token vale para um envio só
    }

    if (!enviado) return
    track('submit_form', { form_id: 'contato', has_telefone: !!telefone })
    router.push('/obrigado')
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30'
  const aviso = falha ?? turnstile.falha

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {/* Honeypot — invisível para humanos */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="website">Não preencha este campo</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="nome" className="mb-1 block text-sm font-medium text-slate-700">
          Nome completo
        </label>
        <input
          id="nome"
          name="nome"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className={inputClass}
          placeholder="Seu nome"
          aria-invalid={!!erros.nome}
        />
        {erros.nome && <p className="mt-1 text-xs text-red-600">{erros.nome}</p>}
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
          E-mail corporativo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="voce@hospital.com.br"
          aria-invalid={!!erros.email}
        />
        {erros.email && <p className="mt-1 text-xs text-red-600">{erros.email}</p>}
      </div>

      <div>
        <label htmlFor="telefone" className="mb-1 block text-sm font-medium text-slate-700">
          Telefone / WhatsApp
        </label>
        <input
          id="telefone"
          name="telefone"
          type="tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          className={inputClass}
          placeholder="Com DDD"
          aria-invalid={!!erros.telefone}
        />
        {erros.telefone && <p className="mt-1 text-xs text-red-600">{erros.telefone}</p>}
      </div>

      <div>
        <label htmlFor="unidade" className="mb-1 block text-sm font-medium text-slate-700">
          Unidade / cargo
        </label>
        <input
          id="unidade"
          name="unidade"
          type="text"
          value={unidade}
          onChange={(e) => setUnidade(e.target.value)}
          className={inputClass}
          placeholder="Ex.: UPA Centro — Diretor Técnico"
        />
      </div>

      <div>
        <label htmlFor="mensagem" className="mb-1 block text-sm font-medium text-slate-700">
          Como podemos ajudar?
        </label>
        <textarea
          id="mensagem"
          name="mensagem"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          rows={4}
          maxLength={4000}
          className={inputClass}
          placeholder="Conte um pouco sobre sua unidade e necessidades…"
        />
      </div>

      {turnstile.widget}

      <button type="submit" disabled={enviando} className="btn-primary disabled:opacity-60">
        {enviando ? 'Enviando…' : 'Enviar mensagem'}
      </button>
      {aviso && (
        <p role="alert" className="text-center text-sm text-red-700">
          {aviso} Se preferir, escreva para <LinkEmail />.
        </p>
      )}
    </form>
  )
}
