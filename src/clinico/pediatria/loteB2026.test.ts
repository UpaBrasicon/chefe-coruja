import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { AUSTRALASIA_ITENS, COMORBIDADES_NIRSEVIMABE, criteriosNirsevimabe, fichaBronquiolite } from './bronquiolite.ts'
import { DIRETRIZ_SSC_PED_2026, PAM_PHOENIX, faixaPhoenix, fichaChoquePediatrico, phoenix } from './choque.ts'
import { DIFERENCAS_PCDT_FALCIFORME, PCDT_FALCIFORME, antibioticoFebre, benzatinaProfilaxia, fichaFalciformePed, hidroxiureiaMgDia, penicilinaVProfilaxia, sequestroPcdt } from './falciformePed.ts'
import { DIFERENCAS_MS_2026, MS_ARANHAS_TABELA, PCDT_ESCORPIAO, fichaPeconhentosPed } from './peconhentosPed.ts'

// Lote B das diretrizes pós-livro (28/09/2026): Phoenix 2024 + SSC pediátrica
// 2026, PCDT escorpiônicos 2026 + portal MS aranhas, nirsevimabe MS + Australásia
// 2025, PCDT falciforme 2024. Fontes lidas no texto.

test('lote B: fichas pediátricas na versão .1 de 28/09 ou posterior, com fonte pediátrica declarada', () => {
  for (const f of [fichaChoquePediatrico, fichaPeconhentosPed, fichaBronquiolite, fichaFalciformePed]) {
    assert.ok(f.versao >= '2026-09-28.1', f.id)
    assert.ok(f.fontes.length >= 2, f.id)
    assert.equal(temReferenciaPediatrica(f), true, f.id)
  }
  assert.ok(fichaChoquePediatrico.fontes.some((f) => /Phoenix/.test(f.citacao)))
  assert.ok(fichaChoquePediatrico.fontes.some((f) => /Surviving Sepsis.*Children 2026/.test(f.citacao)))
  assert.ok(fichaPeconhentosPed.fontes.some((f) => /Acidentes Escorpiônicos/.test(f.citacao)))
  assert.ok(fichaBronquiolite.fontes.some((f) => /Nota Técnica nº 109\/2025/.test(f.citacao)))
  assert.ok(fichaFalciformePed.fontes.some((f) => /Portaria Conjunta SAES\/SECTICS nº 16/.test(f.citacao)))
})

test('Phoenix 2024: faixas etárias e PAM da tabela (p. E3)', () => {
  assert.equal(faixaPhoenix(0.5), '<1m')
  assert.equal(faixaPhoenix(6), '1-11m')
  assert.equal(faixaPhoenix(18), '1-<2a')
  assert.equal(faixaPhoenix(36), '2-<5a')
  assert.equal(faixaPhoenix(100), '5-<12a')
  assert.equal(faixaPhoenix(200), '12-17a')
  assert.equal(faixaPhoenix(216), null) // 18 anos: fora
  assert.deepEqual(PAM_PHOENIX['<1m'].umPonto, [17, 30])
  assert.equal(PAM_PHOENIX['12-17a'].doisPontos, 38)
})

