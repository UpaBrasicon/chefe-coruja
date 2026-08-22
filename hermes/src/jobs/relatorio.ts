// ─────────────────────────────────────────────────────────────────────────────
// GAVIÃO v2 — jobs/relatorio.ts
// Relatório semanal in-app: agrega os incidentes do Cérbero e os alertas do
// Sentinela da semana e grava em gaviao_relatorios_semanais (visível ao
// admin/gestor na aba Gavião).
//
// ⚠️ Resumo com NÚMEROS e títulos — nunca dado de paciente.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase.js'
import { logger } from '../logger.js'

export async function gerarRelatorioSemanal(): Promise<{ id?: string; incidentes: number; alertas: number }> {
  const fim = new Date()
  const inicio = new Date(fim.getTime() - 7 * 86_400_000)
  const inicioIso = inicio.toISOString()
  const fimIso = fim.toISOString()

  // Incidentes do Cérbero na semana
  const { data: incidentes, error: errInc } = await supabase
    .from('cerbero_incidentes')
    .select('id, patrulha, severidade, titulo, status, detectado_em')
    .gte('detectado_em', inicioIso)
    .lte('detectado_em', fimIso)

  if (errInc) {
    logger.error({ err: errInc.message }, '[relatorio] falha ao buscar incidentes')
    throw new Error('falha ao gerar relatório')
  }

  // Alertas do Sentinela na semana
  const { data: alertas, error: errAlertas } = await supabase
    .from('chronos_alertas_escala')
    .select('id, unidade_id, metrica, valor, status, criado_em')
    .gte('criado_em', inicioIso)
    .lte('criado_em', fimIso)

  if (errAlertas) {
    logger.error({ err: errAlertas.message }, '[relatorio] falha ao buscar alertas')
    throw new Error('falha ao gerar relatório')
  }

  const listaIncidentes = (incidentes ?? []).map((i) => ({
    id: i.id, patrulha: i.patrulha, severidade: i.severidade, titulo: i.titulo,
    status: i.status, quando: i.detectado_em,
  }))
  const listaAlertas = (alertas ?? []).map((a) => ({
    id: a.id, unidade_id: a.unidade_id, metrica: a.metrica,
    valor: a.valor, status: a.status, quando: a.criado_em,
  }))

  const resumo = {
    incidentes_por_severidade: {
      critico: (incidentes ?? []).filter((i) => i.severidade === 'critico').length,
      atencao: (incidentes ?? []).filter((i) => i.severidade === 'atencao').length,
      informativo: (incidentes ?? []).filter((i) => i.severidade === 'informativo').length,
    },
    incidentes_por_patrulha: {
      dados: (incidentes ?? []).filter((i) => i.patrulha === 'dados').length,
      conteudo: (incidentes ?? []).filter((i) => i.patrulha === 'conteudo').length,
      hermes: (incidentes ?? []).filter((i) => i.patrulha === 'hermes').length,
    },
    alertas_por_status: {
      novo: (alertas ?? []).filter((a) => a.status === 'novo').length,
      visto: (alertas ?? []).filter((a) => a.status === 'visto').length,
      em_acompanhamento: (alertas ?? []).filter((a) => a.status === 'em_acompanhamento').length,
      justificado: (alertas ?? []).filter((a) => a.status === 'justificado').length,
    },
    total_incidentes: (incidentes ?? []).length,
    total_alertas: (alertas ?? []).length,
    periodo: { inicio: inicioIso.slice(0, 10), fim: fimIso.slice(0, 10) },
  }

  const { data: inserido, error } = await supabase
    .from('gaviao_relatorios_semanais')
    .insert({
      periodo_inicio: inicioIso.slice(0, 10),
      periodo_fim: fimIso.slice(0, 10),
      resumo,
      detalhes: { incidentes: listaIncidentes, alertas: listaAlertas },
    })
    .select('id')
    .single()

  if (error) {
    logger.error({ err: error.message }, '[relatorio] falha ao gravar relatório')
    throw new Error('falha ao gravar relatório')
  }

  logger.info(
    { id: inserido?.id, incidentes: listaIncidentes.length, alertas: listaAlertas.length },
    '[relatorio] relatório semanal gerado'
  )
  return { id: inserido?.id, incidentes: listaIncidentes.length, alertas: listaAlertas.length }
}
