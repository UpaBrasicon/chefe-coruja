// ─────────────────────────────────────────────────────────────────────────────
// HERMES — jobs/vigias.ts (rodada D, 27/09/2026)
// Seis agentes novos, sem LLM: a conta roda no banco (hermes_* functions) e
// aqui só se decide QUEM recebe. Só números e IDs — nunca identidade de
// paciente. Avisos pela Íris (notificações dentro do app, uma por tipo por
// pessoa por dia; o tipo leva a hora quando precisa de mais de uma).
//
//   Porta ............. resumo da virada de plantão para o gestor
//   Presença .......... plantão começou e a pessoa não fez check-in
//   Buraco na escala .. setor sem ninguém nas próximas 24 h, para o gestor
//   Registros tardios . revisão parada há mais de 24 h, para o gestor
//   Guardião .......... aberturas/impressões de prontuário fora do padrão
//   Cadeia ............ log de auditoria adulterado
// ─────────────────────────────────────────────────────────────────────────────
import { supabaseJob as supabase } from '../lib/supabase.js'
import { hojeBrasilia } from '../lib/tempo.js'
import { logger } from '../logger.js'
import { chavesJaAbertas, filtrarNovos } from './dedup.js'
import { dispatchIris, dispatchIrisParaGestores } from './iris.js'

function exigir<T>(r: { data: T | null; error: { message: string } | null }, contexto: string): T {
  if (r.error) throw new Error(`[vigias] ${contexto}: ${r.error.message}`)
  return (r.data ?? ([] as unknown)) as T
}

async function unidadesAtivas(): Promise<{ id: string; nome: string }[]> {
  return exigir(await supabase.from('unidades').select('id, nome').eq('ativo', true), 'unidades')
}

const NOME_COR: Record<string, string> = { vermelho: 'Vermelho', laranja: 'Laranja', amarelo: 'Amarelo', verde: 'Verde', azul: 'Azul' }

// ── Porta ────────────────────────────────────────────────────────────────────
export function textoPorta(unidade: string, r: {
  janela_horas: number; fichas: number; atendidos: number; evasoes: number; aguardando_agora: number
  por_cor: Record<string, { atendidos: number; dentro_do_alvo: number; espera_media_min: number }>
}): string {
  const cores = ['vermelho', 'laranja', 'amarelo', 'verde', 'azul']
    .filter((c) => r.por_cor[c])
    .map((c) => `${NOME_COR[c]}: ${r.por_cor[c]!.dentro_do_alvo}/${r.por_cor[c]!.atendidos} no tempo-alvo (espera média ${r.por_cor[c]!.espera_media_min} min)`)
  return [
    `🦉 Porta — últimas ${r.janela_horas} h · ${unidade}`,
    `${r.fichas} fichas · ${r.atendidos} atendidos · ${r.evasoes} evasões · ${r.aguardando_agora} aguardando agora`,
    ...cores,
  ].join('\n')
}

export async function vigiaPorta(): Promise<number> {
  const hora = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit' })
  let enviados = 0
  for (const u of await unidadesAtivas()) {
    const r = exigir(await supabase.rpc('hermes_porta_resumo', { p_unidade: u.id, p_horas: 12 }), 'porta') as Parameters<typeof textoPorta>[1]
    if (r.fichas === 0 && r.aguardando_agora === 0) continue
    enviados += await dispatchIrisParaGestores(u.id, `porta_resumo_${hora}h`, textoPorta(u.nome, r))
  }
  logger.info({ enviados }, '[vigias] porta concluída')
  return enviados
}

// ── Presença ─────────────────────────────────────────────────────────────────
export async function vigiaPresenca(): Promise<number> {
  type Pendente = { perfil_id: string; unidade_id: string; setor: string; inicio_brasilia: string }
  let enviados = 0
  for (const p of exigir<Pendente[]>(await supabase.rpc('hermes_checkin_pendente'), 'check-in')) {
    const r = await dispatchIris({
      perfilId: p.perfil_id,
      unidadeId: p.unidade_id,
      tipo: `checkin_pendente_${p.inicio_brasilia.replace(':', '')}`,
      mensagem: `Seu plantão em ${p.setor} começou às ${p.inicio_brasilia} e o check-in ainda não foi feito. Faça em Meu Plantão.`,
    })
    if (r.ok) enviados++
  }
  logger.info({ enviados }, '[vigias] presença concluída')
  return enviados
}

