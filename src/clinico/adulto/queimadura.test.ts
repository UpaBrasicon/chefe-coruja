// node --experimental-strip-types --test src/clinico/adulto/queimadura.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { reposicaoQueimado } from './queimadura.ts'

test('queimadura: 70 kg e 30% = 4.200 mL a 2 mL/kg/%SCQ e 8.400 mL no Parkland (ABA 2024)', () => {
  const r = reposicaoQueimado(70, 30)!
  assert.equal(r.volume24hMl, 4200)
  assert.equal(r.parkland24hMl, 8400)
  assert.equal(r.aplica, true)
})
test('queimadura: abaixo de 20% de SCQ a diretriz não se aplica', () => {
  assert.equal(reposicaoQueimado(70, 19)!.aplica, false)
  assert.equal(reposicaoQueimado(70, 20)!.aplica, true)
})
test('queimadura: limite de vigilância é o menor entre Ivy (250 mL/kg) e 6 mL/kg/%SCQ', () => {
  const pequena = reposicaoQueimado(70, 30)!
  assert.equal(pequena.limiteVigilanciaMl, 12600)
  assert.equal(pequena.limiteVigilancia, '6 mL/kg/%SCQ')
  const grande = reposicaoQueimado(70, 60)!
  assert.equal(grande.limiteVigilanciaMl, 17500)
  assert.equal(grande.limiteVigilancia, 'Ivy (250 mL/kg)')
})
test('queimadura: entradas inválidas não calculam', () => {
  assert.equal(reposicaoQueimado(0, 30), null)
  assert.equal(reposicaoQueimado(70, 0), null)
  assert.equal(reposicaoQueimado(70, 120), null)
})
