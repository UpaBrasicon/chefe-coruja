// ─────────────────────────────────────────────────────────────────────────────
// HERMES — agent/pipeline.ts
// Pipeline da mensagem (Fase 1, item 1): dedup → identidade → sessão → loop do
// agente → resposta via Graph API. Chamado pelo worker da fila.
//
// Fluxo:
//   a. Dedup por message_id (Redis SET, TTL 24h) — a Meta reenvia.
//   b. Resolução de identidade por telefone (E.164).
//      - Não encontrado → mensagem fixa, SEM passar pelo LLM.
//   c. Carrega sessão (janela 20 msgs / 2h) e monta o system prompt.
//   d. Loop do agente (LLM + tools).
//   e. Envia resposta via WhatsApp + grava auditoria (direction in/out).
// ─────────────────────────────────────────────────────────────────────────────
import type { Redis } from 'ioredis'
import { createHash } from 'node:crypto'
import { logger } from '../logger.js'
import { supabaseUser } from '../lib/supabase.js'
import { inserirIncidentes, upsertUrlCache } from '../lib/db-job.js'
import { enviarTexto } from '../lib/whatsapp.js'
import { resolverIdentidadePorWaId } from './identidade.js'
import { carregarSessao, salvarSessao, type MensagemSessao } from './sessao.js'
import { executarLoopAgente } from './loop.js'
import { extrairUrls, verificarUrl, hashUrl } from '../tools/urlcheck.js'
import { montarSystemPrompt } from './system-prompt.js'

const TTL_DEDUP_S = 24 * 60 * 60 // 24h
const LIMITE_MSGS = 20 // rate limit por usuário / 10 min
const JANELA_RATE_LIMIT_S = 10 * 60

const MSG_NAO_CADASTRADO =
  'Número não cadastrado no Chefe Coruja. Procure o gestor da sua unidade.'
const MSG_NAO_TEXTO = 'Por enquanto só mensagens de texto são suportadas.'
const MSG_RATE_LIMIT = 'Você está enviando muitas mensagens. Aguarde alguns minutos.'
const MSG_INSTABILIDADE = 'Estou com instabilidade agora. Tente de novo em alguns minutos.'

function dataHoraBrasilia(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date())
}

export async function jaProcessada(redis: Redis, messageId: string): Promise<boolean> {
  const chave = `hermes:dedup:${messageId}`
  const ok = await redis.set(chave, '1', 'EX', TTL_DEDUP_S, 'NX')
  return ok !== 'OK' // NX falhou → já existia
}

export async function dentroDoRateLimit(redis: Redis, waId: string): Promise<boolean> {
  const chave = `hermes:rate:${waId}`
  const atual = await redis.incr(chave)
  if (atual === 1) await redis.expire(chave, JANELA_RATE_LIMIT_S)
  return atual <= LIMITE_MSGS
}

async function gravarAuditoria(
  userId: string | null,
  waId: string,
  direction: 'in' | 'out',
  resumo: string
): Promise<void> {
  // RETURNS void. userId pode ser null (mensagem antes de resolver identidade).
  const { error } = await supabaseUser.rpc('hermes_audit_registrar', {
    p_perfil: userId,
    p_phone: waId,
    p_direction: direction,
    p_tool_name: null,
    p_tool_args: null,
    p_resumo: resumo.slice(0, 500),
  })
  if (error) logger.warn({ err: error.message }, '[audit] falha ao gravar')
}

