// node --experimental-strip-types --test src/clinico/pediatria/hemoterapiaPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  albumina, chAnemiaAgudaMl, chPadraoMl, chPorIncrementoMl, crioUnidades, fatorIXUI, fatorVIIIUI, fichaHemoterapiaPed, gluconatoMacicaMl, minutosA25, pfcMl, plaquetasVolumeMl,
} from './hemoterapiaPed.ts'

test('CH (p. 725, 729) e anemia aguda (cap. 62, p. 659)', () => {
  assert.equal(temReferenciaPediatrica(fichaHemoterapiaPed), true)
  assert.equal(chPadraoMl(15), 150)
  assert.equal(chPorIncrementoMl(15, 2), 90)
  assert.deepEqual(chAnemiaAgudaMl(10), [100, 150])
  assert.equal(minutosA25(150), 60)
  assert.deepEqual(pfcMl(20), [200, 300])
})

test('plaquetas: V = Δ × 1.000 × volemia / (concentração × 0,80) (p. 727)', () => {
  // Δ 50.000/mm³, volemia 1.000 mL, STD 9,1 × 10⁸/mL → 50.000 × 1.000 × 1.000 / (9,1 × 10⁸ × 0,8) ≈ 68,7 mL
  assert.ok(Math.abs(plaquetasVolumeMl(50_000, 1000, 'std')! - 68.68) < 0.01)
  assert.ok(Math.abs(plaquetasVolumeMl(50_000, 1000, 'af')! - 41.67) < 0.01)
  assert.equal(plaquetasVolumeMl(50_000, 0, 'std'), null)
})

test('fatores (p. 728–729), albumina (p. 730) e cálcio na transfusão maciça (p. 725)', () => {
  assert.deepEqual(fatorVIIIUI(20, 50), { dose: 500, repeticao8h: 500 / 3 })
  assert.deepEqual(crioUnidades(480), [4, 6])
  assert.equal(fatorIXUI(20, 50), 1000)
  assert.deepEqual(albumina(10, 1), { g: 8, frascos20: 0.8, mL20: 40, expansaoMl: 144 })
  assert.equal(gluconatoMacicaMl(1500, 1000), 5)
  assert.equal(gluconatoMacicaMl(800, 1000), 0)
})
