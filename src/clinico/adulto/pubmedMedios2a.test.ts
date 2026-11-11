import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import type { Ficha, Fonte } from '../ficha.ts'
import { NOTA_ATS_HIPERCAPNICA, fichaDpocAdulto } from './asmaDpoc.ts'
import { ESO_PA_2025, INTERACT4_2024, NOTA_INTERACT4, fichaTromboliseAvcAdulto } from './avcTrombolise.ts'
import { DBHA_2025_ALVOS, fichaEmergenciaHipertensivaAdulto } from './emergenciaHipertensiva.ts'
import { DIRETRIZ_HSA_2023, ESO_HSA_2026, NCS_HSA_2026, NOTA_ESO_ANTIFIBRINOLITICO, NOTA_NCS_FENITOINA, fichaHsaAdulto } from './hsa.ts'
import { NOTA_ATS_PRE_OXIGENACAO, fichaIsrAdulto } from './isr.ts'
import { MASCC_2026, NOTA_MASCC_2026, mascc } from './neutropeniaFebril.ts'
import { DISPOSITIVOS, NOTA_ATS_HIPOXEMICA, SOHO_2026, fichaOxigenacaoAdulto } from './oxigenacao.ts'
import {
  AARC_TRE_2024, ATS_IRPA_2026, BURNS_TRE_2024, DIRETRIZ_SDRA_2024, NOTA_AARC_TRE, NOTA_ATS_POS_EXTUBACAO, NOTA_SCCM_BNM, SCCM_BNM_2026,
  fichaDesmameAdulto, fichaSdraAdulto,
} from './ventilacaoMecanica.ts'
import { fichaVniPassos } from './vniPassos.ts'

// Revisão PubMed de 09/10/2026, itens de prioridade média, área 2a (adulto,
// neurologia e respiratório). Decisão do RT em 06/11/2026: A em H1 a H22.
// Cada item: fonte com PMID e DOI, ficha com versão nova e a fonte, nota
// exportada e a tela que mostra a nota. Nenhuma dose muda.

const VERSAO = '2026-11-06.1'
const pagina = (caminho: string) => readFileSync(new URL(`../../pages/plantonista/${caminho}`, import.meta.url), 'utf8')

function conferirFonte(f: Fonte, pmid: string) {
  assert.match(f.citacao, new RegExp(`PMID ${pmid}\\)`), pmid)
  assert.match(f.citacao, /et al\./, pmid)
  assert.match(f.url ?? '', /^https:\/\/doi\.org\/10\./, pmid)
}

function conferirFicha(ficha: Ficha, ...fontes: Fonte[]) {
  assert.ok(ficha.versao >= VERSAO, ficha.id)
  assert.equal(ficha.publico, 'adulto', ficha.id)
  assert.match(ficha.fontes[0].citacao, /Manual de Medicina de Emergência/, ficha.id)
  for (const f of fontes) assert.ok(ficha.fontes.includes(f), `${ficha.id}: ${f.citacao}`)
  // revisões posteriores entram antes ("11/11/2026 (...); 06/11/2026 (...)")
  assert.match(ficha.revisadoEm, /(^|; )06\/11\/2026 \(nota .*revisão PubMed, itens médios\)$/, ficha.id)
}

test('2.1 INTERACT4: nota nas duas ferramentas (H3 = A), com a ESO 2025 de PA', () => {
  conferirFonte(INTERACT4_2024, '38752650')
  conferirFonte(ESO_PA_2025, '42095756')
  assert.match(NOTA_INTERACT4, /^INTERACT4 \(NEJM 2024, posterior ao livro\)/)
  assert.match(NOTA_INTERACT4, /Os alvos do livro e da DBHA não mudam\.$/)
  conferirFicha(fichaTromboliseAvcAdulto, INTERACT4_2024, ESO_PA_2025)
  conferirFicha(fichaEmergenciaHipertensivaAdulto, INTERACT4_2024, ESO_PA_2025)
  const linha = DBHA_2025_ALVOS.find((d) => d.tema === 'AVC isquêmico sem trombólise')!
  assert.equal(linha.nota, NOTA_INTERACT4)
  assert.equal(DBHA_2025_ALVOS.filter((d) => d.nota).length, 1)
  assert.match(pagina('manual/TromboliseAvcAdulto.tsx'), /role="note"[^>]*>\{NOTA_INTERACT4\}/)
  assert.match(pagina('manual/EmergenciaHipertensivaAdulto.tsx'), /d\.nota && <p role="note"/)
})

test('2.2 ATS 2026 e SOHO: hipoxêmica no CNAF, pós-extubação na oxigenação e no desmame', () => {
  conferirFonte(ATS_IRPA_2026, '42371750')
  conferirFonte(SOHO_2026, '41841715')
  assert.match(NOTA_ATS_HIPOXEMICA, /^ATS 2026: na IRpA hipoxêmica/)
  assert.match(NOTA_ATS_HIPOXEMICA, /Os alvos de SatO2 do livro não mudam\.$/)
  assert.match(NOTA_ATS_POS_EXTUBACAO, /^ATS 2026: após a extubação/)
  conferirFicha(fichaOxigenacaoAdulto, ATS_IRPA_2026, SOHO_2026)
  assert.equal(DISPOSITIVOS.find((d) => d.id === 'cnaf')!.nota, NOTA_ATS_HIPOXEMICA)
  assert.equal(DISPOSITIVOS.filter((d) => d.nota).length, 1)
  const oxi = pagina('manual/OxigenacaoIrpaAdulto.tsx')
  assert.match(oxi, /d\.nota && <p role="note"/)
  assert.match(oxi, /role="note"[^>]*>\{NOTA_ATS_POS_EXTUBACAO\}/)
  conferirFicha(fichaDesmameAdulto, ATS_IRPA_2026)
  assert.match(pagina('manual/DesmameVmAdulto.tsx'), /role="note"[^>]*>\{NOTA_ATS_POS_EXTUBACAO\}/)
})

