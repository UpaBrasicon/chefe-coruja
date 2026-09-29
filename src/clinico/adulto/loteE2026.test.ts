import { test } from 'node:test'
import assert from 'node:assert/strict'

import { cha2ds2va } from '../escores/cha2ds2va.ts'
import { hasBled } from '../escores/hasBled.ts'
import { DIRETRIZ_SCA_2025, alteplaseIam2025, enoxaparinaLitico2025, fichaAnticoagulacaoPlenaAdulto, fichaFibrinoliticosAdulto, hnfLitico2025, tenecteplase2025 } from './anticoagulacao.ts'
import { DBHA_2025_ALVOS, INDISPONIVEIS_BRASIL_DBHA, QUADRO_11_4, esmololDbha2025, fichaEmergenciaHipertensivaAdulto } from './emergenciaHipertensiva.ts'
import { DOSES_FA_2024, TEXTO_JANELA_2024, fichaFibrilacaoAtrialAdulto, janelaFa2024 } from './fibrilacaoAtrial.ts'
import { DIRETRIZ_ICA_2021, ENSAIOS_ICA, fichaIcAgudaAdulto } from './insuficienciaCardiacaAguda.ts'
import { BRADI_2025, fichaBradicardiaAdulto } from './pcr.ts'
import { ESC_2021_MP, fichaMarcaPassoAdulto } from './procedimentos.ts'

// Lote E (cardiologia), 28/09/2026: AHA/ACC 2025 + ESC 2023 + SBC 2025 (SCA),
// ESC 2024 + SBC 2025 (FA), ESC 2021 + ensaios (ICA), DBHA 2025, ERC/RCUK 2025
// (bradicardia), ESC 2021 (marca-passo).

test('lote E: fichas cardio na versão .1 de 28/09 com o manual como primeira fonte', () => {
  const casos: [typeof fichaFibrinoliticosAdulto, RegExp][] = [
    [fichaFibrinoliticosAdulto, /Acute Coronary Syndromes/],
    [fichaAnticoagulacaoPlenaAdulto, /Acute Coronary Syndromes/],
    [fichaFibrilacaoAtrialAdulto, /Fibrilação Atrial – 2025/],
    [fichaIcAgudaAdulto, /2021 ESC Guidelines.*heart failure/],
    [fichaEmergenciaHipertensivaAdulto, /Hipertensão Arterial – 2025/],
    [fichaBradicardiaAdulto, /Adult Advanced Life Support/],
    [fichaMarcaPassoAdulto, /cardiac pacing/],
  ]
  for (const [f, re] of casos) {
    assert.equal(f.versao, '2026-09-28.1', f.id)
    assert.match(f.fontes[0].citacao, /Manual de Medicina de Emergência/, f.id)
    assert.ok(f.fontes.some((x) => re.test(x.citacao)), f.id)
  }
  assert.equal(cha2ds2va.ficha.versao, '2026-09-28.1')
  assert.equal(hasBled.ficha.versao, '2026-09-28.1')
  assert.ok(hasBled.ficha.fontes.some((f) => /2024 ESC/.test(f.citacao)))
})

test('AHA 2025: tenecteplase por faixas fechadas (70 e 80 kg sem ambiguidade) e meia dose > 75 anos', () => {
  assert.equal(tenecteplase2025(59)!.mg, 30)
  assert.equal(tenecteplase2025(60)!.mg, 35)
  assert.equal(tenecteplase2025(70)!.mg, 40)
  assert.equal(tenecteplase2025(80)!.mg, 45)
  assert.equal(tenecteplase2025(89.9)!.mg, 45)
  assert.equal(tenecteplase2025(90)!.mg, 50)
  assert.equal(tenecteplase2025(85, 80)!.mgFinal, 22.5)
  assert.equal(tenecteplase2025(0), null)
})

