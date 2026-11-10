'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { track } from '@/lib/analytics'

/**
 * Formulário de contato — validação client-side + honeypot anti-spam.
 * Checklist itens 3, 4, 20.
 */
export function ContactForm() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [unidade, setUnidade] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [honeypot, setHoneypot] = useState('') // campo escondido — bot não preenche
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [falha, setFalha] = useState(false)

  function validar() {
    const e: Record<string, string> = {}
    if (nome.trim().length < 2) e.nome = 'Informe seu nome.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Informe um e-mail válido.'
    if (telefone.replace(/\D/g, '').length < 10) e.telefone = 'Informe um telefone com DDD.'
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (honeypot) return // bot detectado — ignora silenciosamente
    if (!validar()) return
    setEnviando(true)
    setFalha(false)

    // Evento de conversão (submit_form, item 20): disparado só depois do envio certo
    // envia pela rota /api/contato (Resend → contato@chefecoruja.com.br); só vai
    // para "Mensagem recebida" se o envio deu certo
    let enviado = false
    try {
      const r = await fetch('/api/contato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, telefone, unidade, mensagem, website: honeypot }),
      })
      enviado = r.ok
    } catch {
      enviado = false
    }

    setEnviando(false)
    if (!enviado) {
      setFalha(true)
      return
    }
    track('submit_form', { form_id: 'contato', has_telefone: !!telefone })
    router.push('/obrigado')
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30'

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
          className={inputClass}
          placeholder="Conte um pouco sobre sua unidade e necessidades…"
        />
      </div>

      <button type="submit" disabled={enviando} className="btn-primary disabled:opacity-60">
        {enviando ? 'Enviando…' : 'Enviar mensagem'}
      </button>
      {falha && (
        <p role="alert" className="text-center text-sm text-red-700">
          Não foi possível enviar agora. Tente de novo em instantes ou escreva para{' '}
          <a href="mailto:contato@chefecoruja.com.br" className="underline">
            contato@chefecoruja.com.br
          </a>
          .
        </p>
      )}
    </form>
  )
}
