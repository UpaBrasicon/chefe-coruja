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

export type AchadoArgos = {
  severidade: 'critico' | 'atencao' | 'informativo'
  titulo: string
  evidencia: Record<string, unknown>
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
  for (const a of achados) {
    const { error } = await supabase.from('cerbero_incidentes').insert({
      patrulha: 'dados',
      severidade: a.severidade,
      titulo: `[Falcao] ${a.titulo}`,
      evidencia: a.evidencia,
    })
    if (error) logger.warn({ err: error.message }, '[argos] falha ao registrar')
  }
  logger.info({ achados: achados.length }, '[argos] auditoria concluída')
  return achados.length
}
