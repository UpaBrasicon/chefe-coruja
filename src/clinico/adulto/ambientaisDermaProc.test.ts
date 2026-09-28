import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { estagioHipotermia, fichaHipotermiaAdulto, rcpNaHipotermia, szpilman, taxaReaquecimento } from './ambientais.ts'
import { dosesDermatoses, faixaRegiscar, fichaDermatosesAdulto, regiscar, scortenUti } from './dermatoses.ts'
import {
  agulhaIoMotor, correnteMptc, fichaAcessosAdulto, fichaMarcaPassoAdulto, frenchParaMm, lidocainaIo, mmParaFrench, saidaMptv, sensibilidadeMptv,
} from './procedimentos.ts'

test('E7 ambientais/derma/procedimentos: fichas de adulto', () => {
  for (const f of [szpilman.ficha, fichaHipotermiaAdulto, regiscar.ficha, scortenUti.ficha, fichaDermatosesAdulto, fichaAcessosAdulto, fichaMarcaPassoAdulto]) {
    assert.equal(f.publico, 'adulto', f.id)
    assert.match(f.id, /^adulto-[a-z0-9-]+$/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
})

test('Szpilman: grau e sobrevida da Tabela 1 (p. 1340–1341)', () => {
  assert.equal(szpilman.calcular({}), null)
  const g4 = szpilman.calcular({ grau: 4, submersao: true })!
  assert.equal(g4.valor, 'Grau IV')
  assert.match(g4.nota, /78-82%/)
  assert.match(g4.derivados[1][1], /^1:/)
  assert.match(szpilman.calcular({ grau: 6 })!.nota, /7-12%/)
})

test('hipotermia: estágios da Tabela 1 com bordas em 32 e 28 °C (p. 1360)', () => {
  assert.equal(estagioHipotermia(35, false)!.estagio, 'sem hipotermia')
  assert.equal(estagioHipotermia(34.9, false)!.estagio, 'HT I')
  assert.equal(estagioHipotermia(32, false)!.estagio, 'HT I')
  assert.equal(estagioHipotermia(31.9, false)!.estagio, 'HT II')
  assert.equal(estagioHipotermia(28, false)!.estagio, 'HT II')
  assert.equal(estagioHipotermia(27.9, false)!.estagio, 'HT III')
  assert.equal(estagioHipotermia(22, true)!.estagio, 'HT IV')
  assert.ok(estagioHipotermia(26, true)!.nota)
  assert.equal(estagioHipotermia(Number.NaN, false), null)
})

test('hipotermia: RCP, adrenalina e choques pela temperatura (p. 1366–1367)', () => {
  assert.match(rcpNaHipotermia(null).ciclo, /até 5 min sem RCP/)
  assert.match(rcpNaHipotermia(18).ciclo, /até 10 min sem RCP/)
  assert.match(rcpNaHipotermia(25).adrenalina, /até 30 °C/)
  assert.match(rcpNaHipotermia(32).adrenalina, /dobrado \(6-10 min\)/)
  assert.match(rcpNaHipotermia(36).adrenalina, /ACLS/)
  assert.match(rcpNaHipotermia(29).desfibrilacao, /após 3 choques/)
})

test('hipotermia: taxa de reaquecimento < 0,5 °C/h = falha do passivo (p. 1369)', () => {
  assert.deepEqual(taxaReaquecimento(30, 31, 2), { cPorHora: 0.5, falhaPassivo: false })
  assert.equal(taxaReaquecimento(30, 30.5, 2)!.falhaPassivo, true)
  assert.equal(taxaReaquecimento(30, 31, 0), null)
})

test('RegiSCAR: faixas da Tabela 4 e amplitude −4 a 9 (p. 1283)', () => {
  const min = { febre: 0, linfonodos: 0, linfocitos: 0, eosinofilia: 0, extensao: 0, morfologia: 0, biopsia: 0, orgaos: 0, resolucao: 0, exames: 0 }
  assert.equal(regiscar.calcular(min)!.valor, '-4')
  const max = { febre: 1, linfonodos: 1, linfocitos: 1, eosinofilia: 2, extensao: 1, morfologia: 1, biopsia: 1, orgaos: 2, resolucao: 1, exames: 1 }
  assert.equal(regiscar.calcular(max)!.valor, '9')
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(faixaRegiscar), ['exclui o diagnóstico', 'diagnóstico possível', 'diagnóstico possível', 'diagnóstico provável', 'diagnóstico provável', 'diagnóstico definitivo'])
})

test('SCORTEN (itens): ≥ 2 = critério de UTI do livro (p. 1285)', () => {
  const nao = Object.fromEntries(scortenUti.itens.map((i) => [i.id, 0]))
  assert.equal(scortenUti.itens.length, 7)
  assert.equal(scortenUti.calcular({ ...nao, idade: 1 })!.estado, 1)
  assert.equal(scortenUti.calcular({ ...nao, idade: 1, fc: 1 })!.estado, 2)
})

test('dermatoses: doses por peso (p. 1282, 1285)', () => {
  assert.deepEqual(dosesDermatoses(70), { ssjNetPrednisonaMg: [70, 140], ssjNetCiclosporinaMg: [210, 350], dressPrednisonaMg: 70 })
  assert.equal(dosesDermatoses(0), null)
})

test('French: 1 Fr = 0,33 mm; 3 Fr = 1 mm (p. 1401)', () => {
  const f = frenchParaMm(9)!
  assert.ok(Math.abs(f.mm - 2.97) < 1e-9)
  assert.equal(f.mmPorTerco, 3)
  assert.equal(mmParaFrench(2), 6)
  assert.equal(frenchParaMm(0), null)
})

test('intraósseo: agulha com motor pelo peso e lidocaína (p. 1413)', () => {
  assert.equal(agulhaIoMotor(30, false)!.agulha!.mm, 15)
  assert.equal(agulhaIoMotor(70, false)!.agulha!.mm, 25)
  assert.equal(agulhaIoMotor(70, true)!.agulha!.mm, 45)
  assert.equal(agulhaIoMotor(39.5, false)!.agulha, null)
  assert.deepEqual(lidocainaIo(70), { ataqueMg: 35, repeticaoMg: 17.5 })
})

test('marca-passo: MPTC limiar + 5-10 mA; MPTV sensibilidade 50% e saída 2× + 1 (p. 1449, 1456–1457)', () => {
  assert.deepEqual(correnteMptc(60), [65, 70])
  assert.equal(sensibilidadeMptv(4), 2)
  assert.equal(saidaMptv(1.5), 4)
  assert.equal(saidaMptv(0), null)
})
