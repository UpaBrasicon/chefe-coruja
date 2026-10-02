// Segundo fator por email: gera o código (RPC solicitar_codigo_2fa, que aplica
// cooldown) e o envia ao email do usuário autenticado via API do Resend.
// O código NUNCA volta ao cliente — só vai pelo email; a RPC que o gera só
// roda com a chave de serviço (migration 20261022000002). A verificação é feita
// depois pela RPC verificar_codigo_2fa (direta do app).
//
// Secrets (Edge Functions → Secrets): RESEND_API_KEY (= senha SMTP do Resend),
// EMAIL_FROM (ex.: "Chefe Coruja <nao-responda@chefecoruja.com.br>"),
// APP_ORIGIN (origem do app p/ CORS). CC_PUBLISHABLE_KEY como nas outras.
import { createClient } from 'npm:@supabase/supabase-js@2'

import { chavePublica, chaveSecreta } from '../_shared/chaves.ts'

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const resposta = (status: number, corpo: Record<string, unknown>) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'Chefe Coruja <nao-responda@chefecoruja.com.br>'

function corpoEmail(codigo: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:460px;margin:24px auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:28px">
    <h1 style="margin:0 0 6px;font-size:18px;color:#111">Seu código de acesso</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#555">Use o código abaixo para entrar no Chefe Coruja neste dispositivo.</p>
    <div style="font-size:34px;font-weight:700;letter-spacing:8px;text-align:center;color:#111;background:#f3f4f6;border-radius:10px;padding:16px 0">${codigo}</div>
    <p style="margin:18px 0 0;font-size:13px;color:#777">O código expira em 10 minutos. Se você não tentou entrar, ignore este email — sua conta segue protegida.</p>
  </div></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return resposta(405, { erro: 'método não permitido' })

  const auth = req.headers.get('Authorization') ?? ''
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, chavePublica(), {
    global: { headers: { Authorization: auth } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return resposta(401, { erro: 'não autenticado' })
  if (!user.email) return resposta(400, { erro: 'conta sem email cadastrado' })

  // Gera o código com a chave de SERVIÇO: a RPC devolve o código em claro e só
  // o service_role a executa (com a chave do usuário, quem tivesse só a senha
  // pegaria o código pela API sem abrir o e-mail). O usuário vem do token.
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, chaveSecreta())
  const { data: codigo, error } = await admin.rpc('solicitar_codigo_2fa', { p_user: user.id })
  if (error) {
    const cooldown = /aguarde/i.test(error.message)
    return resposta(cooldown ? 429 : 400, { erro: error.message })
  }

  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return resposta(500, { erro: 'envio de email não configurado' })

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Seu código de acesso — Chefe Coruja',
      html: corpoEmail(String(codigo)),
    }),
  })
  if (!r.ok) {
    console.error('resend falhou', r.status, await r.text().catch(() => ''))
    return resposta(502, { erro: 'não foi possível enviar o email agora' })
  }
  return resposta(200, { ok: true })
})
