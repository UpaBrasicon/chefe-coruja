// Lote 1 da revisão do HCFMUSP (decisão do RT de 13/11/2026, L1–L3 = A).
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { NOTAS_HCFMUSP, NOTAS_HCFMUSP_LOTE1, NOTAS_HCFMUSP_LOTE2, NOTAS_HCFMUSP_LOTE3, NOTAS_HCFMUSP_LOTE4, textoNota } from './notasHcfmusp.ts'
import { DIRETRIZ_DPOC_GOLD_2026, GINA_ITENS } from './asmaDpoc.ts'
import { DBHA_2025_ALVOS, DIFERENCAS_EH_2025, DIRETRIZ_AORTA_2024 } from './emergenciaHipertensiva.ts'
import { DIFERENCAS_FA_2024, DOSES_FA_2024 } from './fibrilacaoAtrial.ts'
import { DAS_2025, DIRETRIZ_DAS_2025 } from './isr.ts'
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

test('lote 2: onze notas (cap. 3, 15, 17, 18, 19, 20, 21, 30, 31, 32 e 67), itens das listas das fichas, só adulto', () => {
  assert.equal(NOTAS_HCFMUSP_LOTE2.length, 11)
  assert.equal(NOTAS_HCFMUSP.length, NOTAS_HCFMUSP_LOTE1.length + 11 + NOTAS_HCFMUSP_LOTE3.length + NOTAS_HCFMUSP_LOTE4.length)
  const ids = NOTAS_HCFMUSP.map((n) => n.ficha.id)
  assert.equal(new Set(ids).size, ids.length)
  const caps = NOTAS_HCFMUSP_LOTE2.map((n) => n.capitulos).join(' ')
  for (const c of [3, 15, 17, 18, 19, 20, 21, 30, 31, 32, 67]) assert.match(caps, new RegExp(`cap\\. ${c}\\b`), `cap. ${c}`)
  const porId = (id: string) => NOTAS_HCFMUSP_LOTE2.find((n) => n.ficha.id === id)!
  assert.equal(porId('nota-hcfmusp-cap3-via-aerea').itens.length, DIRETRIZ_DAS_2025.length)
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
})

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

test('via aérea: DAS 2025 ao lado do manual; doses do Anexo 1 não mudam', async () => {
  const m = await import('./isr.ts')
  assert.equal(m.fichaIsrAdulto.versao, '2026-11-14.1')
  assert.ok(m.fichaIsrAdulto.fontes.includes(DAS_2025))
  assert.match(DAS_2025.citacao, /PMID 41203471/)
  const dose = (id: string) => m.DROGAS_ISR.find((d) => d.id === id)!.mgKg
  assert.equal(dose('rocuronio'), 1.2)
  assert.equal(dose('succinilcolina'), 1.5)
  const nota = NOTAS_HCFMUSP.find((n) => n.ficha.id === 'nota-hcfmusp-cap3-via-aerea')!
  assert.deepEqual(nota.ficha.fontes, [DAS_2025])
})

test('lote 3, N1: notas de 33, 40 e 76 a partir das listas das fichas; PAC com a ATS lida e a nota da IDSA', async () => {
  const { DIRETRIZ_PAC_2026, IDSA_PAC_2026, fichaPacAntibioticoAdulto } = await import('./tepPac.ts')
  const { DIRETRIZ_HSA_2023 } = await import('./hsa.ts')
  const { DIFERENCAS_AGITACAO_2024 } = await import('./agitacao.ts')
  assert.ok(NOTAS_HCFMUSP_LOTE3.length >= 3)
  assert.equal(NOTAS_HCFMUSP.length, NOTAS_HCFMUSP_LOTE1.length + NOTAS_HCFMUSP_LOTE2.length + NOTAS_HCFMUSP_LOTE3.length + NOTAS_HCFMUSP_LOTE4.length)
  const ids = NOTAS_HCFMUSP.map((n) => n.ficha.id)
  assert.equal(new Set(ids).size, ids.length)
  const por = (id: string) => NOTAS_HCFMUSP_LOTE3.find((n) => n.ficha.id === id)!
  assert.equal(por('nota-hcfmusp-cap33-pac').itens.length, DIRETRIZ_PAC_2026.length + 1)
  assert.equal(por('nota-hcfmusp-cap40-hsa').itens.length, DIRETRIZ_HSA_2023.length + 2)
  assert.equal(por('nota-hcfmusp-cap76-agitacao').itens.length, 2 + DIFERENCAS_AGITACAO_2024.length)
  for (const n of NOTAS_HCFMUSP_LOTE3) {
    assert.equal(n.ficha.versao, '2026-11-14.1')
    assert.equal(n.ficha.publico, 'adulto')
    assert.match(n.ficha.revisadoEm ?? '', /lote 3/)
    for (const f of n.ficha.fontes) assert.doesNotMatch(f.citacao, /Manual de Medicina de Emergência/, n.ficha.id)
  }
  assert.equal(fichaPacAntibioticoAdulto.versao, '2026-11-14.1')
  assert.ok(fichaPacAntibioticoAdulto.fontes.includes(IDSA_PAC_2026))
  assert.ok(por('nota-hcfmusp-cap33-pac').ficha.fontes.includes(IDSA_PAC_2026))
  assert.ok(DIRETRIZ_PAC_2026.some((d) => d.tema === 'Internado com vírus respiratório positivo'))
})

