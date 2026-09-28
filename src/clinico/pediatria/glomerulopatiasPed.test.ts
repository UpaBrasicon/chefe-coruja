// node --experimental-strip-types --test src/clinico/pediatria/glomerulopatiasPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import {
  DOSES_NEFRITICA, albumina20, chShu, fichaGlomerulopatiasPed, hipotensaoPostural, lerPrCr, plasmafereseShuMl, proteinuriaNefrotica, restricaoHidricaGnpe, shuIndicaCH,
} from './glomerulopatiasPed.ts'

test('Tabela 1 da síndrome nefrótica (p. 620)', () => {
  assert.equal(temReferenciaPediatrica(fichaGlomerulopatiasPed), true)
  assert.equal(lerPrCr(2), 'nefrotico')
  assert.equal(lerPrCr(0.2), 'remissao-completa')
  assert.equal(lerPrCr(1, 3), 'remissao-parcial')
  assert.equal(lerPrCr(1, 2.5), 'intermediario')
  const p = proteinuriaNefrotica(1200, 20, 0.8)!
  assert.equal(p.porKg, 60)
  assert.equal(p.nefroticaKg, true)
  assert.equal(p.nefroticaM2, true)
})

test('hipotensão postural e albumina 20% (p. 624–626)', () => {
  assert.equal(hipotensaoPostural(100, 60, 80, 60), true)
  assert.equal(hipotensaoPostural(100, 60, 90, 55), false)
  assert.deepEqual(albumina20(10), { gramas: [5, 10], mL: [25, 50] })
})

test('GNPE e GNRP (p. 608–611)', () => {
  assert.deepEqual(restricaoHidricaGnpe(0.5), [200, 200])
  const mp = calcularDoseLivro(DOSES_NEFRITICA.find((d) => d.id === 'mp-pulso')!, 40)!
  assert.deepEqual(mp.porDose, [1000, 1000])
  assert.deepEqual(calcularDoseLivro(DOSES_NEFRITICA.find((d) => d.id === 'prednisona')!, 40)!.dia, [60, 60])
})

test('SHU: CH com Hb < 6 ou Ht < 18; 10 mL/kg em 3–4 h; plasmaférese (p. 634–636)', () => {
  assert.equal(shuIndicaCH(0, 0), null)
  assert.equal(shuIndicaCH(6, 0), false)
  assert.equal(shuIndicaCH(5.9, 0), true)
  assert.equal(shuIndicaCH(0, 17), true)
  assert.deepEqual(chShu(12), { mL: 120, mlH: [30, 40] })
  assert.deepEqual(plasmafereseShuMl(10), [400, 600])
})
