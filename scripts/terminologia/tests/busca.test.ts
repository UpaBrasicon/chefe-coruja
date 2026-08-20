// ─────────────────────────────────────────────────────────────────────────────
// Testes de busca da terminologia
//
// Parte 1 (unitário, sempre roda): normalização de acento e montagem do termo
//   tsquery — espelha a lógica SQL de terminologia.buscar (unaccent + prefixo).
// Parte 2 (integração, CONDICIONAL): roda contra um banco real SOMENTE se
//   SUPABASE_TEST_URL + SUPABASE_SERVICE_ROLE_KEY estiverem definidos.
//   Valida os critérios de aceite: "cefaleia" acha "Cefaléia" e código parcial.
//   Roda com: $env:SUPABASE_TEST_URL='...'; node --test scripts/terminologia/tests/
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// ── Espelho TS da normalização SQL (unaccent + regexp_replace) ───────────────
export function normalizarTermo(p_termo: string): string {
  return p_termo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function montarTsquery(termo: string): string {
  const tokens = normalizarTermo(termo).split(' ').filter(Boolean)
  if (tokens.length === 0) return ''
  return tokens.map((t) => `${t}:*`).join(' & ')
}

describe('normalização de acento (espelho do SQL)', () => {
  it('"cefaleia" normaliza igual a "Cefaléia"', () => {
    assert.equal(normalizarTermo('cefaleia'), normalizarTermo('Cefaléia'))
  })

  it('monta tsquery com prefixo por token', () => {
    assert.equal(montarTsquery('pneumo'), 'pneumo:*')
    assert.equal(montarTsquery('Cefaléia'), 'cefaleia:*')
    assert.equal(montarTsquery('dor de cabeça'), 'dor:* & de:* & cabeca:*')
  })

  it('termo vazio ou só pontuação vira vazio', () => {
    assert.equal(montarTsquery(''), '')
    assert.equal(montarTsquery('!!!'), '')
  })

  it('código parcial mantém dígitos', () => {
    assert.equal(normalizarTermo('A00'), 'a00')
    assert.equal(montarTsquery('A00'), 'a00:*')
    assert.equal(normalizarTermo('J06.9'), 'j06 9')
  })
})

// ── Integração condicional (banco real) ───────────────────────────────────────
const URL_TESTE = process.env.SUPABASE_TEST_URL
const KEY_TESTE = process.env.SUPABASE_SERVICE_ROLE_KEY
const temBanco = Boolean(URL_TESTE && KEY_TESTE)

// describe.skip exige o nome como 1º argumento; alterna entre describe e skip
const suiteBanco = temBanco ? describe : describe.skip

suiteBanco('busca no banco (integração — define SUPABASE_TEST_URL)', () => {
  type LinhaBusca = { codigo: string; descricao: string }

  it('"cefaleia" encontra "Cefaléia" (busca sem acento)', async () => {
    const { criarCliente } = await import('../lib/supabase.ts')
    const client = criarCliente()
    const { data, error } = await client.rpc('terminologia_buscar', {
      p_tabela: 'cid10',
      p_termo: 'cefaleia',
      p_limite: 5,
    })
    assert.equal(error, null)
    const linhas = (data ?? []) as LinhaBusca[]
    assert.ok(linhas.some((r) => /cefal/i.test(r.descricao)), 'deveria achar Cefaléia')
  })

  it('busca por código parcial ("A00") retorna ranqueado', async () => {
    const { criarCliente } = await import('../lib/supabase.ts')
    const client = criarCliente()
    const { data, error } = await client.rpc('terminologia_buscar', {
      p_tabela: 'cid10',
      p_termo: 'A00',
      p_limite: 5,
    })
    assert.equal(error, null)
    const linhas = (data ?? []) as LinhaBusca[]
    assert.ok(linhas.length > 0)
    // prefixo de código deve vir primeiro
    assert.ok(linhas.some((r) => r.codigo.startsWith('A00')))
  })

  it('tabela inválida lança erro', async () => {
    const { criarCliente } = await import('../lib/supabase.ts')
    const client = criarCliente()
    const { error } = await client.rpc('terminologia_buscar', {
      p_tabela: 'inexistente',
      p_termo: 'x',
      p_limite: 5,
    })
    assert.ok(error, 'deveria falhar com tabela inválida')
  })
})