test('Phoenix 2024: pontos por sistema, sepse ≥ 2 e choque com ponto cardiovascular', () => {
  // criança de 3 anos, sem suporte, sem dados: 0 pontos
  assert.equal(phoenix({ idadeMeses: 36 })!.total, 0)
  // vasoativo + lactato 6 + PAM 40 (2–<5 anos: 1 ponto entre 32 e 44) → cardiovascular 3
  const c = phoenix({ idadeMeses: 36, vasoativos: 1, lactato: 6, pam: 40 })!
  assert.equal(c.cardiovascular, 3)
  assert.equal(c.choqueSeptico, true)
  // PAM abaixo de 32 → 2 pontos; 2 vasoativos → 2; lactato ≥ 11 → 2; teto 6
  assert.equal(phoenix({ idadeMeses: 36, vasoativos: 3, lactato: 12, pam: 20 })!.cardiovascular, 6)
  // respiratório: S/F 200 em VMI → 2; P/F 90 em VMI → 3; P/F 300 com suporte → 1; sem suporte → 0
  assert.equal(phoenix({ idadeMeses: 36, sf: 200, vmInvasiva: true })!.respiratorio, 2)
  assert.equal(phoenix({ idadeMeses: 36, pf: 90, vmInvasiva: true })!.respiratorio, 3)
  assert.equal(phoenix({ idadeMeses: 36, pf: 300, suporteRespiratorio: true })!.respiratorio, 1)
  assert.equal(phoenix({ idadeMeses: 36, pf: 300 })!.respiratorio, 0)
  // coagulação: 4 alterações contam no máximo 2
  assert.equal(phoenix({ idadeMeses: 36, plaquetas: 50, inr: 1.5, dDimero: 3, fibrinogenio: 80 })!.coagulacao, 2)
  // neurológico: Glasgow 8 → 1; pupilas fixas → 2
  assert.equal(phoenix({ idadeMeses: 36, glasgow: 8 })!.neurologico, 1)
  assert.equal(phoenix({ idadeMeses: 36, glasgow: 8, pupilasFixasBilaterais: true })!.neurologico, 2)
  // sepse sem ponto cardiovascular: respiratório 2 → sepse, não choque
  const s = phoenix({ idadeMeses: 36, sf: 200, vmInvasiva: true })!
  assert.equal(s.sepse, true)
  assert.equal(s.choqueSeptico, false)
  assert.ok(phoenix({ idadeMeses: 36, sf: 200 })!.avisos.some((a) => /97%/.test(a)))
})

test('SSC pediátrica 2026: bolus conforme UTI, antimicrobiano 1 h / 3 h, cristaloide balanceado, vasoativo periférico', () => {
  assert.ok(DIRETRIZ_SSC_PED_2026.length >= 10)
  for (const d of DIRETRIZ_SSC_PED_2026) assert.match(d.ssc.pagina, /p\. 9\d\d/, d.tema)
  assert.match(DIRETRIZ_SSC_PED_2026.find((d) => d.tema === 'Bolus onde há UTI')!.ssc.texto, /40–60 mL\/kg.*10–20 mL\/kg/)
  assert.match(DIRETRIZ_SSC_PED_2026.find((d) => d.tema === 'Bolus onde não há UTI')!.ssc.texto, /SEM hipotensão: contra bolus.*até 40 mL\/kg/)
  assert.match(DIRETRIZ_SSC_PED_2026.find((d) => d.tema === 'Antimicrobiano')!.ssc.texto, /1 h.*3 h/)
  assert.match(DIRETRIZ_SSC_PED_2026.find((d) => d.tema === 'Oxigênio no intubado')!.ssc.texto, /88–92%/)
})

test('PCDT escorpiônicos 2026: 0 / 3 / 6 ampolas, máximo 6, qualquer idade; observação 4 h / 6–12 h / ≥ 24 h', () => {
  assert.equal(PCDT_ESCORPIAO.ampolas.leve, null)
  assert.deepEqual(PCDT_ESCORPIAO.ampolas.moderado, [3, 3])
  assert.deepEqual(PCDT_ESCORPIAO.ampolas.grave, [6, 6])
  assert.equal(PCDT_ESCORPIAO.maximo, 6)
  assert.match(PCDT_ESCORPIAO.via, /1:2 a 1:5.*10 a 15 min.*8–12 mL\/min.*intraóssea/)
  assert.equal(PCDT_ESCORPIAO.observacao.semClinica, '4 horas')
  assert.match(PCDT_ESCORPIAO.observacao.comSoro, /24 horas/)
  assert.deepEqual(MS_ARANHAS_TABELA.loxosceles.map((l) => l.ampolas), [null, [5, 5], [10, 10], [10, 10]])
  assert.deepEqual(MS_ARANHAS_TABELA.phoneutria.map((l) => l.ampolas), [null, [2, 4], [5, 10]])
  assert.match(MS_ARANHAS_TABELA.latrodectus, /Não há tratamento soroterápico/)
  assert.ok(DIFERENCAS_MS_2026.length >= 4)
})

