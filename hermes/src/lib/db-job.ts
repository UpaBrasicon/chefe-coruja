// ─────────────────────────────────────────────────────────────────────────────
// HERMES — lib/db-job.ts
// Leituras e escritas de TABELA dos crons (e dos dois registros técnicos do
// caminho de request: log do gateway de IA e cache de URL do firewall).
// Cutover V1, caminho B (docs/seguranca/cutover-hermes-v1.md):
//   • com HERMES_PG_JOB_URL → postgres.js como hermes_app_job (herda
//     hermes_job: grants mínimos + políticas de RLS da migration
//     20261022000007). Não bypassa RLS.
//   • sem a URL → fallback para o supabase-js com a service_role (o comportamento
//     antigo), até o dono ligar HERMES_SEM_SERVICE_ROLE=1. Quando a service_role
//     sair de vez, o ramo `servico` de cada função some.
//
// Cada função devolve { data, error } como o supabase-js, para os jobs manterem
// o tratamento de erro que já tinham. Linhas em JSON gerado pelo banco (mesmo
// formato do PostgREST: datas como string ISO, números como número).
//
// ⚠️ Nada aqui recebe nome de tabela/coluna de fora: as consultas são fixas e os
// valores vão como parâmetro.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'node:crypto'
import type postgres from 'postgres'
import { supabase as servico, sqlJob } from './supabase.js'
import { erroPg, linhasJson, type Sql } from './pg.js'

export type Resultado<T> = { data: T | null; error: { message: string } | null }

type Json = Record<string, unknown>

async function pg<T>(f: (sql: Sql) => Promise<T>): Promise<Resultado<T>> {
  try {
    return { data: await f(sqlJob!), error: null }
  } catch (err) {
    return { data: null, error: { message: erroPg(err).message } }
  }
}

function sb<T>(r: { data: unknown; error: { message: string } | null }): Resultado<T> {
  return { data: (r.data ?? null) as T | null, error: r.error ? { message: r.error.message } : null }
}

const json = (sql: Sql, v: unknown) => sql.json(v as postgres.JSONValue)

// ── Incidentes (cerbero_incidentes) ──────────────────────────────────────────
export type IncidenteNovo = {
  patrulha: string
  severidade: string
  titulo: string
  evidencia: Json
  chave_dedup?: string | null
}

/** Insere incidentes. No Postgres, chave já aberta é ignorada (índice parcial). */
export async function inserirIncidentes(linhas: IncidenteNovo[]): Promise<Resultado<null>> {
  if (linhas.length === 0) return { data: null, error: null }
  if (!sqlJob) return sb(await servico.from('cerbero_incidentes').insert(linhas))
  return pg(async (sql) => {
    const valores = linhas.map((l) => ({
      patrulha: l.patrulha,
      severidade: l.severidade,
      titulo: l.titulo,
      evidencia: json(sql, l.evidencia),
      chave_dedup: l.chave_dedup ?? null,
    }))
    await sql`
      insert into public.cerbero_incidentes ${sql(valores, 'patrulha', 'severidade', 'titulo', 'evidencia', 'chave_dedup')}
      on conflict (chave_dedup) where status in ('aberto', 'em_analise') do nothing`
    return null
  })
}

/** Chaves de dedup que já têm incidente aberto/em análise (lote ≤ 100). */
export async function chavesIncidentesAbertos(chaves: string[]): Promise<Resultado<{ chave_dedup: string | null }[]>> {
  if (chaves.length === 0) return { data: [], error: null }
  if (!sqlJob) {
    return sb(await servico.from('cerbero_incidentes').select('chave_dedup')
      .in('status', ['aberto', 'em_analise']).in('chave_dedup', chaves))
  }
  return pg((sql) => linhasJson(sql, sql`
    select chave_dedup from public.cerbero_incidentes
     where status in ('aberto', 'em_analise') and chave_dedup in ${sql(chaves)}`))
}

export async function incidentesNoPeriodo(inicioIso: string, fimIso: string): Promise<Resultado<{
  id: string; patrulha: string; severidade: string; titulo: string; status: string; detectado_em: string
}[]>> {
  if (!sqlJob) {
    return sb(await servico.from('cerbero_incidentes').select('id, patrulha, severidade, titulo, status, detectado_em')
      .gte('detectado_em', inicioIso).lte('detectado_em', fimIso))
  }
  return pg((sql) => linhasJson(sql, sql`
    select id, patrulha, severidade, titulo, status, detectado_em from public.cerbero_incidentes
     where detectado_em >= ${inicioIso} and detectado_em <= ${fimIso}`))
}

