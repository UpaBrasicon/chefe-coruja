import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { ACIDENTES, PRE_MEDICACAO, fichaPeconhentosAdulto, neostigmina, preMedicacao, soroPorGravidade } from './peconhentos.ts'

const amp = (id: string, g: 'leve' | 'moderado' | 'grave') => soroPorGravidade(id, g)?.classe.ampolas
const droga = (id: string) => PRE_MEDICACAO.drogas.find((d) => d.id === id)!

test('peçonhentos: ficha adulto, manual do HC, id kebab, sem referência pediátrica', () => {
  assert.equal(fichaPeconhentosAdulto.publico, 'adulto')
  assert.match(fichaPeconhentosAdulto.id, /^adulto-[a-z0-9-]+$/)
  assert.match(fichaPeconhentosAdulto.fontes[0].citacao, /p\. 1349–1359/)
  assert.equal(temReferenciaPediatrica(fichaPeconhentosAdulto), false)
  for (const a of ACIDENTES) assert.match(a.pagina, /^p\. \d+/, a.id)
})

test('botrópico 2–4 / 4–8 / 8–12 ampolas (Tabela 1, p. 1354)', () => {
  assert.deepEqual([amp('botropico', 'leve'), amp('botropico', 'moderado'), amp('botropico', 'grave')], [[2, 4], [4, 8], [8, 12]])
})

test('crotálico 5 / 10 / 20 ampolas (Tabela 2, p. 1354)', () => {
  assert.deepEqual([amp('crotalico', 'leve'), amp('crotalico', 'moderado'), amp('crotalico', 'grave')], [[5, 5], [10, 10], [20, 20]])
})

test('elapídico 5–10 e laquético 12–20, sempre graves (p. 1353), com nota de divergência', () => {
  assert.deepEqual(amp('elapidico', 'grave'), [5, 10])
  assert.deepEqual(amp('laquetico', 'grave'), [12, 20])
  assert.equal(soroPorGravidade('elapidico', 'leve'), null)
  assert.ok(ACIDENTES.find((a) => a.id === 'laquetico')!.errata)
})

test('escorpião: soro só no grave do adulto, 4–6 ampolas (p. 1356)', () => {
  assert.deepEqual([amp('escorpionico', 'leve'), amp('escorpionico', 'moderado'), amp('escorpionico', 'grave')], [null, null, [4, 6]])
})

test('aranhas (Tabela 3, p. 1357–1359): Phoneutria, Loxosceles e Latrodectus IM', () => {
  assert.deepEqual([amp('phoneutria', 'moderado'), amp('phoneutria', 'grave')], [[2, 4], [5, 10]])
  assert.deepEqual([amp('loxosceles', 'moderado'), amp('loxosceles', 'grave')], [[5, 5], [5, 5]])
  assert.deepEqual(soroPorGravidade('loxosceles', 'grave')!.classe.ampolasAlternativa!.ampolas, [10, 10])
  const lat = soroPorGravidade('latrodectus', 'grave')!
  assert.deepEqual([lat.classe.ampolas, lat.acidente.via], [[1, 2], 'IM'])
  assert.match(lat.acidente.errata!, /Phoneutria/)
})

test('pré-medicação por peso com teto (p. 1350)', () => {
  assert.deepEqual(preMedicacao(droga('hidrocortisona'), 40), { mg: 400, limitadoAoTeto: false })
  assert.deepEqual(preMedicacao(droga('hidrocortisona'), 70), { mg: 500, limitadoAoTeto: true })
  assert.deepEqual(preMedicacao(droga('dexclorfeniramina'), 50), { mg: 4, limitadoAoTeto: false })
  assert.deepEqual(preMedicacao(droga('dexclorfeniramina'), 70), { mg: 5, limitadoAoTeto: true })
  assert.deepEqual(preMedicacao(droga('ranitidina'), 70), { mg: 100, limitadoAoTeto: true })
  assert.equal(preMedicacao(droga('ranitidina'), 0), null)
  assert.equal(PRE_MEDICACAO.adrenalinaScMg, 0.25)
})

test('neostigmina adulto 1–2 mg = 2–4 mL (0,5 mg/mL) e 12 µg/kg/h (p. 1352)', () => {
  const n = neostigmina(70)
  assert.deepEqual([n.bolusMg, n.bolusMl, n.infusaoUgH], [[1, 2], [2, 4], 840])
  assert.equal(neostigmina(0).infusaoUgH, null)
})
