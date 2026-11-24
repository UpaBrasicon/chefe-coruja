// Perfil Gestor da secretaria (pedido do RT, 24/11/2026): quem o administrador
// designa para a secretaria recebe um e-mail. A tela chama esta função logo
// depois de admin_designar_secretaria; a designação não espera o e-mail.
//
// Ordem:
//   1. só com login: o token de quem chama vai junto para o banco;
//   2. public.secretaria_aviso_reservar, com esse token, confere que quem
//      chama é o administrador da secretaria (segundo fator), marca a
//      tentativa (um envio por minuto) e devolve o e-mail e o resto do aviso;
//   3. uma mensagem pela Resend, só para a pessoa designada. Sem dado de
//      paciente: secretaria, organização, unidades e quem escolheu;
//   4. public.secretaria_aviso_concluir anota enviado ou falhou (falhou libera
//      a próxima tentativa na hora).
// O e-mail não volta para o navegador: a resposta só diz se foi.
//
// Secrets (Edge Functions → Secrets): RESEND_API_KEY (obrigatório; sem ele a
// função responde 503 "envio de e-mail não configurado" e nada é marcado) e
// APP_ORIGIN, os mesmos do enviar-codigo-2fa. Opcional: EMAIL_FROM; ausente
// ou fora do formato, sai do remetente padrão nao-responda@chefecoruja.com.br,
// como no 2FA, na tecnovigilância e no aviso de reunião.
//
// Corpo: { "designacao": "<uuid de secretaria_pessoas>" }
// Publicar (a sessão principal): npx supabase functions deploy avisar-secretaria
import { createClient } from 'npm:@supabase/supabase-js@2.106.2'

import { chavePublica } from '../_shared/chaves.ts'
import { comCors } from '../_shared/cors.ts'
import { comRelato, relatarErro } from '../_shared/sentry.ts'
import { assunto, html, jsonAscii, remetente, texto, type DadosAviso } from './regras.ts'

const FUNCAO = 'avisar-secretaria'
const LIMITE_MS = 15_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  // 1. quem chama: o banco confere pelo próprio token
  const autorizacao = req.headers.get('Authorization') ?? ''
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, chavePublica(), {
    global: { headers: { Authorization: autorizacao } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return resposta(401, { erro: 'não autenticado' })

  let corpo: { designacao?: unknown } = {}
  try {
    corpo = (await req.json()) as typeof corpo
  } catch { /* corpo inválido */ }
  const designacao = String(corpo.designacao ?? '')
  if (!UUID.test(designacao)) return resposta(400, { erro: 'designação inválida' })

  // sem a chave da Resend, nada é marcado: dá para tentar de novo depois
  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim()
  if (!apiKey) {
    relatarErro(FUNCAO, 'sem_chave_resend', 'RESEND_API_KEY ausente')
    return resposta(503, { erro: 'envio de e-mail não configurado (falta o segredo RESEND_API_KEY)' })
  }
  const de = remetente(Deno.env.get('EMAIL_FROM'))
  if (de.motivo === 'malformado') relatarErro(FUNCAO, 'email_from_malformado', 'EMAIL_FROM fora do formato; usado o padrão')

  // 2. reservar (confere o administrador da secretaria)
  const { data, error } = await userClient.rpc('secretaria_aviso_reservar', { p_designacao: designacao })
  if (error) {
    if (error.code === '42501') return resposta(403, { erro: 'só o administrador da secretaria avisa a pessoa designada' })
    if (error.code === '55P03') return resposta(429, { erro: error.message })
    if (error.code === '23514' || error.code === 'P0002') return resposta(409, { erro: error.message })
    relatarErro(FUNCAO, 'rpc_reservar', error.message)
    return resposta(500, { erro: 'não foi possível ler a designação' })
  }
  const d = data as unknown as DadosAviso

  const concluir = async (enviado: boolean) => {
    const { error: e } = await userClient.rpc('secretaria_aviso_concluir', { p_designacao: designacao, p_enviado: enviado })
    if (e) relatarErro(FUNCAO, 'rpc_concluir', e.message)
  }

  // 3. enviar
  const origem = (Deno.env.get('APP_ORIGIN') ?? 'https://www.chefecoruja.com.br').split(',')[0].trim().replace(/\/$/, '')
  let motivo: string | null = null
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: jsonAscii({ from: de.de, to: [d.email], subject: assunto(d), text: texto(d, origem), html: html(d, origem) }),
      signal: AbortSignal.timeout(LIMITE_MS),
    })
    if (!r.ok) {
      const detalhe = (await r.text().catch(() => '')).slice(0, 200)
      relatarErro(FUNCAO, 'resend_falhou', `HTTP ${r.status} ${detalhe}`)
      motivo = r.status === 422 ? 'a Resend recusou o remetente ou o destinatário' : `a Resend respondeu ${r.status}`
    }
  } catch (e) {
    relatarErro(FUNCAO, 'resend_sem_resposta', String(e))
    motivo = 'o envio demorou'
  }

  // 4. anotar
  await concluir(motivo === null)
  console.log(JSON.stringify({ funcao: FUNCAO, remetente: de.motivo, pendente: d.pendente, enviado: motivo === null }))
  if (motivo) return resposta(502, { erro: `e-mail não enviado: ${motivo}` })
  return resposta(200, { enviado: true })
}