// ── Firewall de conteúdo (caminho de request, registro técnico) ──────────────
export async function upsertUrlCache(linha: { url_hash: string; veredicto: string; fonte: string; detalhe: Json }): Promise<Resultado<null>> {
  if (!sqlJob) return sb(await servico.from('cerbero_url_cache').upsert(linha, { onConflict: 'url_hash' }))
  return pg(async (sql) => {
    await sql`
      insert into public.cerbero_url_cache (url_hash, veredicto, fonte, detalhe)
      values (${linha.url_hash}, ${linha.veredicto}, ${linha.fonte}, ${json(sql, linha.detalhe)})
      on conflict (url_hash) do update
        set veredicto = excluded.veredicto, fonte = excluded.fonte, detalhe = excluded.detalhe`
    return null
  })
}

// ── Gateway de IA (log técnico, sem conteúdo) ────────────────────────────────
export type LinhaGatewayLog = {
  origem: string
  perfil_id: string | null
  bloqueado: boolean
  substituicoes: Json
  residuos: number
  hash_entrada: string
  provedor: string | null
  modelo: string | null
  latencia_ms: number | null
  erro: string | null
}

export async function inserirGatewayLog(l: LinhaGatewayLog): Promise<Resultado<null>> {
  if (!sqlJob) return sb(await servico.from('ia_gateway_log').insert(l))
  return pg(async (sql) => {
    await sql`
      insert into public.ia_gateway_log
        (origem, perfil_id, bloqueado, substituicoes, residuos, hash_entrada, provedor, modelo, latencia_ms, erro)
      values (${l.origem}, ${l.perfil_id}, ${l.bloqueado}, ${json(sql, l.substituicoes)}, ${l.residuos},
              ${l.hash_entrada}, ${l.provedor}, ${l.modelo}, ${l.latencia_ms}, ${l.erro})`
    return null
  })
}

// ── Unidades / vínculos / perfis ─────────────────────────────────────────────
export async function unidadesAtivas(): Promise<Resultado<{ id: string; nome: string }[]>> {
  if (!sqlJob) return sb(await servico.from('unidades').select('id, nome').eq('ativo', true))
  return pg((sql) => linhasJson(sql, sql`select id, nome from public.unidades where ativo`))
}

/** Gestores e admins ativos da unidade. */
export async function gestoresDaUnidade(unidadeId: string): Promise<Resultado<{ perfil_id: string }[]>> {
  if (!sqlJob) {
    return sb(await servico.from('vinculos').select('perfil_id')
      .eq('unidade_id', unidadeId).eq('ativo', true).in('papel', ['gestor', 'admin']))
  }
  return pg((sql) => linhasJson(sql, sql`
    select perfil_id from public.vinculos
     where unidade_id = ${unidadeId} and ativo and papel::text in ('gestor', 'admin')`))
}

/** Só id + nome (é o que o GRANT de coluna permite a hermes_job). */
export async function nomesDePerfis(ids: string[]): Promise<Resultado<{ id: string; nome_completo: string }[]>> {
  if (ids.length === 0) return { data: [], error: null }
  if (!sqlJob) return sb(await servico.from('perfis').select('id, nome_completo').in('id', ids))
  return pg((sql) => linhasJson(sql, sql`select id, nome_completo from public.perfis where id in ${sql(ids)}`))
}

// ── Escala (Sentinela) ───────────────────────────────────────────────────────
export async function escalaDaUnidade(unidadeId: string, desde: string, ate: string): Promise<Resultado<{
  id: string; perfil_id: string | null; data: string; turno: string
}[]>> {
  if (!sqlJob) {
    return sb(await servico.from('escala_plantao').select('id, perfil_id, data, turno')
      .eq('unidade_id', unidadeId).eq('ativo', true).gte('data', desde).lte('data', ate))
  }
  return pg((sql) => linhasJson(sql, sql`
    select id, perfil_id, data, turno from public.escala_plantao
     where unidade_id = ${unidadeId} and ativo and data >= ${desde} and data <= ${ate}`))
}

export type SolicitacaoEscala = {
  perfil_id: string | null
  tipo: string
  status: string
  destino_perfil_id: string | null
  created_at: string
  escala_plantao: { data: string } | null
}

