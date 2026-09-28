import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { OMEPRAZOL_ULCERA, ULCERA_ESTRESSE, avaliarIbpDupla, fichaProfilaxiaUlceraEstresse, type CriteriosIbp } from './profilaxiaUlceraEstresse.ts'

const base: CriteriosIbp = { duplaAntiagregacao: true, isolados: [], pareados: [], alcool: false }

test('úlcera de estresse: ficha adulto do manual, sem referência pediátrica', () => {
  assert.equal(fichaProfilaxiaUlceraEstresse.id, 'adulto-profilaxia-ulcera-estresse')
  assert.equal(fichaProfilaxiaUlceraEstresse.publico, 'adulto')
  assert.match(fichaProfilaxiaUlceraEstresse.fontes[0].citacao, /Manual de Medicina de Emergência.*p\. 127/)
  assert.equal(temReferenciaPediatrica(fichaProfilaxiaUlceraEstresse), false)
})

test('úlcera de estresse: omeprazol 40 mg EV 1 vez/dia em VM > 48 h, coagulopatia ou choque (cap. 7, p. 127)', () => {
  assert.deepEqual(OMEPRAZOL_ULCERA, { mg: 40, via: 'EV', vezesDia: 1, pagina: 'cap. 7, p. 127' })
  assert.match(ULCERA_ESTRESSE[0].texto, /mais de 48 horas, com coagulopatia ou choque/)
  assert.match(ULCERA_ESTRESSE[1].pagina, /p\. 1255/)
})

test('IBP na dupla antiagregação: um critério isolado basta (cap. 13, p. 208)', () => {
  const r = avaliarIbpDupla({ ...base, isolados: ['corticoide'] })
  assert.deepEqual([r.criterioPresente, r.motivos], [true, ['Uso de corticosteroide']])
})

test('IBP na dupla antiagregação: dos pareados, precisa de dois (p. 208)', () => {
  assert.equal(avaliarIbpDupla({ ...base, pareados: ['idade65'] }).criterioPresente, false)
  const r = avaliarIbpDupla({ ...base, pareados: ['idade65', 'dispepsia'] })
  assert.equal(r.criterioPresente, true)
  assert.match(r.motivos[0], /Idade > 65 anos, Dispepsia/)
})

test('IBP na dupla antiagregação: álcool fica à parte (errata) e sem dupla antiagregação não há critério', () => {
  const a = avaliarIbpDupla({ ...base, alcool: true, pareados: ['drge'] })
  assert.deepEqual([a.criterioPresente, a.alcoolAmbiguo], [false, true])
  const s = avaliarIbpDupla({ ...base, duplaAntiagregacao: false, isolados: ['aine'] })
  assert.deepEqual([s.criterioPresente, s.semDuplaAntiagregacao, s.motivos], [false, true, []])
})
