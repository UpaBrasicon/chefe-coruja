import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  ADJUVANTES_SAP, ALTA_SAP, DROGAS_SAP, FLUMAZENIL, JEJUM_SAP, NALOXONA,
  calcularAdjuvante, calcularSap, dosesFlumazenilAteMaximo, fichaSedacaoProcedimentoAdulto,
} from './sedacaoProcedimento.ts'

const d = (id: string) => DROGAS_SAP.find((x) => x.id === id)!
const a = (id: string) => ADJUVANTES_SAP.find((x) => x.id === id)!
const r2 = (x: number) => Math.round(x * 100) / 100

test('SAP: ficha adulto do manual do HC, id kebab e páginas em todas as drogas', () => {
  assert.equal(fichaSedacaoProcedimentoAdulto.publico, 'adulto')
  assert.match(fichaSedacaoProcedimentoAdulto.id, /^adulto-[a-z0-9-]+$/)
  assert.match(fichaSedacaoProcedimentoAdulto.fontes[0].citacao, /Manual de Medicina de Emergência.*p\. 153–166/)
  assert.equal(temReferenciaPediatrica(fichaSedacaoProcedimentoAdulto), false)
  for (const x of [...DROGAS_SAP, ...ADJUVANTES_SAP]) assert.match(x.pagina, /^p\. \d+/, x.id)
})

test('SAP: etomidato 0,1–0,2 mg/kg, repique 0,05 mg/kg, 2 mg/mL (p. 162)', () => {
  const r = calcularSap(d('etomidato'), 70)!
  assert.deepEqual(r.inicial.map(r2), [7, 14])
  assert.deepEqual(r.inicialMl[0].ml.map(r2), [3.5, 7])
  assert.deepEqual(r.repique!.map(r2), [3.5, 3.5])
})

test('SAP: midazolam 0,02–0,03 mg/kg com teto de 5 mg (p. 163)', () => {
  const r = calcularSap(d('midazolam'), 70)!
  assert.deepEqual([r.inicial.map(r2), r.limitadoAoTeto], [[1.4, 2.1], false])
  const pesado = calcularSap(d('midazolam'), 200)! // 4–6 mg → 4–5
  assert.deepEqual([pesado.inicial, pesado.limitadoAoTeto], [[4, 5], true])
})

test('SAP: propofol 0,5–1 mg/kg (idoso 0,25–0,5), 10 e 20 mg/mL (p. 164)', () => {
  const r = calcularSap(d('propofol'), 80)!
  assert.deepEqual([r.inicial, r.repique], [[40, 80], [40, 40]])
  assert.deepEqual(r.inicialMl.map((x) => x.ml), [[4, 8], [2, 4]])
  assert.deepEqual(calcularSap(d('propofol-idoso'), 80)!.inicial, [20, 40])
})

test('SAP: quetamina EV 1–2, IM 4–5 (repique 2–5), subdissociativa 0,1–0,3 mg/kg, 50 mg/mL (p. 165)', () => {
  const ev = calcularSap(d('quetamina-ev'), 70)!
  assert.deepEqual([ev.inicial, ev.inicialMl[0].ml, ev.repique], [[70, 140], [1.4, 2.8], [35, 70]])
  const im = calcularSap(d('quetamina-im'), 70)!
  assert.deepEqual([im.inicial, im.repique, im.inicialMl[0].ml], [[280, 350], [140, 350], [5.6, 7]])
  assert.deepEqual(calcularSap(d('quetamina-sub'), 70)!.inicial.map(r2), [7, 21])
  assert.ok(d('quetamina-sub').errata) // 0,1–0,5 no cap. 9
})

test('SAP: fentanil 0,5–1 µg/kg a 50 µg/mL (p. 166)', () => {
  const r = calcularSap(d('fentanil'), 70)!
  assert.deepEqual([r.inicial, r.inicialMl[0].ml], [[35, 70], [0.7, 1.4]])
})

test('SAP: morfina 0,05–0,1 mg/kg com teto de 4 mg só no virgem de opioide (p. 166)', () => {
  const virgem = calcularSap(d('morfina'), 70)!
  assert.deepEqual([virgem.inicial.map(r2), virgem.limitadoAoTeto], [[3.5, 4], true])
  const usuario = calcularSap(d('morfina'), 70, { virgemOpioide: false })!
  assert.deepEqual([usuario.inicial.map(r2), usuario.limitadoAoTeto], [[3.5, 7], false])
  assert.deepEqual(virgem.inicialMl.map((x) => x.ml.map(r2)), [[3.5, 4], [0.35, 0.4]])
})

test('SAP: peso inválido não calcula', () => {
  assert.equal(calcularSap(d('propofol'), 0), null)
  assert.equal(calcularSap(d('propofol'), Number.NaN), null)
  assert.equal(calcularAdjuvante(a('lidocaina'), -1), null)
})

test('SAP: adjuvantes (lidocaína 0,5 mg/kg; midazolam 0,05 e 0,03 mg/kg; haloperidol 5 mg; teto de fentanil 0,5 µg/kg)', () => {
  assert.deepEqual(calcularAdjuvante(a('lidocaina'), 70), [35, 35])
  assert.deepEqual(calcularAdjuvante(a('lidocaina-diluida'), 70), [35, 70])
  assert.deepEqual(calcularAdjuvante(a('midazolam-premed'), 70)!.map(r2), [3.5, 3.5])
  assert.deepEqual(calcularAdjuvante(a('midazolam-emersao'), 70)!.map(r2), [2.1, 2.1])
  assert.deepEqual(calcularAdjuvante(a('haloperidol-premed'), 0), [5, 5])
  assert.deepEqual(calcularAdjuvante(a('fentanil-teto'), 70), [35, 35])
})

test('SAP: reversores, jejum e alta como no livro (p. 160–166)', () => {
  assert.deepEqual([FLUMAZENIL.doseMg, FLUMAZENIL.maxCicloMg, FLUMAZENIL.maxHoraMg, dosesFlumazenilAteMaximo()], [0.2, 1, 3, 5])
  assert.deepEqual([NALOXONA.inicialMg, NALOXONA.limiteMg], [[0.4, 2], 10])
  assert.deepEqual([JEJUM_SAP.liquidosH, JEJUM_SAP.solidosH, ALTA_SAP.observacaoMin], [2, 6, 30])
})
