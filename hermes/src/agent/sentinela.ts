// ─────────────────────────────────────────────────────────────────────────────
// HERMES v1.1 — agent/sentinela.ts
// Cálculo das métricas de escala por médico vs. mediana/IQR da unidade.
//
// ⚠️ Dados REAIS (schema verificado — nunca inventar colunas):
//   - repasses  : solicitacoes_escala tipo='passar_plantao' status='aprovado'
//   - faltas    : solicitacoes_escala tipo='falta'
//   - trocas    : trocas_plantao (status != 'erro')
//   - cancelamento tardio: repasse com created_at < 48h antes do plantão
//   - concentracao_destino: % dos repasses por destino_perfil_id
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase.js'
import { logger } from '../logger.js'

export type MetricasMedico = {
  medicoId: string
  plantoesAtribuidos: number
  repasses: number
  faltas: number
  cancelamentoTardio: number
  trocasIniciadas: number
  concentracaoDestino: number // 0..1
}

export type AlertaSentinela = {
  unidadeId: string
  medicoId: string
  janela: '30d' | '90d'
  metrica: 'taxa_repasse' | 'faltas' | 'cancelamento_tardio' | 'trocas_iniciadas' | 'concentracao_destino'
  valor: number
  medianaUnidade: number
  limiteOutlier: number
  detalhe: Record<string, unknown>
}

const MIN_PLANTOES = 8 // evita falso positivo de quem tem poucos plantões

function quartil(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const resto = pos - base
  const v0 = sorted[base]!
  const v1 = sorted[base + 1] ?? sorted[base]!
  return v0 + (v1 - v0) * resto
}

export function calcularLimiteOutlier(valores: number[]): { mediana: number; limite: number } {
  if (valores.length < 2) return { mediana: valores[0] ?? 0, limite: Infinity }
  const sorted = [...valores].sort((a, b) => a - b)
  const q1 = quartil(sorted, 0.25)
  const q3 = quartil(sorted, 0.75)
  const iqr = q3 - q1
  return { mediana: quartil(sorted, 0.5), limite: q3 + 1.5 * iqr }
}

/**
 * Busca os plantões atribuídos por médico na unidade dentro da janela.
 * Retorna map: medicoId -> lista de plantões (com data, turno).
 */
async function plantoesDaUnidade(
  unidadeId: string,
  dias: number
): Promise<Map<string, { id: string; data: string; turno: string }[]>> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('escala_plantao')
    .select('id, perfil_id, data, turno')
    .eq('unidade_id', unidadeId)
    .eq('ativo', true)
    .gte('data', desde)
    .lte('data', new Date().toISOString().slice(0, 10))

  if (error) {
    logger.error({ err: error.message, unidadeId }, '[sentinela] falha ao buscar escala')
    throw new Error('falha interna ao calcular métricas')
  }

  const map = new Map<string, { id: string; data: string; turno: string }[]>()
  for (const p of data ?? []) {
    if (!p.perfil_id) continue
    const lista = map.get(p.perfil_id) ?? []
    lista.push({ id: p.id, data: p.data, turno: p.turno })
    map.set(p.perfil_id, lista)
  }
  return map
}

/**
 * Calcula as métricas de TODOS os médicos da unidade nas janelas 30d/90d.
 * Sem LLM — SQL/TS puro (requisito do prompt).
 */
