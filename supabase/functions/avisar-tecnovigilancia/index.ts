// LG12, decisão V2 = A (RT, 18/11/2026): relato grave de tecnovigilância
// (óbito, dano permanente ou internação) avisa o responsável técnico por
// e-mail na hora. A tela chama esta função logo depois de relatar_tecnovigilancia.
//
// Ordem:
//   1. só com login (o token do usuário é conferido);
//   2. public.aviso_tecnovigilancia(relato, false), com a chave de serviço,
//      devolve os dados só se o relato for grave e ainda não avisado;
//   3. envio pela Resend, em texto puro, sem dado do paciente;
//   4. public.aviso_tecnovigilancia(relato, true) anota o aviso, que não se repete.
// Se o envio falhar, o relato continua na fila; nada se perde.
//
// Secrets (Edge Functions → Secrets): RESEND_API_KEY e APP_ORIGIN, os mesmos
// do enviar-codigo-2fa. Opcional: EMAIL_FROM.
import { createClient } from 'npm:@supabase/supabase-js@2.106.2'

import { chavePublica, chaveSecreta } from '../_shared/chaves.ts'
import { comCors } from '../_shared/cors.ts'
import { comRelato, relatarErro } from '../_shared/sentry.ts'
import { assuntoAviso, jsonAscii, textoAviso, type DadosAviso } from './regras.ts'

const FUNCAO = 'avisar-tecnovigilancia'
const REMETENTE_PADRAO = 'Chefe Coruja <nao-responda@chefecoruja.com.br>'
const remetenteConfigurado = Deno.env.get('EMAIL_FROM')?.trim() ?? ''
const REMETENTE = /^([^<>]+<)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/.test(remetenteConfigurado) ? remetenteConfigurado : REMETENTE_PADRAO
const LIMITE_MS = 10_000
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

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, chavePublica(), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return resposta(401, { erro: 'não autenticado' })

  let relato = ''
  try {
    relato = String(((await req.json()) as { relato?: unknown }).relato ?? '')
  } catch { /* corpo inválido */ }
  if (!UUID.test(relato)) return resposta(400, { erro: 'relato inválido' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, chaveSecreta())
  const { data, error } = await admin.rpc('aviso_tecnovigilancia', { p_relato: relato, p_marcar: false })
  if (error) {
    relatarErro(FUNCAO, 'rpc_falhou', error.message)
    return resposta(500, { erro: 'não foi possível ler o relato' })
  }
  const d = data as DadosAviso | null
  if (!d) return resposta(200, { enviado: false })
  if (!d.destinatarios?.length) {
    relatarErro(FUNCAO, 'sem_destinatario', `relato ${d.numero}`)
    return resposta(200, { enviado: false })
  }

  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    relatarErro(FUNCAO, 'sem_chave_resend', 'RESEND_API_KEY ausente')
    return resposta(500, { erro: 'envio de e-mail não configurado' })
  }
  const origem = (Deno.env.get('APP_ORIGIN') ?? 'https://www.chefecoruja.com.br').split(',')[0].trim().replace(/\/$/, '')
  let r: Response
  try {
    r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: jsonAscii({ from: REMETENTE, to: d.destinatarios, subject: assuntoAviso(d), text: textoAviso(d, origem) }),
      signal: AbortSignal.timeout(LIMITE_MS),
    })
  } catch (e) {
    relatarErro(FUNCAO, 'resend_sem_resposta', String(e))
    return resposta(504, { erro: 'o envio demorou' })
  }
  if (!r.ok) {
    relatarErro(FUNCAO, 'resend_falhou', `HTTP ${r.status}`)
    return resposta(502, { erro: 'não foi possível enviar o e-mail agora' })
  }
  await admin.rpc('aviso_tecnovigilancia', { p_relato: relato, p_marcar: true })
  return resposta(200, { enviado: true })
}
