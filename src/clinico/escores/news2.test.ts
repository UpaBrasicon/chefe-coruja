import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { faixaNews2, pontosNews2, type VitaisNews2 } from '../news2.ts'
import { news2 } from './news2.ts'

// Cortes iguais aos de private.calcular_acuidade (escala 1).
const normal: VitaisNews2 = { fr: 16, spo2: 97, escala2: false, oxigenio: false, pas: 120, fc: 80, alerta: true, temp: 37 }
const pt = (v: Partial<VitaisNews2>) => pontosNews2({ ...normal, ...v })

test('news2: paciente normal = 0', () => {
  assert.equal(faixaNews2(pt({})).total, 0)
})
test('news2: FR 8/9, 11/12, 20/21, 24/25', () => {
  assert.deepEqual([8, 9, 11, 12, 20, 21, 24, 25].map((fr) => pt({ fr }).fr), [3, 1, 1, 0, 0, 2, 2, 3])
})
test('news2: SpO₂ escala 1 — 91/92, 93/94, 95/96', () => {
  assert.deepEqual([91, 92, 93, 94, 95, 96].map((spo2) => pt({ spo2 }).spo2), [3, 2, 2, 1, 1, 0])
})
test('news2: SpO₂ escala 2 — 93+ só pontua em oxigênio', () => {
  assert.deepEqual([83, 84, 85, 86, 87, 88, 92].map((spo2) => pt({ spo2, escala2: true }).spo2), [3, 2, 2, 1, 1, 0, 0])
  assert.deepEqual([93, 95, 97].map((spo2) => pt({ spo2, escala2: true, oxigenio: false }).spo2), [0, 0, 0])
  assert.deepEqual([93, 94, 95, 96, 97].map((spo2) => pt({ spo2, escala2: true, oxigenio: true }).spo2), [1, 1, 2, 2, 3])
})
test('news2: PAS 90/91, 100/101, 110/111, 219/220', () => {
  assert.deepEqual([90, 91, 100, 101, 110, 111, 219, 220].map((pas) => pt({ pas }).pas), [3, 2, 2, 1, 1, 0, 0, 3])
})
test('news2: FC 40/41, 50/51, 90/91, 110/111, 130/131', () => {
  assert.deepEqual([40, 41, 50, 51, 90, 91, 110, 111, 130, 131].map((fc) => pt({ fc }).fc), [3, 1, 1, 0, 0, 1, 1, 2, 2, 3])
})
test('news2: temperatura 35/35,1, 36/36,1, 38/38,1, 39/39,1', () => {
  assert.deepEqual([35, 35.1, 36, 36.1, 38, 38.1, 39, 39.1].map((temp) => pt({ temp }).temp), [3, 1, 1, 0, 0, 1, 1, 2])
})
test('news2: oxigênio +2 e consciência alterada +3', () => {
  assert.equal(pt({ oxigenio: true }).oxigenio, 2)
  assert.equal(pt({ alerta: false }).consciencia, 3)
})
test('news2: faixas — 4 baixa, 3 isolado baixa-média, 5 média, 7 alta', () => {
  const quatro = faixaNews2(pt({ fr: 22, fc: 100, temp: 38.5 })) // 2+1+1
  assert.deepEqual([quatro.total, quatro.banda], [4, 0])
  const isolado = faixaNews2(pt({ fr: 25 }))
  assert.deepEqual([isolado.total, isolado.banda], [3, 1])
  assert.match(isolado.rotulo, /baixa-média/)
  const cinco = faixaNews2(pt({ fr: 22, fc: 115, temp: 38.5 })) // 2+2+1
  assert.deepEqual([cinco.total, cinco.banda], [5, 1])
  const sete = faixaNews2(pt({ fr: 22, fc: 115, temp: 38.5, oxigenio: true })) // 2+2+1+2
  assert.deepEqual([sete.total, sete.banda], [7, 2])
})
test('news2 (tela): calcula com tudo preenchido, null se faltar; adulto só', () => {
  // escala 0 = escala 1; o2 0 = ar; consciencia 0 = alerta
  const r = news2.calcular({ fr: 25, spo2: 97, escala: 0, o2: 0, pas: 120, fc: 80, consciencia: 0, temp: 37 })!
  assert.equal(r.valor, '3')
  assert.equal(r.estado, 1)
  assert.ok(r.alerta)
  assert.equal(news2.calcular({ fr: 25 }), null)
  assert.equal(news2.calcular({ fr: 250, spo2: 97, escala: 0, o2: 0, pas: 120, fc: 80, consciencia: 0, temp: 37 }), null)
  assert.equal(temReferenciaPediatrica(news2.ficha), false)
})
test('news2: não traz conduta de frequência de monitorização', () => {
  const r = news2.calcular({ fr: 30, spo2: 85, escala: 0, o2: 1, pas: 85, fc: 140, consciencia: 1, temp: 39.5 })!
  assert.ok(!JSON.stringify(r).match(/1\/1 ?h|6\/6|emergência imediata/i))
})