test('HIC (cap. 39): ESO/EANS 2025 ao lado do manual; doses do manual iguais', async () => {
  const m = await import('./reversaoAnticoagulacao.ts')
  assert.equal(m.fichaReversaoAnticoagulacaoAdulto.versao, '2026-11-14.1')
  assert.ok(m.fichaReversaoAnticoagulacaoAdulto.fontes.includes(m.ESO_HIC_2025))
  assert.match(m.ESO_HIC_2025.citacao, /PMID 40401775/)
  const pa = m.DIRETRIZ_HIC_ESO_2025.find((d) => d.tema === 'Pressão arterial')!
  assert.match(pa.eso, /< 140 mmHg/)
  assert.match(pa.eso, /110 mmHg/)
  const nota = NOTAS_HCFMUSP_LOTE3.find((n) => n.ficha.id === 'nota-hcfmusp-cap39-hic')!
  assert.equal(nota.itens.length, m.DIRETRIZ_HIC_ESO_2025.length)
  assert.deepEqual(nota.ficha.fontes, [m.ESO_HIC_2025])
  assert.equal(m.HIP_METAS[0].pagina, 'p. 547')
})

test('neuroinfecção (cap. 43): ESCMID 2016 e EAN–ESCMID 2026 ao lado do manual; doses do manual iguais', async () => {
  const m = await import('./meningite.ts')
  assert.equal(m.fichaMeningiteAdulto.versao, '2026-11-14.1')
  for (const f of [m.ESCMID_MENINGITE_2016, m.EAN_ESCMID_ENCEFALITE_2026, m.GUIA_VIGILANCIA_2024]) assert.ok(m.fichaMeningiteAdulto.fontes.includes(f))
  assert.match(m.ESCMID_MENINGITE_2016.citacao, /PMID 27062097/)
  assert.match(m.EAN_ESCMID_ENCEFALITE_2026.citacao, /PMID 42851210/)
  assert.ok(m.TABELA2_MENINGITE.some((e) => /dexametasona 0,15 mg\/kg/.test(e.corticoide)))
  const nota = NOTAS_HCFMUSP_LOTE3.find((n) => n.ficha.id === 'nota-hcfmusp-cap43-neuroinfeccao')!
  assert.equal(nota.itens.length, m.DIRETRIZ_MENINGITE.length)
  assert.deepEqual(nota.ficha.fontes, [m.ESCMID_MENINGITE_2016, m.EAN_ESCMID_ENCEFALITE_2026])
})

test('HDA (cap. 50): ESGE 2026 e Baveno VIII ao lado do manual; doses do manual iguais', async () => {
  const h = await import('./hemorragiaDigestiva.ts')
  assert.equal(h.fichaHemorragiaDigestiva.versao, '2026-11-14.1')
  for (const f of [h.ESGE_UGIH_2026, h.BAVENO_VIII_2026]) assert.ok(h.fichaHemorragiaDigestiva.fontes.includes(f))
  assert.match(h.BAVENO_VIII_2026.citacao, /PMID 42624290/)
  assert.equal(h.ERITROMICINA_EDA.mgKg, 3)
  assert.equal(h.OMEPRAZOL_HDA.infusaoMgH, 8)
  assert.ok(h.DIRETRIZ_HDA.some((d) => d.fonte === 'Baveno VIII' && /TIPS/.test(d.tema)))
  const nota = NOTAS_HCFMUSP_LOTE3.find((n) => n.ficha.id === 'nota-hcfmusp-cap50-hda')!
  assert.equal(nota.itens.length, h.DIRETRIZ_HDA.length)
  assert.deepEqual(nota.ficha.fontes, [h.ESGE_UGIH_2026, h.BAVENO_VIII_2026])
})

