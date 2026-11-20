// node --experimental-strip-types --test src/clinico/pediatria/ampolas.test.ts
// Dose em mL pela ampola escolhida (lote 0; decisões ML1–ML11 do RT, 19/11/2026).
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { AMPOLAS, ITENS_COM_AMPOLA, ampolasDoItem, problemasDasAmpolas, volumeDaAmpola, type Apresentacao } from './ampolas.ts'
import { BOLUS } from './bolus.ts'
import { DROGAS_RCP } from './rcp.ts'
import { DOSES_SRI } from './viaAerea.ts'

// dados de teste, não são concentrações para a tela
const A3: Apresentacao = { id: 'x-3', rotulo: 'X 3 mg/mL', porMl: 3, fonte: 'teste' }
const SAL: Apresentacao = { id: 'ca-sal', rotulo: 'sal 100 mg/mL', porMl: 100, base: 'sal', fonte: 'teste' }
const DIL: Apresentacao = { id: 'd-50', rotulo: 'D 50 mg/mL', porMl: 50, diluir: true, fonte: 'teste' }

test('sem ampola escolhida não há mL (ML: nenhuma vem marcada)', () => {
  assert.equal(volumeDaAmpola([1, 2], undefined), null)
})

test('volume = dose ÷ concentração da ampola escolhida', () => {
  assert.deepEqual(volumeDaAmpola([1.5, 3], A3), { ml: [0.5, 1], aspirar: false })
})

test('dose e ampola em bases diferentes não dão mL (ML6)', () => {
  assert.equal(volumeDaAmpola([90, 90], SAL, 'elemento'), null)
  assert.deepEqual(volumeDaAmpola([200, 200], SAL, 'sal'), { ml: [2, 2], aspirar: false })
})

test('ampola que pede diluição marca o volume como "a aspirar" (ML5)', () => {
  assert.equal(volumeDaAmpola([100, 100], DIL)?.aspirar, true)
})

test('dose inválida não dá mL', () => {
  assert.equal(volumeDaAmpola([NaN, 1], A3), null)
  assert.equal(volumeDaAmpola([1, 1], { ...A3, porMl: 0 }), null)
})

test('a guarda acusa lista local, insulina do frasco, concentração repetida e base faltando', () => {
  const p = problemasDasAmpolas(
    {
      x: [A3, { ...A3, id: 'x-3b' }],
      insulina: [{ id: 'i', rotulo: 'frasco', porMl: 100, fonte: 'bula' }],
      y: [{ id: 'y', rotulo: 'y', porMl: 6, fonte: 'data/padronizacao.csv' }],
      calcio: [SAL, { id: 'ca-el', rotulo: 'elemento 9 mg/mL', porMl: 9, base: 'elemento', fonte: 'teste' }],
    },
    { 'rcp:calcio': { principio: 'calcio' }, 'rcp:z': { principio: 'z' }, 'Fora:padrao': { principio: 'x' } },
  )
  assert.ok(p.some((x) => /concentração repetida/.test(x)))
  assert.ok(p.some((x) => /insulina do frasco/.test(x)))
  assert.ok(p.some((x) => /lista local/.test(x)))
  assert.ok(p.some((x) => /precisa dizer a base/.test(x)))
  assert.ok(p.some((x) => /princípio z sem ampola/.test(x)))
  assert.ok(p.some((x) => /fora do padrão/.test(x)))
})

test('o cadastro real não tem problema e toda chave aponta para um item existente', () => {
  assert.deepEqual(problemasDasAmpolas(), [])
  const ids: Record<string, Set<string>> = {
    bolus: new Set(BOLUS.map((b) => b.id)), rcp: new Set(DROGAS_RCP.map((d) => d.id)), sri: new Set(DOSES_SRI.map((d) => d.id)),
  }
  for (const chave of Object.keys(ITENS_COM_AMPOLA)) {
    const [lista, id] = chave.split(':')
    assert.ok(ids[lista]?.has(id), `${chave} não existe`)
  }
})

test('lote 0: nenhuma ampola cadastrada ainda (a tela fica como antes)', () => {
  assert.deepEqual(AMPOLAS, {})
  assert.deepEqual(ampolasDoItem('rcp:atropina'), [])
})
