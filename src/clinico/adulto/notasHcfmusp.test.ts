// Lote 1 da revisão do HCFMUSP (decisão do RT de 13/11/2026, L1–L3 = A).
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { NOTAS_HCFMUSP, NOTAS_HCFMUSP_LOTE1, NOTAS_HCFMUSP_LOTE2, textoNota } from './notasHcfmusp.ts'
import { DIRETRIZ_DPOC_GOLD_2026, GINA_ITENS } from './asmaDpoc.ts'
import { DBHA_2025_ALVOS, DIFERENCAS_EH_2025, DIRETRIZ_AORTA_2024 } from './emergenciaHipertensiva.ts'
import { DIFERENCAS_FA_2024, DOSES_FA_2024 } from './fibrilacaoAtrial.ts'
import { DIFERENCAS_BRADI_2025, DIRETRIZ_TAQUI_2025 } from './pcr.ts'
import { DIRETRIZ_ICA_2026 } from './insuficienciaCardiacaAguda.ts'
import { AHA_TEP_2026, DIRETRIZ_TEP_2026 } from './tep2026.ts'
import { DIVERGENCIA_MANUAL_HC } from '../hiperpotassemia.ts'
import { DIFERENCAS_2024 } from './glicemia.ts'
import { DIRETRIZ_AVC_2026 } from './avcTrombolise.ts'

test('oito notas cobrem os 12 capítulos do lote 1, com ids únicos e versão', () => {
  assert.equal(NOTAS_HCFMUSP_LOTE1.length, 8)
  const ids = NOTAS_HCFMUSP_LOTE1.map((n) => n.ficha.id)
  assert.equal(new Set(ids).size, ids.length)
  const caps = NOTAS_HCFMUSP_LOTE1.map((n) => n.capitulos).join(' ')
  for (const c of [2, 4, 6, 7, 11, 13, 14, 38, 64, 97, 98, 99]) assert.match(caps, new RegExp(`cap\\. ${c}\\b`), `cap. ${c}`)
  for (const n of NOTAS_HCFMUSP_LOTE1) {
    assert.match(n.ficha.versao, /^2026-11-13\.[12]$/)
    assert.equal(n.ficha.publico, 'adulto')
    assert.ok(n.itens.length > 0, n.ficha.id)
  }
})

test('as fontes da nota são as diretrizes, nunca o próprio manual', () => {
  for (const n of NOTAS_HCFMUSP_LOTE1) {
    assert.ok(n.ficha.fontes.length > 0, n.ficha.id)
    for (const f of n.ficha.fontes) assert.doesNotMatch(f.citacao, /Manual de Medicina de Emergência/, n.ficha.id)
  }
})

test('os itens vêm das listas das fichas, sem texto novo', () => {
  const cad = NOTAS_HCFMUSP_LOTE1.find((n) => n.ficha.id === 'nota-hcfmusp-cap64-cad-ehh')!
  assert.equal(cad.itens.length, DIFERENCAS_2024.length)
  for (const [i, d] of DIFERENCAS_2024.entries()) {
    assert.ok(cad.itens[i].diretriz.includes(d.consenso))
    assert.equal(cad.itens[i].manual, d.manual)
  }
  const avc = NOTAS_HCFMUSP_LOTE1.find((n) => n.ficha.id === 'nota-hcfmusp-cap38-avc')!
  assert.equal(avc.itens.length, DIRETRIZ_AVC_2026.length)
})

test('lote 2: dez notas (cap. 15, 17, 18, 19, 20, 21, 30, 31, 32 e 67), itens das listas das fichas, só adulto', () => {
  assert.equal(NOTAS_HCFMUSP_LOTE2.length, 10)
  assert.equal(NOTAS_HCFMUSP.length, NOTAS_HCFMUSP_LOTE1.length + 10)
  const ids = NOTAS_HCFMUSP.map((n) => n.ficha.id)
  assert.equal(new Set(ids).size, ids.length)
  const caps = NOTAS_HCFMUSP_LOTE2.map((n) => n.capitulos).join(' ')
  for (const c of [15, 17, 18, 19, 20, 21, 30, 31, 32, 67]) assert.match(caps, new RegExp(`cap\\. ${c}\\b`), `cap. ${c}`)
  const porId = (id: string) => NOTAS_HCFMUSP_LOTE2.find((n) => n.ficha.id === id)!
  assert.equal(porId('nota-hcfmusp-cap15-bradiarritmias').itens.length, DIFERENCAS_BRADI_2025.length)
  assert.equal(porId('nota-hcfmusp-cap17-fa').itens.length, DIFERENCAS_FA_2024.length + DOSES_FA_2024.length)
  assert.equal(porId('nota-hcfmusp-cap18-taquiarritmias').itens.length, DIRETRIZ_TAQUI_2025.length)
  assert.equal(porId('nota-hcfmusp-cap19-emergencia-hipertensiva').itens.length, DBHA_2025_ALVOS.length + DIFERENCAS_EH_2025.length)
  assert.equal(porId('nota-hcfmusp-cap30-asma').itens.length, GINA_ITENS.length)
  assert.equal(porId('nota-hcfmusp-cap21-ic-aguda').itens.length, DIRETRIZ_ICA_2026.length)
  assert.equal(porId('nota-hcfmusp-cap20-sindrome-aortica').itens.length, DIRETRIZ_AORTA_2024.length)
  assert.equal(porId('nota-hcfmusp-cap31-dpoc').itens.length, DIRETRIZ_DPOC_GOLD_2026.length)
  assert.equal(porId('nota-hcfmusp-cap32-tep').itens.length, DIRETRIZ_TEP_2026.length)
  const hiperK = porId('nota-hcfmusp-cap67-hiperpotassemia')
  assert.equal(hiperK.itens.length, DIVERGENCIA_MANUAL_HC.diferencas.length)
  for (const n of NOTAS_HCFMUSP_LOTE2) {
    assert.equal(n.ficha.publico, 'adulto')
    assert.match(n.ficha.revisadoEm ?? '', /lote 2/)
    for (const f of n.ficha.fontes) {
      assert.ok(!f.pediatrica, `${n.ficha.id}: fonte pediátrica`)
      assert.doesNotMatch(f.citacao, /Manual de Medicina de Emergência/, n.ficha.id)
    }
    for (const i of n.itens) assert.doesNotMatch(i.diretriz, /esta tela/, n.ficha.id)
  }
})

