// Teste de integração do caminho B (Postgres direto) contra o Supabase LOCAL.
// Pula se HERMES_PG_TESTE_ADMIN_URL não estiver setada, e RECUSA host que não
// seja local (127.0.0.1/localhost) — nunca roda contra produção.
//
//   $env:HERMES_PG_TESTE_ADMIN_URL = 'postgres://postgres:postgres@127.0.0.1:54322/postgres'
//   node --env-file=.env --import tsx --test src/lib/pg.integration.test.ts
//
// O teste dá uma senha ALEATÓRIA (gerada aqui, só local) a hermes_app_user e
// hermes_app_job pelo `postgres`, conecta como eles, exercita o shim `.rpc()` e
// as consultas do job (lib/db-job.ts), limpa o que gravou e tira a senha no fim.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import postgres from 'postgres'
import { criarRpcPg, criarSql, type ClienteRpc, type Sql } from './pg.js'

const ADMIN_URL = process.env.HERMES_PG_TESTE_ADMIN_URL ?? ''
const local = (() => {
  try {
    const u = new URL(ADMIN_URL)
    return ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)
  } catch {
    return false
  }
})()
const pular = !ADMIN_URL || !local
if (ADMIN_URL && !local) console.error('[pg-teste] HERMES_PG_TESTE_ADMIN_URL não é local — testes pulados')

const MARCA = `teste-shim-pg-${Date.now()}`
const PLANTONISTA = '10000000-0000-4000-8000-000000000002'
const GESTORA = '10000000-0000-4000-8000-000000000001'
const UNIDADE = '21000000-0000-4000-8000-000000000001'
const OUTRA_UNIDADE = '00000000-0000-0000-0000-000000000101'

let admin: Sql
let sqlUser: Sql
let sqlJob: Sql
let user: ClienteRpc
let job: ClienteRpc
let dbJob: typeof import('./db-job.js')
let supa: typeof import('./supabase.js')

function urlComo(papel: string, senha: string): string {
  const u = new URL(ADMIN_URL)
  u.username = papel
  u.password = senha
  return u.toString()
}

before(async () => {
  if (pular) return
  admin = postgres(ADMIN_URL, { max: 1, onnotice: () => undefined })
  const senhaUser = randomBytes(18).toString('hex')
  const senhaJob = randomBytes(18).toString('hex')
  await admin.unsafe(`alter role hermes_app_user password '${senhaUser}'`)
  await admin.unsafe(`alter role hermes_app_job password '${senhaJob}'`)

  // O módulo real lê as URLs do ambiente na importação: aponta para o local.
  process.env.HERMES_PG_USER_URL = urlComo('hermes_app_user', senhaUser)
  process.env.HERMES_PG_JOB_URL = urlComo('hermes_app_job', senhaJob)
  sqlUser = criarSql(process.env.HERMES_PG_USER_URL, 'user')
  sqlJob = criarSql(process.env.HERMES_PG_JOB_URL, 'job')
  const { RPC_USUARIO, RPC_JOB } = await import('./supabase.js')
  user = criarRpcPg(sqlUser, RPC_USUARIO)
  job = criarRpcPg(sqlJob, RPC_JOB)
  dbJob = await import('./db-job.js')
  supa = await import('./supabase.js')
})

after(async () => {
  if (pular) return
  await supa?.fecharBanco()
  await sqlUser?.end({ timeout: 5 })
  await sqlJob?.end({ timeout: 5 })
  await admin`delete from public.hermes_sessions where phone like ${MARCA + '%'}`
  await admin`delete from public.cerbero_incidentes where titulo like ${MARCA + '%'}`
  await admin`delete from public.cerbero_url_cache where url_hash like ${MARCA + '%'}`
  await admin`delete from public.notificacoes_plantonista where tipo = ${MARCA}`
  await admin`delete from public.ia_gateway_log where origem = ${MARCA}`
  await admin`delete from public.chronos_alertas_escala where detalhe->>'marca' = ${MARCA}`
  await admin`delete from public.gaviao_relatorios_semanais where resumo->>'marca' = ${MARCA}`
  await admin`delete from public.hermes_audit_log where phone like ${MARCA + '%'}`
  // Volta ao estado da migration: sem senha, ninguém entra.
  await admin.unsafe('alter role hermes_app_user password null')
  await admin.unsafe('alter role hermes_app_job password null')
  await admin.end({ timeout: 5 })
})

// ── Shim .rpc() — formatos iguais ao PostgREST ──────────────────────────────
test('setof → array de objetos', { skip: pular }, async () => {
  const r = await user.rpc('hermes_unidade_setores', { p_perfil: PLANTONISTA, p_unidade: UNIDADE })
  assert.equal(r.error, null)
  assert.ok(Array.isArray(r.data) && r.data.length > 0)
  assert.equal(typeof r.data[0].nome, 'string')
})

test('bigint/numeric viram número; RETURNS TABLE vira array', { skip: pular }, async () => {
  const r = await user.rpc('hermes_unidade_profissionais', { p_perfil: PLANTONISTA, p_unidade: UNIDADE })
  assert.equal(r.error, null)
  assert.ok(r.data.length > 0)
  assert.equal(typeof r.data[0].total, 'number')
})