test('sódio (cap. 66): europeia 2014 e ERA 2024 ao lado do manual; contas do manual iguais', async () => {
  const s = await import('./sodio.ts')
  assert.equal(s.fichaHiponatremia.versao, '2026-11-14.1')
  for (const f of [s.EUROPEIA_HIPONATREMIA_2014, s.ERA_HIPONATREMIA_2024, s.META_CORRECAO_HIPONATREMIA_2025]) assert.ok(s.fichaHiponatremia.fontes.includes(f))
  assert.match(s.EUROPEIA_HIPONATREMIA_2014.citacao, /PMID 24569125/)
  assert.match(s.ERA_HIPONATREMIA_2024.citacao, /sem graduação/)
  assert.equal(s.LIMITES_HIPONATREMIA.cronicaMax24h, 8)
  assert.equal(s.LIMITES_HIPONATREMIA.bolusMl, 100)
  const nota = NOTAS_HCFMUSP_LOTE3.find((n) => n.ficha.id === 'nota-hcfmusp-cap66-sodio')!
  assert.equal(nota.itens.length, s.DIRETRIZ_HIPONATREMIA.length)
  assert.deepEqual(nota.ficha.fontes, [s.EUROPEIA_HIPONATREMIA_2014, s.ERA_HIPONATREMIA_2024])
})

test('trauma (cap. 47): europeia 2023 e EAST 2025 ao lado do manual; contas do manual iguais', async () => {
  const tr = await import('./trauma.ts')
  assert.equal(tr.fichaTraumaAdulto.versao, '2026-11-14.1')
  for (const f of [tr.EUROPEIA_SANGRAMENTO_TRAUMA_2023, tr.EAST_TXA_2025, tr.UK_REBOA_2023]) assert.ok(tr.fichaTraumaAdulto.fontes.includes(f))
  assert.match(tr.EUROPEIA_SANGRAMENTO_TRAUMA_2023.citacao, /PMID 36859355/)
  assert.match(tr.EAST_TXA_2025.citacao, /resumo/)
  assert.equal(tr.TXA_TRAUMA.bolusG, 1)
  assert.equal(tr.TXA_TRAUMA.janelaH, 3)
  const nota = NOTAS_HCFMUSP_LOTE3.find((n) => n.ficha.id === 'nota-hcfmusp-cap47-trauma')!
  assert.equal(nota.itens.length, tr.DIRETRIZ_TRAUMA.length)
  assert.deepEqual(nota.ficha.fontes, [tr.EUROPEIA_SANGRAMENTO_TRAUMA_2023, tr.EAST_TXA_2025])
})

test('hipoglicemia (cap. 65): ADA 2026 e Endocrine 2023 ao lado do manual; doses do manual iguais', async () => {
  const g = await import('./glicemia.ts')
  assert.equal(g.fichaHipoglicemia.versao, '2026-11-14.1')
  for (const f of [g.ADA_HIPOGLICEMIA_2026, g.ENDOCRINE_HIPOGLICEMIA_2023]) assert.ok(g.fichaHipoglicemia.fontes.includes(f))
  assert.match(g.ADA_HIPOGLICEMIA_2026.citacao, /PMID 41358894/)
  assert.deepEqual(g.HIPOGLICEMIA_DOSES.glicose50Ml, [60, 100])
  assert.deepEqual(g.HIPOGLICEMIA_DOSES.glucagonMg, [1, 2])
  const nota = NOTAS_HCFMUSP_LOTE3.find((n) => n.ficha.id === 'nota-hcfmusp-cap65-hipoglicemia')!
  assert.equal(nota.itens.length, g.DIRETRIZ_HIPOGLICEMIA.length)
  assert.deepEqual(nota.ficha.fontes, [g.ADA_HIPOGLICEMIA_2026, g.ENDOCRINE_HIPOGLICEMIA_2023])
})

