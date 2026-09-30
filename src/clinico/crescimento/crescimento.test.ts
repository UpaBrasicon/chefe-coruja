import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  avaliarMedida, classificarPesoIdade, imc, INDICADORES, intervaloDaIdade, linhaZ, lmsPara, mesesDeIdade,
  motivoSemCurva, paresImc, sexoDaTabela, tabelaDe, type Indicador, type Sexo,
} from './curvas.ts'
import { escoreZ, escoreZBruto, lmsNaIdade, medidaNoEscoreZ, normalAcumulada, percentil } from './lms.ts'
import { fichaCurvaCrescimento } from './fonte.ts'
import { temReferenciaPediatrica } from '../ficha.ts'

// Linhas −3 … +3 com uma casa, como a OMS publica nas tabelas "z-scores"
// (Child Growth Standards 2006 e Growth Reference 2007). Os números abaixo são
// os das tabelas oficiais; a conta sai do LMS de ./dados.
const sd = (ind: Indicador, s: Sexo, m: number) => [-3, -2, -1, 0, 1, 2, 3].map((z) => Number(medidaNoEscoreZ(lmsPara(ind, s, m)!, z).toFixed(1)))

test('tabelas da OMS: batem com as tabelas de escore-z publicadas', () => {
  // peso para a idade, OMS 2006
  assert.deepEqual(sd('peso', 'M', 0), [2.1, 2.5, 2.9, 3.3, 3.9, 4.4, 5.0])
  assert.deepEqual(sd('peso', 'F', 0), [2.0, 2.4, 2.8, 3.2, 3.7, 4.2, 4.8])
  assert.deepEqual(sd('peso', 'M', 12), [6.9, 7.7, 8.6, 9.6, 10.8, 12.0, 13.3])
  assert.deepEqual(sd('peso', 'F', 12), [6.3, 7.0, 7.9, 8.9, 10.1, 11.5, 13.1])
  assert.deepEqual(sd('peso', 'M', 60), [12.4, 14.1, 16.0, 18.3, 21.0, 24.2, 27.9])
  // comprimento ao nascer e estatura aos 2 anos (em pé), OMS 2006
  assert.deepEqual(sd('estatura', 'M', 0), [44.2, 46.1, 48.0, 49.9, 51.8, 53.7, 55.6])
  assert.deepEqual(sd('estatura', 'M', 24), [78.0, 81.0, 84.1, 87.1, 90.2, 93.2, 96.3])
  // perímetro cefálico, OMS 2006
  assert.deepEqual(sd('pc', 'M', 0), [30.7, 31.9, 33.2, 34.5, 35.7, 37.0, 38.3])
  assert.deepEqual(sd('pc', 'F', 0), [30.3, 31.5, 32.7, 33.9, 35.1, 36.2, 37.4])
  // IMC, OMS 2006
  assert.deepEqual(sd('imc', 'M', 0), [10.2, 11.1, 12.2, 13.4, 14.8, 16.3, 18.1])
  // OMS 2007: estatura de menina aos 10 anos, mediana 138,6 cm
  assert.equal(sd('estatura', 'F', 120)[3], 138.6)
})

test('dados: 14 tabelas, eixo em meses, com a fonte da OMS em cada uma', () => {
  const dir = join(import.meta.dirname, 'dados')
  const arqs = readdirSync(dir).filter((a) => a.endsWith('.json'))
  assert.equal(arqs.length, 14)
  for (const a of arqs) {
    const t = JSON.parse(readFileSync(join(dir, a), 'utf8'))
    assert.equal(t.eixo, 'meses', a)
    assert.match(t.fonte, /^OMS, (Padrões de Crescimento Infantil 2006|Referência de Crescimento 2007)/, a)
    for (let i = 1; i < t.lms.length; i++) assert.equal(t.lms[i][0], t.lms[i - 1][0] + 1, `${a}: mês ${t.lms[i][0]} fora de ordem`)
  }
  assert.equal(tabelaDe('pc', 'M', '5-19'), null, 'a OMS não publica perímetro cefálico depois de 5 anos')
  assert.equal(tabelaDe('peso', 'F', '5-19')!.lms.at(-1)![0], 120, 'peso para a idade da OMS 2007 vai só até 10 anos')
  assert.equal(tabelaDe('estatura', 'M', '5-19')!.lms.at(-1)![0], 228, 'estatura vai até 19 anos')
})

