// node --experimental-strip-types --test src/clinico/adulto/meningite.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { TABELA2_MENINGITE, dosesPorPeso, riscoListeria, suspeitaMeningite } from './meningite.ts'

test('meningite: suspeita com 2 dos 4 sinais clássicos (p. 589)', () => {
  assert.equal(suspeitaMeningite(1), false)
  assert.equal(suspeitaMeningite(2), true)
})
test('meningite: dexametasona 0,15 mg/kg/dose e aciclovir 10 mg/kg/dose (Tabela 2, p. 591)', () => {
  assert.deepEqual(dosesPorPeso(70), { dexametasonaMg: 0.15 * 70, aciclovirMg: 700 })
  assert.equal(dosesPorPeso(0), null)
})
test('meningite: risco de Listeria — acima de 50 anos, imunossupressão, corticoide, gestação (p. 592–593)', () => {
  assert.deepEqual(riscoListeria({ idadeAnos: 50 }), [])
  assert.deepEqual(riscoListeria({ idadeAnos: 51 }), ['acima de 50 anos'])
  assert.equal(riscoListeria({ imunossuprimido: true, corticoide: true, gestante: true }).length, 3)
})
test('meningite: empírico é ceftriaxona 2 g 12/12 h, e Listeria não recebe corticoide', () => {
  assert.match(TABELA2_MENINGITE[0].antibiotico, /^ceftriaxona 2 g EV 12\/12 h/)
  assert.equal(TABELA2_MENINGITE.find((e) => e.quem.startsWith('Listeria'))!.corticoide, 'não usar')
})
