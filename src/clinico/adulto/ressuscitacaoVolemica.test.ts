import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  CORTES_LACTATO, DIRETRIZES_2026, PEDIATRICO_NAO_IMPLEMENTADO, SOLUCOES_TABELA5, VASOPRESSINA_SSC_PRATICA, diureseMinimaMlH, diureseMlKgH, fichaRessuscitacaoAdulto,
  gatilhoVasopressina, lactatoMgDl, lactatoMmol, reducaoLactato, sodioNoVolume, somaSolutos, vazaoAliquota, vcSepse, volumeSepse,
} from './ressuscitacaoVolemica.ts'

test('ressuscitação: ficha adulto dos caps. 4 e 7 + SSC 2026 + ILAS jul/2026, sem referência pediátrica', () => {
  assert.equal(fichaRessuscitacaoAdulto.publico, 'adulto')
  assert.match(fichaRessuscitacaoAdulto.id, /^adulto-[a-z0-9-]+$/)
  assert.equal(fichaRessuscitacaoAdulto.versao, '2026-09-28.1')
  assert.equal(fichaRessuscitacaoAdulto.fontes.length, 3)
  assert.match(fichaRessuscitacaoAdulto.fontes[1].citacao, /Surviving Sepsis Campaign.*2026.*rec/i)
  assert.match(fichaRessuscitacaoAdulto.fontes[2].citacao, /ILAS.*julho de 2026/)
  assert.equal(temReferenciaPediatrica(fichaRessuscitacaoAdulto), false)
  assert.ok(PEDIATRICO_NAO_IMPLEMENTADO.length > 0)
})

test('SSC 2026 × ILAS × livro: cada linha tem tema e pelo menos uma fonte com página', () => {
  assert.ok(DIRETRIZES_2026.length >= 12)
  for (const d of DIRETRIZES_2026) {
    assert.ok(d.tema)
    const fontes = [d.ssc, d.ilas, d.livro].filter(Boolean)
    assert.ok(fontes.length >= 1, d.tema)
    for (const f of fontes) assert.match(f!.pagina, /p\. \d+/, d.tema)
  }
  const volume = DIRETRIZES_2026.find((d) => d.tema === 'Volume inicial')!
  assert.match(volume.ssc!.texto, /30 mL\/kg.*3 horas.*condicional/)
  assert.match(volume.ilas!.texto, /até 30 mL\/kg.*3 horas/i)
  const pam = DIRETRIZES_2026.find((d) => d.tema === 'Meta de PAM')!
  assert.match(pam.ssc!.texto, /65 mmHg.*60–65 mmHg/)
})

test('sepse: 30 mL/kg na 1ª hora (livro) ou em 3 h (SSC 2026/ILAS), alíquotas de 250–500 mL (p. 122) ou de 200 mL (p. 74)', () => {
  assert.deepEqual(volumeSepse(70), { totalMl: 2100, mlH: 2100, mlHEm3h: 700, aliquotas: [5, 9], aliquotasDe200: 11 })
  assert.equal(volumeSepse(0), null)
  assert.equal(vazaoAliquota(500, 10), 3000)
  assert.equal(vazaoAliquota(200, 10), 1200)
  assert.equal(vazaoAliquota(0, 10), null)
})

test('metas: diurese 0,5 mL/kg/h (p. 67/72)', () => {
  assert.equal(diureseMinimaMlH(80), 40)
  assert.deepEqual(diureseMlKgH(120, 4, 60), { mlKgH: 0.5, abaixoDe05: false })
  assert.equal(diureseMlKgH(100, 4, 60)!.abaixoDe05, true)
  assert.equal(diureseMlKgH(100, 0, 60), null)
})

test('lactato: 18 mg/dL = 2 mmol/L (p. 120) e meta de queda de 20% em 2 h (p. 72)', () => {
  assert.equal(lactatoMmol(36), 4)
  assert.equal(lactatoMgDl(2), 18)
  assert.deepEqual(CORTES_LACTATO.map((c) => c.mgDl), [13.5, 18, 36])
  const r = reducaoLactato(4, 3.2)!
  assert.ok(Math.abs(r.reducaoPct - 20) < 1e-9)
  assert.equal(r.atingiuMeta20, true)
  assert.ok(Math.abs(r.alvoMax - 3.2) < 1e-9)
  assert.equal(reducaoLactato(4, 3.5)!.atingiuMeta20, false)
  assert.equal(reducaoLactato(0, 1), null)
})

test('vasopressina: cap. 4 (> 5 µg/min após 6 h ou > 15 µg/min em 3 h) x cap. 7 (> 5 µg/min por mais de 6 h) x prática SSC 2026 (0,3 µg/kg/min)', () => {
  const semPeso = { ugKgMin: null, sscPratica: null }
  assert.deepEqual(gatilhoVasopressina(8, 'ug/min', 6), { ugMin: 8, cap4Seis: true, cap4Tres: false, cap7: false, ...semPeso })
  assert.deepEqual(gatilhoVasopressina(8, 'ug/min', 7), { ugMin: 8, cap4Seis: true, cap4Tres: false, cap7: true, ...semPeso })
  assert.deepEqual(gatilhoVasopressina(20, 'ug/min', 3), { ugMin: 20, cap4Seis: false, cap4Tres: true, cap7: false, ...semPeso })
  assert.equal(gatilhoVasopressina(0.25, 'ug/kg/min', 4, 80)!.ugMin, 20)
  assert.equal(gatilhoVasopressina(0.25, 'ug/kg/min', 4), null)
  assert.equal(gatilhoVasopressina(5, 'ug/min', 10)!.cap7, false) // > 5, não ≥ 5
  // prática do painel da SSC 2026 (p. 42): 0,3 µg/kg/min — só com peso
  assert.equal(VASOPRESSINA_SSC_PRATICA.ugKgMin, 0.3)
  assert.equal(gatilhoVasopressina(0.3, 'ug/kg/min', 1, 70)!.sscPratica, true)
  assert.equal(gatilhoVasopressina(0.25, 'ug/kg/min', 1, 70)!.sscPratica, false)
  assert.equal(gatilhoVasopressina(21, 'ug/min', 1, 70)!.ugKgMin, 0.3)
  assert.equal(gatilhoVasopressina(21, 'ug/min', 1, 70)!.sscPratica, true)
})

test('soluções: Tabela 5 (p. 74) e a osmolaridade impressa do Ringer lactato fica anotada', () => {
  const rl = SOLUCOES_TABELA5.find((s) => s.id === 'rl')!
  assert.equal(rl.osm, 208)
  assert.ok(somaSolutos(rl) > rl.osm!)
  assert.ok(rl.nota)
  assert.equal(sodioNoVolume('sf', 1000), 154)
  assert.equal(sodioNoVolume('rl', 500), 65.5)
  assert.equal(sodioNoVolume('x', 500), null)
})

test('VM na sepse: VC 4–6 mL/kg (Tabela 12, p. 127)', () => {
  assert.deepEqual(vcSepse(70), [280, 420])
  assert.equal(vcSepse(-1), null)
})
