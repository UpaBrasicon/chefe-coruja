// node --experimental-strip-types --test src/clinico/pediatria/pneumoniaPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import { DOMICILIAR, HOSPITALAR, faixaPac, fichaPneumoniaPed, lerLiquidoPleural } from './pneumoniaPed.ts'

test('faixa etária das Tabelas 3 e 4', () => {
  assert.equal(temReferenciaPediatrica(fichaPneumoniaPed), true)
  assert.equal(faixaPac(1), 'menor2m')
  assert.equal(faixaPac(2), '2m5a')
  assert.equal(faixaPac(60), '2m5a')
  assert.equal(faixaPac(61), 'maior5a')
  assert.equal(faixaPac(-1), null)
})

test('Tabela 3 (p. 312): amoxicilina 50 mg/kg/dia 12/12 h', () => {
  assert.deepEqual(calcularDoseLivro(DOMICILIAR['2m5a'].inicial[0], 14)!.porDose, [350, 350])
  assert.equal(DOMICILIAR.maior5a.inicial.length, 3)
})

test('Tabela 4 (p. 313): < 2 meses calcula no RN, menos a ceftriaxona', () => {
  const t = HOSPITALAR.menor2m
  assert.ok(t.inicial.every((x) => x.neonatal))
  const ceftri = t.falha.find((x) => x.id === 'ceftri')!
  assert.equal(ceftri.neonatal, undefined)
  assert.deepEqual(calcularDoseLivro(t.inicial[0], 4)!.porDose, [200, 200])
  const pen = HOSPITALAR['2m5a'].inicial[0]
  assert.deepEqual(calcularDoseLivro(pen, 15)!.porDose, [250_000, 250_000])
  assert.deepEqual(calcularDoseLivro(pen, 300)!.dia, [24_000_000, 24_000_000])
})

test('líquido pleural (p. 314)', () => {
  assert.equal(lerLiquidoPleural(7.3, 80, 500), 'benigno')
  assert.equal(lerLiquidoPleural(7.0, 30, 1500), 'infectado')
  assert.equal(lerLiquidoPleural(7.1, 30, 1500), 'intermediario')
  assert.equal(lerLiquidoPleural(NaN, 30, 1500), null)
})
