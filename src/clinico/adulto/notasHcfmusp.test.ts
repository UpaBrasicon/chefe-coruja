// Lote 1 da revisão do HCFMUSP (decisão do RT de 13/11/2026, L1–L3 = A).
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { NOTAS_HCFMUSP, NOTAS_HCFMUSP_LOTE1, NOTAS_HCFMUSP_LOTE2, textoNota } from './notasHcfmusp.ts'
import { GINA_ITENS } from './asmaDpoc.ts'
import { DBHA_2025_ALVOS, DIFERENCAS_EH_2025 } from './emergenciaHipertensiva.ts'
import { DIFERENCAS_FA_2024, DOSES_FA_2024 } from './fibrilacaoAtrial.ts'
import { DIFERENCAS_BRADI_2025 } from './pcr.ts'
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

test('lote 2: cinco notas (cap. 15, 17, 19, 30 e 67), itens das listas das fichas, só adulto', () => {
  assert.equal(NOTAS_HCFMUSP_LOTE2.length, 5)
  assert.equal(NOTAS_HCFMUSP.length, NOTAS_HCFMUSP_LOTE1.length + 5)
  const ids = NOTAS_HCFMUSP.map((n) => n.ficha.id)
  assert.equal(new Set(ids).size, ids.length)
  const caps = NOTAS_HCFMUSP_LOTE2.map((n) => n.capitulos).join(' ')
  for (const c of [15, 17, 19, 30, 67]) assert.match(caps, new RegExp(`cap\\. ${c}\\b`), `cap. ${c}`)
  const porId = (id: string) => NOTAS_HCFMUSP_LOTE2.find((n) => n.ficha.id === id)!
  assert.equal(porId('nota-hcfmusp-cap15-bradiarritmias').itens.length, DIFERENCAS_BRADI_2025.length)
  assert.equal(porId('nota-hcfmusp-cap17-fa').itens.length, DIFERENCAS_FA_2024.length + DOSES_FA_2024.length)
  assert.equal(porId('nota-hcfmusp-cap19-emergencia-hipertensiva').itens.length, DBHA_2025_ALVOS.length + DIFERENCAS_EH_2025.length)
  assert.equal(porId('nota-hcfmusp-cap30-asma').itens.length, GINA_ITENS.length)
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
