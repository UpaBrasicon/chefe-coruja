// ─────────────────────────────────────────────────────────────────────────────
// HERMES — agent/tools.ts
// Tools de LEITURA da Fase 1 (escrita fica para a Fase 2).
//
// ⚠️ REGRA 3 (regras transversais): service_role bypassa RLS — o filtro de
// papel/unidade é reimplementado AQUI no código, nunca confiando no LLM.
//
// Dados consultados: tabela de escala principal `escala_plantao`
// (ver PREFLIGHT-HERMES.md — NUNCA inventar nomes de tabela/coluna).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase.js'
import { logger } from '../logger.js'
import type { IdentidadeHermes } from './identidade.js'

export type ResultadoTool = {
  ok: boolean
  dados?: unknown
  erro?: string
}

export type FerramentaExecutada = {
  tool: string
  args: Record<string, unknown>
  resultado: ResultadoTool
}

// As consultas de escala do WhatsApp saíram daqui (esquema antigo, nunca
// ligadas ao executarTool): a escala vai pela skill API (hermes_* no banco).

/**
 * v1.1 — Cérbero (exclusivo super_admin).
 * Guarda de papel: quem NÃO é super_admin recebe resposta genérica
 * (sem revelar a existência do agente — requisito do prompt).
 *
 * A flag vem da resolução de identidade (tabela `super_admins`), não do que o
 * usuário diz na conversa. `=== true` é proposital: identidade construída sem
 * o campo (undefined) falha FECHADA.
 */
function ehSuperAdmin(identidade: IdentidadeHermes): boolean {
  return identidade.superAdmin === true
}

const RESPOSTA_GENERICA_CERBERO = {
  ok: true,
  dados: {
    mensagem:
      'Não encontrei informações sobre esse assunto. Se precisar de ajuda com escala ou plantões, é só perguntar.',
  },
}

export async function listarQuarentena(
  identidade: IdentidadeHermes,
  _args: { status?: string }
): Promise<ResultadoTool> {
  if (!ehSuperAdmin(identidade)) return RESPOSTA_GENERICA_CERBERO

  const { data, error } = await supabase
    .from('cerbero_quarentena')
    .select('id, tipo, origem, motivo, liberado, criado_em')
    .order('criado_em', { ascending: false })
    .limit(50)
  if (error) return { ok: false, erro: 'falha interna' }
  void _args
  return { ok: true, dados: data ?? [] }
}

export async function getIncidentes(
  identidade: IdentidadeHermes,
  args: { patrulha?: string; severidade?: string }
): Promise<ResultadoTool> {
  if (!ehSuperAdmin(identidade)) return RESPOSTA_GENERICA_CERBERO

  let q = supabase
    .from('cerbero_incidentes')
    .select('id, patrulha, severidade, titulo, status, detectado_em')
    .order('detectado_em', { ascending: false })
    .limit(50)
  if (args.patrulha) q = q.eq('patrulha', args.patrulha)
  if (args.severidade) q = q.eq('severidade', args.severidade)

  const { data, error } = await q
  if (error) return { ok: false, erro: 'falha interna' }
  return { ok: true, dados: data ?? [] }
}

/**
 * liberar_quarentena(id) — ÚNICA escrita do Cérbero.
 * Exige que o admin confirme explicitamente NA CONVERSA antes (o loop pede
 * confirmação; aqui só executamos — a confirmação é responsabilidade do
 * agente no fluxo, ver system-prompt).
 */
export async function liberarQuarentena(
  identidade: IdentidadeHermes,
  args: { id?: string }
): Promise<ResultadoTool> {
  if (!ehSuperAdmin(identidade)) return RESPOSTA_GENERICA_CERBERO
  if (!args.id) return { ok: false, erro: 'informe o id do item em quarentena' }

  const { error } = await supabase
    .from('cerbero_quarentena')
    .update({ liberado: true })
    .eq('id', args.id)
  if (error) return { ok: false, erro: 'falha ao liberar' }
  return { ok: true, dados: { liberado: true, id: args.id } }
}

/**
 * Executa uma tool pelo nome (usada pelo loop do agente).
 * Toda execução grava em hermes_audit_log (direction='tool').
 */
export async function executarTool(
  identidade: IdentidadeHermes,
  waId: string,
  nome: string,
  args: Record<string, unknown>
): Promise<FerramentaExecutada> {
  let resultado: ResultadoTool
  if (nome === 'listar_quarentena') {
    resultado = await listarQuarentena(identidade, { status: args.status as string | undefined })
  } else if (nome === 'get_incidentes') {
    resultado = await getIncidentes(identidade, {
      patrulha: args.patrulha as string | undefined,
      severidade: args.severidade as string | undefined,
    })
  } else if (nome === 'liberar_quarentena') {
    resultado = await liberarQuarentena(identidade, { id: args.id as string | undefined })
  } else {
    resultado = { ok: false, erro: `ferramenta desconhecida: ${nome}` }
  }

  await registrarAuditoriaTool(identidade, waId, nome, args, resultado)

  return { tool: nome, args, resultado }
}

// ── Auditoria (hermes_audit_log — service_role; RLS negado a anon/authenticated)
async function registrarAuditoriaTool(
  identidade: IdentidadeHermes,
  waId: string,
  nome: string,
  args: Record<string, unknown>,
  resultado: ResultadoTool
): Promise<void> {
  const { error } = await supabase.from('hermes_audit_log').insert({
    user_id: identidade.perfilId,
    phone: waId,
    direction: 'tool',
    tool_name: nome,
    tool_args: args,
    tool_result_summary: resultado.ok
      ? `ok ${JSON.stringify(resultado.dados).slice(0, 200)}`
      : `erro: ${resultado.erro}`,
  })

  if (error) {
    logger.warn({ err: error.message, tool: nome }, '[audit] falha ao gravar log de tool')
  }
}
