import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import type { Ficha, Fonte } from '../ficha.ts'
import { BICARICU2_2025, NOTA_BICARICU2, fichaBicarbonato } from './acidobase.ts'
import { BAP_SUBSTANCIAS_2026, FENOBARBITAL_PS_2024, NOTA_ABSTINENCIA_FENOBARBITAL, fichaAbstinenciaAlcoolica } from './abstinenciaAlcoolica.ts'
import { GALEN_2024, NOTA_GALEN_2024, fichaAnafilaxiaAdulto } from './anafilaxia.ts'
import { DRESS_DELPHI_2024, NOTA_DRESS_DELPHI, regiscar } from './dermatoses.ts'
import { EAPC_SEDACAO_2024, NOTA_EAPC_SEDACAO, fichaPaliativoAdulto } from './dorAnalgesia.ts'
import { NOTA_TASC_STA, TASC_2025, fichaFalciformeAdulto } from './falciforme.ts'
import { BASAL_PRECOCE_CAD_2026, NOTA_BASAL_PRECOCE_CAD, fichaCadEhhAvaliacao, fichaCadEhhTratamento } from './glicemia.ts'
import { ESGE_UGIH_2026, NOTA_ESGE_2026, fichaHemorragiaDigestiva } from './hemorragiaDigestiva.ts'
import { ACG_ALD_2024, NOTA_ACG_HEPATITE_ALCOOLICA, fichaMaddrey, maddrey } from './hepatopata.ts'
import {
  AHA_ESPECIAIS_2025, AHA_INTOX_2023, DIGOXINA_CONSENSO_2023, DIGOXINA_CONSENSO_2024, NOTA_AHA_INTOXICACOES, NOTA_DIGOXINA_CONSENSO,
  fichaIntoxicacoesAdulto,
} from './intoxicacoes.ts'
import { ENMC_RABDO_2025, NOTA_ENMC_RABDO, fichaRabdomiolise } from './renal.ts'
import { HIPERNATREMIA_CORRECAO_2025, NOTA_HIPERNATREMIA_VELOCIDADE, fichaHipernatremia } from './sodio.ts'
import {
  CRYOSTAT2_2023, NOTA_ENSAIOS_NEGATIVOS_TRAUMA, NOTA_PATCH_TRAUMA, PATCH_TRAUMA_2023, PROCOAG_2023, SANGUE_TOTAL_SMITH_2026, SANGUE_TOTAL_SPERRY_2026,
  UK_REBOA_2023, fichaTraumaAdulto,
} from './trauma.ts'
import { fichaAnafilaxiaPediatrica } from '../pediatria/anafilaxia.ts'

// Revisão PubMed de 09/10/2026, itens de prioridade média, área 2b (decisão do
// RT de 06/11/2026: A em H1 a H22). Cada item: a fonte com o PMID certo, a
// ficha na versão de 06/11 ou posterior com a fonte, a nota exportada e a
// tela que a mostra.

const VERSAO = '2026-11-06.1'
const pagina = (nome: string) => readFileSync(new URL(`../../pages/plantonista/manual/${nome}`, import.meta.url), 'utf8')

function confere(fonte: Fonte, pmid: string, ficha: Ficha) {
  assert.match(fonte.citacao, new RegExp(`PMID ${pmid}\\)`), pmid)
  assert.match(fonte.citacao, /et al\.|Investigators/, pmid)
  assert.match(fonte.url ?? '', /^https:\/\/doi\.org\/10\./, pmid)
  assert.ok(ficha.versao >= VERSAO, `${ficha.id} ${ficha.versao}`)
  assert.ok(ficha.fontes.includes(fonte), `${ficha.id} sem ${pmid}`)
  assert.match(ficha.revisadoEm, /^06\/11\/2026 .*revisão PubMed, itens médios/, ficha.id)
}

function naTela(arquivo: string, nota: string) {
  const fonte = pagina(arquivo)
  assert.ok(fonte.includes(`{${nota}}`), `${arquivo} não mostra ${nota}`)
}

/** Nenhuma nota traz dose: sem mg, mg/kg, U/kg, mL/kg nem g de droga. */
function semDose(nota: string) {
  assert.doesNotMatch(nota, /\d\s*(mg|U\/kg|UI|mL\/kg|mcg|µg)\b/, nota.slice(0, 40))
}

