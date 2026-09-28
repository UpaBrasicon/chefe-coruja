import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { DOSES_PROFILAXIA_TEV, MENCOES_PROFILAXIA_TEV, doseDiaria, fichaProfilaxiaTev, protaminaHnfSc, volumeDoseMl } from './profilaxiaTev.ts'

const d = (id: string) => DOSES_PROFILAXIA_TEV.find((x) => x.id === id)!

test('profilaxia TEV: ficha adulto do manual, sem referência pediátrica', () => {
  assert.equal(fichaProfilaxiaTev.id, 'adulto-profilaxia-tev')
  assert.equal(fichaProfilaxiaTev.publico, 'adulto')
  assert.match(fichaProfilaxiaTev.fontes[0].citacao, /Manual de Medicina de Emergência.*p\. 127/)
  assert.equal(temReferenciaPediatrica(fichaProfilaxiaTev), false)
  for (const m of MENCOES_PROFILAXIA_TEV) assert.match(m.pagina, /p\. \d+/, m.contexto)
})

test('profilaxia TEV: enoxaparina 40 mg SC 1x/dia e HNF 5.000 UI SC 3x/dia (cap. 7, p. 127)', () => {
  assert.deepEqual([d('enoxaparina').dose, d('enoxaparina').vezesDia, doseDiaria(d('enoxaparina'))], [40, 1, 40])
  assert.deepEqual([d('hnf').dose, d('hnf').vezesDia, doseDiaria(d('hnf'))], [5000, 3, 15000])
})

test('profilaxia TEV: HNF de profilaxia 1 mL = 5.000 U (cap. 25, p. 352) → 1 mL por dose', () => {
  assert.equal(volumeDoseMl(d('hnf')), 1)
  assert.equal(volumeDoseMl(d('enoxaparina')), null)
})

test('profilaxia TEV: compressão pneumática nos capítulos de AVC, HIP e HSA (p. 541, 545, 559)', () => {
  const mec = MENCOES_PROFILAXIA_TEV.filter((m) => m.mecanica).map((m) => m.pagina)
  assert.deepEqual(mec, ['cap. 38, p. 541', 'cap. 39, p. 545', 'cap. 40, p. 559'])
})

test('protamina na HNF SC: 1–1,5 mg/100 U, teto 50 mg, ampola 50 mg (cap. 79, p. 1044)', () => {
  const r = protaminaHnfSc(3000)!
  assert.deepEqual([r.mg, r.limitadoAoTeto, r.ampolas], [[30, 45], false, [0.6, 0.9]])
  const r5 = protaminaHnfSc(5000)! // 50–75 mg → teto 50
  assert.deepEqual([r5.mg, r5.limitadoAoTeto, r5.ampolas], [[50, 50], true, [1, 1]])
  assert.equal(protaminaHnfSc(0), null)
  assert.equal(protaminaHnfSc(Number.NaN), null)
})
