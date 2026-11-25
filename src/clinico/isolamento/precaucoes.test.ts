import assert from 'node:assert/strict'
import { test } from 'node:test'

import { FONTES_PRECAUCAO, PRECAUCOES, fontesDaPrecaucao, precaucaoDoTipo } from './precaucoes.ts'

test('RG5: os cinco tipos têm quarto, paramentação e transporte, cada item com fonte e seção', () => {
  assert.deepEqual(Object.keys(PRECAUCOES).sort(), ['aerossol', 'contato', 'contato_aerossol', 'goticula', 'reverso'])
  for (const p of Object.values(PRECAUCOES)) {
    for (const grupo of [p.quarto, p.paramentacao, p.transporte]) {
      assert.ok(grupo.length > 0, `${p.tipo}: grupo vazio`)
      for (const i of grupo) {
        assert.ok(i.texto.trim().length > 20, `${p.tipo}: texto curto`)
        assert.ok(FONTES_PRECAUCAO[i.fonte], `${p.tipo}: fonte desconhecida`)
        assert.ok(i.secao.trim().length > 0, `${p.tipo}: sem seção`)
      }
    }
  }
})

test('RG5: toda fonte tem link https oficial (gov.br ou cdc.gov)', () => {
  for (const f of Object.values(FONTES_PRECAUCAO)) {
    assert.match(f.link, /^https:\/\/www\.(gov\.br\/anvisa|cdc\.gov)\//)
  }
})

test('RG5: o ambiente protetor vem do CDC (a Anvisa não trata dele)', () => {
  assert.deepEqual(fontesDaPrecaucao(PRECAUCOES.reverso).map((f) => f.id), ['cdc_2007'])
})

test('RG5: aerossol cita a N95/PFF2 e a pressão negativa da fonte', () => {
  assert.match(PRECAUCOES.aerossol.paramentacao[0].texto, /N95 ou PFF2/)
  assert.match(PRECAUCOES.aerossol.quarto[0].texto, /pressão negativa/)
})

test('precaucaoDoTipo: tipo desconhecido ou vazio dá null', () => {
  assert.equal(precaucaoDoTipo('x'), null)
  assert.equal(precaucaoDoTipo(null), null)
  assert.equal(precaucaoDoTipo('goticula')?.rotulo, 'Precaução para gotículas')
})