const ENTRE = { tp: 20, controle: 13, bt: 5 }

test('3.1 hepatite alcoólica: ACG 2024 em cuidados e descrição do Maddrey', () => {
  confere(ACG_ALD_2024, '38174913', fichaMaddrey)
  assert.equal(maddrey.ficha, fichaMaddrey)
  assert.match(NOTA_ACG_HEPATITE_ALCOOLICA, /MELD > 20/)
  assert.match(NOTA_ACG_HEPATITE_ALCOOLICA, /mantém o Maddrey e o corte do livro/)
  assert.ok(maddrey.calcular(ENTRE)!.cuidados!.includes(NOTA_ACG_HEPATITE_ALCOOLICA))
  assert.match(maddrey.descricao, /ACG 2024/)
})

test('3.2 úlcera péptica: ESGE 2026 (com a errata) no bloco das metas da HDA', () => {
  confere(ESGE_UGIH_2026, '42127996', fichaHemorragiaDigestiva)
  assert.match(ESGE_UGIH_2026.citacao, /PMID 42173116/)
  assert.match(NOTA_ESGE_2026, /≤ 6 h.*≤ 12 h/)
  assert.match(NOTA_ESGE_2026, /Doses não mudam/)
  naTela('HemorragiaDigestivaAdulto.tsx', 'NOTA_ESGE_2026')
})

test('3.3 STA: TASC como novidade, sem conduta nem dose (H6 = A)', () => {
  confere(TASC_2025, '40209087', fichaFalciformeAdulto)
  assert.match(NOTA_TASC_STA, /não muda a conduta do livro e não traz dose de anticoagulante/)
  semDose(NOTA_TASC_STA)
  naTela('FalciformeAdulto.tsx', 'NOTA_TASC_STA')
})

