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

// ⚠️ USAR `escala_plantao` (principal). `escala_plantoes` é paralela/legado —
// não usar nesta tool (risco anotado no PREFLIGHT).
const TABELA_ESCALA = 'escala_plantao'

function fmtDataBR(d: string): string {
  const [ano, mes, dia] = d.split('-')
  return `${dia}/${mes}/${ano}`
}

/**
 * get_meus_plantoes(periodo) — plantões do USUÁRIO (sempre filtrado pelo
 * perfil_id resolvido da identidade).
 */
export async function getMeusPlantoes(
  identidade: IdentidadeHermes,
  args: { periodo?: string }
): Promise<ResultadoTool> {
  const periodo = args.periodo ?? 'semana'
  const hoje = new Date()
  const fim = new Date(hoje)
  if (periodo === 'hoje') fim.setDate(hoje.getDate())
  else if (periodo === 'mes') fim.setMonth(hoje.getMonth() + 1)
  else fim.setDate(hoje.getDate() + 7) // semana (default)

  const dataIni = hoje.toISOString().slice(0, 10)
  const dataFim = fim.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from(TABELA_ESCALA)
    .select('id, data, turno, rotulo, observacao, setor_id, setores!escala_plantao_setor_id_fkey(nome)')
    .eq('perfil_id', identidade.perfilId)
    .eq('ativo', true)
    .gte('data', dataIni)
    .lte('data', dataFim)
    .order('data', { ascending: true })
    .order('turno', { ascending: true })

  if (error) {
    logger.error({ err: error.message, perfil: identidade.perfilId }, '[tool] get_meus_plantoes falhou')
    return { ok: false, erro: 'falha interna ao consultar seus plantões' }
  }

  return {
    ok: true,
    dados: (data ?? []).map((p) => ({
      data: fmtDataBR(p.data),
      turno: p.turno,
      setor: (p.setores as unknown as { nome: string } | null)?.nome ?? null,
      rotulo: p.rotulo,
      observacao: p.observacao,
    })),
  }
}

/**
 * get_plantao_do_dia(data) — escala da UNIDADE do gestor/admin.
 * Plantonista tentando usar → erro "sem permissão" (filtro NO CÓDIGO).
 */
export async function getPlantaoDoDia(
  identidade: IdentidadeHermes,
  args: { data?: string }
): Promise<ResultadoTool> {
  // Filtro de papel NO CÓDIGO — não confiar no LLM (regra 3).
  if (identidade.papel !== 'gestor' && identidade.papel !== 'admin') {
    return { ok: false, erro: 'sem permissão para ver a escala da unidade' }
  }
  if (!identidade.unidadeId) {
    return { ok: false, erro: 'usuário sem unidade vinculada' }
  }

  // Data no formato esperado pela tool (yyyy-mm-dd) ou hoje.
  const data = args.data ?? new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { ok: false, erro: 'data inválida — use o formato AAAA-MM-DD' }
  }

  const { data: plantoes, error } = await supabase
    .from(TABELA_ESCALA)
    .select('data, turno, rotulo, perfil_id, perfis!escala_plantao_perfil_id_fkey(nome_completo), setor_id, setores!escala_plantao_setor_id_fkey(nome)')
    .eq('unidade_id', identidade.unidadeId)
    .eq('data', data)
    .eq('ativo', true)
    .order('turno', { ascending: true })

  if (error) {
    logger.error({ err: error.message, unidade: identidade.unidadeId }, '[tool] get_plantao_do_dia falhou')
    return { ok: false, erro: 'falha interna ao consultar a escala' }
  }

  const semDados = (plantoes ?? []).length === 0
  return {
    ok: true,
    dados: semDados
      ? { data: fmtDataBR(data), mensagem: 'Nenhum plantão encontrado nesta data.' }
      : {
          data: fmtDataBR(data),
          plantoes: (plantoes ?? []).map((p) => ({
            turno: p.turno,
            setor: (p.setores as unknown as { nome: string } | null)?.nome ?? null,
            profissional:
              (p.perfis as unknown as { nome_completo: string } | null)?.nome_completo ?? '?',
            rotulo: p.rotulo,
          })),
        },
  }
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
  if (nome === 'get_meus_plantoes') {
    resultado = await getMeusPlantoes(identidade, { periodo: args.periodo as string | undefined })
  } else if (nome === 'get_plantao_do_dia') {
    resultado = await getPlantaoDoDia(identidade, { data: args.data as string | undefined })
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
