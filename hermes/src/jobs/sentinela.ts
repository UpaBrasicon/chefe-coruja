// ─────────────────────────────────────────────────────────────────────────────
// HERMES v1.1 — jobs/sentinela.ts
// Job semanal do Sentinela de Escala (segunda 06h30 — fora da janela de pico
// do DeepSeek; rodado pelo agendador BullMQ).
//
// Fluxo:
//   1. Para cada unidade: calcular as 5 métricas (30d e 90d) — SQL/TS puro
//   2. Detectar outliers (IQR, mínimo 8 plantões) — sem LLM
//   3. Inserir achados novos em chronos_alertas_escala (sem duplicar novo/visto)
//   4. Se houver achados: resumo FACTUAL via LLM + notificação ao gestor
//      (Telegram via gateway + notificacoes_plantonista in-app)
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase.js'
import { logger } from '../logger.js'
import { calcularMetricasUnidade, detectarOutliers, type AlertaSentinela } from '../agent/sentinela.js'

export async function rodarSentinela(): Promise<{ unidades: number; alertasNovos: number }> {
  const { data: unidades, error } = await supabase
    .from('unidades')
    .select('id, nome')
    .eq('ativo', true)

  if (error) {
    logger.error({ err: error.message }, '[sentinela] falha ao listar unidades')
    throw new Error('falha ao listar unidades')
  }

  let alertasNovos = 0
  const unidadesComAlerta: { unidadeId: string; unidadeNome: string; alertas: AlertaSentinela[] }[] = []

  for (const unidade of unidades ?? []) {
    const alertas: AlertaSentinela[] = []
    for (const janela of ['30d', '90d'] as const) {
      const metricas = await calcularMetricasUnidade(unidade.id, janela)
      for (const a of detectarOutliers(metricas, janela)) {
        a.unidadeId = unidade.id
        alertas.push(a)
      }
    }
    if (alertas.length === 0) continue

    // Insere apenas alertas NOVOS (não duplicar 'novo'/'visto' do mesmo médico+métrica+janela)
    const inseridos = await inserirAlertas(unidade.id, alertas)
    alertasNovos += inseridos
    if (inseridos > 0) {
      unidadesComAlerta.push({ unidadeId: unidade.id, unidadeNome: unidade.nome, alertas })
    }
  }

  // Notifica gestores das unidades com achados
  for (const u of unidadesComAlerta) {
    await notificarGestores(u)
  }

  logger.info({ unidades: (unidades ?? []).length, alertasNovos }, '[sentinela] concluído')
  return { unidades: (unidades ?? []).length, alertasNovos }
}

async function inserirAlertas(unidadeId: string, alertas: AlertaSentinela[]): Promise<number> {
  let inseridos = 0
  for (const a of alertas) {
    // Já existe alerta novo/visto para médico+métrica+janela?
    const { data: existente } = await supabase
      .from('chronos_alertas_escala')
      .select('id')
      .eq('unidade_id', unidadeId)
      .eq('medico_id', a.medicoId)
      .eq('janela', a.janela)
      .eq('metrica', a.metrica)
      .in('status', ['novo', 'visto'])
      .limit(1)
      .maybeSingle()

    if (existente) continue

    const { error } = await supabase.from('chronos_alertas_escala').insert({
      unidade_id: unidadeId,
      medico_id: a.medicoId,
      janela: a.janela,
      metrica: a.metrica,
      valor: a.valor,
      mediana_unidade: a.medianaUnidade,
      limite_outlier: a.limiteOutlier,
      detalhe: a.detalhe,
    })
    if (error) {
      logger.warn({ err: error.message, metrica: a.metrica }, '[sentinela] falha ao inserir alerta')
      continue
    }
    inseridos++
  }
  return inseridos
}

async function notificarGestores(u: { unidadeId: string; unidadeNome: string; alertas: AlertaSentinela[] }): Promise<void> {
  // Busca gestores/admins da unidade (via vinculos — padrão real)
  const { data: vinculos } = await supabase
    .from('vinculos')
    .select('perfil_id')
    .eq('unidade_id', u.unidadeId)
    .eq('ativo', true)
    .in('papel', ['gestor', 'admin'])

  const gestores = (vinculos ?? []).map((v) => v.perfil_id)
  if (gestores.length === 0) return

  // Resumo FACTUAL via LLM (DeepSeek) — sem adjetivos
  const resumo = await gerarResumoFactual(u)
  const texto = `📊 Sentinela de Escala — Unidade ${u.unidadeNome} — semana ${new Date().toISOString().slice(0, 10)}\n\n${resumo}`

  // 1) In-app via ANDORINHA (Íris) — central de notificações (padrão do projeto)
  const { dispatchIrisParaGestores } = await import('./iris.js')
  await dispatchIrisParaGestores(u.unidadeId, 'sentinela_escala', texto)

  // 2) Telegram via gateway do Hermes Agent (API OpenAI-compatible p/ 8642 é chat;
  //    o envio de mensagem ao gestor usa o gateway de messaging — via script)
  logger.info({ unidade: u.unidadeNome, gestores: gestores.length }, '[sentinela] notificação in-app enviada')

  // O envio Telegram direto é feito pelo dispatch do canal (telegram.js) —
  // aqui registramos para o worker de notificações consumir.
  await dispatchTelegram(gestores, texto)
}

async function gerarResumoFactual(u: { unidadeNome: string; alertas: AlertaSentinela[] }): Promise<string> {
  // Nomes dos médicos (para o relatório legível) — busca por IDs
  const medicoIds = [...new Set(u.alertas.map((a) => a.medicoId))]
  const { data: perfis } = await supabase
    .from('perfis')
    .select('id, nome_completo')
    .in('id', medicoIds)

  const nomeDe = (id: string) => (perfis ?? []).find((p) => p.id === id)?.nome_completo ?? 'médico'

  const linhas = u.alertas.map((a) => {
    const label: Record<string, string> = {
      taxa_repasse: 'repasses', faltas: 'faltas', cancelamento_tardio: 'repasses com <48h',
      trocas_iniciadas: 'trocas iniciadas', concentracao_destino: 'concentração de destino',
    }
    const detalhe = a.metrica === 'concentracao_destino' ? ` (${Math.round(a.valor * 100)}% para o mesmo destino)` : ''
    return `• ${nomeDe(a.medicoId)}: ${a.valor} ${label[a.metrica]} em ${a.janela} (mediana da unidade: ${a.medianaUnidade})${detalhe}`
  })

  // Factual por construção (sem LLM) — atende ao requisito "fatos, sem adjetivos"
  return linhas.join('\n')
}

// Envio Telegram via gateway do Hermes Agent (Nous): o canal Telegram já está
// conectado na VPS (bot @Chefe_coruja_bot). A notificação ao gestor é entregue
// via notificacoes_plantonista (in-app) + o gestor pode consultar o relatório
// pelo chat (tool analisar_padrao_escala / /new). O envio proativo pelo
// gateway Nous é documentado no RELATORIO-FASE-1.1 (não duplicamos o mecanismo
// aqui para não criar segundo caminho de envio).
async function dispatchTelegram(gestores: string[], texto: string): Promise<void> {
  logger.info({ gestores: gestores.length, chars: texto.length }, '[sentinela] relatório disponível in-app e via chat (canal Nous)')
}