test('nirsevimabe (NT 109/2025; Guia VSR 2026): prematuro ≤ 36s6d qualquer peso; < 24 meses com comorbidade só na sazonalidade', () => {
  assert.equal(COMORBIDADES_NIRSEVIMABE.length, 7)
  const prem = criteriosNirsevimabe({ idadeMeses: 1, igSemanas: 34, comorbidades: new Set(), periodoSazonal: false })
  assert.equal(prem.elegivel, true)
  assert.equal(prem.avisos.length, 0)
  assert.equal(criteriosNirsevimabe({ idadeMeses: 1, igSemanas: 37, comorbidades: new Set(), periodoSazonal: true }).elegivel, false)
  const com = criteriosNirsevimabe({ idadeMeses: 18, igSemanas: 39, comorbidades: new Set(['cardiopatia']), periodoSazonal: false })
  assert.equal(com.elegivel, true)
  assert.match(com.avisos[0], /fevereiro a agosto/)
  const velho = criteriosNirsevimabe({ idadeMeses: 24, igSemanas: 39, comorbidades: new Set(['down']), periodoSazonal: true })
  assert.equal(velho.elegivel, false)
  assert.match(velho.avisos[0], /24 meses/)
  assert.ok(AUSTRALASIA_ITENS.some((i) => /< 90%.*< 92%/.test(i.texto)))
})

test('PCDT falciforme 2024: hidroxiureia 15 → 35 mg/kg/dia; penicilina V e benzatina por peso; ceftriaxona 50–75 (máx. 4 g); sequestro 10–15 mL/kg + CH 10 mL/kg', () => {
  assert.deepEqual(hidroxiureiaMgDia(20), { inicial: 300, incremento: 100, maximo: 700, comprimido100: true })
  assert.equal(hidroxiureiaMgDia(30)!.comprimido100, false)
  assert.equal(hidroxiureiaMgDia(0), null)
  assert.deepEqual(penicilinaVProfilaxia(24, 12), { mg: 125, criterio: '< 3 anos ou até 15 kg' })
  assert.deepEqual(penicilinaVProfilaxia(48, 20), { mg: 250, criterio: '> 3 anos ou 15–25 kg' })
  assert.deepEqual(penicilinaVProfilaxia(48, 14), { mg: 125, criterio: '< 3 anos ou até 15 kg' }) // peso ≤ 15 kg manda
  assert.equal(benzatinaProfilaxia(8)!.ui, 300_000)
  assert.equal(benzatinaProfilaxia(15)!.ui, 600_000)
  assert.equal(benzatinaProfilaxia(25)!.ui, 1_200_000)
  const atb = antibioticoFebre(20)!
  assert.deepEqual(atb.penicilinaUDia, [2_000_000, 5_000_000])
  assert.deepEqual(atb.ceftriaxonaMgDia, [1000, 1500])
  assert.equal(antibioticoFebre(60)!.ceftriaxonaNoTeto, true)
  assert.deepEqual(antibioticoFebre(60)!.ceftriaxonaMgDia, [3000, 4000])
  assert.deepEqual(sequestroPcdt(10), { expansorMl: [100, 150], sfMl: [400, 1000], chMl: 100 })
  assert.equal(PCDT_FALCIFORME.sta.spo2Uti, 93)
  assert.ok(PCDT_FALCIFORME.transfusaoSimples.indicacoes.some((i) => /1,5 g\/dL/.test(i)))
  assert.ok(DIFERENCAS_PCDT_FALCIFORME.length >= 3)
})

test('choque séptico: nota do PRoMPT BOLUS no tema do fluido (revisão de 09/10/2026)', () => {
  assert.ok(fichaChoquePediatrico.fontes.some((f) => f.citacao.includes('PMID 42028918')))
  const fluido = DIRETRIZ_SSC_PED_2026.find((d) => d.tema === 'Qual fluido')!
  assert.match(fluido.nota ?? '', /PRoMPT BOLUS/)
})
