import { test } from 'node:test'
import assert from 'node:assert/strict'

import { DIRETRIZ_HIPOTERMIA_2025, ESTAGIOS_ERC_2025, criteriosEcpr2025, fichaHipotermiaAdulto } from './ambientais.ts'
import { DIRETRIZ_HSA_2023, fichaHsaAdulto } from './hsa.ts'
import { DIFERENCAS_TETANO_GVS, TRATAMENTO_GVS_2024, fichaTetanoAdulto, profilaxiaTetano, profilaxiaTetanoGvs } from './profilaxiaPosExposicao.ts'
import { DIRETRIZ_PAC_2026, fichaPacAntibioticoAdulto } from './tepPac.ts'
import { DIFERENCAS_TRANSFUSAO_2023, GATILHOS_HB_AABB, PLAQUETAS_AABB_2025, fichaTransfusaoAdulto, gatilhosAbaixo, gatilhosAbaixoAabb } from './transfusao.ts'
import { DIRETRIZ_SDRA_2024, fichaSdraAdulto, relacaoSF, sdraGlobal2024 } from './ventilacaoMecanica.ts'

// Lote C das diretrizes pós-livro (28/09/2026): AABB 2023/2025, AHA/ASA HSA
// 2023, ATS PAC 2026, definição global de SDRA 2024 + ATS 2024 + ESICM 2023,
// ERC/RCUK 2025 (hipotermia), Guia de Vigilância em Saúde 2024 (tétano).

test('lote C: fichas de adulto na versão .1 de 28/09, com o manual como primeira fonte e a diretriz declarada', () => {
  const casos: [typeof fichaTransfusaoAdulto, RegExp][] = [
    [fichaTransfusaoAdulto, /AABB International Guidelines/],
    [fichaHsaAdulto, /Aneurysmal Subarachnoid Hemorrhage/],
    [fichaPacAntibioticoAdulto, /American Thoracic Society Clinical Practice Guideline/],
    [fichaSdraAdulto, /Global Definition of Acute Respiratory Distress Syndrome/],
    [fichaHipotermiaAdulto, /European Resuscitation Council Guidelines 2025/],
    [fichaTetanoAdulto, /Guia de Vigilância em Saúde/],
  ]
  for (const [f, re] of casos) {
    // revisão PubMed de 09/10/2026 subiu a versão de algumas fichas do lote
    assert.ok(f.versao >= '2026-09-28.1', f.id)
    assert.equal(f.publico, 'adulto', f.id)
    assert.match(f.fontes[0].citacao, /Manual de Medicina de Emergência/, f.id)
    assert.ok(f.fontes.some((x) => re.test(x.citacao)), f.id)
  }
})

test('AABB 2023/2025: 7 / 7,5 / 8 / 7 / 10 g/dL e a Hb informada abaixo de cada limiar', () => {
  assert.deepEqual(GATILHOS_HB_AABB.map((g) => g.hb), [7, 7.5, 8, 7, 10])
  assert.deepEqual(gatilhosAbaixoAabb(7.2), ['cardiaca', 'ortopedica-cv', 'iam'])
  assert.deepEqual(gatilhosAbaixoAabb(6.5), GATILHOS_HB_AABB.map((g) => g.id))
  assert.deepEqual(gatilhosAbaixoAabb(0), [])
  // o manual continua com a Tabela 1 (SCA < 8; anemia sintomática < 10)
  assert.ok(gatilhosAbaixo(7.9).includes('sca'))
  assert.ok(DIFERENCAS_TRANSFUSAO_2023.some((d) => /IAM hospitalizado/.test(d)))
})

test('AABB/ICTMG 2025: dengue sem sangramento maior não transfunde; neonato 25 mil; punção lombar 20 mil', () => {
  const dengue = PLAQUETAS_AABB_2025.find((p) => /Dengue/.test(p.situacao))!
  assert.equal(dengue.limiar, null)
  assert.equal(dengue.forca, 'forte')
  assert.equal(PLAQUETAS_AABB_2025.find((p) => /neonato/.test(p.situacao))!.limiar, 25_000)
  assert.equal(PLAQUETAS_AABB_2025.find((p) => /Punção lombar/.test(p.situacao))!.limiar, 20_000)
  assert.equal(PLAQUETAS_AABB_2025.find((p) => /Hemorragia intracraniana/.test(p.situacao))!.limiar, null)
})

