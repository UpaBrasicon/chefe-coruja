// ─────────────────────────────────────────────────────────────────────────────
// Testes da guarda de papel da Skill API (correção C1 da auditoria 22/08).
//
// O que estes testes protegem: antes, "exclusivo super_admin" e "só a sua
// unidade" eram frases num arquivo markdown lido pelo LLM. Agora são estas
// funções. Se alguém afrouxar uma delas, o teste quebra.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { autorizado, resolverUnidade } from './skill-api.js'
import type { IdentidadeHermes, PapelHermes } from '../agent/identidade.js'

const UNIDADE_A = '11111111-1111-4111-8111-111111111111'
const UNIDADE_B = '22222222-2222-4222-8222-222222222222'

function identidade(over: Partial<IdentidadeHermes> = {}): IdentidadeHermes {
  const papel = (over.papel ?? 'plantonista') as PapelHermes | null
  return {
    perfilId: 'perfil-1',
    nome: 'Fulano',
    email: null,
    papel,
    unidadeId: UNIDADE_A,
    unidadeNome: 'UPA Centro',
    organizacaoId: 'org-1',
    vinculos: papel ? [{ papel, unidadeId: UNIDADE_A, unidadeNome: 'UPA Centro', organizacaoId: 'org-1' }] : [],
    superAdmin: false,
    ...over,
  }
}

// ── Segurança e infra: só super_admin ────────────────────────────────────────

test('seguranca/infra: plantonista, gestor e admin são negados', () => {
  for (const papel of ['plantonista', 'gestor', 'admin'] as PapelHermes[]) {
    assert.equal(autorizado('seguranca', identidade({ papel })), false, `${papel} não pode ver segurança`)
    assert.equal(autorizado('infra', identidade({ papel })), false, `${papel} não pode ver infra`)
  }
})

test('seguranca/infra: super_admin é autorizado', () => {
  const su = identidade({ papel: 'gestor', superAdmin: true })
  assert.equal(autorizado('seguranca', su), true)
  assert.equal(autorizado('infra', su), true)
})

test('super_admin ausente na identidade falha FECHADO', () => {
  // Identidade montada sem o campo (código legado / objeto parcial).
  const semCampo = { ...identidade({ papel: 'admin' }) } as Partial<IdentidadeHermes>
  delete semCampo.superAdmin
  assert.equal(autorizado('seguranca', semCampo as IdentidadeHermes), false)
})

// ── Sentinela: gestor/admin ──────────────────────────────────────────────────

test('sentinela: plantonista é negado, gestor e admin passam', () => {
  assert.equal(autorizado('sentinela', identidade({ papel: 'plantonista' })), false)
  assert.equal(autorizado('sentinela', identidade({ papel: 'gestor' })), true)
  assert.equal(autorizado('sentinela', identidade({ papel: 'admin' })), true)
})

// ── Escopos operacionais: exigem vínculo ─────────────────────────────────────

test('operacional: usuário sem papel e sem vínculo é negado', () => {
  const semPapel = identidade({ papel: null, unidadeId: null, vinculos: [] })
  for (const escopo of ['aguia', 'garca', 'operacional', 'escala'] as const) {
    assert.equal(autorizado(escopo, semPapel), false, `${escopo} exige vínculo`)
  }
})

test('operacional: plantonista com vínculo passa', () => {
  assert.equal(autorizado('aguia', identidade({ papel: 'plantonista' })), true)
  assert.equal(autorizado('escala', identidade({ papel: 'plantonista' })), true)
})

// ── Unidade: anti cross-tenant ───────────────────────────────────────────────

test('sem unidade pedida, usa a do vínculo principal', () => {
  const r = resolverUnidade(identidade({ papel: 'gestor' }), undefined)
  assert.deepEqual(r, { ok: true, unidadeId: UNIDADE_A })
})

test('pedir unidade NÃO vinculada é bloqueado', () => {
  const r = resolverUnidade(identidade({ papel: 'gestor' }), UNIDADE_B)
  assert.deepEqual(r, { ok: false })
})

test('pedir unidade vinculada (multi-vínculo) é permitido', () => {
  const multi = identidade({
    papel: 'gestor',
    vinculos: [
      { papel: 'gestor', unidadeId: UNIDADE_A, unidadeNome: 'A', organizacaoId: 'org-1' },
      { papel: 'plantonista', unidadeId: UNIDADE_B, unidadeNome: 'B', organizacaoId: 'org-1' },
    ],
  })
  assert.deepEqual(resolverUnidade(multi, UNIDADE_B), { ok: true, unidadeId: UNIDADE_B })
})

test('super_admin pode consultar qualquer unidade', () => {
  const su = identidade({ papel: 'gestor', superAdmin: true })
  assert.deepEqual(resolverUnidade(su, UNIDADE_B), { ok: true, unidadeId: UNIDADE_B })
})
