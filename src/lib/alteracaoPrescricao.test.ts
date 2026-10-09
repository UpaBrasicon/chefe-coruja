// node --experimental-strip-types --test src/lib/alteracaoPrescricao.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resumoMudanca } from './alteracaoPrescricao.ts'

test('resumo do que mudou', () => {
  const a = { dose: '1 g', via: 'EV', posologia: '12/12h', se_necessario: false }
  assert.equal(resumoMudanca(a, { ...a, dose: '2 g' }), 'dose 1 g → 2 g')
  assert.equal(resumoMudanca(a, { ...a, posologia: '24/24h', se_necessario: true }), 'frequência 12/12h → 24/24h; passou a "se necessário"')
  assert.equal(resumoMudanca(a, a), '')
})
