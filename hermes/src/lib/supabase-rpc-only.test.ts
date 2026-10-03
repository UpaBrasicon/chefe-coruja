// ============================================================================
// GUARD (red-team V1 — defesa em profundidade): o caminho de request NÃO pode
// tocar tabela direto, nem alcançar a service_role.
// ----------------------------------------------------------------------------
// Desde o caminho B do cutover (docs/seguranca/cutover-hermes-v1.md, DESFECHO
// de 02/10/2026) o banco já recusa: `hermes_app_user` só tem EXECUTE nas RPCs
// scoped. Esta guarda cobre o código, inclusive enquanto o fallback para a
// service_role existir:
//
//   1. `supabaseUser` / `supabaseJob` (lib/supabase.ts) só podem ser usados
//      como `X.rpc(...)` — sob QUALQUER nome local (alias de import), sem ser
//      passados adiante, atribuídos, re-exportados ou indexados (`X['from']`).
//   2. O cliente service_role (`supabase`) e a conexão crua do job (`sqlJob`)
//      só podem ser importados por lib/db-job.ts.
//   3. Ninguém re-exporta lib/supabase.ts / lib/pg.ts, nem importa esses
//      módulos por `import()` dinâmico ou `require` (a análise depende de
//      imports estáticos); `import * as` de lib/supabase é proibido.
//   4. `createClient` / '@supabase/supabase-js' (valor) só em lib/supabase.ts;
//      o pacote 'postgres' só em lib/pg.ts; SUPABASE_SERVICE_ROLE_KEY e as
//      URLs HERMES_PG_* só em config/env.ts e lib/supabase.ts.
//   5. Os arquivos do caminho de request importam de lib/supabase só o
//      `supabaseUser` (e tipos).
//
// A análise é feita na AST (compilador do TypeScript), não por regex: alias,
// namespace e acesso por colchete não escapam. Os casos de burla conhecidos
// estão testados abaixo contra o próprio analisador.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

// Arquivos do caminho de request (input não-confiável do WhatsApp/skill).
const ARQUIVOS_REQUEST = [
  'agent/identidade.ts',
  'agent/sessao.ts',
  'agent/tools.ts',
  'agent/pipeline.ts',
  'server/skill-api.ts',
]

const MOD_SUPABASE = join(SRC, 'lib', 'supabase')
const MOD_PG = join(SRC, 'lib', 'pg')
const CLIENTES_RPC = new Set(['supabaseUser', 'supabaseJob'])
const SO_DB_JOB = new Set(['supabase', 'sqlJob'])

const rel = (abs: string) => relative(SRC, abs).split(sep).join('/')

function listarTs(dir: string): string[] {
  const out: string[] = []
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome)
    if (statSync(p).isDirectory()) out.push(...listarTs(p))
    else if (nome.endsWith('.ts') && !nome.endsWith('.test.ts')) out.push(p)
  }
  return out
}

/** Resolve o especificador para caminho absoluto sem extensão (relativos) ou o nome do pacote. */
function resolverModulo(arquivoAbs: string, especificador: string): string {
  if (!especificador.startsWith('.')) return especificador
  return resolve(dirname(arquivoAbs), especificador).replace(/\.(js|ts|mjs|cjs)$/, '')
}

/**
 * Analisa um arquivo e devolve as violações. Exportável para o autoteste.
 * `arquivoAbs` decide as exceções (lib/supabase.ts, lib/db-job.ts…).
 */
