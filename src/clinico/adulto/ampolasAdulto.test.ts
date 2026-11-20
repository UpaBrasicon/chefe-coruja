// node --experimental-strip-types --test src/clinico/adulto/ampolasAdulto.test.ts
// Dose em mL na PCR do adulto (19/11/2026; regras ML1–ML11 do RT).
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { problemasDasAmpolas, volumeDaAmpola } from '../pediatria/ampolas.ts'
import { AMPOLAS_PCR_ADULTO, DOSES_FIXAS_PCR_ADULTO, fichaAmpolasAdulto } from './ampolasAdulto.ts'
import { AHA_2025_PCR, DROGAS_PCR, calcularPcr } from './pcr.ts'

test('cadastro sem problema e só com itens da Tabela 2', () => {
  assert.deepEqual(problemasDasAmpolas(AMPOLAS_PCR_ADULTO, {}), [])
  const ids = new Set(DROGAS_PCR.map((d) => d.id))
  for (const id of Object.keys(AMPOLAS_PCR_ADULTO)) assert.ok(ids.has(id), `${id} não está em DROGAS_PCR`)
})

test('ficam sem mL: as doses já em mL e as infusões', () => {
  for (const id of ['calcio', 'emulsao', 'kcl', 'alteplase', 'glicose-insulina']) assert.equal(AMPOLAS_PCR_ADULTO[id], undefined, id)
})

test('CMED (RT, 20/11/2026): magnésio 10% e 50%, bicarbonato 8,4% e 10%; adrenalina só 1 mg/mL (0,1 mg/mL sem venda)', () => {
  assert.deepEqual(AMPOLAS_PCR_ADULTO.magnesio.map((a) => a.porMl), [0.1, 0.5])
  assert.deepEqual(AMPOLAS_PCR_ADULTO.bicarbonato.map((a) => a.porMl), [1, 1.19])
  assert.deepEqual(AMPOLAS_PCR_ADULTO.adrenalina.map((a) => a.porMl), [1])
  // magnésio 2 g: 20 mL de 10% ou 4 mL de 50%
  assert.deepEqual(AMPOLAS_PCR_ADULTO.magnesio.map((a) => volumeDaAmpola([2, 2], a)?.ml[0]), [20, 4])
})

test('as doses fixas batem com a Tabela 2 e com a AHA 2025', () => {
  assert.equal(DOSES_FIXAS_PCR_ADULTO.adrenalinaMg, AHA_2025_PCR.adrenalinaMg)
  assert.deepEqual([DOSES_FIXAS_PCR_ADULTO.amiodaronaMg.primeira, DOSES_FIXAS_PCR_ADULTO.amiodaronaMg.segunda], AHA_2025_PCR.amiodaronaMg)
  assert.match(DROGAS_PCR.find((d) => d.id === 'adrenalina')!.dose, /^1 mg /)
  assert.match(DROGAS_PCR.find((d) => d.id === 'amiodarona')!.dose, /300 mg.*150 mg/)
})

test('contas: adrenalina 1 mL; amiodarona 6 e 3 mL a aspirar e diluir; bicarbonato 70 kg = 70 a 105 mL; lidocaína 70 kg = 3,5 a 5,25 mL', () => {
  assert.deepEqual(volumeDaAmpola([1, 1], AMPOLAS_PCR_ADULTO.adrenalina[0])?.ml, [1, 1])
  assert.deepEqual(volumeDaAmpola([300, 300], AMPOLAS_PCR_ADULTO.amiodarona[0]), { ml: [6, 6], aspirar: true })
  assert.deepEqual(volumeDaAmpola([150, 150], AMPOLAS_PCR_ADULTO.amiodarona[0])?.ml, [3, 3])
  const r = calcularPcr(70)!
  assert.deepEqual(volumeDaAmpola(r.bicarbonatoMEq, AMPOLAS_PCR_ADULTO.bicarbonato[0])?.ml, [70, 105])
  assert.deepEqual(volumeDaAmpola(r.lidocainaMg, AMPOLAS_PCR_ADULTO.lidocaina.find((a) => a.porMl === 20))?.ml, [3.5, 5.25])
})

test('ficha do adulto com as fontes de cada concentração', () => {
  assert.equal(fichaAmpolasAdulto.publico, 'adulto')
  assert.equal(fichaAmpolasAdulto.versao, '2026-11-20.1')
  const c = fichaAmpolasAdulto.fontes.map((f) => f.citacao).join(' ')
  for (const t of ['p. 938', 'Adrenalina® 1 mg/mL', 'amiodarona 50 mg/mL', 'lidocaína 20 mg/mL']) assert.ok(c.includes(t), t)
})
