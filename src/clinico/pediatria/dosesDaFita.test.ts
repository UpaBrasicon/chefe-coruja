import assert from 'node:assert/strict'
import { test } from 'node:test'

import { choquesDoPeso, DOSES_DA_FITA, dosesDoPeso, fichaDosesDaFita, numeroDaDose, pesoDaDose } from './dosesDaFita.ts'

// Doses pela cor e pelo peso (decisões D1–D12 do RT de 17/11/2026).

const perto = (a: number[] | null, b: number[]) => {
  assert.ok(a, "sem valor")
  a.forEach((x, i) => assert.ok(Math.abs(x - b[i]) < 1e-9, `${x} ≠ ${b[i]}`))
}

const doseDe = (id: string, kg: number, meses?: number) => {
  const d = dosesDoPeso(kg, meses).find((x) => x.dose.id === id)
  assert.ok(d, `${id} em ${kg} kg`)
  return d.calculo
}

test('com peso informado, vale o peso; a cor só sem peso (regra do RT)', () => {
  assert.deepEqual(pesoDaDose(23, 'amarelo'), { origem: 'peso', kg: 23 })
  const daCor = pesoDaDose(null, 'rosa')
  assert.equal(daCor.origem, 'cor')
  assert.equal(daCor.origem === 'cor' && daCor.kg, 6.5)
  assert.equal(pesoDaDose(null, null).origem, 'nenhum')
  assert.equal(pesoDaDose(0, null).origem, 'nenhum')
})

test('dose da fonte × peso, nos três pesos, com o máximo da fonte', () => {
  // epinefrina 0,01 mg/kg máx 1 mg, 0,1 mg/mL
  perto(doseDe('fita-epinefrina-iv', 6.5).faixa, [0.065, 0.065])
  perto(doseDe('fita-epinefrina-iv', 6.5).volumeMl, [0.65, 0.65])
  perto(doseDe('fita-epinefrina-iv', 120).faixa, [1, 1])
  // amiodarona 5 mg/kg máx 300
  perto(doseDe('fita-amiodarona', 13).faixa, [65, 65])
  perto(doseDe('fita-amiodarona', 80).faixa, [300, 300])
  // adenosina 0,1 (máx 6) e 0,2 (máx 12)
  perto(doseDe('fita-adenosina-1', 33).faixa, [3.3, 3.3])
  perto(doseDe('fita-adenosina-2', 70).faixa, [12, 12])
  // cálcio 20 mg/kg máx 2 g, 100 mg/mL
  perto(doseDe('fita-cloreto-calcio', 20).faixa, [400, 400])
  perto(doseDe('fita-cloreto-calcio', 20).volumeMl, [4, 4])
})

test('erros do e-book não passam (D1)', () => {
  // atropina: nunca acima de 0,5 mg (e-book: 0,8 a 1,6 mg nas cores maiores)
  for (const kg of [15, 20, 25, 35]) assert.ok(doseDe('fita-atropina', kg).faixa[1] <= 0.5, `atropina ${kg} kg`)
  // atropina sem mínimo (D3): 3 kg → 0,06 mg
  perto(doseDe('fita-atropina', 3).faixa, [0.06, 0.06])
  // glucagon fixo (e-book: 15 a 35 mg)
  perto(doseDe('fita-glucagon-menor20', 13).faixa, [0.5, 0.5])
  perto(doseDe('fita-glucagon-maior20', 35).faixa, [1, 1])
  assert.equal(dosesDoPeso(35).some((d) => d.dose.id === 'fita-glucagon-menor20'), false)
  // cloreto de cálcio no azul (e-book: 1.200 mg)
  perto(doseDe('fita-cloreto-calcio', 20.5).faixa, [410, 410])
})

test('decisões D4–D8', () => {
  const c = choquesDoPeso(10)!
  assert.deepEqual(c.cardioversaoInicial, [5, 10])
  assert.equal(c.cardioversaoSeguinte, 20)
  assert.equal(c.desfibrilacaoPrimeiro, 20)
  assert.equal(c.desfibrilacaoSeguinte, 40)
  assert.equal(choquesDoPeso(0), null)
  perto(doseDe('fita-propofol', 10).faixa, [20, 20])
  perto(doseDe('fita-diazepam-iv', 20).faixa, [3, 4])
  perto(doseDe('fita-diazepam-iv', 80).faixa, [10, 10])
  // fentanil da intubação fica fora (D8)
  assert.equal(DOSES_DA_FITA.some((d) => d.secao === 'intubacao' && d.id.includes('fentanil')), false)
})

test('rodada D10: ondansetrona, salbutamol e gluconato', () => {
  perto(doseDe('fita-ondansetrona-iv', 35).faixa, [5.25, 5.25])
  perto(doseDe('fita-ondansetrona-iv', 70).faixa, [8, 8])
  const vo = (kg: number) => dosesDoPeso(kg).filter((d) => d.dose.id.startsWith('fita-ondansetrona-vo')).map((d) => d.calculo.faixa)
  assert.deepEqual(vo(6), [])
  assert.deepEqual(vo(15), [[2, 2]])
  assert.deepEqual(vo(20), [[4, 4]])
  assert.deepEqual(vo(35), [[6, 8]])
  perto(doseDe('fita-salbutamol-nebulizacao', 13).faixa, [2.5, 5])
  perto(doseDe('fita-gluconato-calcio', 10).faixa, [600, 600])
  perto(doseDe('fita-gluconato-calcio', 10).volumeMl, [6, 6])
  perto(doseDe('fita-gluconato-calcio', 120).faixa, [6000, 6000])
})

test('regra por idade: sem idade, mostra lactente e criança; com idade, só a que vale', () => {
  const ids = (meses?: number) => dosesDoPeso(9, meses, 'intubacao').map((d) => d.dose.id)
  assert.ok(ids().includes('fita-succinilcolina-lactente') && ids().includes('fita-succinilcolina-crianca'))
  assert.ok(ids(8).includes('fita-succinilcolina-lactente') && !ids(8).includes('fita-succinilcolina-crianca'))
  assert.ok(!ids(30).includes('fita-succinilcolina-lactente') && ids(30).includes('fita-succinilcolina-crianca'))
})

test('toda dose tem fonte pediátrica e trecho literal', () => {
  assert.equal(fichaDosesDaFita.publico, 'pediatrico')
  for (const d of DOSES_DA_FITA) {
    assert.ok(d.fontes.length > 0 && d.fontes.every((f) => f.pediatrica), d.id)
    assert.ok(d.trecho.length > 10, d.id)
    if (d.porMl) assert.ok(d.apresentacao, `${d.id}: mL só com a concentração escrita`)
  }
  assert.equal(new Set(DOSES_DA_FITA.map((d) => d.id)).size, DOSES_DA_FITA.length)
})

test('número sem ponto de milhar (D12)', () => {
  assert.equal(numeroDaDose(1200), '1200')
  assert.equal(numeroDaDose(0.065), '0,07')
  assert.equal(numeroDaDose(6.5), '6,5')
})