export async function solicitacoesDaUnidade(unidadeId: string, desdeIso: string): Promise<Resultado<SolicitacaoEscala[]>> {
  if (!sqlJob) {
    return sb(await servico.from('solicitacoes_escala')
      .select('perfil_id, tipo, status, destino_perfil_id, created_at, escala_plantao!solicitacoes_escala_escala_plantao_id_fkey(data)')
      .eq('unidade_id', unidadeId).gte('created_at', desdeIso).order('created_at', { ascending: true }))
  }
  // Mesmo formato do embed do PostgREST: escala_plantao = { data } ou null.
  return pg((sql) => linhasJson(sql, sql`
    select s.perfil_id, s.tipo, s.status, s.destino_perfil_id, s.created_at,
           case when e.id is null then null else json_build_object('data', e.data) end as escala_plantao
      from public.solicitacoes_escala s
      left join public.escala_plantao e on e.id = s.escala_plantao_id
     where s.unidade_id = ${unidadeId} and s.created_at >= ${desdeIso}
     order by s.created_at asc`))
}

export async function trocasDaUnidade(unidadeId: string, desdeIso: string): Promise<Resultado<{
  perfil_a_id: string | null; status: string; created_at: string
}[]>> {
  if (!sqlJob) {
    return sb(await servico.from('trocas_plantao').select('perfil_a_id, status, created_at')
      .eq('unidade_id', unidadeId).gte('created_at', desdeIso))
  }
  return pg((sql) => linhasJson(sql, sql`
    select perfil_a_id, status, created_at from public.trocas_plantao
     where unidade_id = ${unidadeId} and created_at >= ${desdeIso}`))
}

// ── Alertas do Sentinela (chronos_alertas_escala) ────────────────────────────
export async function alertaEscalaAberto(f: { unidade_id: string; medico_id: string; janela: string; metrica: string }): Promise<Resultado<{ id: string } | null>> {
  if (!sqlJob) {
    return sb(await servico.from('chronos_alertas_escala').select('id')
      .eq('unidade_id', f.unidade_id).eq('medico_id', f.medico_id).eq('janela', f.janela).eq('metrica', f.metrica)
      .in('status', ['novo', 'visto']).limit(1).maybeSingle())
  }
  return pg(async (sql) => {
    const linhas = await linhasJson<{ id: string }>(sql, sql`
      select id from public.chronos_alertas_escala
       where unidade_id = ${f.unidade_id} and medico_id = ${f.medico_id}
         and janela = ${f.janela} and metrica = ${f.metrica} and status in ('novo', 'visto')
       limit 1`)
    return linhas[0] ?? null
  })
}

export type AlertaEscalaNovo = {
  unidade_id: string; medico_id: string; janela: string; metrica: string
  valor: number; mediana_unidade: number; limite_outlier: number; detalhe: Json
}

export async function inserirAlertaEscala(a: AlertaEscalaNovo): Promise<Resultado<null>> {
  if (!sqlJob) return sb(await servico.from('chronos_alertas_escala').insert(a))
  return pg(async (sql) => {
    // Número não finito (limite Infinity em amostra pequena) vira NULL — igual
    // ao supabase-js, onde JSON.stringify(Infinity) === 'null'.
    const num = (x: number) => (Number.isFinite(x) ? x : null)
    await sql`
      insert into public.chronos_alertas_escala
        (unidade_id, medico_id, janela, metrica, valor, mediana_unidade, limite_outlier, detalhe)
      values (${a.unidade_id}, ${a.medico_id}, ${a.janela}, ${a.metrica}, ${num(a.valor)},
              ${num(a.mediana_unidade)}, ${num(a.limite_outlier)}, ${json(sql, a.detalhe)})`
    return null
  })
}

export async function alertasNoPeriodo(inicioIso: string, fimIso: string): Promise<Resultado<{
  id: string; unidade_id: string; metrica: string; valor: number; status: string; criado_em: string
}[]>> {
  if (!sqlJob) {
    return sb(await servico.from('chronos_alertas_escala').select('id, unidade_id, metrica, valor, status, criado_em')
      .gte('criado_em', inicioIso).lte('criado_em', fimIso))
  }
  return pg((sql) => linhasJson(sql, sql`
    select id, unidade_id, metrica, valor, status, criado_em from public.chronos_alertas_escala
     where criado_em >= ${inicioIso} and criado_em <= ${fimIso}`))
}

// ── Notificações (Íris) ──────────────────────────────────────────────────────
export type NotificacaoNova = { perfil_id: string; unidade_id: string | null; tipo: string; mensagem: string; data: string }

/**
 * Insere e devolve o id. No Postgres o id é gerado aqui (sem RETURNING), porque
 * hermes_job não tem SELECT em notificacoes_plantonista — e não precisa ter.
 */