test('HSA AHA/ASA 2023: antifibrinolítico 3: sem benefício; PA sem alvo; fenitoína dano; nimodipino 1 A; página com "e"', () => {
  const t = (tema: RegExp) => DIRETRIZ_HSA_2023.find((d) => tema.test(d.tema))!
  assert.match(t(/Antifibrinolítico/).classe, /3: sem benefício, A/)
  assert.match(t(/Pressão arterial/).aha, /não há evidência para um alvo numérico/)
  assert.match(t(/Fenitoína/).classe, /3: dano/)
  assert.equal(t(/Nimodipino/).classe, '1, A')
  assert.match(t(/Tratamento do aneurisma/).aha, /24 h/)
  for (const d of DIRETRIZ_HSA_2023) assert.match(d.pagina, /^e\d{3}/, d.tema)
})

test('ATS PAC 2026: corticoide só na grave (exclui influenza), contra na não grave; < 5 dias (mín. 3) e ≥ 5 dias', () => {
  const t = (tema: RegExp) => DIRETRIZ_PAC_2026.find((d) => tema.test(d.tema))!
  assert.match(t(/grave \(internado\)/).ats, /exclui pneumonia grave por influenza/)
  assert.match(t(/não grave \(internado\)/).ats, /NÃO administrar/)
  assert.match(t(/Duração — não grave/).ats, /Menos de 5 dias.*mínimo de 3/)
  assert.match(t(/Duração — grave/).ats, /5 dias ou mais/)
  assert.match(t(/vírus respiratório/).ats, /não prescrever antibiótico empírico/)
})

test('definição global de SDRA 2024: intubada por P/F e S/F (SpO2 ≤ 97%), não intubada em CNAF ≥ 30 ou VNI, recursos limitados sem PEEP', () => {
  assert.equal(relacaoSF(92, 40), 230)
  assert.equal(relacaoSF(92, 0), null)
  // intubada: 100 < P/F ≤ 200 → moderada; PEEP ≥ 5 exigida
  assert.equal(sdraGlobal2024({ pf: 150, suporte: 'vmi', peep: 8 })!.gravidade, 'moderada')
  assert.equal(sdraGlobal2024({ pf: 90, suporte: 'vmi', peep: 10 })!.gravidade, 'grave')
  assert.equal(sdraGlobal2024({ pf: 250, suporte: 'vmi', peep: 5 })!.gravidade, 'leve')
  const semPeep = sdraGlobal2024({ pf: 150, suporte: 'vmi', peep: 3 })!
  assert.equal(semPeep.gravidade, null)
  assert.match(semPeep.notas[0], /PEEP ≥ 5/)
  // S/F: 148 < 230 ≤ 235 → moderada; com SpO2 > 97% não vale
  assert.equal(sdraGlobal2024({ sf: 230, spo2: 92, suporte: 'vmi', peep: 8 })!.gravidade, 'moderada')
  assert.equal(sdraGlobal2024({ sf: 230, spo2: 99, suporte: 'vmi', peep: 8 }), null)
  // não intubada
  const cnaf = sdraGlobal2024({ sf: 300, spo2: 94, suporte: 'cnaf30' })!
  assert.equal(cnaf.categoria, 'não intubada')
  assert.equal(cnaf.criterioOxigenacao, true)
  assert.equal(cnaf.gravidade, null)
  assert.equal(sdraGlobal2024({ sf: 300, spo2: 94, suporte: 'o2' })!.categoria, null)
  // recursos limitados: S/F sem PEEP
  assert.equal(sdraGlobal2024({ sf: 300, spo2: 94, suporte: 'o2', recursosLimitados: true })!.categoria, 'recursos limitados')
  // acima dos cortes
  assert.equal(sdraGlobal2024({ pf: 350, suporte: 'vmi', peep: 8 })!.criterioOxigenacao, false)
  assert.ok(DIRETRIZ_SDRA_2024.some((d) => /Bloqueio neuromuscular/.test(d.tema) && /divergência/.test(d.diretriz)))
  assert.match(DIRETRIZ_SDRA_2024.find((d) => /Posição prona/.test(d.tema))!.diretriz, /16 h/)
})

