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
//   D. Leito ocupado em setor sem ninguém de plantão agora (janela real)
// ─────────────────────────────────────────────────────────────────────────────
import { supabaseJob as supabase } from '../lib/supabase.js'
import { inserirIncidentes, observacoesFuturas, prescricoesFuturas, prescricoesOrfas } from '../lib/db-job.js'
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
    a.evidencia.observacao_id ?? a.evidencia.prescricao_id ?? a.evidencia.setor_id
  return `dados:[Falcao] ${a.titulo}:${String(id ?? 'sem-id')}`
}

export async function auditoriaArgos(): Promise<AchadoArgos[]> {
  const achados: AchadoArgos[] = []
  const agoraIso = new Date().toISOString()

  // A. Observação com aferição no futuro
  const { data: obsFuturas, error: e1 } = await observacoesFuturas(agoraIso, 500)
  if (e1) throw new Error(`[argos] observação: ${e1.message}`)
  for (const o of obsFuturas ?? []) {
    achados.push({
      severidade: 'atencao',
      titulo: 'Observação com aferição no futuro',
      evidencia: { observacao_id: o.id, unidade_id: o.unidade_id, aferido_em: o.aferido_em },
    })
  }

  // B. Prescrição com criação no futuro
  const { data: prescFuturas, error: e2 } = await prescricoesFuturas(agoraIso, 500)
  if (e2) throw new Error(`[argos] prescrição futura: ${e2.message}`)
  for (const p of prescFuturas ?? []) {
    achados.push({
      severidade: 'atencao',
      titulo: 'Prescrição com criação no futuro',
      evidencia: { prescricao_id: p.id, unidade_id: p.unidade_id, created_at: p.created_at },
    })
  }

  // C. Prescrição sem paciente (órfã) — só ID, nunca nome
  const { data: prescOrfas, error: e3 } = await prescricoesOrfas(500)
  if (e3) throw new Error(`[argos] prescrição órfã: ${e3.message}`)
  for (const p of prescOrfas ?? []) {
    achados.push({
      severidade: 'informativo',
      titulo: 'Prescrição sem paciente vinculado',
      evidencia: { prescricao_id: p.id, unidade_id: p.unidade_id },
    })
  }

  // D. Setor com leito ocupado e ninguém de plantão AGORA — pela janela real
  //    do plantão (a noite que começou ontem conta), no banco.
  const { data: semPlantao, error: e4 } = await supabase.rpc('hermes_setores_ocupados_sem_plantao')
  if (e4) throw new Error(`[argos] setor sem plantão: ${e4.message}`)
  for (const x of (semPlantao ?? []) as { unidade_id: string; setor_id: string; leitos_ocupados: number }[]) {
    achados.push({
      severidade: 'atencao',
      titulo: 'Leito ocupado em setor sem ninguém de plantão agora',
      evidencia: { setor_id: x.setor_id, unidade_id: x.unidade_id, leitos_ocupados: x.leitos_ocupados },
    })
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
    const { error } = await inserirIncidentes(
      novos.map((a) => ({
        patrulha: 'dados',
        severidade: a.severidade,
        titulo: `[Falcao] ${a.titulo}`,
        evidencia: a.evidencia,
        chave_dedup: chaveDedupArgos(a),
      }))
    )
    if (error) throw new Error(`[argos] falha ao registrar: ${error.message}`)
  }
  logger.info(
    { achados: achados.length, novos: novos.length },
    '[argos] auditoria concluída'
  )
  return achados.length
}
