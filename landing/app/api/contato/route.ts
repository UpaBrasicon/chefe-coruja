import { NextResponse } from 'next/server'

/**
 * API de contato — endpoint local (modo demo).
 * TODO: integrar com serviço de e-mail (Resend/Formspree/SMTP) e persistência.
 * A cada chamada, disparar o evento GA4 'submit_form' é responsabilidade do
 * cliente (ContactForm já o faz).
 */

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nome, email, telefone, unidade, mensagem } = body ?? {}

    // validação básica no servidor
    if (!nome || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos' }, { status: 400 })
    }

    // TODO: enviar para e-mail/Slack/CRM e persistir lead
    console.log('[contato] novo lead:', { nome, email, telefone, unidade, mensagem })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Erro interno' }, { status: 500 })
  }
}
