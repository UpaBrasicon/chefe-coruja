import { test } from 'node:test'
import assert from 'node:assert/strict'

import { DIRETRIZ_AVC_2026, TENECTEPLASE_2026, fichaTromboliseAvcAdulto, tenecteplase2026 } from './avcTrombolise.ts'

// AHA/ASA 2026 (Stroke 2026;57:e316–e436), lida no PDF em 28/09/2026.

test('ficha de trombólise: versão .1 de 28/09 com o manual e a AHA/ASA 2026', () => {
  assert.equal(fichaTromboliseAvcAdulto.versao, '2026-09-28.1')
  assert.equal(fichaTromboliseAvcAdulto.fontes.length, 2)
  assert.match(fichaTromboliseAvcAdulto.fontes[0].citacao, /cap\. 38/)
  assert.match(fichaTromboliseAvcAdulto.fontes[1].citacao, /2026 Guideline for the Early Management.*Stroke\. 2026;57/)
})

test('tenecteplase 2026: 0,25 mg/kg, máximo 25 mg, e as faixas da Tabela 7 (p. 43)', () => {
  assert.equal(TENECTEPLASE_2026.mgKg, 0.25)
  assert.equal(TENECTEPLASE_2026.maxMg, 25)
  assert.deepEqual(tenecteplase2026(70), { mg: 17.5, limitadoAoTeto: false, faixaTabela7: { mg: 20, ml: 4, faixa: '70–< 80 kg' } })
  assert.deepEqual(tenecteplase2026(55), { mg: 13.75, limitadoAoTeto: false, faixaTabela7: { mg: 15, ml: 3, faixa: '< 60 kg' } })
  assert.deepEqual(tenecteplase2026(120), { mg: 25, limitadoAoTeto: true, faixaTabela7: { mg: 25, ml: 5, faixa: '≥ 90 kg' } })
  assert.equal(tenecteplase2026(89.9)!.faixaTabela7.mg, 22.5)
  assert.equal(tenecteplase2026(90)!.faixaTabela7.mg, 25)
  assert.equal(tenecteplase2026(0), null)
})

test('AHA/ASA 2026: cada item tem classe e página; os pontos-chave estão presentes', () => {
  assert.ok(DIRETRIZ_AVC_2026.length >= 12)
  for (const d of DIRETRIZ_AVC_2026) {
    assert.ok(d.tema && d.texto && d.classe, d.tema)
    assert.match(d.pagina, /p\. \d+/, d.tema)
  }
  const temas = DIRETRIZ_AVC_2026.map((d) => d.tema)
  assert.ok(temas.includes('Tenecteplase 0,4 mg/kg'))
  assert.match(DIRETRIZ_AVC_2026.find((d) => d.tema === 'PA após a trombólise')!.texto, /180\/105.*24 h/)
  assert.match(DIRETRIZ_AVC_2026.find((d) => d.tema === 'Redução intensiva da PAS após trombólise')!.classe, /COR 3/)
  assert.match(DIRETRIZ_AVC_2026.find((d) => d.tema === 'Glicemia')!.texto, /< 60.*140–180.*80–130/)
  assert.match(DIRETRIZ_AVC_2026.find((d) => d.tema.startsWith('Sangramento'))!.texto, /1\.000 mg IV em 10 min/)
})
