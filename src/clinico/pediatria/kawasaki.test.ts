// node --experimental-strip-types --test src/clinico/pediatria/kawasaki.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import {
  AHA_KAWASAKI_2024, DIFERENCAS_KAWASAKI_2024, DOSES_AHA_2024, DOSES_KAWASAKI, altoRiscoAha2024, classificarZ, fichaKawasaki, lerCriterios, lerIncompleta, velocidadeIvigMlH,
} from './kawasaki.ts'

const d = (id: string) => DOSES_KAWASAKI.find((x) => x.id === id)!

test('critérios clássicos e forma incompleta (p. 747–748)', () => {
  assert.equal(temReferenciaPediatrica(fichaKawasaki), true)
  assert.equal(lerCriterios(5, 4, 24)!.classica, true)
  assert.equal(lerCriterios(4, 4, 24)!.quartoDia, true)
  assert.equal(lerCriterios(5, 3, 24)!.incompletaAvaliar, true)
  assert.equal(lerCriterios(7, 0, 4)!.incompletaAvaliar, true)
  assert.equal(lerCriterios(6, 1, 24)!.incompletaAvaliar, false)
  assert.equal(lerCriterios(5, 6, 24), null)
})

test('Figura 1: PCR/VHS e alterações laboratoriais', () => {
  assert.equal(lerIncompleta(2, 30, 5), 'inflamacao-baixa')
  assert.equal(lerIncompleta(3, 30, 3), 'tratar-lab')
  assert.equal(lerIncompleta(1, 40, 2), 'depende-eco')
})

test('Z-score (p. 749–750)', () => {
  assert.equal(classificarZ(1.5), 'normal')
  assert.equal(classificarZ(2.2), 'dilatacao')
  assert.equal(classificarZ(2.5), 'aneurisma-pequeno')
  assert.equal(classificarZ(5), 'aneurisma-medio')
  assert.equal(classificarZ(10), 'aneurisma-gigante')
  assert.equal(classificarZ(6, 9), 'aneurisma-gigante')
  assert.equal(classificarZ(-3), 'abaixo')
})

test('doses (Tabela 1, p. 750–751)', () => {
  assert.deepEqual(calcularDoseLivro(d('ivig'), 12)!.porDose, [24, 24])
  assert.deepEqual(calcularDoseLivro(d('aas-alta'), 12)!.dia, [360, 600])
  assert.deepEqual(calcularDoseLivro(d('aas-baixa'), 12)!.dia, [36, 60])
  assert.deepEqual(calcularDoseLivro(d('aas-baixa'), 30)!.dia, [90, 100])
  assert.deepEqual(calcularDoseLivro(d('metilpred-pulso'), 40)!.porDose, [1000, 1000])
  assert.deepEqual(calcularDoseLivro(d('infliximabe'), 12)!.porDose, [60, 60])
  assert.deepEqual(velocidadeIvigMlH(10), { inicial: 6, maxima: 48 })
})

// ── AHA 2024 (Jone et al., lacunas da Central, lote 3) ──

const aha = (id: string) => DOSES_AHA_2024.find((x) => x.id === id)!

test('Kawasaki: ficha .1 com a AHA 2024 depois do livro do ICr', () => {
  assert.equal(fichaKawasaki.versao, '2026-10-25.1')
  assert.match(fichaKawasaki.fontes[0].citacao, /cap\. 70/)
  assert.equal(fichaKawasaki.fontes.at(-1), AHA_KAWASAKI_2024)
  assert.equal(temReferenciaPediatrica(fichaKawasaki), true)
})
test('AHA 2024: alto risco com idade < 6 meses ou Z ≥ 2,5 no diagnóstico (p. e482)', () => {
  assert.equal(altoRiscoAha2024(5, null).altoRisco, true)
  assert.equal(altoRiscoAha2024(6, 2.4).altoRisco, false)
  assert.equal(altoRiscoAha2024(24, 2.5).altoRisco, true)
  assert.equal(altoRiscoAha2024(null, null).altoRisco, false)
  assert.equal(altoRiscoAha2024(24, 1, true).motivos.length, 1)
  assert.equal(altoRiscoAha2024(3, 3, true).motivos.length, 3)
})
test('AHA 2024, Tabela 3: infliximabe 10 mg/kg (livro 5 mg/kg)', () => {
  assert.deepEqual(calcularDoseLivro(aha('aha-infliximabe'), 20)!.porDose, [200, 200])
  assert.deepEqual(calcularDoseLivro(d('infliximabe'), 20)!.porDose, [100, 100])
})
test('AHA 2024, Tabela 3: corticoides 2 mg/kg/dia com teto de 60 mg/dia', () => {
  const pred = calcularDoseLivro(aha('aha-prednisolona'), 15)!
  assert.deepEqual(pred.dia, [30, 30])
  assert.deepEqual(pred.porDose, [10, 10])
  const teto = calcularDoseLivro(aha('aha-metilpred'), 40)!
  assert.deepEqual(teto.dia, [60, 60])
  assert.deepEqual(teto.porDose, [30, 30])
  assert.equal(teto.noMaximo, true)
})
test('AHA 2024: cada diferença com o livro cita a página da revista', () => {
  for (const x of DIFERENCAS_KAWASAKI_2024) assert.match(x.pagina, /e4\d\d/, x.tema)
})
