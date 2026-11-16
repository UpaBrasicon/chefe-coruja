// node --test scripts/ambiente/alvo-seguro.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { conferirAlvoSeguro, ehProducao, FLAG_PRODUCAO, REF_PRODUCAO } from './alvo-seguro.mjs'
import { PROJETOS } from './supabase-alvo.mjs'

const P = REF_PRODUCAO
const H = PROJETOS.homolog

test('reconhece a produção pela URL da API, pelo host direto, pelo pooler e pela API pública', () => {
  assert.equal(ehProducao(`https://${P}.supabase.co`), true)
  assert.equal(ehProducao(`https://${P}.supabase.co/functions/v1/api/v1`), true)
  assert.equal(ehProducao(`postgresql://postgres:x@db.${P}.supabase.co:5432/postgres`), true)
  assert.equal(ehProducao(`postgresql://postgres.${P}:x@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`), true)
  assert.equal(ehProducao('https://api.chefecoruja.com.br/v1'), true)
  assert.equal(ehProducao(`HTTPS://${P.toUpperCase()}.SUPABASE.CO`), true)
})

test('homologação, banco local e endereço vazio não são produção', () => {
  assert.equal(ehProducao(`https://${H}.supabase.co`), false)
  assert.equal(ehProducao('https://api-homolog.chefecoruja.com.br/v1'), false)
  assert.equal(ehProducao('http://127.0.0.1:54321'), false)
  assert.equal(ehProducao('postgresql://postgres:postgres@127.0.0.1:54322/postgres'), false)
  assert.equal(ehProducao(undefined), false)
  assert.equal(ehProducao(''), false)
})

test('produção sem a flag é recusada; com a flag passa e avisa', () => {
  const sem = conferirAlvoSeguro({ enderecos: [`https://${P}.supabase.co`], argv: ['node', 'x.ts'], nome: 'demo' })
  assert.equal(sem.ok, false)
  assert.match(sem.motivo, /PRODUÇÃO/)
  assert.match(sem.motivo, /--confirmo-producao/)
  const com = conferirAlvoSeguro({ enderecos: [`https://${P}.supabase.co`], argv: ['node', 'x.ts', FLAG_PRODUCAO] })
  assert.deepEqual(com, { ok: true, producao: true })
})

test('homologação passa sem flag; basta um dos endereços ser a produção para recusar', () => {
  assert.deepEqual(conferirAlvoSeguro({ enderecos: [`https://${H}.supabase.co`] }), { ok: true, producao: false })
  assert.equal(conferirAlvoSeguro({ enderecos: [`https://${H}.supabase.co`, `db.${P}.supabase.co`] }).ok, false)
})
