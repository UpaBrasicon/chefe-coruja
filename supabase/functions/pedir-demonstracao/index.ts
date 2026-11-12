// Formulário "Agendar demonstração" da página de entrada (pedido 8, J3).
// Decisões do RT de 12/11/2026 (docs/landing/J3-FORMULARIO-DEMONSTRACAO-DIAGNOSTICO.md):
// F1 = A (esta função, com Turnstile, campo-isca e limite por endereço de rede),
// F2 = não gravar o pedido (o e-mail para contato@ é o registro),
// F3 = 3 envios por endereço de rede por hora.
//
// Sem login (verify_jwt = false em config.toml). A ordem é:
//   1. campo-isca preenchido: responde "ok" e não envia nada;
//   2. dados: nome, e-mail e telefone, com as regras da landing/;
//   3. Turnstile, conferido na Cloudflare com o TURNSTILE_SECRET;
//   4. limite: 3 pedidos por hora pelo resumo do endereço de rede
//      (public.contar_pedido_demonstracao, migration 20270406000001);
//   5. envio pela Resend, em texto puro, com o e-mail da pessoa no "responder para".
// Nada do que a pessoa escreve vai para o log.
//
// Secrets (Edge Functions → Secrets): TURNSTILE_SECRET, RESEND_API_KEY,
// APP_ORIGIN (CORS). Opcionais: DEMONSTRACAO_DESTINO (padrão
// contato@chefecoruja.com.br) e EMAIL_FROM.
import { createClient } from 'npm:@supabase/supabase-js@2'

import { chaveSecreta } from '../_shared/chaves.ts'
import { comCors } from '../_shared/cors.ts'
import { comRelato, relatarErro } from '../_shared/sentry.ts'
import { corpoEmail, enderecoDaRede, jsonAscii, lerPedido, resumoDoEndereco } from './regras.ts'

const FUNCAO = 'pedir-demonstracao'
const DESTINO = Deno.env.get('DEMONSTRACAO_DESTINO') ?? 'contato@chefecoruja.com.br'
const REMETENTE = Deno.env.get('EMAIL_FROM') ?? 'Chefe Coruja <nao-responda@chefecoruja.com.br>'
const LIMITE_MS = 10_000

const cabecalhos = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const resposta = (status: number, corpo: Record<string, unknown>) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cabecalhos, 'Content-Type': 'application/json' } })

Deno.serve(comRelato(FUNCAO, async (req) => comCors(req, await tratar(req))))

async function tratar(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhos })
  if (req.method !== 'POST') return resposta(405, { erro: 'método não permitido' })

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return resposta(400, { erro: 'dados inválidos' })
  }
  const leitura = lerPedido(corpo)
  if (leitura.tipo === 'isca') return resposta(200, { ok: true })
  if (leitura.tipo === 'invalido') return resposta(400, { erro: 'dados inválidos', campo: leitura.campo })

  const segredoTurnstile = Deno.env.get('TURNSTILE_SECRET')
  const chaveResend = Deno.env.get('RESEND_API_KEY')
  if (!segredoTurnstile || !chaveResend) {
    relatarErro(FUNCAO, 'sem_segredo', !segredoTurnstile ? 'TURNSTILE_SECRET ausente' : 'RESEND_API_KEY ausente')
    return resposta(503, { erro: 'envio indisponível' })
  }

  const endereco = enderecoDaRede(req.headers)

  // 3. Turnstile
  if (!leitura.token) return resposta(403, { erro: 'confirme que você não é um robô' })
  try {
    const conferencia = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: segredoTurnstile, response: leitura.token, remoteip: endereco }),
      signal: AbortSignal.timeout(LIMITE_MS),
    })
    const r = (await conferencia.json()) as { success?: boolean }
    if (!r.success) return resposta(403, { erro: 'confirme que você não é um robô' })
  } catch (e) {
    relatarErro(FUNCAO, 'turnstile_sem_resposta', e)
    return resposta(504, { erro: 'não foi possível conferir agora; tente de novo em instantes' })
  }

  // 4. limite por hora
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, chaveSecreta())
  const { data: cabe, error } = await admin.rpc('contar_pedido_demonstracao', {
    p_chave: await resumoDoEndereco(endereco, segredoTurnstile),
  })
  if (error) {
    relatarErro(FUNCAO, 'contagem', error.message)
    return resposta(500, { erro: 'não foi possível enviar agora' })
  }
  if (cabe !== true) return resposta(429, { erro: 'muitos pedidos deste endereço; tente de novo em uma hora' })

  // 5. envio
  const p = leitura.pedido
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chaveResend}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: jsonAscii({
        from: REMETENTE,
        to: [DESTINO],
        reply_to: p.email,
        subject: `Pedido de demonstração: ${p.nome}`,
        text: corpoEmail(p),
      }),
      signal: AbortSignal.timeout(LIMITE_MS),
    })
    if (!r.ok) {
      relatarErro(FUNCAO, 'resend_falhou', `HTTP ${r.status}`)
      return resposta(502, { erro: 'não foi possível enviar agora' })
    }
  } catch (e) {
    relatarErro(FUNCAO, 'resend_sem_resposta', e)
    return resposta(504, { erro: 'o envio demorou; tente de novo em instantes' })
  }
  return resposta(200, { ok: true })
}