// ── Buraco na escala ─────────────────────────────────────────────────────────
export async function vigiaEscala(): Promise<number> {
  type Buraco = { unidade_id: string; setor: string; horas_sem_ninguem: number; primeira_hora_brasilia: string }
  const porUnidade = new Map<string, Buraco[]>()
  for (const b of exigir<Buraco[]>(await supabase.rpc('hermes_buracos_escala', { p_horas: 24 }), 'buracos')) {
    porUnidade.set(b.unidade_id, [...(porUnidade.get(b.unidade_id) ?? []), b])
  }
  let enviados = 0
  for (const [unidadeId, lista] of porUnidade) {
    const linhas = lista.slice(0, 6).map((b) => `• ${b.setor}: ${b.horas_sem_ninguem} h sem ninguém, a partir de ${b.primeira_hora_brasilia}`)
    if (lista.length > 6) linhas.push(`• … e mais ${lista.length - 6} setores`)
    enviados += await dispatchIrisParaGestores(unidadeId, 'escala_buraco', ['Escala das próximas 24 h com setor descoberto:', ...linhas].join('\n'))
  }
  logger.info({ unidades: porUnidade.size, enviados }, '[vigias] escala concluída')
  return enviados
}

// ── Registros tardios ────────────────────────────────────────────────────────
export async function vigiaTardios(): Promise<number> {
  type Parada = { unidade_id: string; pendentes: number; mais_antiga_brasilia: string }
  let enviados = 0
  for (const p of exigir<Parada[]>(await supabase.rpc('hermes_revisoes_paradas'), 'tardios')) {
    enviados += await dispatchIrisParaGestores(
      p.unidade_id,
      'registros_tardios',
      `${p.pendentes} registro(s) feitos sem conexão aguardam revisão há mais de 24 h (o mais antigo chegou ${p.mais_antiga_brasilia}). Abra Unidade → Registros tardios.`
    )
  }
  logger.info({ enviados }, '[vigias] registros tardios concluída')
  return enviados
}

// ── Incidentes (Guardião e Cadeia) ───────────────────────────────────────────
type Incidente = { severidade: 'critico' | 'atencao'; titulo: string; evidencia: Record<string, unknown>; chave: string }

async function registrarIncidentes(lista: Incidente[]): Promise<number> {
  if (lista.length === 0) return 0
  const abertas = await chavesJaAbertas(lista.map((i) => i.chave))
  const novos = filtrarNovos(lista, (i) => i.chave, abertas)
  if (novos.length === 0) return 0
  const { error } = await supabase.from('cerbero_incidentes').insert(
    novos.map((i) => ({ patrulha: 'dados', severidade: i.severidade, titulo: i.titulo, evidencia: i.evidencia, chave_dedup: i.chave }))
  )
  if (error) throw new Error(`[vigias] falha ao registrar incidentes: ${error.message}`)
  return novos.length
}

export async function guardiaoProntuario(): Promise<number> {
  type Anomalo = { perfil_id: string; unidade_id: string; aberturas: number; impressoes: number; pacientes_distintos: number }
  const achados = exigir<Anomalo[]>(await supabase.rpc('hermes_acessos_anomalos', { p_horas: 24, p_aberturas: 80, p_impressoes: 40 }), 'acessos')
  const hoje = hojeBrasilia()
  const novos = await registrarIncidentes(achados.map((a) => ({
    severidade: 'atencao' as const,
    titulo: 'Acesso ao prontuário fora do padrão (24 h)',
    evidencia: a,
    chave: `dados:guardiao:${a.perfil_id}:${a.unidade_id}:${hoje}`,
  })))
  logger.info({ achados: achados.length, novos }, '[vigias] guardião concluído')
  return achados.length
}

export async function cadeiaAuditoria(): Promise<boolean> {
  // Aqui NULL é a resposta boa (cadeia íntegra): não passa pelo exigir(),
  // que troca null por lista vazia — foi assim que o primeiro disparo deu
  // falso "quebrada" (27/09).
  const r = await supabase.rpc('hermes_cadeia_auditoria')
  if (r.error) throw new Error(`[vigias] cadeia: ${r.error.message}`)
  const quebra = r.data as number | null
  if (typeof quebra === 'number') {
    await registrarIncidentes([{
      severidade: 'critico',
      titulo: 'Cadeia do log de auditoria adulterada',
      evidencia: { primeira_linha_invalida: quebra },
      chave: `dados:cadeia:${quebra}`,
    }])
    logger.error({ seq: quebra }, '[vigias] cadeia de auditoria QUEBRADA')
    return false
  }
  logger.info('[vigias] cadeia de auditoria íntegra')
  return true
}