test('2.2 ATS 2026: hipercápnica na VNI em cinco passos e na DPOC', () => {
  assert.match(NOTA_ATS_HIPERCAPNICA, /^ATS 2026: na IRpA hipercápnica/)
  assert.match(NOTA_ATS_HIPERCAPNICA, /Concorda com o livro\.$/)
  conferirFicha(fichaVniPassos, ATS_IRPA_2026)
  conferirFicha(fichaDpocAdulto, ATS_IRPA_2026)
  assert.match(pagina('ventilacao/VniCincoPassos.tsx'), /role="note"[^>]*>\{NOTA_ATS_HIPERCAPNICA\}/)
  assert.match(pagina('manual/DpocExacerbacaoAdulto.tsx'), /role="note"[^>]*>\{NOTA_ATS_HIPERCAPNICA\}/)
})

test('2.2 ATS 2026: pré-oxigenação na sequência rápida (H4 = A), sem mexer nas doses', () => {
  assert.match(NOTA_ATS_PRE_OXIGENACAO, /^ATS 2026: recomendação forte de CNAF ou VNI na pré-oxigenação/)
  conferirFicha(fichaIsrAdulto, ATS_IRPA_2026)
  assert.match(pagina('calculadoras/IsrAdulto.tsx'), /role="note"[^>]*>\{NOTA_ATS_PRE_OXIGENACAO\}/)
})

test('2.3 SCCM 2026: nota na linha do bloqueio neuromuscular da SDRA', () => {
  conferirFonte(SCCM_BNM_2026, '41773929')
  assert.match(NOTA_SCCM_BNM, /^SCCM 2026 \(posterior ao livro e às diretrizes ATS 2024 e ESICM 2023\)/)
  assert.match(NOTA_SCCM_BNM, /As três posições ficam lado a lado\.$/)
  conferirFicha(fichaSdraAdulto, SCCM_BNM_2026)
  assert.equal(DIRETRIZ_SDRA_2024.find((d) => d.tema === 'Bloqueio neuromuscular')!.nota, NOTA_SCCM_BNM)
  assert.equal(DIRETRIZ_SDRA_2024.filter((d) => d.nota).length, 1)
  assert.match(pagina('manual/SdraVentilacaoAdulto.tsx'), /d\.nota && <p role="note"/)
})

test('2.4 HSA: ESO/EANS/ESMINT no antifibrinolítico e NCS 2026 na fenitoína (H5 = A)', () => {
  conferirFonte(ESO_HSA_2026, '42095754')
  conferirFonte(NCS_HSA_2026, '42552475')
  conferirFicha(fichaHsaAdulto, ESO_HSA_2026, NCS_HSA_2026)
  assert.match(NOTA_ESO_ANTIFIBRINOLITICO, /^ESO\/EANS\/ESMINT 2026:/)
  assert.match(NOTA_NCS_FENITOINA, /^NCS 2026 \(posterior à AHA 2023\)/)
  assert.equal(DIRETRIZ_HSA_2023.find((d) => d.tema.startsWith('Antifibrinolítico'))!.nota, NOTA_ESO_ANTIFIBRINOLITICO)
  const fenitoina = DIRETRIZ_HSA_2023.find((d) => d.tema === 'Fenitoína')!
  assert.equal(fenitoina.nota, NOTA_NCS_FENITOINA)
  assert.equal(fenitoina.classe, '3: dano, B-NR')
  assert.equal(DIRETRIZ_HSA_2023.filter((d) => d.nota).length, 2)
  assert.match(pagina('manual/HsaAdulto.tsx'), /d\.nota && <p role="note"/)
})

test('2.6 desmame: AARC 2024 e o ECR do JAMA 2024 no bloco do TRE', () => {
  conferirFonte(AARC_TRE_2024, '38443142')
  conferirFonte(BURNS_TRE_2024, '39382222')
  assert.match(NOTA_AARC_TRE, /^AARC 2024 \(posterior ao livro; recomendações condicionais\)/)
  conferirFicha(fichaDesmameAdulto, AARC_TRE_2024, BURNS_TRE_2024)
  assert.match(pagina('manual/DesmameVmAdulto.tsx'), /role="note"[^>]*>\{NOTA_AARC_TRE\}/)
})

test('2.7 MASCC 2026: nota nos cuidados do escore, com o original mantido', () => {
  conferirFonte(MASCC_2026, '42525130')
  assert.match(NOTA_MASCC_2026, /^Consenso MASCC 2026:/)
  conferirFicha(mascc.ficha, MASCC_2026)
  assert.ok(mascc.ficha.fontes.some((f) => /Klastersky/.test(f.citacao)))
  const r = mascc.calcular({ sintomas: 0, hipotensao: 1, dpoc: 1, tumor: 1, desidratacao: 1, ambulatorial: 1, idade: 1 })!
  assert.ok(r.cuidados?.includes(NOTA_MASCC_2026))
})
