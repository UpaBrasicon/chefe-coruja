// ─────────────────────────────────────────────────────────────────────────────
// HERMES — lib/pg.ts
// Caminho B do cutover V1 (docs/seguranca/cutover-hermes-v1.md, DESFECHO de
// 02/10/2026): Postgres direto (pooler Supavisor) com papéis LOGIN de menor
// privilégio — hermes_app_user (herda hermes_user) e hermes_app_job (herda
// hermes_job). Sem PostgREST, sem JWT, sem service_role.
//
// O shim `.rpc(nome, params)` devolve o MESMO formato do supabase-js
// ({ data, error }) para os call sites não mudarem:
//   • só chama função da lista permitida (allowlist por caminho);
//   • nome e argumentos validados como identificador; os tipos vêm do catálogo
//     (pg_proc), nunca do chamador;
//   • argumentos nomeados e parametrizados, como o PostgREST faz:
//       select ... from jsonb_to_record($1::jsonb) as _a(p_x uuid, ...),
//                       public.fn(p_x => _a.p_x, ...)
//     — o valor do usuário só entra como o JSON do $1, nunca no texto do SQL;
//   • saída em JSON gerado pelo próprio Postgres (json_agg / to_json), igual ao
//     PostgREST: setof → array, escalar → valor, jsonb → objeto, void → null,
//     timestamps como string ISO, bigint/numeric como número.
// ─────────────────────────────────────────────────────────────────────────────
import postgres from 'postgres'

export type Sql = postgres.Sql

/** Erro no formato do PostgREST (o que os call sites já leem). */
export type RpcErro = { message: string; code: string; details: string | null; hint: string | null }

/** Resposta no formato do supabase-js. `data` é `any` como no cliente sem tipos. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RpcResposta = { data: any; error: RpcErro | null }

/** O único método que o caminho de request enxerga. Não há `.from()` aqui. */
export interface ClienteRpc {
  rpc(nome: string, params?: Record<string, unknown>): Promise<RpcResposta>
}

