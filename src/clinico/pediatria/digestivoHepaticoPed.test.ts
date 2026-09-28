// node --experimental-strip-types --test src/clinico/pediatria/digestivoHepaticoPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import {
  DOSES_HDA, criterioCoagulacaoPalf, fichaDigestivoHepaticoPed, glicoseIhaMgMin, leituraAmonia, leituraParacetamol, octreotidaInfusaoUgH, ofertaRestritaIha, somatostatinaUgH,
} from './digestivoHepaticoPed.ts'

test('octreotida e somatostatina (p. 349)', () => {
  assert.equal(temReferenciaPediatrica(fichaDigestivoHepaticoPed), true)
  const b = calcularDoseLivro(DOSES_HDA.find((d) => d.id === 'octreotida-bolus')!, 60)!
  assert.deepEqual(b.porDose, [50, 50])
  assert.equal(b.noMaximo, true)
  assert.deepEqual(octreotidaInfusaoUgH(10), [10, 40])
  assert.deepEqual(somatostatinaUgH(10), [10, 200])
  const ome = calcularDoseLivro(DOSES_HDA.find((d) => d.id === 'omeprazol-iv')!, 40)!
  assert.deepEqual(ome.dia, [28, 80])
})

test('PALF: coagulação com e sem encefalopatia (p. 357)', () => {
  assert.equal(criterioCoagulacaoPalf({ inr: 0, tpSeg: 0, encefalopatia: false }), null)
  assert.equal(criterioCoagulacaoPalf({ inr: 1.8, tpSeg: 0, encefalopatia: true }), true)
  assert.equal(criterioCoagulacaoPalf({ inr: 1.8, tpSeg: 0, encefalopatia: false }), false)
  assert.equal(criterioCoagulacaoPalf({ inr: 0, tpSeg: 20, encefalopatia: false }), true)
  assert.equal(criterioCoagulacaoPalf({ inr: 0, tpSeg: 15, encefalopatia: true }), true)
})

test('paracetamol, amônia, glicose e oferta restrita (p. 358–364)', () => {
  assert.equal(leituraParacetamol(3500, 20)!.toxicaUnica, 'faixa')
  assert.equal(leituraParacetamol(5000, 20)!.toxicaUnica, 'sim')
  assert.equal(leituraParacetamol(2000, 20)!.toxicaUnica, 'nao')
  assert.equal(leituraParacetamol(8000, 50)!.adolescenteAcima75g, true)
  assert.equal(leituraAmonia(150), 'abaixo')
  assert.equal(leituraAmonia(180), 'faixa')
  assert.equal(leituraAmonia(210), 'acima')
  assert.deepEqual(glicoseIhaMgMin(10), [100, 150])
  assert.deepEqual(ofertaRestritaIha(1000), [850, 950])
})
