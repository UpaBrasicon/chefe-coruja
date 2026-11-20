import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { ROTA_DA_FICHA } from '../clinico/indice.ts'
import { GUIA_ADULTO, GUIA_CRIANCA, ROTA_TODAS_FERRAMENTAS, cartaoDoGuia, rotasDoCartao } from './guiaRapido.ts'

// Guia rápido no celular e no tablet (F4; protótipo aprovado pelo RT em 17/11/2026).
const rotas = new Set(Object.values(ROTA_DA_FICHA))

test('todo cartão abre uma ferramenta que existe na Central', () => {
  for (const c of [...GUIA_ADULTO, ...GUIA_CRIANCA]) {
    for (const r of rotasDoCartao(c)) assert.ok(rotas.has(r), `rota sem ferramenta: ${c.nome} ${r}`)
  }
})

test('ordem do RT: parada primeiro nos dois; na criança o cartão junta a parada e a reanimação neonatal', () => {
  assert.equal(GUIA_ADULTO[0].nome, 'Parada e reanimação')
  assert.equal(GUIA_CRIANCA[0].nome, 'Parada e reanimação')
  assert.deepEqual(rotasDoCartao(GUIA_CRIANCA[0]), ['/plantonista/pediatria/rcp-pediatrica', '/plantonista/pediatria/reanimacao-neonatal'])
  assert.equal(cartaoDoGuia('parada-crianca')?.itens.length, 2)
  assert.equal(cartaoDoGuia(null), undefined)
  assert.equal(GUIA_ADULTO.length, 15)
  assert.equal(GUIA_CRIANCA.length, 12)
})

test('criança só abre telas da pediatria; adulto, nenhuma da pediatria', () => {
  assert.ok(GUIA_CRIANCA.flatMap(rotasDoCartao).every((r) => r.startsWith('/plantonista/pediatria/')))
  assert.ok(GUIA_ADULTO.flatMap(rotasDoCartao).every((r) => !r.startsWith('/plantonista/pediatria/')))
})

test('"Calculadoras e escores" leva à Central completa; a aba de baixo se chama Guia rápido', () => {
  assert.equal(ROTA_TODAS_FERRAMENTAS, '/plantonista?todas=1')
  const nav = readFileSync('src/components/casca/navegacao.ts', 'utf8')
  assert.match(nav, /\{ to: '\/plantonista', rotulo: 'Guia rápido', icone: Stethoscope \}/)
})
