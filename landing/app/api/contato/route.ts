import { NextResponse } from 'next/server'

/**
 * Formulário de contato: envia o pedido pela Resend para contato@chefecoruja.com.br,
 * que a Cloudflare encaminha à caixa do Chefe Coruja (RT, 09/11/2026). O e-mail
 * do visitante vai no "responder para".
 *
 * - Chave: RESEND_API_KEY, só no ambiente Production da Vercel. Sem ela, a rota
 *   responde 503 e o formulário mostra o erro (nada de "Mensagem recebida" falso).
 * - Corpo em texto puro: nada do que o visitante digita vira HTML.
 * - Não loga o conteúdo (nome, e-mail, telefone e mensagem são dado pessoal).
 */

const DESTINO = process.env.CONTATO_DESTINO || 'contato@chefecoruja.com.br'
const REMETENTE = process.env.CONTATO_REMETENTE || 'Site Chefe Coruja <nao-responda@chefecoruja.com.br>'
const LIMITE_MS = 10_000

const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) ?? {}
  } catch {
    return NextResponse.json({ ok: false, error: 'Dados inválidos' }, { status: 400 })
  }

  // honeypot: humano não preenche; o robô recebe "ok" e nada é enviado
  if (texto(body.website, 200)) return NextResponse.json({ ok: true })

  const nome = texto(body.nome, 120)
  const email = texto(body.email, 200)
  const telefone = texto(body.telefone, 30)
  const unidade = texto(body.unidade, 200)
  const mensagem = texto(body.mensagem, 4000)

  if (nome.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || telefone.replace(/\D/g, '').length < 10) {
    return NextResponse.json({ ok: false, error: 'Dados inválidos' }, { status: 400 })
  }

  const chave = process.env.RESEND_API_KEY
  if (!chave) {
    console.error('[contato] RESEND_API_KEY ausente')
    return NextResponse.json({ ok: false, error: 'Envio indisponível' }, { status: 503 })
  }

  const corpo = [
    'Pedido de contato pelo site do Chefe Coruja.',
    '',
    `Nome: ${nome}`,
    `E-mail: ${email}`,
    `Telefone: ${telefone}`,
    `Unidade e cargo: ${unidade || '(não informado)'}`,
    '',
    'Mensagem:',
    mensagem || '(sem mensagem)',
  ].join('\n')

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: REMETENTE,
        to: [DESTINO],
        reply_to: email,
        subject: `Pedido de contato pelo site: ${nome}`,
        text: corpo,
      }),
      signal: AbortSignal.timeout(LIMITE_MS),
    })
    if (!r.ok) {
      console.error('[contato] Resend respondeu', r.status)
      return NextResponse.json({ ok: false, error: 'Falha no envio' }, { status: 502 })
    }
  } catch {
    console.error('[contato] Resend sem resposta')
    return NextResponse.json({ ok: false, error: 'Falha no envio' }, { status: 504 })
  }

  return NextResponse.json({ ok: true })
}
