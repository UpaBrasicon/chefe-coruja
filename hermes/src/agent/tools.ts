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
 * v1.1 — analisar_padrao_escala(medico_id?, janela)
 * Métricas do médico vs. mediana da unidade (Sentinela).
 * Guarda de papel: gestor/admin vê qualquer médico da unidade; plantonista
 * só recebe os PRÓPRIOS dados (filtro NO CÓDIGO, regra 3).
 */
export async function analisarPadraoEscala(
  identidade: IdentidadeHermes,
  args: { medico_id?: string; janela?: string }
): Promise<ResultadoTool> {
  const janela = (args.janela === '90d' ? '90d' : '30d') as '30d' | '90d'

  // Filtro de papel NO CÓDIGO: plantonista só vê os próprios dados
  const medicoAlvo =
    identidade.papel === 'gestor' || identidade.papel === 'admin'
      ? (args.medico_id ?? identidade.perfilId)
      : identidade.perfilId

  if (!identidade.unidadeId) {
    return { ok: false, erro: 'usuário sem unidade vinculada' }
  }

  const { calcularMetricasUnidade } = await import('./sentinela.js')
  const metricas = await calcularMetricasUnidade(identidade.unidadeId, janela)
  const doMedico = metricas.find((m) => m.medicoId === medicoAlvo)

  if (!doMedico) {
    return { ok: true, dados: { mensagem: 'Médico sem plantões na janela selecionada.' } }
  }

  // Mediana da unidade para comparação (médicos elegíveis, mínimo 8)
  const { detectarOutliers } = await import('./sentinela.js')
  const alertas = detectarOutliers(metricas, janela).filter((a) => a.medicoId === medicoAlvo)

  const { data: perfil } = await supabase
    .from('perfis')
    .select('nome_completo')
    .eq('id', medicoAlvo)
    .maybeSingle()

  return {
    ok: true,
    dados: {
      medico: (perfil as { nome_completo: string } | null)?.nome_completo ?? 'médico',
      janela,
      plantoesAtribuidos: doMedico.plantoesAtribuidos,
      repasses: doMedico.repasses,
      faltas: doMedico.faltas,
      cancelamentoTardio: doMedico.cancelamentoTardio,
      trocasIniciadas: doMedico.trocasIniciadas,
      concentracaoDestino: doMedico.concentracaoDestino,
      foraDoPadrao: alertas.map((a) => ({ metrica: a.metrica, valor: a.valor, mediana: a.medianaUnidade })),
    },
  }
}

/**
 * v1.1 — Cérbero (exclusivo super_admin).
 * Guarda de papel: quem NÃO é super_admin recebe resposta genérica
 * (sem revelar a existência do agente — requisito do prompt).
 */
async function ehSuperAdmin(perfilId: string): Promise<boolean> {
  const { data } = await supabase
    .from('super_admins')
    .select('perfil_id')
    .eq('perfil_id', perfilId)
    .maybeSingle()
  return Boolean(data)
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
  if (!(await ehSuperAdmin(identidade.perfilId))) return RESPOSTA_GENERICA_CERBERO

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
  if (!(await ehSuperAdmin(identidade.perfilId))) return RESPOSTA_GENERICA_CERBERO

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
  if (!(await ehSuperAdmin(identidade.perfilId))) return RESPOSTA_GENERICA_CERBERO
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
  if (nome === 'get_meus_plantoes') {
    resultado = await getMeusPlantoes(identidade, { periodo: args.periodo as string | undefined })
  } else if (nome === 'get_plantao_do_dia') {
    resultado = await getPlantaoDoDia(identidade, { data: args.data as string | undefined })
  } else if (nome === 'analisar_padrao_escala') {
    resultado = await analisarPadraoEscala(identidade, {
      medico_id: args.medico_id as string | undefined,
      janela: args.janela as string | undefined,
    })
  } else if (nome === 'listar_quarentena') {
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
