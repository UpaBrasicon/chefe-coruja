import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import type { Ficha, Fonte } from '../ficha.ts'
import { ISTH_HNF_2026, NOTA_HNF_ANTI_XA, fichaHnfAdulto } from './anticoagulacao.ts'
import { ENSAIOS_ICA, NOTA_PUSH_AHF, NOTA_SGLT2_INTERNACAO, PUSH_AHF_2023, SGLT2_INTERNACAO_2026, fichaIcAgudaAdulto } from './insuficienciaCardiacaAguda.ts'
import {
  BICARBONATO_PCR_IH_2026, DIRETRIZ_ALS_2025, DOSE_VF_2022, IVIO_2025, NOTA_PCR_ACESSO, NOTA_PCR_BICARBONATO, NOTA_PCR_TROCA_VETOR, PARAMEDIC3_2025, fichaPcrAdulto,
} from './pcr.ts'
import { MPTC_CAPTURA_2026, NOTA_MPTC_CAPTURA, fichaMarcaPassoAdulto } from './procedimentos.ts'
import { ARISE_FLUIDS_2026, DIRETRIZES_2026, NOTA_ARISE_FLUIDS, fichaRessuscitacaoAdulto } from './ressuscitacaoVolemica.ts'
import {
  ANNEXA_I, NCS_ICH_2023, NOTA_ICH_PROGNOSTICO, NOTA_SBTH_2026, REVERSAO_DOAC, SBTH_2026, escoreIch, fichaEscoreIch, fichaReversaoAnticoagulacaoAdulto,
} from './reversaoAnticoagulacao.ts'
import { HEMOTION_2024, NOTA_TRANSFUSAO_LESAO_CEREBRAL, SAHARA_2025, TRAIN_2024, fichaTransfusaoAdulto } from './transfusao.ts'

// Revisão PubMed de 09/10/2026, itens de prioridade média, área 1 (adulto,
// cardiologia e ressuscitação) e o escore ICH (item 2.5). Decisão do RT em
// 06/11/2026: A em H1–H22. Cada item entra como nota com a fonte citada;
// nenhuma dose muda, exceto a janela do carvão na reversão de DOAC (H2).

const VERSAO = '2026-11-06.1'
const pagina = (nome: string) => readFileSync(new URL(`../../pages/plantonista/manual/${nome}.tsx`, import.meta.url), 'utf8')

function confereFonte(ficha: Ficha, fonte: Fonte, pmid: string) {
  assert.match(fonte.citacao, new RegExp(`PMID ${pmid}\\)`), pmid)
  assert.match(fonte.url ?? '', /^https:\/\/doi\.org\/10\./, pmid)
  assert.ok(ficha.versao >= VERSAO, `${ficha.id} ${ficha.versao}`)
  assert.ok(ficha.fontes.includes(fonte), `${ficha.id} sem ${pmid}`)
  assert.match(ficha.revisadoEm, /06\/11\/2026.*revisão PubMed, itens médios/, ficha.id)
}

test('1.1 transfusão: TRAIN, HEMOTION e SAHaRA na ficha e a nota na tela', () => {
  confereFonte(fichaTransfusaoAdulto, TRAIN_2024, '39382241')
  confereFonte(fichaTransfusaoAdulto, HEMOTION_2024, '38869931')
  confereFonte(fichaTransfusaoAdulto, SAHARA_2025, '39655786')
  assert.match(NOTA_TRANSFUSAO_LESAO_CEREBRAL, /TRAIN.*62,6% × 72,6%.*HEMOTION.*SAHaRA.*3,3% × 0,8%.*'Hb < 7' do livro continua/)
  const tela = pagina('TransfusaoAdulto')
  assert.match(tela, /role="note"[^>]*>\{NOTA_TRANSFUSAO_LESAO_CEREBRAL\}/)
})

test('1.2 HNF: ISTH 2026 com o alvo de anti-Xa só na nota (H1 = A)', () => {
  confereFonte(fichaHnfAdulto, ISTH_HNF_2026, '42162738')
  assert.match(NOTA_HNF_ANTI_XA, /0,30–0,70 U\/mL/)
  assert.match(NOTA_HNF_ANTI_XA, /A conta desta tela continua a do livro/)
  assert.match(pagina('HeparinaNaoFracionadaAdulto'), /role="note"[^>]*>\{NOTA_HNF_ANTI_XA\}/)
})

test('1.3 reversão: SBTH 2026 depois do ANNEXA-I e a nota no bloco dos DOAC', () => {
  confereFonte(fichaReversaoAnticoagulacaoAdulto, SBTH_2026, '42561189')
  assert.equal(fichaReversaoAnticoagulacaoAdulto.fontes[1], ANNEXA_I)
  assert.ok(fichaReversaoAnticoagulacaoAdulto.fontes.indexOf(SBTH_2026) > 1)
  assert.match(NOTA_SBTH_2026, /últimas 4 h.*Idarucizumabe.*nada aqui muda dose/)
  assert.match(pagina('ReversaoAnticoagulacaoAdulto'), /role="note"[^>]*>\{NOTA_SBTH_2026\}/)
})