test('o texto da nota diz que o manual é de 2022 e que vale a diretriz mais recente', () => {
  const t = textoNota(NOTAS_HCFMUSP_LOTE1[0], '/plantonista/x')
  assert.match(t, /3ª ed\., 2022/)
  assert.match(t, /vale a diretriz mais recente/)
  assert.match(t, /Diretriz atual: /)
  assert.match(t, /Manual de 2022: /)
  assert.doesNotMatch(t, /\.\./)
})

test('DPOC: GOLD 2026 ao lado do manual; doses e conta da gasometria seguem o manual', async () => {
  const m = await import('./asmaDpoc.ts')
  assert.equal(m.fichaDpocAdulto.versao, '2026-11-13.1')
  assert.ok(m.fichaDpocAdulto.fontes.includes(m.GOLD_2026))
  assert.ok(m.fichaDpocAdulto.fontes.some((f) => /Manual de Medicina de Emergência/.test(f.citacao)))
  for (const d of m.DIRETRIZ_DPOC_GOLD_2026) assert.match(d.onde, /^p\. \d+/, d.tema)
  const vni = m.DIRETRIZ_DPOC_GOLD_2026.find((d) => d.tema === 'Indicação de VNI')!
  assert.match(vni.gold, /PaCO2 ≥ 45 mmHg e pH ≤ 7,35/)
  // a conta continua a do livro: PaCO2 50 com pH 7,30 não indica VNI pela Tabela 6
  assert.deepEqual(m.lerGasometriaDpoc({ paco2: 50, ph: 7.3 }).vni, [])
  assert.ok(m.DROGAS_DPOC.some((d) => d.id === 'prednisona' && /40 mg VO por 5 dias/.test(d.texto)))
})

test('TEP: AHA/ACC 2026 nas fichas de PERC, HESTIA, PESI e fibrinolíticos, sem dose nova e sem entrar na nota da SCA', async () => {
  const { perc, hestia } = await import('./tepPac.ts')
  const { pesi } = await import('./pesi.ts')
  const { fichaFibrinoliticosAdulto, ALTEPLASE_TEP } = await import('./anticoagulacao.ts')
  for (const f of [perc.ficha, hestia.ficha, pesi.ficha, fichaFibrinoliticosAdulto]) {
    assert.equal(f.versao, '2026-11-14.1', f.id)
    assert.ok(f.fontes.includes(AHA_TEP_2026), f.id)
    assert.ok(f.fontes.some((x) => /Manual de Medicina de Emergência/.test(x.citacao)), f.id)
  }
  assert.match(AHA_TEP_2026.citacao, /PMID 41712677/)
  assert.equal(AHA_TEP_2026.url, 'https://doi.org/10.1161/CIR.0000000000001415')
  for (const d of DIRETRIZ_TEP_2026) assert.doesNotMatch(d.aha, /\d+ ?mg\b/, `${d.tema}: dose não vem da diretriz`)
  assert.equal(ALTEPLASE_TEP.preferivel.mg, 100)
  const sca = NOTAS_HCFMUSP_LOTE1.find((n) => n.ficha.id === 'nota-hcfmusp-cap13-14-sca')!
  assert.ok(!sca.ficha.fontes.includes(AHA_TEP_2026))
  const tep = NOTAS_HCFMUSP.find((n) => n.ficha.id === 'nota-hcfmusp-cap32-tep')!
  assert.equal(tep.ficha.versao, '2026-11-14.1')
  assert.deepEqual(tep.ficha.fontes, [AHA_TEP_2026])
test('taquiarritmias: AHA 2025 ao lado do manual; doses do manual não mudam', async () => {
  const m = await import('./pcr.ts')
  assert.equal(m.fichaTaquiarritmiaAdulto.versao, '2026-11-14.1')
  assert.ok(m.fichaTaquiarritmiaAdulto.fontes.includes(m.AHA_ALS_2025_TAQUI))
  assert.ok(m.fichaTaquiarritmiaAdulto.fontes.some((f) => /Manual de Medicina de Emergência/.test(f.citacao)))
  assert.match(m.AHA_ALS_2025_TAQUI.citacao, /PMID 41122884/)
  assert.deepEqual(m.adenosina(false), [6, 12, 12])
  assert.equal(m.esquemaAmiodarona().fases[0].mg, 150)
  const vc = m.DIRETRIZ_TAQUI_2025.find((d) => d.tema === 'Verapamil e diltiazem no QRS largo')!
  assert.match(vc.classe, /3: dano/)
})