test('neutropenia febril (cap. 81): ABHH 2024 e MASCC 2026 ao lado do manual; doses do manual iguais', async () => {
  const n = await import('./neutropeniaFebril.ts')
  assert.equal(n.fichaNeutropeniaFebrilAdulto.versao, '2026-11-14.1')
  for (const f of [n.ABHH_NF_2024, n.MASCC_2026]) assert.ok(n.fichaNeutropeniaFebrilAdulto.fontes.includes(f))
  assert.match(n.ABHH_NF_2024.citacao, /PMID 39694764/)
  assert.equal(n.ANTIFUNGICOS_NF.caspofungina.ataqueMg, 70)
  assert.ok(n.ATB_ALTO_RISCO.some((a) => a.nome === 'Cefepime' && a.dose.startsWith('2 g')))
  const nota = NOTAS_HCFMUSP_LOTE3.find((x) => x.ficha.id === 'nota-hcfmusp-cap81-neutropenia')!
  assert.equal(nota.itens.length, n.DIRETRIZ_NF.length)
  assert.deepEqual(nota.ficha.fontes, [n.ABHH_NF_2024, n.MASCC_2026])
})

test('abstinência alcoólica (cap. 78): BAP 2026 ao lado do manual; doses do manual iguais', async () => {
  const a = await import('./abstinenciaAlcoolica.ts')
  assert.equal(a.fichaAbstinenciaAlcoolica.versao, '2026-11-14.1')
  assert.match(a.BAP_SUBSTANCIAS_2026.citacao, /PMC13222391/)
  assert.ok(a.DOSES_ABSTINENCIA.some((d) => d.id === 'tiamina-im'))
  const nota = NOTAS_HCFMUSP_LOTE3.find((x) => x.ficha.id === 'nota-hcfmusp-cap78-abstinencia')!
  assert.equal(nota.itens.length, a.DIRETRIZ_SAA.length)
  assert.deepEqual(nota.ficha.fontes, [a.BAP_SUBSTANCIAS_2026])
})

test('TVP (cap. 25): ASH 2020 ao lado do manual; a nota da SCA não herda a fonte nova', async () => {
  const v = await import('./tvp2026.ts')
  const ac = await import('./anticoagulacao.ts')
  assert.equal(ac.fichaAnticoagulacaoPlenaAdulto.versao, '2026-11-14.1')
  assert.ok(ac.fichaAnticoagulacaoPlenaAdulto.fontes.includes(v.ASH_TEV_2020))
  assert.match(v.ASH_TEV_2020.citacao, /PMID 33007077\)/)
  const nota = NOTAS_HCFMUSP_LOTE3.find((x) => x.ficha.id === 'nota-hcfmusp-cap25-tvp')!
  assert.equal(nota.itens.length, v.DIRETRIZ_TVP.length)
  assert.deepEqual(nota.ficha.fontes, [v.ASH_TEV_2020])
  for (const n of NOTAS_HCFMUSP) if (n !== nota) assert.ok(!n.ficha.fontes.includes(v.ASH_TEV_2020), n.ficha.id)
})

test('lote 4, O1: nota do cap. 37 (VM) a partir da lista da ficha da SDRA, sem fonte do manual', async () => {
  const vm = await import('./ventilacaoMecanica.ts')
  const nota = NOTAS_HCFMUSP_LOTE4.find((n) => n.ficha.id === 'nota-hcfmusp-cap37-vm')!
  assert.equal(nota.ficha.versao, '2026-11-14.1')
  assert.equal(nota.ficha.publico, 'adulto')
  assert.match(nota.ficha.revisadoEm ?? '', /lote 4/)
  assert.equal(nota.itens.length, vm.DIRETRIZ_SDRA_2024.length + 3)
  assert.ok(nota.ficha.fontes.every((f) => !/Manual de Medicina de Emergência/.test(f.citacao)))
  assert.ok(nota.ficha.fontes.includes(vm.SCCM_BNM_2026))
})