test('1.3 H2: carvão ativado na janela de 4 h nas duas listas de DOAC', () => {
  for (const d of REVERSAO_DOAC) {
    const carvao = d.maior.filter((x) => /Carvão ativado/.test(x))
    assert.equal(carvao.length, 1, d.droga)
    assert.match(carvao[0], /< 4 h/, d.droga)
    assert.match(carvao[0], /SBTH 2026/, d.droga)
    assert.doesNotMatch(carvao[0], /< 2 h/, d.droga)
  }
})

test('1.4 PCR: IVIO, PARAMEDIC-3, DOSE VF e bicarbonato em notas por linha', () => {
  confereFonte(fichaPcrAdulto, IVIO_2025, '39480221')
  confereFonte(fichaPcrAdulto, PARAMEDIC3_2025, '39480216')
  confereFonte(fichaPcrAdulto, DOSE_VF_2022, '36342151')
  confereFonte(fichaPcrAdulto, BICARBONATO_PCR_IH_2026, '42273960')
  const nota = (tema: string) => DIRETRIZ_ALS_2025.find((d) => d.tema === tema)!.nota
  assert.equal(nota('Acesso vascular'), NOTA_PCR_ACESSO)
  assert.equal(nota('Troca de vetor e dupla desfibrilação sequencial'), NOTA_PCR_TROCA_VETOR)
  assert.equal(nota('Cálcio, bicarbonato e magnésio'), NOTA_PCR_BICARBONATO)
  assert.match(NOTA_PCR_ACESSO, /36,0% × 39,1%/)
  assert.match(NOTA_PCR_TROCA_VETOR, /não estabelecida \(2b\)/)
  assert.match(NOTA_PCR_BICARBONATO, /39% × 37%/)
  assert.match(pagina('PcrAdulto'), /\{d\.nota && <p role="note"[^>]*>\{d\.nota\}/)
})

test('1.5 choque séptico: ARISE FLUIDS na nota da linha do vasopressor', () => {
  confereFonte(fichaRessuscitacaoAdulto, ARISE_FLUIDS_2026, '42274006')
  const linha = DIRETRIZES_2026.find((d) => d.tema === 'Vasopressor: qual e por onde')!
  assert.equal(linha.nota, NOTA_ARISE_FLUIDS)
  assert.match(NOTA_ARISE_FLUIDS, /1\.108 mL.*0,6% × 5,0%.*30 mL\/kg\) não muda/)
  assert.match(pagina('RessuscitacaoVolemicaAdulto'), /\{d\.nota && <p[^>]*>\{d\.nota\}/)
})

test('1.6 IC aguda: PUSH-AHF e a metanálise do SGLT2 em ENSAIOS_ICA', () => {
  confereFonte(fichaIcAgudaAdulto, PUSH_AHF_2023, '37640861')
  confereFonte(fichaIcAgudaAdulto, SGLT2_INTERNACAO_2026, '42507311')
  assert.ok(ENSAIOS_ICA.some((e) => e.texto === NOTA_PUSH_AHF))
  assert.ok(ENSAIOS_ICA.some((e) => e.texto === NOTA_SGLT2_INTERNACAO))
  assert.match(NOTA_PUSH_AHF, /409 × 345 mmol.*31% × 31%/)
  assert.match(NOTA_SGLT2_INTERNACAO, /RR 0,77.*RR 0,74/)
  assert.match(pagina('InsuficienciaCardiacaAgudaAdulto'), /ENSAIOS_ICA\.map/)
})

test('1.7 marca-passo transcutâneo: captura em 11,5% e a nota no bloco do transcutâneo', () => {
  confereFonte(fichaMarcaPassoAdulto, MPTC_CAPTURA_2026, '42600263')
  assert.match(NOTA_MPTC_CAPTURA, /11,5%.*como o livro já pede/)
  assert.match(pagina('MarcaPassoProvisorioAdulto'), /role="note"[^>]*>\{NOTA_MPTC_CAPTURA\}/)
})

test('2.5 escore ICH: NCS 2023 em cuidados, sem mudar pontos nem mortalidade', () => {
  confereFonte(fichaEscoreIch, NCS_ICH_2023, '37923968')
  assert.equal(escoreIch.ficha, fichaEscoreIch)
  assert.match(NOTA_ICH_PROGNOSTICO, /48–72 h.*não decide limitação de suporte/)
  const r = escoreIch.calcular({ glasgow: 2, volume: 1, ventricular: 0, infratentorial: 0, idade: 0 })!
  assert.match(r.nota, /72%/)
  assert.ok(r.cuidados?.includes(NOTA_ICH_PROGNOSTICO))
})