export async function calcularMetricasUnidade(
  unidadeId: string,
  janela: '30d' | '90d'
): Promise<MetricasMedico[]> {
  const dias = janela === '30d' ? 30 : 90
  const plantoes = await plantoesDaUnidade(unidadeId, dias)
  const desdeIso = new Date(Date.now() - dias * 86_400_000).toISOString()

  // Repasses aprovados (com created_at para detectar tardio) e faltas
  const { data: sols, error: errSols } = await supabase
    .from('solicitacoes_escala')
    .select('perfil_id, tipo, status, destino_perfil_id, created_at, escala_plantao!solicitacoes_escala_escala_plantao_id_fkey(data)')
    .eq('unidade_id', unidadeId)
    .gte('created_at', desdeIso)
    .order('created_at', { ascending: true })

  if (errSols) {
    logger.error({ err: errSols.message }, '[sentinela] falha ao buscar solicitações')
    throw new Error('falha interna ao calcular métricas')
  }

  // Trocas iniciadas
  const { data: trocas, error: errTrocas } = await supabase
    .from('trocas_plantao')
    .select('perfil_a_id, status, created_at')
    .eq('unidade_id', unidadeId)
    .gte('created_at', desdeIso)

  if (errTrocas) {
    logger.error({ err: errTrocas.message }, '[sentinela] falha ao buscar trocas')
    throw new Error('falha interna ao calcular métricas')
  }

  const medicoIds = new Set<string>([...plantoes.keys()])
  for (const s of sols ?? []) if (s.perfil_id) medicoIds.add(s.perfil_id)
  for (const t of trocas ?? []) if (t.perfil_a_id) medicoIds.add(t.perfil_a_id)

  const resultado: MetricasMedico[] = []
  for (const medicoId of medicoIds) {
    const meusPlantoes = plantoes.get(medicoId) ?? []
    const meusSols = (sols ?? []).filter((s) => s.perfil_id === medicoId)
    const repasses = meusSols.filter((s) => s.tipo === 'passar_plantao' && s.status === 'aprovado')
    const faltas = meusSols.filter((s) => s.tipo === 'falta')
    const minhasTrocas = (trocas ?? []).filter((t) => t.perfil_a_id === medicoId && t.status !== 'erro')

    // cancelamento tardio: repasse cujo plantão é < 48h após a solicitação
    const cancelamentoTardio = repasses.filter((r) => {
      const dataPlantao = (r.escala_plantao as { data?: string } | null)?.data
      if (!dataPlantao) return false
      const plantaoTs = new Date(`${dataPlantao}T23:59:59`).getTime()
      const criadoTs = new Date(r.created_at).getTime()
      return plantaoTs - criadoTs < 48 * 3_600_000
    }).length

    // concentração de destino: % indo para o destino mais frequente
    let concentracaoDestino = 0
    if (repasses.length > 0) {
      const contagem = new Map<string, number>()
      for (const r of repasses) {
        if (!r.destino_perfil_id) continue
        contagem.set(r.destino_perfil_id, (contagem.get(r.destino_perfil_id) ?? 0) + 1)
      }
      const max = Math.max(0, ...contagem.values())
      concentracaoDestino = repasses.length > 0 ? max / repasses.length : 0
    }

    resultado.push({
      medicoId,
      plantoesAtribuidos: meusPlantoes.length,
      repasses: repasses.length,
      faltas: faltas.length,
      cancelamentoTardio,
      trocasIniciadas: minhasTrocas.length,
      concentracaoDestino,
    })
  }

  return resultado
}

/**
 * Detecta outliers por IQR da unidade. Retorna alertas para médicos com
 * plantoesAtribuidos >= MIN_PLANTOES acima de Q3 + 1.5*IQR.
 */
export function detectarOutliers(metricas: MetricasMedico[], janela: '30d' | '90d'): AlertaSentinela[] {
  const alertas: AlertaSentinela[] = []
  const chaves: (keyof Pick<MetricasMedico, 'repasses' | 'faltas' | 'cancelamentoTardio' | 'trocasIniciadas' | 'concentracaoDestino'>)[] = [
    'repasses', 'faltas', 'cancelamentoTardio', 'trocasIniciadas', 'concentracaoDestino',
  ]
  const nomes: Record<string, AlertaSentinela['metrica']> = {
    repasses: 'taxa_repasse', faltas: 'faltas', cancelamentoTardio: 'cancelamento_tardio',
    trocasIniciadas: 'trocas_iniciadas', concentracaoDestino: 'concentracao_destino',
  }

  for (const chave of chaves) {
    // Só considera médicos com mínimo de plantões (requisito)
    const elegiveis = metricas.filter((m) => m.plantoesAtribuidos >= MIN_PLANTOES)
    if (elegiveis.length < 2) continue
    const valores = elegiveis.map((m) => m[chave] as number)
    const { mediana, limite } = calcularLimiteOutlier(valores)
    if (!Number.isFinite(limite)) continue

    for (const m of elegiveis) {
      const valor = m[chave] as number
      if (valor > limite) {
        alertas.push({
          unidadeId: '', // preenchido pelo chamador
          medicoId: m.medicoId,
          janela,
          metrica: nomes[chave]!,
          valor,
          medianaUnidade: mediana,
          limiteOutlier: limite,
          detalhe: {},
        })
      }
    }
  }

  return alertas
}