test('3.4 CAD: insulina basal precoce só no adulto, no bloco da transição', () => {
  confere(BASAL_PRECOCE_CAD_2026, '42405473', fichaCadEhhTratamento)
  assert.ok(!fichaCadEhhAvaliacao.fontes.includes(BASAL_PRECOCE_CAD_2026))
  assert.match(NOTA_BASAL_PRECOCE_CAD, /8 ECRs em adultos \(407 pacientes\)/)
  assert.match(NOTA_BASAL_PRECOCE_CAD, /Momento e dose da basal seguem o livro/)
  naTela('CadEhhTratamento.tsx', 'NOTA_BASAL_PRECOCE_CAD')
  const ped = readFileSync(new URL('../pediatria/cadPed.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(ped, /42405473/)
})

test('3.5 antídotos: nota AHA 2023/2025 e consenso da digoxina, sem conferir dose agora (H7 = A)', () => {
  confere(AHA_INTOX_2023, '37721023', fichaIntoxicacoesAdulto)
  confere(AHA_ESPECIAIS_2025, '41122889', fichaIntoxicacoesAdulto)
  confere(DIGOXINA_CONSENSO_2024, '39265879', fichaIntoxicacoesAdulto)
  confere(DIGOXINA_CONSENSO_2023, '37650725', fichaIntoxicacoesAdulto)
  assert.match(NOTA_AHA_INTOXICACOES, /ainda não foram conferidas/)
  assert.match(NOTA_DIGOXINA_CONSENSO, /33 enunciados/)
  assert.match(NOTA_DIGOXINA_CONSENSO, /O cálculo de frascos segue o livro/)
  semDose(NOTA_AHA_INTOXICACOES)
  semDose(NOTA_DIGOXINA_CONSENSO)
  naTela('IntoxicacoesAntidotosAdulto.tsx', 'NOTA_AHA_INTOXICACOES')
  naTela('IntoxicacoesAntidotosAdulto.tsx', 'NOTA_DIGOXINA_CONSENSO')
})

test('3.6 anafilaxia: GALEN 2024 só no adulto, no bloco da WAO 2020', () => {
  confere(GALEN_2024, '39880313', fichaAnafilaxiaAdulto)
  assert.ok(!fichaAnafilaxiaPediatrica.fontes.some((f) => f.citacao.includes('39880313')))
  assert.match(NOTA_GALEN_2024, /mantém os critérios da WAO 2020 e as doses atuais/)
  naTela('AnafilaxiaAdulto.tsx', 'NOTA_GALEN_2024')
})

test('3.7 trauma: PATCH no ácido tranexâmico e ensaios negativos na circulação', () => {
  confere(PATCH_TRAUMA_2023, '37314244', fichaTraumaAdulto)
  confere(CRYOSTAT2_2023, '37824155', fichaTraumaAdulto)
  confere(UK_REBOA_2023, '37824132', fichaTraumaAdulto)
  confere(PROCOAG_2023, '36942533', fichaTraumaAdulto)
  confere(SANGUE_TOTAL_SMITH_2026, '41841706', fichaTraumaAdulto)
  confere(SANGUE_TOTAL_SPERRY_2026, '42150044', fichaTraumaAdulto)
  assert.match(NOTA_PATCH_TRAUMA, /53,7% × 53,5%/)
  assert.match(NOTA_ENSAIOS_NEGATIVOS_TRAUMA, /CRYOSTAT-2.*UK-REBOA.*PROCOAG/)
  assert.doesNotMatch(NOTA_PATCH_TRAUMA, /90 min/)
  naTela('TraumaInicialAdulto.tsx', 'NOTA_PATCH_TRAUMA')
  naTela('TraumaInicialAdulto.tsx', 'NOTA_ENSAIOS_NEGATIVOS_TRAUMA')
})

test('3.8 hipernatremia: nota da velocidade, limite do livro mantido (H8 = A)', () => {
  confere(HIPERNATREMIA_CORRECAO_2025, '39765195', fichaHipernatremia)
  assert.match(NOTA_HIPERNATREMIA_VELOCIDADE, /limite do manual .* continua/)
  semDose(NOTA_HIPERNATREMIA_VELOCIDADE)
  naTela('HipernatremiaManual.tsx', 'NOTA_HIPERNATREMIA_VELOCIDADE')
})

test('3.8 bicarbonato: BICARICU-2', () => {
  confere(BICARICU2_2025, '41159812', fichaBicarbonato)
  assert.match(NOTA_BICARICU2, /62,1% × 61,7%/)
  semDose(NOTA_BICARICU2)
  naTela('AcidoBase.tsx', 'NOTA_BICARICU2')
})

test('3.8 rabdomiólise: divergência do corte de CPK do ENMC, critério do livro mantido (H9 = A)', () => {
  confere(ENMC_RABDO_2025, '40220353', fichaRabdomiolise)
  assert.match(NOTA_ENMC_RABDO, /10\.000 UI\/L.*5\.000 UI\/L/)
  assert.match(NOTA_ENMC_RABDO, /mantém o critério do livro/)
  naTela('RabdomioliseAdulto.tsx', 'NOTA_ENMC_RABDO')
})

test('3.8 DRESS: consenso Delphi 2024 nos cuidados do RegiSCAR', () => {
  confere(DRESS_DELPHI_2024, '37966824', regiscar.ficha)
  semDose(NOTA_DRESS_DELPHI)
  const r = Object.fromEntries(regiscar.itens.map((i) => [i.id, i.tipo === 'escolha' ? i.opcoes[0].valor : 0]))
  assert.ok(regiscar.calcular(r)!.cuidados!.includes(NOTA_DRESS_DELPHI))
})

test('3.8 sedação paliativa: EAPC 2024 no bloco do midazolam', () => {
  confere(EAPC_SEDACAO_2024, '38297460', fichaPaliativoAdulto)
  assert.match(NOTA_EAPC_SEDACAO, /proporcionalidade/)
  semDose(NOTA_EAPC_SEDACAO)
  naTela('SintomasPaliativosAdulto.tsx', 'NOTA_EAPC_SEDACAO')
})

test('3.8 abstinência alcoólica: fenobarbital no PS (metanálise 2024) e BAP 2026', () => {
  confere(FENOBARBITAL_PS_2024, '37923363', fichaAbstinenciaAlcoolica)
  confere(BAP_SUBSTANCIAS_2026, '41731947', fichaAbstinenciaAlcoolica)
  assert.match(NOTA_ABSTINENCIA_FENOBARBITAL, /1\.507 pacientes/)
  semDose(NOTA_ABSTINENCIA_FENOBARBITAL)
  naTela('Abstinencia.tsx', 'NOTA_ABSTINENCIA_FENOBARBITAL')
})
