// Testes do texto dos vigias (rodada D) — sem banco.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { textoPorta } from './vigias.js'

test('Porta: resumo só com números, cor a cor, sem identidade', () => {
  const t = textoPorta('UPA Centro', {
    janela_horas: 12, fichas: 14, atendidos: 12, evasoes: 1, aguardando_agora: 3,
    por_cor: { laranja: { atendidos: 3, dentro_do_alvo: 2, espera_media_min: 12 }, verde: { atendidos: 9, dentro_do_alvo: 9, espera_media_min: 40 } },
  })
  assert.match(t, /14 fichas · 12 atendidos · 1 evasões · 3 aguardando agora/)
  assert.match(t, /Laranja: 2\/3 no tempo-alvo \(espera média 12 min\)/)
  assert.ok(t.indexOf('Laranja') < t.indexOf('Verde'), 'mais grave primeiro')
})
