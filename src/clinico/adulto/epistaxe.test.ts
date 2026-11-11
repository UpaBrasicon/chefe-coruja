// node --experimental-strip-types --test src/clinico/adulto/epistaxe.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { AAO_HNS_EPISTAXE_2020, EPISTAXE_AAO_HNS, NOPAC_2021, TRANEXAMICO_EPISTAXE_2026, fichaReversaoAnticoagulacaoAdulto } from './reversaoAnticoagulacao.ts'

// Escores P2/P3, item A12 (decisão B do RT, 11/11/2026).
test('epistaxe: fontes com o PMID certo, na ficha da reversão em versão nova', () => {
  assert.match(AAO_HNS_EPISTAXE_2020.citacao, /PMID 31910111/)
  assert.match(NOPAC_2021.citacao, /PMID 33612282/)
  assert.match(TRANEXAMICO_EPISTAXE_2026.citacao, /PMID 42297643/)
  assert.equal(fichaReversaoAnticoagulacaoAdulto.versao, '2026-11-11.1')
  for (const f of [AAO_HNS_EPISTAXE_2020, NOPAC_2021, TRANEXAMICO_EPISTAXE_2026]) assert.ok(fichaReversaoAnticoagulacaoAdulto.fontes.includes(f))
})
test('epistaxe: tratamento local antes de reverter, fora do risco de vida', () => {
  assert.match(EPISTAXE_AAO_HNS.principio, /risco de vida/)
  assert.match(EPISTAXE_AAO_HNS.principio, /antes de transfundir, reverter ou suspender/)
  assert.match(EPISTAXE_AAO_HNS.passos[0], /5 minutos ou mais/)
  assert.match(EPISTAXE_AAO_HNS.passos[1], /reabsorvível/)
})
test('epistaxe: tranexâmico só como divergência, sem dose', () => {
  assert.match(EPISTAXE_AAO_HNS.tranexamico, /conflitantes/)
  assert.match(EPISTAXE_AAO_HNS.tranexamico, /não traz dose/)
  for (const t of [EPISTAXE_AAO_HNS.tranexamico, ...EPISTAXE_AAO_HNS.passos]) assert.doesNotMatch(t, /\d\s?(mg|g|mL)\b/)
})
test('epistaxe: bloco na tela da reversão', () => {
  assert.match(readFileSync('src/pages/plantonista/manual/ReversaoAnticoagulacaoAdulto.tsx', 'utf8'), /EPISTAXE_AAO_HNS\.tranexamico/)
})
