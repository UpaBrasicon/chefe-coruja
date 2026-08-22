// ─────────────────────────────────────────────────────────────────────────────
// GAVIÃO v2 — jobs/argos.ts
// FALCÃO (Argos) — auditoria de dados clínicos (coerência estrutural).
//
// ⚠️ LGPD: reporta IDs e números, NUNCA nome de paciente. Dado clínico
// identificável fica só na plataforma (nunca em chat externo).
//
// Checks (SQL/TS puro, sem LLM):
//   A. Observação com aferição no futuro
//   B. Prescrição com criação no futuro
//   C. Prescrição sem paciente vinculado (órfã)
//   D. Leito ocupado em setor sem médico na escala de hoje
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase.js'
import { logger } from '../logger.js'
import { chavesJaAbertas, filtrarNovos } from './dedup.js'

export type AchadoArgos = {
  severidade: 'critico' | 'atencao' | 'informativo'
  titulo: string
  evidencia: Record<string, unknown>
}

/**
 * Chave estável de dedup (A1): patrulha + título + id da evidência.
 * O id varia por check: observacao_id (A), prescricao_id (B/C), leito_id (D).
 * Enquanto o incidente estiver aberto, a mesma chave não duplica; quando o
 * admin resolve e o problema persiste, a reincidência gera um novo incidente.
 */
export function chaveDedupArgos(a: AchadoArgos): string {
  const id =
    a.evidencia.observacao_id ?? a.evidencia.prescricao_id ?? a.evidencia.leito_id
  return `dados:[Falcao] ${a.titulo}:${String(id ?? 'sem-id')}`
}

export async function auditoriaArgos(): Promise<AchadoArgos[]> {
  const achados: AchadoArgos[] = []
  const agoraIso = new Date().toISOString()

  // A. Observação com aferição no futuro
  const { data: obsFuturas } = await supabase
    .from('observacao')
    .select('id, unidade_id, aferido_em')
    .gt('aferido_em', agoraIso)
    .limit(500)
  for (const o of obsFuturas ?? []) {
    achados.push({
      severidade: 'atencao',
      titulo: 'Observação com aferição no futuro',
      evidencia: { observacao_id: o.id, unidade_id: o.unidade_id, aferido_em: o.aferido_em },
    })
  }

  // B. Prescrição com criação no futuro
  const { data: prescFuturas } = await supabase
    .from('prescricoes')
    .select('id, unidade_id, created_at')
    .gt('created_at', agoraIso)
    .limit(500)
  for (const p of prescFuturas ?? []) {
    achados.push({
      severidade: 'atencao',
      titulo: 'Prescrição com criação no futuro',
      evidencia: { prescricao_id: p.id, unidade_id: p.unidade_id, created_at: p.created_at },
    })
  }

  // C. Prescrição sem paciente (órfã) — só ID, nunca nome
  const { data: prescOrfas } = await supabase
    .from('prescricoes')
    .select('id, unidade_id')
    .is('paciente_id', null)
    .limit(500)
  for (const p of prescOrfas ?? []) {
    achados.push({
      severidade: 'informativo',
      titulo: 'Prescrição sem paciente vinculado',
      evidencia: { prescricao_id: p.id, unidade_id: p.unidade_id },
    })
  }

  // D. Leito ocupado em setor sem médico na escala de hoje
  const hoje = new Date().toISOString().slice(0, 10)
  const { data: leitosOcupados } = await supabase
    .from('leitos')
    .select('id, setor_id')
    .eq('status', 'ocupado')
    .eq('ativo', true)
    .limit(1000)
  const { data: plantoesHoje } = await supabase
    .from('escala_plantao')
    .select('setor_id')
    .eq('data', hoje)
    .eq('ativo', true)
    .limit(2000)
  const setoresComEscala = new Set((plantoesHoje ?? []).map((p) => p.setor_id))
  for (const l of leitosOcupados ?? []) {
    if (l.setor_id && !setoresComEscala.has(l.setor_id)) {
      achados.push({
        severidade: 'atencao',
        titulo: 'Leito ocupado em setor sem médico na escala de hoje',
        evidencia: { leito_id: l.id, setor_id: l.setor_id },
      })
    }
  }

  return achados
}

export async function rodarAuditoriaArgos(): Promise<number> {
  const achados = await auditoriaArgos()
  if (achados.length === 0) {
    logger.info({ achados: 0 }, '[argos] auditoria concluída')
    return 0
  }

  // A1 — dedup: só insere o que NÃO tem chave aberta equivalente.
  const abertas = await chavesJaAbertas(achados.map(chaveDedupArgos))
  const novos = filtrarNovos(achados, chaveDedupArgos, abertas)

  if (novos.length > 0) {
    const { error } = await supabase.from('cerbero_incidentes').insert(
      novos.map((a) => ({
        patrulha: 'dados',
        severidade: a.severidade,
        titulo: `[Falcao] ${a.titulo}`,
        evidencia: a.evidencia,
        chave_dedup: chaveDedupArgos(a),
      }))
    )
    if (error) logger.warn({ err: error.message }, '[argos] falha ao registrar')
  }
  logger.info(
    { achados: achados.length, novos: novos.length },
    '[argos] auditoria concluída'
  )
  return achados.length
}
