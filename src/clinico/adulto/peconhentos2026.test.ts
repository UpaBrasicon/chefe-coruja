import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ACIDENTES, MS_2026_PECONHENTOS, fichaPeconhentosAdulto } from './peconhentos.ts'

// PCDT escorpiônicos 2026 e portal do MS (aranhas), ao lado do manual do HC.

test('peçonhentos adulto: ficha .1 de 28/09 com o manual, o PCDT escorpiônicos, o portal das aranhas e o PCDT ofídicos citados', () => {
  assert.equal(fichaPeconhentosAdulto.versao, '2026-09-28.1')
  assert.equal(fichaPeconhentosAdulto.fontes.length, 4)
  assert.match(fichaPeconhentosAdulto.fontes[1].citacao, /Acidentes Escorpiônicos.*2026/)
  assert.match(fichaPeconhentosAdulto.fontes[3].citacao, /Acidentes Ofídicos.*Portaria SECTICS\/MS nº 83/)
  assert.equal(fichaPeconhentosAdulto.publico, 'adulto')
})

test('MS × manual: escorpião moderado ganha 3 ampolas em qualquer idade; grave 6 (máx. 6); Latrodectus sem soro; serpentes seguem o manual', () => {
  const t = (tema: string) => MS_2026_PECONHENTOS.find((d) => d.tema === tema)!
  assert.match(t('Escorpião moderado').ms, /3 frascos-ampolas.*independentemente da idade/)
  assert.match(t('Escorpião grave').ms, /6 frascos-ampolas.*não administrar mais de 6/)
  assert.match(t('Latrodectus').ms, /não há soro disponível/)
  assert.match(t('Serpentes').ms, /não lido/)
  // o manual continua com os valores impressos para as serpentes
  const bot = ACIDENTES.find((a) => a.id === 'botropico')!
  assert.deepEqual(bot.classes.map((c) => c.ampolas), [[2, 4], [4, 8], [8, 12]])
  for (const d of MS_2026_PECONHENTOS) assert.ok(d.pagina, d.tema)
})
