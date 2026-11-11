// node --experimental-strip-types --test src/clinico/adulto/intoxicacoesAha.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import * as m from './intoxicacoes.ts'

// Conferência dose por dose com a AHA 2023 e 2025 (decisão do RT, 11/11/2026):
// D2–D11 como nota de divergência, L1/L3/L6/L7/L9/L11 como nota; D1 sem
// mudança; nenhuma dose do livro muda.
const tela = readFileSync('src/pages/plantonista/manual/IntoxicacoesAntidotosAdulto.tsx', 'utf8')

test('AHA: ficha em versão nova, com as duas diretrizes nas fontes', () => {
  assert.ok(m.fichaIntoxicacoesAdulto.versao >= '2026-11-11.2')
  assert.ok(m.fichaIntoxicacoesAdulto.fontes.includes(m.AHA_INTOX_2023))
  assert.ok(m.fichaIntoxicacoesAdulto.fontes.includes(m.AHA_ESPECIAIS_2025))
})

test('AHA: cada nota aparece na tela', () => {
  for (const chave of Object.keys(m.NOTAS_AHA)) {
    if (chave === 'bicarbonatoTriciclico') continue
    assert.match(tela, new RegExp(`NOTAS_AHA\\.${chave}\\b`), chave)
  }
  assert.equal(m.BICARBONATO_USOS.find((u) => u.id === 'triciclico')!.nota, m.NOTAS_AHA.bicarbonatoTriciclico)
  assert.match(tela, /nota=\{u\.nota\}/)
})

test('AHA: as divergências dizem que a tela segue o livro', () => {
  const n = m.NOTAS_AHA
  for (const nota of [n.bbCalcio, n.bbInsulina, n.bccCalcio, n.bccCalcioFigura, n.bccInsulinaFigura, n.bccEmulsaoFigura, n.digoxina, n.bicarbonatoTriciclico, n.atropinaOrganofosforado, n.pralidoxima]) {
    assert.match(nota, /segue o livro/)
  }
})

test('AHA: valores das notas conferidos no texto completo', () => {
  const n = m.NOTAS_AHA
  assert.match(n.bbCalcio, /60 mL/)
  assert.match(n.bbInsulina, /1 a 10 U\/kg\/h/)
  assert.match(n.bccCalcio, /28 mEq/)
  assert.match(n.bccCalcio, /0,28–0,56 mEq\/kg\/h/)
  assert.match(n.digoxina, /1 frasco para cada 0,5 mg/)
  assert.match(n.digoxina, /Hemodiálise/)
  assert.match(n.bicarbonatoTriciclico, /155 mEq\/L/)
  assert.match(n.bicarbonatoTriciclico, /7,55/)
  assert.match(n.pralidoxima, /2 g EV em 15–30 min/)
  assert.match(n.pralidoxima, /1 g\/h/)
  assert.match(n.organofosforadoIot, /succinilcolina/)
  assert.match(n.cianetoComCo, /tiossulfato sozinho/)
  assert.match(n.flumazenil, /PCR/)
  assert.match(n.naloxonaPcr, /RCP/)
})

test('AHA: as doses do livro não mudam (D1 e D2–D11)', () => {
  assert.deepEqual(m.NALOXONA.cenarios.find((c) => c.id === 'drive')!.mg, [0.04, 0.04])
  assert.equal(m.BETABLOQUEADOR.insulina.infusaoUiKgH, 0.5)
  assert.match(m.BETABLOQUEADOR.calcio.texto, /30 mL/)
  assert.deepEqual(m.BCC.figura.insulinaBolusUiKg, [0.5, 1])
  assert.equal(m.BCC.figura.emulsaoMlKgMin, 0.5)
  assert.equal(m.frascosPorDose(5), 8)
  assert.deepEqual(m.ORGANOFOSFORADO.atropinaInicialMg, [2, 5])
  assert.equal(m.ORGANOFOSFORADO.pralidoxima.bolusMgKg, 30)
  assert.equal(m.ORGANOFOSFORADO.pralidoxima.infusaoMgKgH, 8)
})