test('ERC/RCUK 2025: estágios I–IV, critérios de ECPR (FC < 45, PAS < 90, arritmia, T < 30), adrenalina só a partir de 30 °C', () => {
  assert.deepEqual(ESTAGIOS_ERC_2025.map((e) => e.tempC), ['35–32 °C', '32–28 °C', '28–24 °C', '< 24 °C'])
  assert.deepEqual(criteriosEcpr2025({ fc: 40, pas: 85, arritmiaVentricular: true, tempC: 27 }), ['FC < 45/min', 'PAS < 90 mmHg', 'arritmia ventricular', 'temperatura central < 30 °C'])
  assert.deepEqual(criteriosEcpr2025({ fc: 60, pas: 110, tempC: 31 }), [])
  assert.deepEqual(criteriosEcpr2025({}), [])
  assert.match(DIRETRIZ_HIPOTERMIA_2025.find((d) => d.tema === 'Adrenalina')!.erc, /30 °C.*6–10 min/)
  assert.match(DIRETRIZ_HIPOTERMIA_2025.find((d) => d.tema === 'Desfibrilação')!.erc, /3 choques/)
})

test('GVS 2024 tétano: IGHAT 500 UI (até 6.000), SAT 20.000; penicilina 2 mi UI 4/4 h ou metronidazol 500 mg 8/8 h por 7–10 d', () => {
  assert.equal(TRATAMENTO_GVS_2024.ighat.terapeuticaUi, 500)
  assert.equal(TRATAMENTO_GVS_2024.ighat.terapeuticaMaxUi, 6000)
  assert.equal(TRATAMENTO_GVS_2024.sat.terapeuticaUi, 20_000)
  assert.equal(TRATAMENTO_GVS_2024.sat.profilaticaUi, 5000)
  assert.equal(TRATAMENTO_GVS_2024.antibiotico.penicilinaUiDose, 2_000_000)
  assert.equal(TRATAMENTO_GVS_2024.antibiotico.metronidazolIntervaloH, 8)
  assert.deepEqual(TRATAMENTO_GVS_2024.antibiotico.dias, [7, 10])
  assert.ok(TRATAMENTO_GVS_2024.sedativos.errata.length > 0)
  assert.ok(DIFERENCAS_TETANO_GVS.length >= 4)
})

test('GVS 2024 Quadro 4: coincide com o Anexo 7 do manual nas quatro linhas e acrescenta a nota d', () => {
  const pares = [['incerta', 'limpo', 'minimo'], ['incerta', 'outros', 'alto'], ['menos5', 'limpo', 'minimo'], ['menos5', 'outros', 'alto'], ['entre5e10', 'limpo', 'minimo'], ['entre5e10', 'outros', 'alto'], ['mais10', 'limpo', 'minimo'], ['mais10', 'outros', 'alto']] as const
  for (const [h, fLivro, fGvs] of pares) {
    const livro = profilaxiaTetano(h, fLivro)
    const gvs = profilaxiaTetanoGvs(h, fGvs, false)
    assert.equal(gvs.vacina, livro.vacina, `${h}/${fGvs} vacina`)
    assert.equal(gvs.imunoglobulina, livro.imunoglobulina, `${h}/${fGvs} soro`)
  }
  const idoso = profilaxiaTetanoGvs('mais10', 'alto', true)
  assert.equal(idoso.imunoglobulina, true)
  assert.match(idoso.notas[0], /Nota d/)
  assert.equal(profilaxiaTetanoGvs('mais10', 'minimo', true).imunoglobulina, false)
  assert.equal(profilaxiaTetanoGvs('mais10Especial', 'alto', false).imunoglobulina, true)
  assert.equal(profilaxiaTetanoGvs('menos5', 'alto', true).imunoglobulina, false)
})
