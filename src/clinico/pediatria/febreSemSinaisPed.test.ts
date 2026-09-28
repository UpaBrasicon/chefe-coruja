// node --experimental-strip-types --test src/clinico/pediatria/febreSemSinaisPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import { DOSES_FSSL, coletaUrina, faixaFssl, fichaFebreSemSinais, leucogramaAlterado, pcrAlterada } from './febreSemSinaisPed.ts'

const d = (id: string) => DOSES_FSSL.find((x) => x.id === id)!

test('faixas dos fluxogramas (Figuras 1–3)', () => {
  assert.equal(temReferenciaPediatrica(fichaFebreSemSinais), true)
  assert.equal(faixaFssl(21, 0), '0-21d')
  assert.equal(faixaFssl(22, 0), '22-60d')
  assert.equal(faixaFssl(61, 0), '61-90d')
  assert.equal(faixaFssl(90, 0), '61-90d')
  assert.equal(faixaFssl(0, 3), '3-24m')
  assert.equal(faixaFssl(0, 24), '3-24m')
  assert.equal(faixaFssl(0, 25), 'fora')
  assert.equal(faixaFssl(0, 0), null)
})

test('leucograma e PCR (p. 463–467)', () => {
  assert.equal(leucogramaAlterado({ leucocitos: 0, neutrofilos: 0, bastoesSobreNeutrofilos: 0 }, false), null)
  assert.equal(leucogramaAlterado({ leucocitos: 15_000, neutrofilos: 0, bastoesSobreNeutrofilos: 0 }, false)!.alterado, true)
  assert.equal(leucogramaAlterado({ leucocitos: 12_000, neutrofilos: 5_000, bastoesSobreNeutrofilos: 0.1 }, false)!.alterado, false)
  assert.equal(leucogramaAlterado({ leucocitos: 12_000, neutrofilos: 5_000, bastoesSobreNeutrofilos: 0.1 }, true)!.alterado, true)
  assert.equal(pcrAlterada(20), false)
  assert.equal(pcrAlterada(21), true)
})

test('coleta de urina (p. 462)', () => {
  assert.equal(coletaUrina('menina', new Set(['t39', 'branca']), 10, false), 'coletar')
  assert.equal(coletaUrina('menina', new Set(['t39']), 10, false), 'nao-indicada')
  assert.equal(coletaUrina('menino', new Set(['t39']), 4, true), 'coletar')
  assert.equal(coletaUrina('menino', new Set(['t39']), 6, true), 'indefinido')
  assert.equal(coletaUrina('menino', new Set(['t39', 'semFoco']), 12, true), 'nao-indicada')
  assert.equal(coletaUrina('menino', new Set(['t39', 'semFoco']), 12, false), 'coletar')
})

test('doses (cap. 45 e Apêndice)', () => {
  assert.deepEqual(calcularDoseLivro(d('amoxicilina'), 10)!.dia, [500, 900])
  assert.deepEqual(calcularDoseLivro(d('cefuroxima-vo'), 40)!.porDose, [400, 500])
  assert.deepEqual(calcularDoseLivro(d('amoxclav-7'), 50)!.dia, [1250, 1750])
  assert.equal(d('ceftriaxona').neonatal, undefined)
})