export async function processarMensagem(
  redis: Redis,
  messageId: string,
  waId: string,
  texto: string,
  tipo: 'text' | 'outro' = 'text'
): Promise<void> {
  // a. Dedup (a Meta pode reenviar o mesmo message_id)
  if (await jaProcessada(redis, messageId)) {
    logger.info({ messageId }, '[pipeline] mensagem duplicada ignorada')
    return
  }

  // Rate limit por usuário (20 / 10 min)
  if (!(await dentroDoRateLimit(redis, waId))) {
    await enviarTexto(waId, MSG_RATE_LIMIT)
    return
  }

  // Mensagem não-texto (áudio, imagem, sticker...) — resposta fixa, sem LLM.
  if (tipo !== 'text') {
    await enviarTexto(waId, MSG_NAO_TEXTO)
    await gravarAuditoria(null, waId, 'in', 'mensagem não-texto recebida')
    await gravarAuditoria(null, waId, 'out', MSG_NAO_TEXTO)
    return
  }

  // v1.1 — Cérbero Patrulha B (on-write): URLs maliciosas vão para quarentena
  // e NÃO são processadas; suspeitas seguem com aviso.
  const urls = extrairUrls(texto)
  if (urls.length > 0) {
    const resultados = await Promise.all(urls.map((u) => verificarUrl(u)))
    const maliciosas = resultados.filter((r) => r.veredicto === 'malicioso')
    if (maliciosas.length > 0) {
      await quarentenar(waId, texto, urls, resultados)
      await gravarAuditoria(null, waId, 'in', `mensagem com URL maliciosa em quarentena (${urls.length} url(s))`)
      return
    }
    const suspeitas = resultados.filter((r) => r.veredicto === 'suspeito')
    if (suspeitas.length > 0) {
      await registrarIncidenteConteudo(waId, urls, resultados)
    }
  }

  await gravarAuditoria(null, waId, 'in', `msg recebida: ${texto.slice(0, 100)}`)

  // b. Resolução de identidade
  const identidade = await resolverIdentidadePorWaId(waId)
  if (!identidade) {
    logger.info({ waId }, '[pipeline] número não cadastrado')
    await enviarTexto(waId, MSG_NAO_CADASTRADO)
    await gravarAuditoria(null, waId, 'out', MSG_NAO_CADASTRADO)
    return
  }

  // c. Sessão + system prompt
  const historicoSessao = await carregarSessao(identidade.perfilId, waId)
  const systemPrompt = montarSystemPrompt(identidade, dataHoraBrasilia())

  // d. Loop do agente
  const resultado = await executarLoopAgente(
    identidade,
    waId,
    systemPrompt,
    historicoSessao.map((m) => ({ role: m.role, content: m.content })),
    texto
  )

  // e. Resposta + persistência da sessão
  const resposta = resultado.ok ? resultado.texto : MSG_INSTABILIDADE
  const envio = await enviarTexto(waId, resposta)

  const novasMsgs: MensagemSessao[] = [
    ...historicoSessao,
    { role: 'user', content: texto, ts: new Date().toISOString() },
    { role: 'assistant', content: resposta, ts: new Date().toISOString() },
  ]
  await salvarSessao(identidade.perfilId, waId, novasMsgs)
  await gravarAuditoria(identidade.perfilId, waId, 'out', `envio ${envio.ok ? 'ok' : 'falhou'}: ${resposta.slice(0, 100)}`)

  logger.info({ waId, messageId, envioOk: envio.ok }, '[pipeline] mensagem processada')
}

// ── Cérbero Patrulha B — quarentena e incidentes de conteúdo ────────────────

async function quarentenar(
  waId: string,
  texto: string,
  urls: string[],
  resultados: { veredicto: string; motivos: string[] }[]
): Promise<void> {
  // Resolve perfil do autor (se cadastrado) — sem dado clínico, só ID
  const identidade = await resolverIdentidadePorWaId(waId).catch(() => null)

  // Uma única RPC colapsa o incidente + a quarentena (antes eram dois INSERTs
  // separados, com o incidente_id costurado no cliente). RETURNS uuid do
  // incidente criado.
  const { error: errQ } = await supabaseUser.rpc('hermes_quarentenar_conteudo', {
    p_tenant: identidade?.organizacaoId ?? null,
    p_tipo: 'url',
    p_origem: 'chat_whatsapp',
    p_autor: identidade?.perfilId ?? '00000000-0000-0000-0000-000000000000',
    p_conteudo_hash: createHash('sha256').update(texto).digest('hex'),
    p_motivo: `URL maliciosa: ${resultados.map((r) => r.motivos.join(',')).join('; ')}`,
    p_severidade: 'critico',
    p_titulo: 'URL maliciosa interceptada no canal',
    p_evidencia: { urls, motivos: resultados.map((r) => r.motivos) },
  })
  if (errQ) logger.warn({ err: errQ.message }, '[cerbero] falha ao quarentenar conteúdo')
  logger.warn({ waId, urls }, '[cerbero] conteúdo em quarentena (URL maliciosa)')

  // Notifica o AUTOR que o conteúdo está em análise (transparência — item 5)
  await enviarTexto(
    waId,
    'Seu conteúdo foi enviado para análise por conter um link não verificado. Ele não foi entregue ao destinatário. Em caso de dúvida, procure o suporte.'
  )
  await gravarAuditoria(identidade?.perfilId ?? null, waId, 'out', 'aviso ao autor: conteúdo em análise (quarentena)')
}

async function registrarIncidenteConteudo(
  waId: string,
  urls: string[],
  resultados: { veredicto: string; motivos: string[] }[]
): Promise<void> {
  const hash = hashUrl(urls[0] ?? '')
  // Caso SUSPEITO: segue com aviso, sem quarentena. Só cache + incidente
  // informativo — ambos pela conexão do job (lib/db-job.ts; hermes_job tem
  // INSERT em url_cache e cerbero_incidentes; hermes_quarentenar_conteudo
  // criaria quarentena à toa). Consultas fixas, sem tabela vinda de fora.
  await upsertUrlCache(
    { url_hash: hash, veredicto: 'suspeito', fonte: 'heuristica', detalhe: { urls, motivos: resultados.map((r) => r.motivos) } },
  )
  await inserirIncidentes([{
    patrulha: 'conteudo',
    severidade: 'informativo',
    titulo: 'URL suspeita no canal',
    evidencia: { waId, urls, motivos: resultados.map((r) => r.motivos) },
  }])
  logger.info({ waId, urls }, '[cerbero] URL suspeita registrada (segue com aviso)')
}
