import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularLinha, fichaHipoglicemiaPed, glicoseOralG, glucagonMg, linhaTabela, linhasTexto, taxaDextroseMlH, vigDaTaxa } from './hipoglicemiaPed.ts'

const r1 = (x: number | null | undefined) => Math.round(x! * 10) / 10

test('hipoglicemia: ficha do ICr (cap. 51)', () => {
  assert.equal(temReferenciaPediatrica(fichaHipoglicemiaPed), true)
  assert.match(fichaHipoglicemiaPed.fontes[0].citacao, /cap\. 51, p\. 507–511/)
})

test('via oral 0,3 g/kg (p. 510)', () => {
  assert.equal(r1(glicoseOralG(20)), 6)
  assert.equal(glicoseOralG(0), null)
})

test('glucagon: 0,5 mg < 25 kg; 1 mg ≥ 25 kg (p. 510)', () => {
  assert.equal(glucagonMg(24.9), 0.5)
  assert.equal(glucagonMg(25), 1)
  assert.equal(glucagonMg(60), 1)
})

test('EV: linhas do texto e da Tabela 2 por idade, gramas e teto de 25 g (p. 510–511)', () => {
  // lactente de 1 ano, 10 kg: SG 10% 5–10 mL/kg → 50–100 mL = 5–10 g
  const t = calcularLinha(linhaTabela(1)!, 10)!
  assert.deepEqual(t.ml, [50, 100])
  assert.deepEqual(t.g, [5, 10])
  // 6 anos, 25 kg: SG 25% 2–5 mL/kg → 50–125 mL, teto 100 mL (25 g)
  const c = calcularLinha(linhaTabela(6)!, 25)!
  assert.deepEqual(c.ml, [50, 100])
  assert.deepEqual(c.g, [12.5, 25])
  assert.equal(c.limitada, true)
  // adolescente 13 anos, 45 kg: SG 50% 1–2 mL/kg → 45–90 mL, teto 50 mL
  const a = calcularLinha(linhaTabela(13)!, 45)!
  assert.deepEqual(a.ml, [45, 50])
  assert.deepEqual(a.g, [22.5, 25])
  // texto: < 12 anos → SG 10% e SG 25%; ≥ 12 → SG 25% 1–2 mL/kg
  assert.deepEqual(linhasTexto(6)!.map((l) => l.solucao), ['SG 10%', 'SG 25%'])
  const txt = calcularLinha(linhasTexto(13)![0], 45)!
  assert.deepEqual(txt.g, [11.25, 22.5]) // 0,25–0,5 g/kg — errata registrada
  // SG 10% 10 mL/kg em 30 kg = 300 mL = 30 g → teto de 25 g = 250 mL
  const s10 = calcularLinha(linhasTexto(8)![0], 30)!
  assert.deepEqual(s10.ml, [150, 250])
})

test('VIG: mL/h = VIG × 6 × peso ÷ % (p. 510)', () => {
  assert.equal(taxaDextroseMlH(5, 10, 10), 30)
  assert.equal(taxaDextroseMlH(3, 20, 5), 72)
  assert.equal(vigDaTaxa(30, 10, 10), 5)
  assert.equal(taxaDextroseMlH(5, 0, 10), null)
})
