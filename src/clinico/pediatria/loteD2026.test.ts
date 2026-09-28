import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { DIFERENCAS_NEFROTICA_2025, KDIGO_ITENS, fichaGlomerulopatiasPed, prednisolonaKdigo } from './glomerulopatiasPed.ts'
import { ASH_ISTH_ITENS, DIFERENCAS_TEV_2025, fichaHemostasiaTromboPed } from './hemostasiaTromboPed.ts'
import { DIFERENCAS_NF_2023, IPFNG_ITENS, fichaOncologiaPed } from './oncologiaPed.ts'
import { DERRAME_IDSA_2026, DOSES_SBP_2024, DRENAGEM_SBP_2024, ESQUEMAS_SBP_2024, fichaPneumoniaPed, uroquinasePleural } from './pneumoniaPed.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import { DIRETRIZ_PALS_2025, fichaRcpPediatrica, metaPadRcp2025 } from './rcp.ts'

// Lote D (pediatria), 28/09/2026: AHA/AAP 2025 (Destaques), SBP 2024 +
// IDSA/PIDS 2026, IPFNG 2023, KDIGO 2025 + IPNA 2023, ASH/ISTH 2025.

test('lote D pediatria: fichas na versão .1 de 28/09, fonte pediátrica declarada, livro como primeira fonte', () => {
  const casos: [typeof fichaRcpPediatrica, RegExp][] = [
    [fichaRcpPediatrica, /Pediatric Advanced Life Support: 2025/],
    [fichaPneumoniaPed, /Sociedade Brasileira de Pediatria.*Complicadas: Atualização 2024/],
    [fichaOncologiaPed, /Fever and Neutropenia in Pediatric Patients.*2023 Update/],
    [fichaGlomerulopatiasPed, /KDIGO 2025.*Nephrotic Syndrome in Children/],
    [fichaHemostasiaTromboPed, /2025 updated guidelines for treatment of venous thromboembolism in pediatric patients/],
  ]
  for (const [f, re] of casos) {
    assert.equal(f.versao, '2026-09-28.1', f.id)
    assert.equal(temReferenciaPediatrica(f), true, f.id)
    assert.match(f.fontes[0].citacao, /Schvartsman|Pronto-Socorro/, f.id)
    assert.ok(f.fontes.some((x) => re.test(x.citacao)), f.id)
  }
})

test('AHA/AAP 2025 (Destaques): PAD ≥ 25 no lactente e ≥ 30 a partir de 1 ano; 2 dedos não mais recomendados; pós-PCR > p10; doses do livro mantidas', () => {
  assert.equal(metaPadRcp2025('lactente'), 25)
  assert.equal(metaPadRcp2025('crianca'), 30)
  assert.equal(metaPadRcp2025('adolescente'), 30)
  assert.match(DIRETRIZ_PALS_2025.find((d) => /Compressão no lactente/.test(d.tema))!.aha, /2 dedos não é mais recomendada/)
  assert.match(DIRETRIZ_PALS_2025.find((d) => /Pós-PCR/.test(d.tema))!.aha, /percentil 10/)
  assert.match(DIRETRIZ_PALS_2025.find((d) => d.tema === 'EtCO₂')!.aha, /não deve ser usado para encerrar/)
  assert.match(DIRETRIZ_PALS_2025.find((d) => /Doses e cargas/.test(d.tema))!.aha, /não alteram/)
})

