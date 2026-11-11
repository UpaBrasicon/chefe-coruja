import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ANGIOEDEMA_POS_ALTEPLASE, CORRECAO_AHA_2026, DIRETRIZ_AVC_2026, TENECTEPLASE_2026, fichaTromboliseAvcAdulto, tenecteplase2026 } from './avcTrombolise.ts'

// AHA/ASA 2026 (Stroke 2026;57:e316–e436), lida no PDF em 28/09/2026.

test('ficha de trombólise: versão .1 de 28/09 ou posterior com o manual e a AHA/ASA 2026', () => {
  // a .1 de 06/11/2026 acrescentou o INTERACT4 e a ESO 2025 (revisão PubMed, itens médios)
  assert.ok(fichaTromboliseAvcAdulto.versao >= '2026-09-28.1')
  assert.ok(fichaTromboliseAvcAdulto.fontes.length >= 2)
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

// Correção oficial da AHA/ASA 2026 (Stroke 2026;57(8):e461–e467), lida em 11/11/2026; decisão do RT D1–D3 = A.
test('correção AHA 2026: janela estendida só sem indicação de trombectomia e "pode ser benéfica"', () => {
  const j = DIRETRIZ_AVC_2026.find((d) => d.tema === 'Janela estendida com imagem')
  assert.ok(j)
  assert.match(j.texto, /Sem indicação de trombectomia/)
  assert.match(j.texto, /pode ser benéfica/)
  assert.match(j.pagina, /e463/)
  assert.match(j.classe, /não informa/)
})
test('correção AHA 2026: adrenalina do angioedema IM, com o SC do livro como errata', () => {
  const adr = ANGIOEDEMA_POS_ALTEPLASE.itens.find((i) => /epinefrina/.test(i))
  assert.ok(adr)
  assert.match(adr, /0,3 mL IM/)
  assert.doesNotMatch(adr, /SC/)
  assert.match(ANGIOEDEMA_POS_ALTEPLASE.errata, /SC.*IM/)
})
test('correção AHA 2026: aviso lido em 11/11 e ficha com a correção nas fontes', () => {
  assert.match(CORRECAO_AHA_2026.texto, /lida em 11\/11\/2026/)
  assert.doesNotMatch(CORRECAO_AHA_2026.texto, /confira na versão corrigida/)
  assert.equal(fichaTromboliseAvcAdulto.versao, '2026-11-11.1')
  assert.ok(fichaTromboliseAvcAdulto.fontes.some((f) => /Correction to: 2026 Guideline/.test(f.citacao)))
})