const IDENT = /^[a-z_][a-z0-9_]{0,62}$/
// format_type devolve coisas como `uuid`, `text[]`, `timestamp with time zone`,
// `public.meu_enum`, `character varying(20)`. Qualquer outra coisa é recusada.
const TIPO_SEGURO = /^[a-z0-9_ ."[\](),]+$/i

export function criarSql(url: string, papel: 'user' | 'job'): Sql {
  return postgres(url, {
    max: papel === 'user' ? 5 : 3,
    idle_timeout: 60,
    connect_timeout: 10,
    max_lifetime: 30 * 60,
    // Statements sem nome: funciona no pooler em modo session (5432) e
    // transaction (6543).
    prepare: false,
    connection: { application_name: `hermes-${papel}` },
    onnotice: () => undefined,
  })
}

export function erroPg(err: unknown): RpcErro {
  const e = err as { message?: string; code?: string; detail?: string; hint?: string }
  return {
    message: e?.message ?? String(err),
    code: typeof e?.code === 'string' ? e.code : '',
    details: e?.detail ?? null,
    hint: e?.hint ?? null,
  }
}

function erroShim(code: string, message: string): RpcResposta {
  return { data: null, error: { message, code, details: null, hint: null } }
}

export type Assinatura = {
  retset: boolean
  /** typtype do retorno: b=base, c=composto, d=domínio, e=enum, p=pseudo (void/record) */
  tipoKind: string
  tipoNome: string
  entradas: { nome: string; tipo: string }[]
  obrigatorias: number
  /** Tem parâmetros OUT/TABLE: a linha vira objeto mesmo com uma coluna só. */
  temSaidas: boolean
}

type LinhaCatalogo = {
  retset: boolean
  tipo_kind: string
  tipo_nome: string
  nargdefaults: number
  nomes: string[]
  modos: string[]
  tipos: string[]
}

async function lerAssinaturas(sql: Sql, nome: string): Promise<Assinatura[]> {
  const linhas = await sql<LinhaCatalogo[]>`
    select p.proretset as retset,
           t.typtype::text as tipo_kind,
           t.typname::text as tipo_nome,
           p.pronargdefaults::int as nargdefaults,
           coalesce(p.proargnames, '{}'::text[]) as nomes,
           coalesce(p.proargmodes::text[], '{}'::text[]) as modos,
           array(select pg_catalog.format_type(x.oid, null)
                   from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality as x(oid, ord)
                  order by x.ord) as tipos
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      join pg_catalog.pg_type t on t.oid = p.prorettype
     where n.nspname = 'public' and p.proname = ${nome}`
  return linhas.map((l) => {
    const entradas: { nome: string; tipo: string }[] = []
    l.tipos.forEach((tipo, i) => {
      const modo = l.modos.length === 0 ? 'i' : l.modos[i]
      if (modo === 'i' || modo === 'b' || modo === 'v') entradas.push({ nome: l.nomes[i] ?? '', tipo })
    })
    return {
      retset: l.retset,
      tipoKind: l.tipo_kind,
      tipoNome: l.tipo_nome,
      entradas,
      obrigatorias: entradas.length - l.nargdefaults,
      temSaidas: l.modos.some((m) => m === 'o' || m === 't' || m === 'b'),
    }
  })
}

/** Monta o SQL da chamada. Exportado só para teste (sem banco). */
export function montarChamada(nome: string, a: Assinatura, chaves: string[]): string {
  const usadas = a.entradas.filter((e) => chaves.includes(e.nome))
  for (const e of usadas) {
    if (!IDENT.test(e.nome) || !TIPO_SEGURO.test(e.tipo)) throw new Error(`assinatura inesperada em ${nome}`)
  }
  const args = usadas.map((e) => `"${e.nome}" => _a."${e.nome}"`).join(', ')
  const chamada = `public."${nome}"(${args})`
  const origem = usadas.length > 0
    ? `pg_catalog.jsonb_to_record($1::jsonb) as _a(${usadas.map((e) => `"${e.nome}" ${e.tipo}`).join(', ')})`
    : null

  const de = `${origem ? `${origem}, ` : ''}${chamada} as _f`
  // Linha como objeto (RETURNS TABLE, OUT, composto): subconsulta só com as
  // colunas da função — `_f.*` — para o nome da coluna virar a chave do JSON,
  // como no PostgREST (inclusive RETURNS TABLE de uma coluna só).
  const objeto = a.temSaidas || a.tipoKind === 'c' || (a.tipoKind === 'p' && a.tipoNome === 'record')

  if (a.retset && objeto) {
    return `select coalesce(pg_catalog.json_agg(_r), '[]'::json) as r from (select _f.* from ${de}) as _r`
  }
  if (a.retset) {
    return `select coalesce(pg_catalog.json_agg(_f), '[]'::json) as r from ${de}`
  }
  if (a.tipoKind === 'p' && a.tipoNome === 'void') {
    return `select ${chamada} is null as r${origem ? ` from ${origem}` : ''}`
  }
  if (objeto) {
    return `select pg_catalog.to_json(_r) as r from (select _f.* from ${de}) as _r`
  }
  return `select pg_catalog.to_json(${chamada}) as r${origem ? ` from ${origem}` : ''}`
}

/**
 * Cria o cliente `.rpc()` sobre uma conexão postgres.js, restrito à allowlist.
 * Nunca lança: erro volta em `error`, como no supabase-js.
 */
export function criarRpcPg(sql: Sql, permitidas: ReadonlySet<string>): ClienteRpc {
  const cache = new Map<string, Assinatura[]>()

  return {
    async rpc(nome, params = {}) {
      if (typeof nome !== 'string' || !IDENT.test(nome) || !permitidas.has(nome)) {
        return erroShim('HRM01', `Função não permitida neste caminho: ${String(nome).slice(0, 64)}`)
      }
      if (params === null || typeof params !== 'object' || Array.isArray(params)) {
        return erroShim('HRM02', 'Parâmetros devem ser um objeto')
      }
      const chaves = Object.keys(params).filter((k) => params[k] !== undefined)
      const invalida = chaves.find((k) => !IDENT.test(k))
      if (invalida) return erroShim('HRM02', `Nome de parâmetro inválido: ${invalida.slice(0, 64)}`)

      try {
        let assinaturas = cache.get(nome)
        if (!assinaturas) {
          assinaturas = await lerAssinaturas(sql, nome)
          cache.set(nome, assinaturas)
        }
        const candidatas = assinaturas.filter((a) => {
          const nomes = a.entradas.map((e) => e.nome)
          const obrigatorias = nomes.slice(0, a.obrigatorias)
          return chaves.every((k) => nomes.includes(k)) && obrigatorias.every((k) => chaves.includes(k))
        })
        if (candidatas.length !== 1) {
          const codigo = candidatas.length === 0 ? 'PGRST202' : 'PGRST203'
          return erroShim(codigo, `Não achei uma única função public.${nome}(${chaves.join(', ')})`)
        }
        const a = candidatas[0]!
        const texto = montarChamada(nome, a, chaves)
        const valores: Record<string, unknown> = {}
        for (const k of chaves) valores[k] = params[k]
        // O JSON vai como parâmetro tipado (jsonb): o postgres.js serializa.
        const linhas = chaves.length > 0
          ? await sql.unsafe(texto, [sql.json(valores as postgres.JSONValue)])
          : await sql.unsafe(texto)
        if (a.tipoKind === 'p' && a.tipoNome === 'void') return { data: null, error: null }
        return { data: linhas[0]?.r ?? null, error: null }
      } catch (err) {
        return { data: null, error: erroPg(err) }
      }
    },
  }
}

/**
 * Executa uma consulta do job e devolve as linhas como o PostgREST devolveria
 * (JSON gerado no banco: datas como string ISO, números como número).
 */
export async function linhasJson<T>(sql: Sql, consulta: postgres.PendingQuery<postgres.Row[]>): Promise<T[]> {
  const [r] = await sql<{ r: T[] }[]>`select coalesce(pg_catalog.json_agg(_t), '[]'::json) as r from (${consulta}) as _t`
  return r?.r ?? []
}
