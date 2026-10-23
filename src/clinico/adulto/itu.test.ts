// node --experimental-strip-types --test src/clinico/adulto/itu.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { CISTITE, PIELONEFRITE, aminoglicosideo, duracaoItu } from './itu.ts'

test('itu: aminoglicosídeo por peso — amicacina 15 mg/kg, gentamicina 5 mg/kg (p. 1213)', () => {
  assert.deepEqual(aminoglicosideo(70), { amicacinaMg: 1050, gentamicinaMg: 350 })
  assert.equal(aminoglicosideo(0), null)
})
test('itu: cistite — 3 dias; homem pelo menos 7 (p. 1212–1213)', () => {
  assert.match(duracaoItu({ quadro: 'cistite' }).manual.texto, /3 dias/)
  assert.match(duracaoItu({ quadro: 'cistite', homem: true }).manual.texto, /7 dias/)
  assert.equal(duracaoItu({ quadro: 'cistite' }).idsa, null)
})
test('itu: pielonefrite — manual 7 a 14 dias; IDSA 5–7 (fluoroquinolona) ou 7', () => {
  const d = duracaoItu({ quadro: 'pielonefrite' })
  assert.match(d.manual.texto, /7 a 14 dias/)
  assert.match(d.idsa!.texto, /5–7 dias de fluoroquinolona ou 7 dias/)
})
test('itu: homem febril com suspeita de prostatite — 10–14 dias (IDSA 2025)', () => {
  assert.match(duracaoItu({ quadro: 'pielonefrite', homem: true, prostatiteSuspeita: true }).idsa!.texto, /10–14 dias/)
})
test('itu: trechos ambíguos do livro ficam com errata, sem intervalo inventado', () => {
  const smx = CISTITE.find((e) => e.droga.startsWith('Sulfa'))!
  assert.equal(smx.dose, '160/800 mg')
  assert.ok(smx.errata)
  assert.ok(CISTITE.find((e) => e.droga === 'Norfloxacina')!.errata)
})
test('itu: pielonefrite sem norfloxacina (não penetra no trato alto)', () => {
  assert.equal(PIELONEFRITE.some((e) => e.droga === 'Norfloxacina'), false)
})