test('void → data null; jsonb → valor; injeção no valor fica literal', { skip: pular }, async () => {
  const fone = `${MARCA}-'); drop table public.perfis; --`
  const msgs = [{ role: 'user', content: 'oi "aspas" \\ barra', ts: '2026-10-02T10:00:00Z' }]
  const s = await user.rpc('hermes_sessao_salvar', { p_perfil: PLANTONISTA, p_phone: fone, p_messages: msgs })
  assert.deepEqual(s, { data: null, error: null })
  const c = await user.rpc('hermes_sessao_carregar', { p_perfil: PLANTONISTA, p_phone: fone })
  assert.equal(c.error, null)
  assert.deepEqual(c.data, msgs)
  const [{ n }] = await admin<{ n: number }[]>`select count(*)::int as n from public.perfis`
  assert.ok(n > 0, 'perfis continua lá')
})

test('jsonb nulo → null; argumento com default omitido', { skip: pular }, async () => {
  const r = await user.rpc('hermes_unidade_resumo', { p_perfil: PLANTONISTA, p_unidade: UNIDADE })
  assert.equal(r.error, null)
  const n = await user.rpc('hermes_minhas_notificacoes', { p_perfil: PLANTONISTA, p_unidade: UNIDADE })
  assert.equal(n.error, null)
  assert.ok(Array.isArray(n.data))
})

test('parâmetro array (text[]) e escalar uuid/null', { skip: pular }, async () => {
  const r = await user.rpc('hermes_alertas_escala', { p_perfil: GESTORA, p_unidade: UNIDADE, p_status: ['novo', 'visto'] })
  assert.equal(r.error, null)
  assert.ok(Array.isArray(r.data))
  const v = await user.rpc('confirmar_vinculo_hermes', { p_canal: 'telegram', p_identificador: MARCA, p_codigo: '000000' })
  assert.equal(v.error, null)
  assert.equal(v.data, null)
})

test('erro do banco vem em error (código 42501), sem lançar', { skip: pular }, async () => {
  const r = await user.rpc('hermes_unidade_censo', { p_perfil: PLANTONISTA, p_unidade: OUTRA_UNIDADE })
  assert.equal(r.data, null)
  assert.equal(r.error?.code, '42501')
  assert.match(r.error?.message ?? '', /Acesso negado/)
  const s = await user.rpc('hermes_integridade_resumo', { p_perfil: PLANTONISTA })
  assert.equal(s.error?.code, '42501')
})

test('allowlist, identificador e argumento desconhecido', { skip: pular }, async () => {
  assert.equal((await user.rpc('hermes_checkin_pendente')).error?.code, 'HRM01')
  assert.equal((await user.rpc('pg_sleep', { seconds: 1 })).error?.code, 'HRM01')
  assert.equal((await user.rpc('hermes_unidade_setores', { 'p_perfil"); --': 'x' })).error?.code, 'HRM02')
  assert.equal((await user.rpc('hermes_unidade_setores', { p_perfil: PLANTONISTA, p_x: 1 })).error?.code, 'PGRST202')
  assert.equal((await user.rpc('hermes_unidade_setores', { p_perfil: PLANTONISTA })).error?.code, 'PGRST202')
})

test('o banco recusa mesmo se o código errar (sem allowlist)', { skip: pular }, async () => {
  const semLista = criarRpcPg(sqlUser, new Set(['hermes_checkin_pendente', 'solicitar_codigo_2fa']))
  assert.equal((await semLista.rpc('hermes_checkin_pendente')).error?.code, '42501')
  assert.equal((await semLista.rpc('solicitar_codigo_2fa', { p_user: PLANTONISTA })).error?.code, '42501')
  await assert.rejects(sqlUser`select id from public.perfis limit 1`, /permission denied/)
})

test('job: RPCs de verificação (setof e escalar nulo)', { skip: pular }, async () => {
  const p = await job.rpc('hermes_checkin_pendente')
  assert.equal(p.error, null)
  assert.ok(Array.isArray(p.data))
  const c = await job.rpc('hermes_cadeia_auditoria')
  assert.equal(c.error, null)
  assert.ok(c.data === null || typeof c.data === 'number')
  assert.equal((await job.rpc('hermes_sessao_carregar', {})).error?.code, 'HRM01')
})

// ── lib/db-job.ts pela conexão real do job ──────────────────────────────────
test('db-job: o módulo está em modo postgres', { skip: pular }, () => {
  assert.deepEqual(supa.modoBanco(), { user: 'postgres', job: 'postgres' })
})

