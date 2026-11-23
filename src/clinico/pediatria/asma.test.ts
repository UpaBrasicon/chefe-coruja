// node --experimental-strip-types --test src/clinico/pediatria/asma.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { INDINNIMEO_ASMA_2018 } from '../fontesPubmed.ts'
import { CLASSIFICACAO_ASMA, DOSES_ASMA, FIXOS_ASMA, fichaAsmaPediatrica, ipratropioNebulizacao } from './asma.ts'
import { calcularDose } from './fonteP2.ts'

const d = (id: string) => DOSES_ASMA.find((x) => x.id === id)!

test('asma: ficha do ICr e Tabela 1 com 12 parâmetros', () => {
  assert.equal(temReferenciaPediatrica(fichaAsmaPediatrica), true)
  assert.equal(CLASSIFICACAO_ASMA.length, 12)
  assert.equal(CLASSIFICACAO_ASMA.find((l) => l.parametro.startsWith('SpO'))!.grave, '91 a 95')
})

test('corticoides (Tabela 3, p. 119)', () => {
  assert.deepEqual(calcularDose(d('prednisolona'), 15)!.dose, [15, 30])
  assert.deepEqual(calcularDose(d('prednisolona'), 30)!.dose, [30, 40]) // máx. 40 mg/dia
  assert.deepEqual(calcularDose(d('dexametasona'), 20)!.dose, [6, 12])
  assert.deepEqual(calcularDose(d('dexametasona'), 40)!.dose, [12, 16])
  assert.deepEqual(calcularDose(d('hidrocortisona'), 15)!.dose, [150, 150])
  assert.deepEqual(calcularDose(d('hidrocortisona'), 25)!.dose, [200, 200])
})

test('magnésio: tabela 25–75 mg/kg x texto 25 mg/kg máx. 2 g (p. 119)', () => {
  assert.deepEqual(calcularDose(d('magnesio-tabela'), 20)!.dose, [500, 1500])
  assert.deepEqual(calcularDose(d('magnesio-texto'), 20)!.dose, [500, 500])
  assert.deepEqual(calcularDose(d('magnesio-texto'), 100)!.dose, [2000, 2000])
  assert.ok(d('magnesio-tabela').nota && d('magnesio-texto').nota)
})

test('salbutamol contínuo 0,5 mg/kg/h, máx. 20 mg/h; ipratrópio por peso', () => {
  assert.deepEqual(calcularDose(d('salbutamol-continuo'), 16)!.dose, [8, 8])
  assert.deepEqual(calcularDose(d('salbutamol-continuo'), 50)!.dose, [20, 20])
  assert.ok(d('salbutamol-continuo').errata)
  assert.deepEqual(ipratropioNebulizacao(19.9), { mcg: 250, gotas: 20 })
  assert.deepEqual(ipratropioNebulizacao(20), { mcg: 500, gotas: 40 })
})

// ── Lote D11 (decisão do RT de 19/11/2026): item 14 ──

test('lote D11: salbutamol em nebulização intermitente, 2,5 a 5 mg (Sociedade Italiana de Pediatria 2018)', () => {
  assert.ok(fichaAsmaPediatrica.versao >= '2026-11-19.1') // subiu no lote 4 da dose em mL (20/11/2026)
  assert.ok(fichaAsmaPediatrica.fontes.includes(INDINNIMEO_ASMA_2018))
  assert.match(fichaAsmaPediatrica.revisadoEm, /19\/11\/2026 \(lote D11: item 14/)
  const neb = FIXOS_ASMA.find((f) => /nebulização intermitente/.test(f.nome))!
  assert.match(neb.dose, /^2,5 a 5 mg por nebulização.*até 3 vezes, a cada 20 a 30 min, na primeira hora/)
  assert.match(neb.fonte!, /Sociedade Italiana de Pediatria/)
  // os itens do livro seguem com a página do livro e sem fonte aberta
  for (const f of FIXOS_ASMA.filter((x) => x !== neb)) assert.equal(f.fonte, undefined, f.nome)
})
