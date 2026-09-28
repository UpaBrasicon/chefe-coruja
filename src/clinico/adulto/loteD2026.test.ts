import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ACEP_2024_RECOMENDACOES, DIFERENCAS_AGITACAO_2024, DOSES_ENSAIOS_ACEP, fichaAgitacaoAdulto } from './agitacao.ts'
import { GINA_ITENS, GINA_TRATAMENTO, fichaAsmaAdulto, fichaDpocAdulto, gravidadeGina } from './asmaDpoc.ts'
import { NOTAS_PADIS_2025, fichaInfusoesAdulto } from './infusoes.ts'
import { DIFERENCAS_RAIVA_2022, PROTOCOLO_RAIVA_2022, SORO_RAIVA, doseSoroRaiva, fichaRaivaAdulto } from './profilaxiaPosExposicao.ts'
import { DIFERENCAS_ULCERA_2024, REVISE, SCCM_ASHP_ITENS, fichaProfilaxiaUlceraEstresse } from './profilaxiaUlceraEstresse.ts'

// Lote D (adulto), 28/09/2026: GINA 2026, ACEP 2024, PADIS 2025, REVISE +
// SCCM/ASHP 2024, Notas Técnicas do MS sobre raiva (2022, 2026).

test('lote D adulto: fichas na versão .1 de 28/09 com o manual como primeira fonte', () => {
  const casos: [typeof fichaAsmaAdulto, RegExp][] = [
    [fichaAsmaAdulto, /Global Initiative for Asthma.*2026/],
    [fichaAgitacaoAdulto, /American College of Emergency Physicians.*Severe Agitation/],
    [fichaInfusoesAdulto, /Focused Update.*Sedation/],
    [fichaProfilaxiaUlceraEstresse, /REVISE/],
    [fichaRaivaAdulto, /Nota Técnica nº 8\/2022/],
  ]
  for (const [f, re] of casos) {
    assert.equal(f.versao, '2026-09-28.1', f.id)
    assert.match(f.fontes[0].citacao, /Manual de Medicina de Emergência/, f.id)
    assert.ok(f.fontes.some((x) => re.test(x.citacao)), f.id)
  }
  assert.equal(fichaDpocAdulto.versao, '2026-09-27.1')
})

test('GINA 2026 (Figura 9): grave por SpO2 < 92, FR > 30, PEF < 50 ou incapacidade; risco de vida se sonolento; moderada PEF 50–70; leve', () => {
  assert.equal(gravidadeGina({ spo2: 90 }).gravidade, 'grave')
  assert.equal(gravidadeGina({ fr: 32, spo2: 95 }).gravidade, 'grave')
  assert.equal(gravidadeGina({ pefPct: 45 }).gravidade, 'grave')
  assert.equal(gravidadeGina({ incapazFalarBeberDeitar: true }).gravidade, 'grave')
  assert.equal(gravidadeGina({ toraxSilente: true }).gravidade, 'grave')
  assert.equal(gravidadeGina({ spo2: 85, sonolentoConfusoCianotico: true }).gravidade, 'risco de vida')
  assert.equal(gravidadeGina({ spo2: 93, pefPct: 60 }).gravidade, 'moderada')
  assert.equal(gravidadeGina({ spo2: 96, pefPct: 80, falaEmFrases: true }).gravidade, 'moderada')
  assert.equal(gravidadeGina({ spo2: 96, pefPct: 80 }).gravidade, 'leve')
  assert.equal(gravidadeGina({}).gravidade, null)
  assert.match(GINA_TRATAMENTO.grave, /6–10 jatos.*92–95%/)
  assert.match(GINA_TRATAMENTO.leve, /4 jatos.*budesonida-formoterol/)
  assert.match(GINA_ITENS.find((i) => i.tema === 'Fenoterol')!.gina, /Não recomendado/)
  assert.match(GINA_ITENS.find((i) => i.tema === 'Corticoide sistêmico')!.gina, /40–50 mg.*5–7 dias/)
})

test('ACEP 2024: nível B droperidol/atípico + midazolam; nível C cetamina por consenso; doses dos ensaios rotuladas como tais', () => {
  assert.match(ACEP_2024_RECOMENDACOES.find((r) => r.nivel === 'B')!.texto, /droperidol \+ midazolam.*antipsicótico atípico/)
  assert.match(ACEP_2024_RECOMENDACOES.find((r) => /C/.test(r.nivel))!.texto, /cetamina/)
  assert.ok(DOSES_ENSAIOS_ACEP.some((d) => d.droga === 'Droperidol' && /5 mg/.test(d.dose)))
  assert.ok(DOSES_ENSAIOS_ACEP.some((d) => d.droga === 'Cetamina' && /3,7 mg\/kg/.test(d.dose)))
  assert.ok(DIFERENCAS_AGITACAO_2024.some((d) => /quetamina 5 mg\/kg/.test(d)))
})

test('PADIS 2025: dexmedetomidina sobre propofol (condicional, moderada); antipsicótico sem recomendação; melatonina sugerida', () => {
  assert.match(NOTAS_PADIS_2025.find((n) => /Dexmedetomidina/.test(n.tema))!.forca, /condicional, evidência moderada/)
  assert.match(NOTAS_PADIS_2025.find((n) => /Antipsicótico/.test(n.tema))!.forca, /sem recomendação/)
  assert.ok(NOTAS_PADIS_2025.some((n) => n.tema === 'Melatonina'))
})

test('REVISE: pantoprazol 40 mg IV/dia, sangramento 1,0% × 3,5%, HR 0,30, mortalidade sem diferença; SCCM/ASHP 2024: fatores de risco e suspensão', () => {
  assert.deepEqual(REVISE.sangramentoPct, [1.0, 3.5])
  assert.equal(REVISE.hr, 0.3)
  assert.deepEqual(REVISE.mortalidade90Pct, [29.1, 30.9])
  assert.match(REVISE.droga, /pantoprazol 40 mg IV/)
  assert.ok(SCCM_ASHP_ITENS.some((i) => /coagulopatia, choque e doença hepática crônica/.test(i)))
  assert.ok(SCCM_ASHP_ITENS.some((i) => /Suspender/.test(i)))
  assert.ok(DIFERENCAS_ULCERA_2024.length >= 3)
})

test('raiva (NT 8/2022, 134/2022, 35/2026): SAR 40 UI/kg e IGHAR 20 UI/kg; VINRAB 1000 UI/5 mL; 100 kg → 4.000 UI = 20 mL = 4 frascos', () => {
  assert.equal(SORO_RAIVA.sarUiKg, 40)
  assert.equal(SORO_RAIVA.igharUiKg, 20)
  assert.equal(SORO_RAIVA.prazoDias, 7)
  assert.deepEqual(doseSoroRaiva(100), { sarUi: 4000, sarMlVinrab: 20, frascosVinrab: 4, igharUi: 2000 })
  assert.deepEqual(doseSoroRaiva(70), { sarUi: 2800, sarMlVinrab: 14, frascosVinrab: 3, igharUi: 1400 })
  assert.equal(doseSoroRaiva(0), null)
  assert.match(PROTOCOLO_RAIVA_2022.find((i) => /Vacina pós-exposição/.test(i.tema))!.ms, /dias 0, 3, 7 e 14/)
  assert.match(PROTOCOLO_RAIVA_2022.find((i) => /silvestres/.test(i.tema))!.ms, /sempre grave/)
  assert.ok(DIFERENCAS_RAIVA_2022.some((d) => /não traz a dose do soro/.test(d)))
})