test('insuficiência adrenal (cap. 72): três fontes ao lado do manual; doses do manual iguais', async () => {
  const e = await import('./endocrino.ts')
  assert.equal(e.fichaInsuficienciaAdrenal.versao, '2026-11-14.1')
  for (const f of [e.ES_IA_PRIMARIA_2016, e.SFE_CRISE_ADRENAL_2016, e.ESE_ES_IA_GLICOCORTICOIDE_2024]) assert.ok(e.fichaInsuficienciaAdrenal.fontes.includes(f))
  assert.equal(e.CRISE_ADRENAL.hidrocortisonaAtaqueMg, 100)
  assert.deepEqual(e.CRISE_ADRENAL.hidrocortisonaManutencaoMg, [50, 100])
  const nota = NOTAS_HCFMUSP_LOTE4.find((x) => x.ficha.id === 'nota-hcfmusp-cap72-adrenal')!
  assert.equal(nota.itens.length, e.DIRETRIZ_IA.length)
  assert.deepEqual(nota.ficha.fontes, [e.ES_IA_PRIMARIA_2016, e.SFE_CRISE_ADRENAL_2016, e.ESE_ES_IA_GLICOCORTICOIDE_2024])
})

test('crise tireotóxica (cap. 70): consenso ETA/BTA/SfE 2026 ao lado do manual; doses do manual iguais', async () => {
  const e = await import('./endocrino.ts')
  assert.equal(e.fichaCriseTireotoxica.versao, '2026-11-14.1')
  assert.ok(e.fichaCriseTireotoxica.fontes.includes(e.ETA_TEMPESTADE_2026))
  assert.match(e.ETA_TEMPESTADE_2026.citacao, /sem graduação/)
  assert.ok(e.DROGAS_CRISE_TIREOTOXICA.some((d) => d.droga === 'Metimazol' && /20 mg/.test(d.texto)))
  const nota = NOTAS_HCFMUSP_LOTE4.find((x) => x.ficha.id === 'nota-hcfmusp-cap70-tireotoxica')!
  assert.equal(nota.itens.length, e.DIRETRIZ_TT.length)
  assert.deepEqual(nota.ficha.fontes, [e.ETA_TEMPESTADE_2026])
})

test('cálcio (cap. 68): Endocrine Society 2023 e SfE 2016 ao lado do manual; doses do manual iguais', async () => {
  const e = await import('./eletrolitos.ts')
  assert.equal(e.fichaHipercalcemia.versao, '2026-11-14.1')
  assert.equal(e.fichaReposicaoCalcio.versao, '2026-11-14.1')
  assert.ok(e.fichaHipercalcemia.fontes.includes(e.ES_HIPERCALCEMIA_MALIGNIDADE_2023))
  assert.ok(e.fichaReposicaoCalcio.fontes.includes(e.SFE_HIPOCALCEMIA_2016))
  assert.equal(e.INFUSAO_CALCIO.gluconatoMl, 110)
  const nota = NOTAS_HCFMUSP_LOTE4.find((x) => x.ficha.id === 'nota-hcfmusp-cap68-calcio')!
  assert.equal(nota.itens.length, e.DIRETRIZ_CALCIO.length)
  assert.ok(nota.itens.some((i) => i.tema.startsWith('Hipocalcemia')))
})

test('lise tumoral (cap. 84): BSH 2025 ao lado do manual; doses do manual iguais', async () => {
  const s = await import('./liseTumoral.ts')
  assert.equal(s.fichaLiseTumoralAdulto.versao, '2026-11-14.1')
  assert.ok(s.fichaLiseTumoralAdulto.fontes.includes(s.BSH_SLT_2025))
  assert.deepEqual(s.RASBURICASE_SLT.mgKg, [0.15, 0.2])
  const nota = NOTAS_HCFMUSP_LOTE4.find((x) => x.ficha.id === 'nota-hcfmusp-cap84-lise-tumoral')!
  assert.equal(nota.itens.length, s.DIRETRIZ_SLT.length)
  assert.deepEqual(nota.ficha.fontes, [s.BSH_SLT_2025])
})