test('db-job: leituras dos crons voltam no formato do PostgREST', { skip: pular }, async () => {
  const u = await dbJob.unidadesAtivas()
  assert.equal(u.error, null)
  assert.ok(u.data!.some((x) => x.id === UNIDADE))
  const g = await dbJob.gestoresDaUnidade(UNIDADE)
  assert.deepEqual(new Set(g.data!.map((x) => x.perfil_id)), new Set([GESTORA, '10000000-0000-4000-8000-000000000003']))
  const n = await dbJob.nomesDePerfis([GESTORA])
  assert.equal(n.data![0]!.id, GESTORA)
  assert.equal(Object.keys(n.data![0]!).sort().join(','), 'id,nome_completo')

  const desde = new Date(Date.now() - 400 * 86_400_000).toISOString()
  for (const r of [
    await dbJob.escalaDaUnidade(UNIDADE, '2020-01-01', '2100-01-01'),
    await dbJob.solicitacoesDaUnidade(UNIDADE, desde),
    await dbJob.trocasDaUnidade(UNIDADE, desde),
    await dbJob.censosNegativos('2020-01-01'),
    await dbJob.entradasAuditDesde(desde, 10),
    await dbJob.observacoesFuturas(new Date().toISOString(), 5),
    await dbJob.prescricoesFuturas(new Date().toISOString(), 5),
    await dbJob.prescricoesOrfas(5),
    await dbJob.incidentesNoPeriodo(desde, new Date().toISOString()),
    await dbJob.alertasNoPeriodo(desde, new Date().toISOString()),
  ]) {
    assert.equal(r.error, null)
    assert.ok(Array.isArray(r.data))
  }
  const esc = await dbJob.escalaDaUnidade(UNIDADE, '2020-01-01', '2100-01-01')
  if (esc.data!.length > 0) assert.match(esc.data![0]!.data, /^\d{4}-\d{2}-\d{2}$/, 'date como YYYY-MM-DD')
  const sol = await dbJob.solicitacoesDaUnidade(UNIDADE, desde)
  for (const s of sol.data!) assert.ok(s.escala_plantao === null || typeof s.escala_plantao.data === 'string')
})

test('db-job: escritas (incidente com dedup, cache, notificação, log, alerta, relatório)', { skip: pular }, async () => {
  const chave = `${MARCA}:chave`
  const inc = { patrulha: 'dados', severidade: 'informativo', titulo: `${MARCA} incidente`, evidencia: { a: 1 }, chave_dedup: chave }
  assert.equal((await dbJob.inserirIncidentes([inc])).error, null)
  assert.equal((await dbJob.inserirIncidentes([inc])).error, null, 'repetido não quebra (índice parcial)')
  const abertas = await dbJob.chavesIncidentesAbertos([chave, `${MARCA}:outra`])
  assert.deepEqual(abertas.data, [{ chave_dedup: chave }])

  for (let i = 0; i < 2; i++) {
    const r = await dbJob.upsertUrlCache({ url_hash: `${MARCA}-url`, veredicto: 'suspeito', fonte: 'heuristica', detalhe: { i } })
    assert.equal(r.error, null)
  }
  const [cache] = await admin<{ detalhe: { i: number } }[]>`select detalhe from public.cerbero_url_cache where url_hash = ${MARCA + '-url'}`
  assert.equal(cache?.detalhe.i, 1, 'upsert atualizou o detalhe')

  const nt = await dbJob.inserirNotificacao({ perfil_id: PLANTONISTA, unidade_id: UNIDADE, tipo: MARCA, mensagem: 'oi', data: '2026-10-02' })
  assert.equal(nt.error, null)
  const [linhaNt] = await admin<{ id: string }[]>`select id from public.notificacoes_plantonista where tipo = ${MARCA}`
  assert.equal(linhaNt?.id, nt.data?.id, 'id devolvido é o gravado')

  const lg = await dbJob.inserirGatewayLog({
    origem: MARCA, perfil_id: null, bloqueado: false, substituicoes: { nome: 1 }, residuos: 0,
    hash_entrada: 'a'.repeat(64), provedor: null, modelo: null, latencia_ms: 12, erro: null,
  })
  assert.equal(lg.error, null)

  const al = await dbJob.inserirAlertaEscala({
    unidade_id: UNIDADE, medico_id: PLANTONISTA, janela: '30d', metrica: 'faltas',
    valor: 3, mediana_unidade: 1, limite_outlier: 2.5, detalhe: { marca: MARCA },
  })
  assert.equal(al.error, null)
  const aberto = await dbJob.alertaEscalaAberto({ unidade_id: UNIDADE, medico_id: PLANTONISTA, janela: '30d', metrica: 'faltas' })
  assert.equal(aberto.error, null)
  assert.equal(typeof aberto.data?.id, 'string')

  const rel = await dbJob.inserirRelatorioSemanal({ periodo_inicio: '2026-09-25', periodo_fim: '2026-10-02', resumo: { marca: MARCA }, detalhes: {} })
  assert.equal(rel.error, null)
  assert.equal(typeof rel.data?.id, 'string')

  // Escrita fora do permitido continua barrada pelo banco.
  await assert.rejects(sqlJob`update public.cerbero_incidentes set status = 'resolvido' where chave_dedup = ${chave}`, /permission denied/)
  await assert.rejects(sqlJob`select email from public.perfis limit 1`, /permission denied/)
})
