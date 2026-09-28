import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  CATEGORIAS_FIGURA1, ERRATA_FAIXAS_HOLLIDAY, ERRATA_TABELAS_SOLUCOES, EXEMPLO_LIVRO, MAX_ML_H, SOLUCOES_PADRAO, composicao, expansaoMl, fichaManutencaoPed,
  hollidaySegarMlDia, manutencao, regraPraticaMlH, volumeCategoria,
} from './manutencao.ts'

const r0 = (x: number | null | undefined) => Math.round(x!)
const sol = (id: string) => SOLUCOES_PADRAO.find((s) => s.id === id)!

test('manutenção: ficha do livro do ICr, pediátrica, com página', () => {
  assert.equal(fichaManutencaoPed.publico, 'pediatrico')
  assert.equal(temReferenciaPediatrica(fichaManutencaoPed), true)
  assert.match(fichaManutencaoPed.fontes[0].citacao, /Pronto-Socorro\. 4ª ed\..*ISBN 978-65-5576-759-9\. cap\. 77, p\. 838–843\./)
  assert.equal(fichaManutencaoPed.versao, '2026-09-27.3')
})

test('Holliday-Segar: exemplo do livro — 17 kg → 1.350 mL/dia, 56 mL/h; regra prática 54 mL/h (p. 841–842)', () => {
  const m = manutencao(EXEMPLO_LIVRO.pesoKg)!
  assert.equal(m.mlDia, EXEMPLO_LIVRO.mlDia)
  assert.equal(Math.floor(m.mlHCalculado), EXEMPLO_LIVRO.mlH) // 1.350/24 = 56,25
  assert.equal(m.praticaMlH, EXEMPLO_LIVRO.praticaMlH)
})

test('Holliday-Segar: faixas contínuas nas bordas (errata das faixas 10–11 e 20–21 kg)', () => {
  assert.equal(hollidaySegarMlDia(10), 1000)
  assert.equal(hollidaySegarMlDia(10.5), 1025)
  assert.equal(hollidaySegarMlDia(20), 1500)
  assert.equal(hollidaySegarMlDia(20.5), 1510)
  assert.equal(hollidaySegarMlDia(5), 500)
  assert.equal(hollidaySegarMlDia(30), 1700)
  assert.equal(regraPraticaMlH(10), 40)
  assert.equal(regraPraticaMlH(20), 60)
  assert.equal(regraPraticaMlH(30), 70)
  assert.match(ERRATA_FAIXAS_HOLLIDAY, /11-20/)
  assert.equal(hollidaySegarMlDia(0), null)
  assert.equal(hollidaySegarMlDia(-3), null)
})

test('Holliday-Segar: teto de 100 mL/h do livro (p. 840–841)', () => {
  const m = manutencao(70)!
  assert.equal(m.mlDia, 2500)
  assert.equal(r0(m.mlHCalculado), 104)
  assert.equal(m.mlH, MAX_ML_H)
  assert.equal(m.praticaMlH, 100) // 60 + 50 = 110 → 100
  assert.equal(m.noTeto, true)
  assert.equal(manutencao(17)!.noTeto, false)
})

test('Tabela 2: o preparo reproduz os números do livro (136/34 mEq de Na, 25 de K, osm 570) e a errata do cloreto e da osm hipotônica', () => {
  const iso = composicao(sol('isotonica'))
  const hipo = composicao(sol('hipotonica'))
  assert.equal(iso.naMeq, 136)
  assert.equal(hipo.naMeq, 34)
  assert.equal(iso.kMeq, 25)
  assert.equal(iso.glicoseG, 50)
  assert.equal(r0(iso.osmMOsmL), 571) // livro: 570
  assert.equal(iso.clMeq, 161) // livro imprime 151
  assert.notEqual(iso.clMeq, sol('isotonica').livro.cl)
  assert.equal(hipo.clMeq, sol('hipotonica').livro.cl) // 59 bate
  assert.equal(r0(hipo.osmMOsmL), 388) // livro imprime 321
  assert.match(ERRATA_TABELAS_SOLUCOES, /161/)
  assert.match(ERRATA_TABELAS_SOLUCOES, /388/)
})

test('Figura 1: frações do volume calculado e expansão de 20 mL/kg (p. 842)', () => {
  const cat = (id: string) => CATEGORIAS_FIGURA1.find((c) => c.id === id)!
  assert.deepEqual(cat('oligurico').fracao, [0.25, 0.25])
  assert.deepEqual(cat('edematoso').fracao, [0.4, 0.6])
  assert.deepEqual(cat('concentracao').fracao, [1.2, 1.2])
  const [a, b] = volumeCategoria(17, cat('edematoso'))!
  assert.equal(Math.round(a * 10) / 10, 22.5)
  assert.equal(Math.round(b * 10) / 10, 33.8)
  assert.equal(volumeCategoria(70, cat('concentracao'))![0], 100) // teto
  assert.equal(expansaoMl(12), 240)
  assert.equal(expansaoMl(0), null)
})