test('PBE e SHR (cap. 57 e 58): AASLD 2021 e ADQI-ICA 2024 ao lado do manual; doses do manual iguais', async () => {
  const h = await import('./hepatopata.ts')
  assert.equal(h.fichaAsciteShr.versao, '2026-11-14.1')
  assert.ok(h.fichaAsciteShr.fontes.includes(h.AASLD_ASCITE_2021))
  assert.equal(h.ALBUMINA_PBE.d1GKg, 1.5)
  assert.equal(h.TERLIPRESSINA_SHR.maxMgDia, 12)
  const nota = NOTAS_HCFMUSP_LOTE4.find((x) => x.ficha.id === 'nota-hcfmusp-cap57-58-pbe-shr')!
  assert.equal(nota.itens.length, h.DIRETRIZ_PBE_SHR.length)
  assert.deepEqual(nota.ficha.fontes, [h.AASLD_ASCITE_2021, h.ADQI_ICA_2024])
})

test('encefalopatia hepática (cap. 59): ACG 2026 ao lado do manual; doses do manual iguais', async () => {
  const h = await import('./hepatopata.ts')
  assert.equal(h.fichaInsuficienciaHepatica.versao, '2026-11-14.1')
  assert.ok(h.fichaInsuficienciaHepatica.fontes.includes(h.ACG_EH_2026))
  assert.deepEqual(h.lactuloseMlDia(), [60, 240])
  assert.deepEqual(h.DIETA_EH.proteinaTabelaGKg, [1.2, 1.5])
  const nota = NOTAS_HCFMUSP_LOTE4.find((x) => x.ficha.id === 'nota-hcfmusp-cap59-encefalopatia')!
  assert.equal(nota.itens.length, h.DIRETRIZ_EH.length)
  assert.deepEqual(nota.ficha.fontes, [h.ACG_EH_2026])
})

test('endocardite (cap. 23): ESC 2023 ao lado do manual; Duke-ISCVID igual', async () => {
  const d = await import('./duke.ts')
  assert.equal(d.duke.ficha.versao, '2026-11-14.1')
  assert.ok(d.duke.ficha.fontes.includes(d.ESC_EI_2023))
  assert.equal(d.preencheDuke(1, 3), true)
  assert.equal(d.possivelDuke(1, 1), true)
  const nota = NOTAS_HCFMUSP_LOTE4.find((x) => x.ficha.id === 'nota-hcfmusp-cap23-endocardite')!
  assert.equal(nota.itens.length, d.DIRETRIZ_EI.length)
  assert.deepEqual(nota.ficha.fontes, [d.ESC_EI_2023])
})

test('LRA (cap. 61): KDIGO 2012 ao lado do manual; contas do manual iguais', async () => {
  const r = await import('./renal.ts')
  assert.equal(r.fichaLesaoRenalAguda.versao, '2026-11-14.2')
  assert.match(r.DIRETRIZ_LRA[0].diretriz, /rascunho de consulta pública/)
  assert.ok(r.fichaLesaoRenalAguda.fontes.includes(r.KDIGO_LRA_2012))
  assert.equal(r.kdigo({ crBasal: 1, crAtual: 2 }).estadio, 2)
  assert.equal(r.furosemidaEstresse(70, false), 70)
  const nota = NOTAS_HCFMUSP_LOTE4.find((x) => x.ficha.id === 'nota-hcfmusp-cap61-lra')!
  assert.equal(nota.itens.length, r.DIRETRIZ_LRA.length)
  assert.deepEqual(nota.ficha.fontes, [r.KDIGO_LRA_2012])
})

test('cap. 22 e 45 (O3): nota só com o capítulo do manual, sem ficha da Central', () => {
  for (const id of ['nota-hcfmusp-cap22-pericardite-miocardite', 'nota-hcfmusp-cap45-primeira-crise']) {
    const n = NOTAS_HCFMUSP_LOTE4.find((x) => x.ficha.id === id)!
    assert.equal(n.fichaCentral, '')
    assert.match(n.ficha.versao, /^2026-11-14\.[12]$/)
    assert.ok(n.ficha.fontes.length >= 1)
    for (const i of n.itens) assert.ok(i.diretriz.length > 0 && i.manual.length > 0, i.tema)
  }
  const n45 = NOTAS_HCFMUSP_LOTE4.find((x) => x.ficha.id === 'nota-hcfmusp-cap45-primeira-crise')!
  assert.equal(n45.ficha.fontes.length, 2)
  assert.equal(n45.ficha.versao, '2026-11-14.2')
  assert.match(textoNota(n45), /ACEP 2024 \(nível A\)/)
  assert.doesNotMatch(textoNota(n45), /CAPTCHA/)
})