test('escore-z LMS: fórmula, inverso e o caso L = 0', () => {
  const lms = { L: 0.3487, M: 3.3464, S: 0.14602 }
  for (const z of [-2.5, -1, 0, 0.7, 2.9]) assert.ok(Math.abs(escoreZ(lms, medidaNoEscoreZ(lms, z)) - z) < 1e-9)
  const log = { L: 0, M: 10, S: 0.1 }
  assert.ok(Math.abs(escoreZBruto(log, 10 * Math.exp(0.2)) - 2) < 1e-9)
  assert.ok(Math.abs(medidaNoEscoreZ(log, -1) - 10 * Math.exp(-0.1)) < 1e-9)
  assert.throws(() => escoreZ(lms, 0))
})

test('escore-z além de ±3: a restrição da OMS (distância em degraus de SD2–SD3)', () => {
  const lms = lmsPara('peso', 'M', 12)!
  const sd2 = medidaNoEscoreZ(lms, 2)
  const sd3 = medidaNoEscoreZ(lms, 3)
  const y = sd3 + 0.5 * (sd3 - sd2)
  assert.ok(Math.abs(escoreZ(lms, y) - 3.5) < 1e-9)
  assert.ok(escoreZBruto(lms, y) < 3.5, 'a fórmula crua daria menos que 3,5 (L < 1)')
  const n2 = medidaNoEscoreZ(lms, -2)
  const n3 = medidaNoEscoreZ(lms, -3)
  assert.ok(Math.abs(escoreZ(lms, n3 - (n2 - n3)) + 4) < 1e-9)
  // com L = 1 (estatura) a restrição não muda nada
  const e = lmsPara('estatura', 'M', 12)!
  assert.ok(Math.abs(escoreZ(e, medidaNoEscoreZ(e, 4.2)) - 4.2) < 1e-9)
})

test('percentil pela normal', () => {
  assert.ok(Math.abs(percentil(0) - 50) < 1e-4)
  assert.ok(Math.abs(normalAcumulada(1.96) - 0.975) < 1e-4)
  assert.ok(Math.abs(normalAcumulada(-2) - 0.02275) < 1e-5)
  assert.ok(Math.abs(percentil(1) + percentil(-1) - 100) < 1e-4)
})

test('interpolação entre meses e nada fora da tabela', () => {
  const t = tabelaDe('peso', 'M', '0-5')!.lms
  const meio = lmsNaIdade(t, 11.5)!
  assert.ok(Math.abs(meio.M - (t[11][2] + t[12][2]) / 2) < 1e-12)
  assert.equal(lmsNaIdade(t, -0.1), null)
  assert.equal(lmsNaIdade(t, 60.1), null)
  assert.equal(lmsPara('pc', 'F', 61), null)
  assert.equal(lmsPara('peso', 'F', 121), null)
  // entre 60 e 61 meses: emenda do padrão 2006 com a referência 2007
  const a = lmsPara('peso', 'M', 60)!.M
  const b = lmsPara('peso', 'M', 61)!.M
  assert.ok(Math.abs(lmsPara('peso', 'M', 60.5)!.M - (a + b) / 2) < 1e-12)
})

