// Agenda do administrador (pedido do RT, 24/11/2026): os convidados da reunião
// recebem também o aviso por e-mail. A tela chama esta função logo depois de
// salvar_reuniao ou cancelar_reuniao; a gravação não espera o e-mail.
//
// Ordem:
//   1. só com login: quem chama é quem marcou a reunião (o token é conferido)
//      ou o próprio serviço (chave secreta no Authorization);
//   2. public.reuniao_emails_reservar, com a chave de serviço, confere quem
//      marcou, reserva a fila da reunião (private.reuniao_emails, enchida por
//      private.reuniao_avisar) e devolve a reunião e o e-mail de cada pessoa;
//   3. uma mensagem por pessoa (regras.ts), pela Resend em lote, cada uma só
//      com o próprio destinatário. Sem dado de paciente;
//   4. public.reuniao_emails_concluir anota enviado, sem_email, descartado ou
//      falhou (falhou volta para a fila na próxima chamada, até 3 vezes).
// O e-mail dos convidados nunca volta para o navegador: a resposta só conta.
//
// Secrets (Edge Functions → Secrets): RESEND_API_KEY (obrigatório; sem ele a
// função responde 503 "envio de e-mail não configurado" e a fila fica para a
// próxima chamada) e APP_ORIGIN, os mesmos do enviar-codigo-2fa. Opcional:
// EMAIL_FROM; ausente ou fora do formato, sai do remetente padrão
// nao-responda@chefecoruja.com.br, como no 2FA e na tecnovigilância.
//
// Corpo: { "reuniao": "<uuid>", "evento"?: "convite" | "alterada" | "cancelada" | "retirado" }
// (também aceita mudanca, cancelamento e retirada). Sem evento, vai tudo o que
// está na fila da reunião.
import { createClient } from 'npm:@supabase/supabase-js@2.106.2'

import { chavePublica, chaveSecreta } from '../_shared/chaves.ts'
import { comCors } from '../_shared/cors.ts'
import { comRelato, relatarErro } from '../_shared/sentry.ts'
import {
  assunto, escolherEnvios, eventoPedido, html, jsonAscii, remetente, texto,
  type DadosReuniao, type Envio, type Pendente,
} from './regras.ts'

const FUNCAO = 'avisar-reuniao'
const LIMITE_MS = 15_000
const LOTE_RESEND = 100
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const cabecalhos = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const resposta = (status: number, corpo: Record<string, unknown>) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cabecalhos, 'Content-Type': 'application/json' } })

Deno.serve(comRelato(FUNCAO, async (req) => comCors(req, await tratar(req))))

/** Comparação sem atalho (o tempo não diz quantas letras acertou). */
function iguais(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

function ehServico(token: string): boolean {
  return [chaveSecreta(), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''].some((k) => iguais(token, k))
}

async function tratar(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhos })
  if (req.method !== 'POST') return resposta(405, { erro: 'método não permitido' })

  // 1. quem chama
  const autorizacao = req.headers.get('Authorization') ?? ''
  const token = autorizacao.replace(/^Bearer\s+/i, '').trim()
  let quem: string | null = null
  if (!ehServico(token)) {
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, chavePublica(), {
      global: { headers: { Authorization: autorizacao } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return resposta(401, { erro: 'não autenticado' })
    quem = user.id
  }

  let corpo: { reuniao?: unknown; evento?: unknown } = {}
  try {
    corpo = (await req.json()) as typeof corpo
  } catch { /* corpo inválido */ }
  const reuniao = String(corpo.reuniao ?? '')
  if (!UUID.test(reuniao)) return resposta(400, { erro: 'reunião inválida' })
  const evento = eventoPedido(corpo.evento)
  if (evento === undefined) return resposta(400, { erro: 'evento inválido' })

  // sem a chave da Resend, nada é reservado: a fila fica para quando houver
  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim()
  if (!apiKey) {
    relatarErro(FUNCAO, 'sem_chave_resend', 'RESEND_API_KEY ausente')
    return resposta(503, { erro: 'envio de e-mail não configurado (falta o segredo RESEND_API_KEY)' })
  }
  const de = remetente(Deno.env.get('EMAIL_FROM'))
  if (de.motivo === 'malformado') relatarErro(FUNCAO, 'email_from_malformado', 'EMAIL_FROM fora do formato; usado o padrão')

  // 2. reservar a fila (confere quem marcou)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, chaveSecreta())
  const { data, error } = await admin.rpc('reuniao_emails_reservar', { p_reuniao: reuniao, p_quem: quem, p_evento: evento })
  if (error) {
    if (error.code === '42501') return resposta(403, { erro: 'só quem marcou a reunião avisa os convidados' })
    relatarErro(FUNCAO, 'rpc_reservar', error.message)
    return resposta(500, { erro: 'não foi possível ler a reunião' })
  }
  const d = data as { reuniao: DadosReuniao; pendentes: Pendente[] }
  const { envios, semEmail, descartados, pessoasSemEmail } = escolherEnvios(d.pendentes ?? [])

  const concluir = async (ids: number[], situacao: 'enviado' | 'sem_email' | 'descartado' | 'falhou') => {
    if (ids.length === 0) return
    const { error: e } = await admin.rpc('reuniao_emails_concluir', { p_ids: ids, p_situacao: situacao })
    if (e) relatarErro(FUNCAO, 'rpc_concluir', e.message)
  }
  await concluir(semEmail, 'sem_email')
  await concluir(descartados, 'descartado')

  // 3. enviar
  const origem = (Deno.env.get('APP_ORIGIN') ?? 'https://www.chefecoruja.com.br').split(',')[0].trim().replace(/\/$/, '')
  const enviados: Envio[] = []
  const falhas: Envio[] = []
  let motivo: string | null = null
  for (let i = 0; i < envios.length; i += LOTE_RESEND) {
    const lote = envios.slice(i, i + LOTE_RESEND)
    const mensagens = lote.map((e) => ({
      from: de.de,
      to: [e.email],
      subject: assunto(e.evento, d.reuniao),
      text: texto(e.evento, d.reuniao, e.nome, origem),
      html: html(e.evento, d.reuniao, e.nome, origem),
    }))
    try {
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json; charset=utf-8' },
        body: jsonAscii(mensagens),
        signal: AbortSignal.timeout(LIMITE_MS),
      })
      if (r.ok) {
        enviados.push(...lote)
      } else {
        const detalhe = (await r.text().catch(() => '')).slice(0, 200)
        relatarErro(FUNCAO, 'resend_falhou', `HTTP ${r.status} ${detalhe}`)
        motivo = r.status === 422 ? 'a Resend recusou o remetente ou o destinatário' : `a Resend respondeu ${r.status}`
        falhas.push(...lote)
      }
    } catch (e) {
      relatarErro(FUNCAO, 'resend_sem_resposta', String(e))
      motivo = 'o envio demorou'
      falhas.push(...lote)
    }
  }

  // 4. anotar
  await concluir(enviados.flatMap((e) => e.ids), 'enviado')
  await concluir(falhas.flatMap((e) => e.ids), 'falhou')

  const contagem = { enviados: enviados.length, sem_email: pessoasSemEmail, falhas: falhas.length }
  console.log(JSON.stringify({ funcao: FUNCAO, servico: quem === null, remetente: de.motivo, ...contagem, descartados: descartados.length }))
  if (falhas.length > 0) return resposta(502, { erro: `e-mail não enviado: ${motivo ?? 'falha no envio'}`, ...contagem })
  return resposta(200, contagem)
}

