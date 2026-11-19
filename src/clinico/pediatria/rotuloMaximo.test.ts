// node --experimental-strip-types --test src/clinico/pediatria/rotuloMaximo.test.ts
// Rótulo do máximo (19/11/2026, achado do lote D11): quando o teto não é do
// livro, a tela diz de onde ele vem em vez de "máximo do livro".
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { BOLUS, fichaBolusPediatrico } from './bolus.ts'
import { DROGAS_RCP, fichaRcpPediatrica } from './rcp.ts'
import { DOSES_SRI, fichaViaAereaPediatrica } from './viaAerea.ts'

const fonte = (lista: { id: string; fonteMaximo?: string }[], id: string) => lista.find((d) => d.id === id)?.fonteMaximo

test('tetos que vieram de fora do livro no lote D11 têm a fonte do máximo', () => {
  assert.equal(fonte(DROGAS_RCP, 'atropina'), 'AHA 2025 e Coreia 2025')
  assert.equal(fonte(DROGAS_RCP, 'cloreto-calcio'), 'Coreia 2025')
  assert.equal(fonte(DROGAS_RCP, 'magnesio'), 'Coreia 2025')
  assert.equal(fonte(DOSES_SRI, 'atropina'), 'AHA 2025 e Coreia 2025')
  assert.equal(fonte(BOLUS, 'epinefrina-pcr'), 'AHA 2025')
  assert.equal(fonte(BOLUS, 'diazepam-iv-menor5'), 'AES 2016')
  // o teto do livro continua sem o campo (a tela diz "do livro")
  assert.equal(fonte(DROGAS_RCP, 'amiodarona'), undefined)
  assert.equal(fonte(BOLUS, 'diazepam-iv-maior5'), undefined)
})

test('as três fichas sobem para 2026-11-19.2', () => {
  for (const f of [fichaRcpPediatrica, fichaViaAereaPediatrica, fichaBolusPediatrico]) {
    assert.equal(f.versao, '2026-11-19.2', f.id)
    assert.match(f.revisadoEm, /rótulo do máximo/)
  }
})

test('as telas usam a fonte do máximo em vez de "máximo do livro" fixo', () => {
  const tela = (n: string) => readFileSync(new URL(`../../pages/plantonista/pediatria/${n}`, import.meta.url), 'utf8')
  for (const n of ['PecasP2.tsx', 'RcpPediatrica.tsx', 'ViaAereaPediatrica.tsx', 'BolusPediatrico.tsx']) {
    assert.ok(!/máximo do livro/.test(tela(n)), `${n} ainda fixa "máximo do livro"`)
    assert.ok(tela(n).includes('doMaximo('), `${n} sem doMaximo`)
  }
  assert.ok(tela('PecasP4.tsx').includes('b.fonteMaximo'))
})
