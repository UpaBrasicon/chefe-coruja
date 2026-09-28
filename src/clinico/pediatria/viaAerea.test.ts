// node --experimental-strip-types --test src/clinico/pediatria/viaAerea.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { DIAS_ANO, DIAS_MES, calcularDose } from './fonteP2.ts'
import {
  DOSES_SRI, EQUIPAMENTO, equipamentoPorIdade, fichaViaAereaPediatrica, fluxoApneia,
  profundidadeCm, succinilcolinaAplica, tuboPorIdade,
} from './viaAerea.ts'

const d = (id: string) => DOSES_SRI.find((x) => x.id === id)!

test('via aérea: ficha do livro do ICr, com o manual HC como segunda fonte concordante', () => {
  assert.equal(temReferenciaPediatrica(fichaViaAereaPediatrica), true)
  assert.match(fichaViaAereaPediatrica.fontes[0].citacao, /ICr-HCFMUSP.*p\. 67–78.*p\. 150–151/)
  assert.match(fichaViaAereaPediatrica.fontes[1].citacao, /Manual de Medicina de Emergência.*1494/)
})

test('tubo: sem cuff (idade/4)+4, com cuff (idade/4)+3,5; profundidade 3 × DI (p. 75)', () => {
  const t4 = tuboPorIdade(4)!
  assert.equal(t4.semCuff.calculadoMm, 5)
  assert.deepEqual(t4.semCuff.vizinhosMm, [5])
  assert.equal(t4.comCuff.calculadoMm, 4.5)
  assert.equal(profundidadeCm(5), 15) // exemplo do livro: tubo 5 mm, marca 15 cm
  const t3 = tuboPorIdade(3)!
  assert.equal(t3.semCuff.calculadoMm, 4.75)
  assert.deepEqual(t3.semCuff.vizinhosMm, [4.5, 5])
  assert.deepEqual(t3.comCuff.vizinhosMm, [4, 4.5])
  assert.equal(tuboPorIdade(0), null)
  assert.equal(tuboPorIdade(14), null)
})

test('equipamento: Tabelas 2 e 3 do cap. 13 (p. 151)', () => {
  assert.equal(EQUIPAMENTO.length, 6)
  assert.equal(equipamentoPorIdade(2 * DIAS_MES)!.tubo, '3,0–3,5 sem cuff')
  assert.equal(equipamentoPorIdade(8 * DIAS_MES)!.laringoscopio, '1, lâmina reta/curva')
  const tres = equipamentoPorIdade(3 * DIAS_ANO + 100)!
  assert.equal(tres.rotulo, '1–3 anos — 10–12 kg')
  assert.equal(tres.sondaGastrica, '12')
  assert.equal(equipamentoPorIdade(5 * DIAS_ANO)!.tubo, '5,0–5,5 sem cuff')
  const dez = equipamentoPorIdade(10 * DIAS_ANO + 200)!
  assert.equal(dez.tubo, '5,5–6,5 com cuff')
  assert.equal(dez.drenoTorax, '28–32')
  assert.equal(equipamentoPorIdade(11 * DIAS_ANO), null) // acima de 10 anos o livro não traz linha
})

test('O₂ na apneia: 5 / 10 / 15 L/min (p. 69)', () => {
  assert.equal(fluxoApneia(100), 5)
  assert.equal(fluxoApneia(1 * DIAS_ANO), 10)
  assert.equal(fluxoApneia(7 * DIAS_ANO + 300), 10)
  assert.equal(fluxoApneia(8 * DIAS_ANO), 15)
})

test('SRI: Tabelas 1 e 2 (p. 69–70) e atropina (p. 71) a 20 kg', () => {
  for (const x of DOSES_SRI) assert.ok(x.pagina, x.id)
  assert.deepEqual(calcularDose(d('rocuronio'), 20)!.dose, [18, 24])
  assert.deepEqual(calcularDose(d('fentanil'), 20)!.dose, [40, 140])
  assert.deepEqual(calcularDose(d('quetamina'), 20)!.dose, [20, 80])
  assert.deepEqual(calcularDose(d('atropina'), 20)!.dose, [0.4, 0.4])
  assert.deepEqual(calcularDose(d('atropina'), 60)!.dose, [1, 1]) // máximo 1 mg
  assert.deepEqual(calcularDose(d('atropina'), 3)!.dose.map((x) => Math.round(x * 100) / 100), [0.06, 0.06]) // sem dose mínima
  assert.equal(succinilcolinaAplica('succinilcolina-menor10', 8), true)
  assert.equal(succinilcolinaAplica('succinilcolina-maior10', 8), false)
  assert.equal(succinilcolinaAplica('succinilcolina-menor10', 10), false) // errata: 10 kg sem linha
  assert.equal(succinilcolinaAplica('succinilcolina-maior10', 10), false)
})