test('AHA 2025: alteplase com corte em 67 kg e tetos de 50/35 mg', () => {
  assert.equal(alteplaseIam2025(67)!.totalMg, 100)
  const a = alteplaseIam2025(66)!
  assert.deepEqual(a.fases.map((f) => f.mg), [15, 49.5, 33])
  assert.ok(DIRETRIZ_SCA_2025.some((d) => /Tenecteplase/.test(d.tema)))
})

test('AHA 2025: enoxaparina com lítico — tetos de 100/75 mg e ClCr < 30 em qualquer idade; HNF 60 UI/kg máx. 4.000', () => {
  assert.deepEqual(enoxaparinaLitico2025(120, 60), { bolusMg: 30, doseMg: 100, intervalo: '12/12 h SC', noTeto: true, regra: enoxaparinaLitico2025(120, 60)!.regra })
  const idoso = enoxaparinaLitico2025(110, 80)!
  assert.equal(idoso.bolusMg, null)
  assert.equal(idoso.doseMg, 75)
  const renal = enoxaparinaLitico2025(70, 80, 25)!
  assert.equal(renal.doseMg, 70)
  assert.equal(renal.intervalo, '1 vez ao dia SC')
  assert.deepEqual(hnfLitico2025(80), { bolusUi: 4000, bolusNoTeto: true, infusaoUiH: 960, infusaoNoTeto: false })
})

test('ESC 2024 / SBC 2025: janela de 24 h; doses IV das duas diretrizes ao lado do manual', () => {
  assert.equal(janelaFa2024(24), 'ate-24h')
  assert.equal(janelaFa2024(25), 'mais-de-24h-ou-indeterminada')
  assert.equal(janelaFa2024(null), 'mais-de-24h-ou-indeterminada')
  assert.match(TEXTO_JANELA_2024['mais-de-24h-ou-indeterminada'], /3 semanas/)
  const esm = DOSES_FA_2024.find((d) => d.droga === 'Esmolol')!
  assert.match(esm.esc, /50–300/)
  assert.match(esm.sbc, /10–40/)
  assert.match(esm.livro, /50–200/)
})

test('ICA: ESC 2021 O2 só < 90% e sem opioide de rotina; ensaios com números dos resumos', () => {
  assert.match(DIRETRIZ_ICA_2021.find((d) => d.tema === 'Oxigênio')!.esc, /< 90%/)
  assert.match(DIRETRIZ_ICA_2021.find((d) => d.tema === 'Opioide')!.esc, /não recomendado/)
  assert.ok(ENSAIOS_ICA.some((e) => /42,2% × 30,5%/.test(e.texto)))
  assert.ok(ENSAIOS_ICA.some((e) => /46,5% × 17,2%/.test(e.texto)))
})

test('DBHA 2025: SCA PAD 70–80; eclâmpsia até 15 mg; nitroprussiato com errata; esmolol até 300 µg/kg/min; drogas indisponíveis', () => {
  assert.match(DBHA_2025_ALVOS.find((d) => /coronariana/.test(d.tema))!.dbha, /PAD 70–80/)
  assert.match(DBHA_2025_ALVOS.find((d) => /Gestação/.test(d.tema))!.dbha, /até 15 mg/)
  assert.ok(QUADRO_11_4.find((q) => /Nitroprussiato/.test(q.droga))!.errata)
  assert.deepEqual(esmololDbha2025(70), { ataqueMg: 35, manutInicialUgMin: [1750, 3500], maximoUgMin: 21000 })
  assert.ok(INDISPONIVEIS_BRASIL_DBHA.includes('labetalol'))
})

test('ERC/RCUK 2025: atropina 500 µg a cada 3–5 min até 3 mg; AHA 1 mg marcada como não confirmada; ESC 2021 marca-passo I C / IIa C', () => {
  assert.equal(BRADI_2025.atropina.ug, 500)
  assert.deepEqual(BRADI_2025.atropina.intervaloMin, [3, 5])
  assert.match(BRADI_2025.ahaNaoConfirmada, /não confirmado/)
  assert.deepEqual(ESC_2021_MP.map((m) => m.classe).slice(0, 2), ['I C', 'IIa C'])
})