function analisar(arquivoAbs: string, texto: string): string[] {
  const r = rel(arquivoAbs)
  const v: string[] = []
  const sf = ts.createSourceFile(arquivoAbs, texto, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
  const ehSupabase = r === 'lib/supabase.ts'
  const ehPg = r === 'lib/pg.ts'
  const ehDbJob = r === 'lib/db-job.ts'
  const ehEnv = r === 'config/env.ts'
  const ehRequest = ARQUIVOS_REQUEST.includes(r)

  // binding local → nome exportado original em lib/supabase.ts
  const bindings = new Map<string, string>()
  // nós de identificador que SÃO a própria declaração (não contam como uso)
  const declaracoes = new Set<ts.Node>()

  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier)) {
      const alvo = resolverModulo(arquivoAbs, st.moduleSpecifier.text)
      const soTipo = st.importClause?.isTypeOnly ?? false
      if (alvo === '@supabase/supabase-js' && !soTipo && !ehSupabase) {
        const nomes = st.importClause?.namedBindings
        const temValor = !nomes || !ts.isNamedImports(nomes) || nomes.elements.some((e) => !e.isTypeOnly)
        if (temValor || st.importClause?.name) v.push(`${r}: importa valor de '@supabase/supabase-js' (só lib/supabase.ts)`)
      }
      if (alvo === 'postgres' && !soTipo && !ehPg) v.push(`${r}: importa o pacote 'postgres' (só lib/pg.ts abre conexão)`)
      if (alvo === MOD_PG && !soTipo && ehRequest) v.push(`${r}: caminho de request importa lib/pg`)
      if (alvo === MOD_SUPABASE && st.importClause && !soTipo) {
        const nb = st.importClause.namedBindings
        if (st.importClause.name) v.push(`${r}: import default de lib/supabase`)
        if (nb && ts.isNamespaceImport(nb)) v.push(`${r}: import * as ${nb.name.text} de lib/supabase (proibido)`)
        if (nb && ts.isNamedImports(nb)) {
          for (const el of nb.elements) {
            if (el.isTypeOnly) continue
            const original = (el.propertyName ?? el.name).text
            bindings.set(el.name.text, original)
            declaracoes.add(el.name)
            if (SO_DB_JOB.has(original) && !ehDbJob) v.push(`${r}: importa '${original}' de lib/supabase (só lib/db-job.ts)`)
            if (ehRequest && original !== 'supabaseUser') v.push(`${r}: caminho de request importa '${original}' (só supabaseUser)`)
          }
        }
      }
    }
    if (ts.isExportDeclaration(st)) {
      if (st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
        const alvo = resolverModulo(arquivoAbs, st.moduleSpecifier.text)
        if ((alvo === MOD_SUPABASE || alvo === MOD_PG) && !st.isTypeOnly && !ehSupabase) {
          v.push(`${r}: re-exporta ${rel(alvo)} (proibido)`)
        }
      }
    }
  }

  const visitar = (no: ts.Node): void => {
    // import() dinâmico / require
    if (ts.isCallExpression(no)) {
      const ehImport = no.expression.kind === ts.SyntaxKind.ImportKeyword
      const ehRequire = ts.isIdentifier(no.expression) && no.expression.text === 'require'
      if (ehImport || ehRequire) {
        const arg = no.arguments[0]
        if (!arg || !ts.isStringLiteralLike(arg)) {
          v.push(`${r}: ${ehImport ? 'import()' : 'require'} com especificador não literal`)
        } else {
          const alvo = resolverModulo(arquivoAbs, arg.text)
          if ([MOD_SUPABASE, MOD_PG, '@supabase/supabase-js', 'postgres'].includes(alvo) && !ehSupabase) {
            v.push(`${r}: ${ehImport ? 'import()' : 'require'} de ${arg.text} (proibido — só import estático)`)
          }
        }
      }
    }
    if (ts.isIdentifier(no)) {
      const nome = no.text
      if (nome === 'createClient' && !ehSupabase) v.push(`${r}: usa createClient (só lib/supabase.ts)`)
      if (nome === 'SUPABASE_SERVICE_ROLE_KEY' && !ehSupabase && !ehEnv) v.push(`${r}: referencia SUPABASE_SERVICE_ROLE_KEY`)
      if ((nome === 'HERMES_PG_USER_URL' || nome === 'HERMES_PG_JOB_URL') && !ehSupabase && !ehEnv) {
        v.push(`${r}: referencia ${nome}`)
      }
      const original = bindings.get(nome)
      if (original && CLIENTES_RPC.has(original) && !declaracoes.has(no)) {
        const pai = no.parent
        // export { x } / export default x de um binding importado = lavagem
        const ok =
          ts.isPropertyAccessExpression(pai) && pai.expression === no && pai.name.text === 'rpc'
        if (!ok) {
          const trecho = pai.getText(sf).replace(/\s+/g, ' ').slice(0, 60)
          v.push(`${r}: ${nome} (${original}) usado fora de .rpc(): \`${trecho}\``)
        }
      }
    }
    // Strings com o nome da chave também contam (process.env['SUPABASE_SERVICE_ROLE_KEY']).
    if (ts.isStringLiteralLike(no) && no.text === 'SUPABASE_SERVICE_ROLE_KEY' && !ehSupabase && !ehEnv) {
      v.push(`${r}: referencia 'SUPABASE_SERVICE_ROLE_KEY'`)
    }
    ts.forEachChild(no, visitar)
  }
  visitar(sf)
  return v
}

// ── O repositório real ───────────────────────────────────────────────────────
test('repositório: nenhum acesso cru a tabela/service_role fora do permitido', () => {
  const violacoes: string[] = []
  for (const arquivo of listarTs(SRC)) violacoes.push(...analisar(arquivo, readFileSync(arquivo, 'utf8')))
  assert.deepEqual(violacoes, [], `Violações da guarda do caminho de request:\n${violacoes.join('\n')}`)
})