test('avaliar medida: menino de 12 meses com 9,6 kg fica na mediana', () => {
  const r = avaliarMedida('peso', 'M', 12, 9.6)!
  assert.ok(Math.abs(r.z) < 0.1)
  assert.ok(Math.abs(r.percentil - 50) < 4)
  assert.equal(avaliarMedida('peso', 'M', 12, 0), null)
  assert.equal(avaliarMedida('pc', 'M', 80, 50), null, 'sem tabela, sem conta')
})

test('peso para a idade: faixas do SISVAN 2011', () => {
  assert.equal(classificarPesoIdade(-3.01), 'Muito baixo peso para a idade')
  assert.equal(classificarPesoIdade(-3), 'Baixo peso para a idade')
  assert.equal(classificarPesoIdade(-2.01), 'Baixo peso para a idade')
  assert.equal(classificarPesoIdade(-2), 'Peso adequado para a idade')
  assert.equal(classificarPesoIdade(2), 'Peso adequado para a idade')
  assert.equal(classificarPesoIdade(2.01), 'Peso elevado para a idade')
})

test('idade em meses (dias ÷ 30,4375) e intervalo da curva', () => {
  assert.equal(mesesDeIdade('2025-01-01', '2025-01-01'), 0)
  assert.ok(Math.abs(mesesDeIdade('2025-01-01', '2026-01-01')! - 365 / 30.4375) < 1e-12)
  assert.equal(mesesDeIdade('2025-01-02', '2025-01-01'), null)
  assert.equal(intervaloDaIdade(60), '0-5')
  assert.equal(intervaloDaIdade(60.2), '5-19')
  assert.equal(intervaloDaIdade(null), '0-5')
})

test('IMC e os pares peso + estatura do mesmo dia', () => {
  assert.ok(Math.abs(imc(20, 100)! - 20) < 1e-12)
  assert.equal(imc(20, 0), null)
  const pares = paresImc(
    [{ aferidoEm: '2026-09-01T10:00:00', valor: 20 }, { aferidoEm: '2026-09-01T15:00:00', valor: 21 }, { aferidoEm: '2026-09-02T10:00:00', valor: 22 }],
    [{ aferidoEm: '2026-09-01T11:00:00', valor: 100 }],
  )
  assert.equal(pares.length, 1, 'sem estatura no dia 2, sem IMC')
  assert.ok(Math.abs(pares[0].valor - 21) < 1e-12, 'vale o último peso do dia')
})

test('linhas de escore-z: mês a mês no intervalo, cortadas no fim da pediatria', () => {
  const l = linhaZ('estatura', 'F', '5-19', 0)
  assert.equal(l[0].meses, 61)
  assert.equal(l.at(-1)!.meses, 168)
  assert.equal(linhaZ('pc', 'M', '5-19', 0).length, 0)
  assert.equal(linhaZ('peso', 'M', '5-19', 0).at(-1)!.meses, 120)
  assert.deepEqual(INDICADORES.map((i) => i.id), ['peso', 'estatura', 'imc', 'pc'])
})

test('só pediatria, com o motivo quando não se aplica', () => {
  assert.equal(motivoSemCurva('2020-05-05', 'F', '2026-09-29'), null)
  assert.match(motivoSemCurva(null, 'F', '2026-09-29')!, /data de nascimento/)
  assert.match(motivoSemCurva('2020-05-05', null, '2026-09-29')!, /Sexo não registrado/)
  // 13 anos, 11 meses e 29 dias ainda é pediatria; com 14 completos, adulto
  assert.equal(motivoSemCurva('2012-09-30', 'M', '2026-09-29'), null)
  assert.match(motivoSemCurva('2012-09-29', 'M', '2026-09-29')!, /14 anos ou mais/)
  assert.equal(sexoDaTabela('Masculino'), 'M')
  assert.equal(sexoDaTabela('f'), 'F')
  assert.equal(sexoDaTabela('I'), null)
})

test('ficha: pediátrica, com fonte pediátrica declarada', () => {
  assert.ok(temReferenciaPediatrica(fichaCurvaCrescimento))
})