test('SBP 2024 (Quadro 2): ampicilina 150–200 mg/kg/dia máx. 12 g; penicilina 200–250 mil U/kg/dia máx. 24 mi; ceftriaxona 50–100 máx. 4 g; uroquinase por idade', () => {
  const ampi = DOSES_SBP_2024.find((d) => d.id === 'sbp-ampi')!
  assert.deepEqual(ampi.porKgDia, [150, 200])
  assert.equal(ampi.maxDia, 12_000)
  const c = calcularDoseLivro(ampi, 20)!
  assert.deepEqual(c.dia, [3000, 4000])
  const cAlto = calcularDoseLivro(ampi, 80)!
  assert.equal(cAlto.dia![1], 12_000)
  assert.equal(cAlto.noMaximo, true)
  assert.deepEqual(DOSES_SBP_2024.find((d) => d.id === 'sbp-pen')!.porKgDia, [200_000, 250_000])
  assert.equal(DOSES_SBP_2024.find((d) => d.id === 'sbp-ceftri')!.maxDia, 4000)
  assert.deepEqual(uroquinasePleural(6), { ui: 10_000, mlSf: 10 })
  assert.deepEqual(uroquinasePleural(12), { ui: 40_000, mlSf: 40 })
  assert.equal(uroquinasePleural(-1), null)
  assert.ok(DRENAGEM_SBP_2024.indicacoes.some((i) => /Glicose abaixo de 50/.test(i)))
  assert.ok(ESQUEMAS_SBP_2024.some((e) => /vancomicina \+ ceftriaxona/.test(e.texto)))
  assert.ok(DERRAME_IDSA_2026.some((d) => /≤ 12 Fr/.test(d.texto)))
  assert.ok(DERRAME_IDSA_2026.some((d) => /tPA isolado/.test(d.texto)))
})

test('IPFNG 2023: B5 suspende em 48 h no baixo risco sem recuperação medular (condicional); C4 antifúngico ≥ 96 h (forte, alta)', () => {
  assert.match(IPFNG_ITENS.find((i) => i.codigo === 'B5')!.texto, /48 h.*sem recuperação medular/)
  assert.match(IPFNG_ITENS.find((i) => i.codigo === 'B5')!.forca, /condicional/)
  assert.match(IPFNG_ITENS.find((i) => i.codigo === 'C4')!.texto, /96 h.*caspofungina ou anfotericina B lipossomal/)
  assert.match(IPFNG_ITENS.find((i) => i.codigo === 'C4')!.forca, /forte, evidência alta/)
  assert.ok(DIFERENCAS_NF_2023.some((d) => /era 72 h/.test(d)))
})

test('KDIGO 2025: prednisolona 2 mg/kg ou 60 mg/m² (máx. 60) e 1,5 mg/kg ou 40 mg/m² (máx. 40)', () => {
  assert.deepEqual(prednisolonaKdigo(20, 0.8), { diariaPorPeso: 40, diariaPorSc: 48, alternadaPorPeso: 30, alternadaPorSc: 32, noTetoDiaria: false, noTetoAlternada: false })
  const grande = prednisolonaKdigo(40, 1.3)!
  assert.equal(grande.diariaPorPeso, 60)
  assert.equal(grande.diariaPorSc, 60)
  assert.equal(grande.alternadaPorPeso, 40)
  assert.equal(grande.noTetoDiaria, true)
  assert.equal(grande.noTetoAlternada, true)
  assert.equal(prednisolonaKdigo(20, 0)!.diariaPorSc, null)
  assert.equal(prednisolonaKdigo(0, 0), null)
  assert.match(KDIGO_ITENS.find((i) => i.tema === 'Tratamento inicial')!.texto, /8 semanas.*12 semanas/)
  assert.match(KDIGO_ITENS.find((i) => /IPNA/.test(i.tema))!.texto, /0,5–1 g\/kg em 4–6 h.*furosemida 1–2 mg\/kg/)
  assert.ok(DIFERENCAS_NEFROTICA_2025.length >= 3)
})

test('ASH/ISTH 2025: DOAC sugerido sobre o padrão; provocado selecionado 6 semanas; não provocado 6–12 meses; DOAC sem dose calculada', () => {
  assert.match(ASH_ISTH_ITENS.find((i) => /17–20/.test(i.numero))!.texto, /rivaroxabana ou dabigatrana/)
  assert.match(ASH_ISTH_ITENS.find((i) => i.numero === '3')!.texto, /6 semanas em vez de 3 meses/)
  assert.match(ASH_ISTH_ITENS.find((i) => i.numero === '4')!.texto, /6 a 12 meses/)
  assert.ok(DIFERENCAS_TEV_2025.some((d) => /não são calculadas/.test(d)))
})