test('repositório: os arquivos do caminho de request existem (lista não envelheceu)', () => {
  for (const r of ARQUIVOS_REQUEST) assert.ok(statSync(join(SRC, r)).isFile(), r)
})

// ── Autoteste do analisador: as burlas conhecidas são pegas ─────────────────
const FAKE_REQUEST = join(SRC, 'agent', 'tools.ts')
const FAKE_OUTRO = join(SRC, 'jobs', 'fake.ts')

const BURLAS: [string, string, string][] = [
  ['alias de import', FAKE_OUTRO, `import { supabaseUser as db } from '../lib/supabase.js'\nawait db.from('perfis').select('*')`],
  ['atribuição e uso indireto', FAKE_OUTRO, `import { supabaseUser } from '../lib/supabase.js'\nconst x = supabaseUser\nx.rpc('a')`],
  ['acesso por colchete', FAKE_OUTRO, `import { supabaseUser } from '../lib/supabase.js'\nsupabaseUser['from']('perfis')`],
  ['passar como argumento', FAKE_OUTRO, `import { supabaseJob } from '../lib/supabase.js'\nfaz(supabaseJob)`],
  ['re-export com from', FAKE_OUTRO, `export { supabase } from '../lib/supabase.js'`],
  ['re-export * ', FAKE_OUTRO, `export * from '../lib/supabase.js'`],
  ['re-export de binding importado', FAKE_OUTRO, `import { supabaseUser } from '../lib/supabase.js'\nexport { supabaseUser }`],
  ['export default do binding', FAKE_OUTRO, `import { supabaseUser as s } from '../lib/supabase.js'\nexport default s`],
  ['import * as', FAKE_OUTRO, `import * as sb from '../lib/supabase.js'\nsb.supabase.from('perfis')`],
  ['import() dinâmico', FAKE_OUTRO, `const m = await import('../lib/supabase.js')\nm.supabase.from('perfis')`],
  ['import() não literal', FAKE_OUTRO, `const p = '../lib/' + 'supabase.js'\nawait import(p)`],
  ['require', FAKE_OUTRO, `const m = require('../lib/supabase.js')`],
  ['service_role fora do db-job', FAKE_OUTRO, `import { supabase } from '../lib/supabase.js'\nsupabase.from('perfis')`],
  ['createClient com a chave', FAKE_REQUEST, `import { createClient } from '@supabase/supabase-js'\ncreateClient(u, process.env.SUPABASE_SERVICE_ROLE_KEY!)`],
  ['createClient por alias', FAKE_OUTRO, `import { createClient as cc } from '@supabase/supabase-js'\ncc(u, k)`],
  ['chave por string', FAKE_OUTRO, `const k = process.env['SUPABASE_SERVICE_ROLE_KEY']`],
  ['conexão crua postgres', FAKE_REQUEST, `import postgres from 'postgres'\npostgres(process.env.X!)`],
  ['request importa supabaseJob', FAKE_REQUEST, `import { supabaseJob } from '../lib/supabase.js'\nawait supabaseJob.rpc('hermes_checkin_pendente')`],
  ['request importa lib/pg', FAKE_REQUEST, `import { criarSql } from '../lib/pg.js'\ncriarSql(u, 'user')`],
]

for (const [nome, arquivo, codigo] of BURLAS) {
  test(`analisador pega: ${nome}`, () => {
    assert.notDeepEqual(analisar(arquivo, codigo), [], `não pegou: ${nome}`)
  })
}

test('analisador aceita o uso correto (.rpc no caminho de request)', () => {
  const ok = `import { supabaseUser } from '../lib/supabase.js'\nimport type { SupabaseClient } from '@supabase/supabase-js'\nconst { data } = await supabaseUser.rpc('hermes_unidade_setores', { p_perfil: a, p_unidade: b })`
  assert.deepEqual(analisar(FAKE_REQUEST, ok), [])
})

// ── Runtime: o objeto do caminho de request só tem .rpc e respeita a allowlist
test('supabaseUser só expõe .rpc e recusa função fora da allowlist (sem rede)', async () => {
  const { supabaseUser, supabaseJob } = await import('./supabase.js')
  assert.deepEqual(Object.keys(supabaseUser), ['rpc'])
  assert.equal((supabaseUser as unknown as Record<string, unknown>).from, undefined)
  for (const nome of ['solicitar_codigo_2fa', 'hermes_checkin_pendente', 'pacientes', 'x; drop table perfis', 'HERMES_SESSAO_CARREGAR']) {
    const r = await supabaseUser.rpc(nome, {})
    assert.equal(r.error?.code, 'HRM01', `deveria recusar ${nome}`)
  }
  // job não chama RPC do caminho de request
  const r = await supabaseJob.rpc('hermes_sessao_carregar', {})
  assert.equal(r.error?.code, 'HRM01')
})
