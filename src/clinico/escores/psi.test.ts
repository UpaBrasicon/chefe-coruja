// node --experimental-strip-types --test src/clinico/escores/psi.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import { psi } from './psi.ts'

const CRITERIOS = psi.itens.filter((i) => i.id !== 'sexo' && i.id !== 'idade').map((i) => i.id)
/** sexo 0 masculino, 1 feminino; critérios presentes pelo id. */
const r = (idade: number, sexo: number, ...ids: string[]): Respostas => ({ idade, sexo, ...Object.fromEntries(CRITERIOS.map((k) => [k, ids.includes(k) ? 1 : 0])) })

test('psi: homem de 80 anos sem nada = 80, classe III, com alerta de idade', () => {
  const res = psi.calcular(r(80, 0))!
  assert.equal(res.valor, '80')
  assert.equal(res.rotulo, 'PSI · classe III')
  assert.match(res.nota, /0,9%/)
  assert.match(res.alerta!, /IDADE/)
})
test('psi: classe I pelo passo prévio (40 anos, sem comorbidade nem exame, com laboratório)', () => {
  const res = psi.calcular(r(40, 0, 'sodio'))!
  assert.equal(res.valor, 'I')
  assert.equal(res.rotulo, 'PSI · classe I')
  assert.equal(res.estado, 0)
  assert.match(res.alerta!, /PASSO PRÉVIO/)
})
test('psi: mulher subtrai 10; 51 anos com derrame = 51 − 10 + 10 = 51, classe II', () => {
  const res = psi.calcular(r(51, 1, 'derrame'))!
  assert.equal(res.valor, '51')
  assert.equal(res.rotulo, 'PSI · classe II')
})
test('psi: cortes das classes (70→II, 71→III, 90→III, 91→IV, 130→IV, 131→V)', () => {
  const cls = (idade: number, ...ids: string[]) => psi.calcular(r(idade, 0, ...ids))!.rotulo
  assert.equal(cls(70), 'PSI · classe II')
  assert.equal(cls(71), 'PSI · classe III')
  assert.equal(cls(90), 'PSI · classe III')
  assert.equal(cls(91), 'PSI · classe IV')
  assert.equal(cls(100, 'neoplasia'), 'PSI · classe IV')
  assert.equal(cls(101, 'neoplasia'), 'PSI · classe V')
  assert.equal(psi.calcular(r(70, 0))!.estado, 0)
  assert.equal(psi.calcular(r(71, 0))!.estado, 1)
  assert.equal(psi.calcular(r(101, 0, 'neoplasia'))!.estado, 2)
  assert.match(psi.calcular(r(101, 0, 'neoplasia'))!.nota, /27,0%/)
})
test('psi: incompleto ou idade fora da faixa devolve null', () => {
  const x = r(60, 0)
  delete x.derrame
  assert.equal(psi.calcular(x), null)
  assert.equal(psi.calcular(r(600, 0)), null)
})
test('psi: ficha de adulto, sem fonte pediátrica', () => {
  assert.equal(psi.ficha.publico, 'adulto')
  assert.ok(psi.ficha.fontes.every((f) => !f.pediatrica))
  assert.equal(temReferenciaPediatrica(psi.ficha), false)
})
