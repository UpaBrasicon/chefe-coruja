// node --experimental-strip-types --test src/lib/offline/sessaoLocal.test.ts
//
// Recarga sem conexão, parte 2 (A em N1 a N5, RT em 05/11/2026): o que a casca
// precisa para abrir sem rede fica cifrado com a chave da sessão, só nesta aba.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const sessao = new Map<string, string>()
Object.assign(globalThis, {
  sessionStorage: {
    getItem: (k: string) => sessao.get(k) ?? null,
    setItem: (k: string, v: string) => { sessao.set(k, v) },
    removeItem: (k: string) => { sessao.delete(k) },
  },
})

const { definirChave } = await import('../cofreLocal.ts')
const { apagarSessaoLocal, CHAVE_SESSAO_LOCAL, guardarSessaoLocal, lerSessaoLocal, perfilReduzido } = await import('./sessaoLocal.ts')

const chaveB64 = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')
const perfil = {
  id: 'p1', nome_completo: 'Enfermeira Teste', email: 'e@x', crm: null, uf_crm: null, conselho: 'COREN', registro_numero: '123',
  registro_uf: 'GO', cbo: '223505', foto_url: null, tema: 'escuro', ativo: true,
  cpf: '00000000000', cns: '700000000000000', telefone: '62999999999', dados_pessoais: { mae: 'x' }, data_nascimento: '1990-01-01',
  tipo_sanguineo: 'O+', created_at: '2026-01-01', updated_at: '2026-01-01',
}
const vinculos = [{ id: 'v1', papel: 'enfermagem', unidade_id: 'u1', unidade: { id: 'u1', nome: 'UPA Teste', tipo: 'upa', organizacao_id: 'o1' } }]

test('o perfil guardado leva só o que a casca usa: nada de CPF, CNS, telefone ou dados pessoais', () => {
  const r = perfilReduzido(perfil)
  for (const campo of ['cpf', 'cns', 'telefone', 'dados_pessoais', 'data_nascimento', 'tipo_sanguineo']) {
    assert.ok(!(campo in r) || r[campo as keyof typeof r] === null || JSON.stringify(r[campo as keyof typeof r]) === '{}', campo)
  }
  assert.equal(r.nome_completo, 'Enfermeira Teste')
  assert.equal(r.registro_numero, '123')
})

test('N2: cifrado com a chave da sessão, no armazenamento da aba; sem chave, não grava', () => {
  definirChave(null)
  guardarSessaoLocal({ perfil, vinculos, isSuper: false })
  assert.equal(sessao.has(CHAVE_SESSAO_LOCAL), false)

  definirChave(chaveB64())
  guardarSessaoLocal({ perfil, vinculos, isSuper: false })
  const bruto = sessao.get(CHAVE_SESSAO_LOCAL)!
  assert.ok(bruto.startsWith('ccr1:'))
  assert.ok(!bruto.includes('Enfermeira') && !bruto.includes('UPA Teste'))
  const lido = lerSessaoLocal()!
  assert.equal(lido.perfil.id, 'p1')
  assert.deepEqual(lido.vinculos, vinculos)
  assert.equal(lido.isSuper, false)
})

test('guardar em partes não perde o que já estava', () => {
  definirChave(chaveB64())
  apagarSessaoLocal()
  guardarSessaoLocal({ perfil })
  guardarSessaoLocal({ vinculos, isSuper: true })
  const lido = lerSessaoLocal()!
  assert.equal(lido.perfil.id, 'p1')
  assert.equal(lido.vinculos.length, 1)
  assert.equal(lido.isSuper, true)
})

test('outra pessoa no mesmo aparelho não lê: perfil diferente do token não vale', () => {
  definirChave(chaveB64())
  guardarSessaoLocal({ perfil, vinculos, isSuper: false })
  assert.equal(lerSessaoLocal('outra-pessoa'), null)
  assert.equal(lerSessaoLocal('p1')?.perfil.id, 'p1')
})

test('sair apaga; chave de outra sessão não decifra', () => {
  definirChave(chaveB64())
  guardarSessaoLocal({ perfil, vinculos, isSuper: false })
  definirChave(chaveB64())
  assert.equal(lerSessaoLocal(), null)
  apagarSessaoLocal()
  assert.equal(sessao.has(CHAVE_SESSAO_LOCAL), false)
})

test('a casca usa o cache só sem rede e dentro da regra de 2 h e 20 min (N3)', () => {
  const auth = readFileSync('src/contexts/AuthContext.tsx', 'utf8')
  assert.match(auth, /perfilSemConexao(<.*?>)?\(/)
  assert.match(auth, /situacaoSemConexao\(\)\.pode/)
  assert.match(auth, /apagarSessaoLocal\(\)/)
  const unidade = readFileSync('src/contexts/UnidadeContext.tsx', 'utf8')
  assert.match(unidade, /lerSessaoLocal(<.*?>)?\(/)
  assert.match(unidade, /guardarSessaoLocal(<.*?>)?\(/)
})