export async function inserirNotificacao(n: NotificacaoNova): Promise<Resultado<{ id: string }>> {
  if (!sqlJob) return sb(await servico.from('notificacoes_plantonista').insert(n).select('id').single())
  return pg(async (sql) => {
    const id = randomUUID()
    await sql`
      insert into public.notificacoes_plantonista (id, perfil_id, unidade_id, tipo, mensagem, data)
      values (${id}, ${n.perfil_id}, ${n.unidade_id}, ${n.tipo}, ${n.mensagem}, ${n.data})`
    return { id }
  })
}

// ── Relatório semanal (Gavião) ───────────────────────────────────────────────
export async function inserirRelatorioSemanal(r: { periodo_inicio: string; periodo_fim: string; resumo: Json; detalhes: Json }): Promise<Resultado<{ id: string }>> {
  if (!sqlJob) return sb(await servico.from('gaviao_relatorios_semanais').insert(r).select('id').single())
  return pg(async (sql) => {
    const id = randomUUID()
    await sql`
      insert into public.gaviao_relatorios_semanais (id, periodo_inicio, periodo_fim, resumo, detalhes)
      values (${id}, ${r.periodo_inicio}, ${r.periodo_fim}, ${json(sql, r.resumo)}, ${json(sql, r.detalhes)})`
    return { id }
  })
}

// ── Cérbero / Falcão (leituras de auditoria) ─────────────────────────────────
export type CensoLinha = {
  unidade_id: string; setor_id: string; data: string; turno: string
  internados: number; leitos_total: number; leitos_ocupados: number; leitos_livres: number
}

export async function censosNegativos(desde: string): Promise<Resultado<CensoLinha[]>> {
  if (!sqlJob) {
    return sb(await servico.from('censo_ocupacao')
      .select('unidade_id, setor_id, data, turno, internados, leitos_total, leitos_ocupados, leitos_livres')
      .gte('data', desde).or('internados.lt.0,leitos_total.lt.0,leitos_ocupados.lt.0,leitos_livres.lt.0'))
  }
  return pg((sql) => linhasJson(sql, sql`
    select unidade_id, setor_id, data, turno, internados, leitos_total, leitos_ocupados, leitos_livres
      from public.censo_ocupacao
     where data >= ${desde}
       and (internados < 0 or leitos_total < 0 or leitos_ocupados < 0 or leitos_livres < 0)`))
}

export async function entradasAuditDesde(desdeIso: string, limite: number): Promise<Resultado<{
  id: string; phone: string; tool_result_summary: string | null; created_at: string
}[]>> {
  if (!sqlJob) {
    return sb(await servico.from('hermes_audit_log').select('id, phone, tool_result_summary, created_at')
      .eq('direction', 'in').gte('created_at', desdeIso).order('created_at', { ascending: false }).limit(limite))
  }
  return pg((sql) => linhasJson(sql, sql`
    select id, phone, tool_result_summary, created_at from public.hermes_audit_log
     where direction = 'in' and created_at >= ${desdeIso}
     order by created_at desc limit ${limite}`))
}

export async function observacoesFuturas(agoraIso: string, limite: number): Promise<Resultado<{ id: string; unidade_id: string; aferido_em: string }[]>> {
  if (!sqlJob) {
    return sb(await servico.from('observacao').select('id, unidade_id, aferido_em').gt('aferido_em', agoraIso).limit(limite))
  }
  return pg((sql) => linhasJson(sql, sql`
    select id, unidade_id, aferido_em from public.observacao where aferido_em > ${agoraIso} limit ${limite}`))
}

export async function prescricoesFuturas(agoraIso: string, limite: number): Promise<Resultado<{ id: string; unidade_id: string; created_at: string }[]>> {
  if (!sqlJob) {
    return sb(await servico.from('prescricoes').select('id, unidade_id, created_at').gt('created_at', agoraIso).limit(limite))
  }
  return pg((sql) => linhasJson(sql, sql`
    select id, unidade_id, created_at from public.prescricoes where created_at > ${agoraIso} limit ${limite}`))
}

export async function prescricoesOrfas(limite: number): Promise<Resultado<{ id: string; unidade_id: string }[]>> {
  if (!sqlJob) {
    return sb(await servico.from('prescricoes').select('id, unidade_id').is('paciente_id', null).limit(limite))
  }
  return pg((sql) => linhasJson(sql, sql`
    select id, unidade_id from public.prescricoes where paciente_id is null limit ${limite}`))
}
