// node --experimental-strip-types --test src/clinico/adulto/meningite.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  QUIMIO_HIB, QUIMIO_MENINGOCOCO, TABELA2_MENINGITE, dosesPorPeso, fichaMeningiteAdulto, riscoListeria, rifampicinaMeningococoMg,
  suspeitaMeningite,
} from './meningite.ts'

test('meningite: suspeita com 2 dos 4 sinais clássicos (p. 589)', () => {
  assert.equal(suspeitaMeningite(1), false)
  assert.equal(suspeitaMeningite(2), true)
})
test('meningite: dexametasona 0,15 mg/kg/dose e aciclovir 10 mg/kg/dose (Tabela 2, p. 591)', () => {
  assert.deepEqual(dosesPorPeso(70), { dexametasonaMg: 0.15 * 70, aciclovirMg: 700 })
  assert.equal(dosesPorPeso(0), null)
})
test('meningite: risco de Listeria — acima de 50 anos, imunossupressão, corticoide, gestação (p. 592–593)', () => {
  assert.deepEqual(riscoListeria({ idadeAnos: 50 }), [])
  assert.deepEqual(riscoListeria({ idadeAnos: 51 }), ['acima de 50 anos'])
  assert.equal(riscoListeria({ imunossuprimido: true, corticoide: true, gestante: true }).length, 3)
})
test('meningite: empírico é ceftriaxona 2 g 12/12 h, e Listeria não recebe corticoide', () => {
  assert.match(TABELA2_MENINGITE[0].antibiotico, /^ceftriaxona 2 g EV 12\/12 h/)
  assert.equal(TABELA2_MENINGITE.find((e) => e.quem.startsWith('Listeria'))!.corticoide, 'não usar')
})

test('quimioprofilaxia: Quadro 3 do Guia de Vigilância 2024 (meningococo, p. 117), como o Guia traz', () => {
  assert.deepEqual(QUIMIO_MENINGOCOCO.map((l) => [l.droga, l.idade, l.dose, l.intervalo, l.duracao]), [
    ['Rifampicina', '< 1 mês', '5 mg/kg/dose', '12 em 12 horas', '2 dias'],
    ['Rifampicina', 'crianças ≥ 1 mês e adultos', '10 mg/kg/dose (máximo de 600 mg)', '12 em 12 horas', '2 dias'],
    ['Ceftriaxona', '< 12 anos', '125 mg intramuscular', '—', 'dose única'],
    ['Ceftriaxona', '≥ 12 anos', '250 mg intramuscular', '—', 'dose única'],
    ['Ciprofloxacino', '> 18 anos', '500 mg via oral', '—', 'dose única'],
  ])
})
test('quimioprofilaxia: Quadro 11 do Guia (Hib, p. 143), rifampicina 1 vez ao dia por 4 dias', () => {
  assert.deepEqual(QUIMIO_HIB.map((l) => [l.idade, l.dose, l.intervalo, l.duracao]), [
    ['adultos', '600 mg/dose', '24 em 24 horas', '4 dias'],
    ['≥ 1 mês até 10 anos', '20 mg/kg/dose (dose máxima de 600 mg)', '24 em 24 horas', '4 dias'],
    ['< 1 mês', '10 mg/kg/dose (dose máxima de 600 mg)', '24 em 24 horas', '4 dias'],
  ])
})
test('quimioprofilaxia: rifampicina no meningococo do adulto, 10 mg/kg/dose até 600 mg', () => {
  assert.equal(rifampicinaMeningococoMg(50), 500)
  assert.equal(rifampicinaMeningococoMg(60), 600)
  assert.equal(rifampicinaMeningococoMg(90), 600)
  assert.equal(rifampicinaMeningococoMg(0), null)
})
test('quimioprofilaxia: ficha nova cita o Guia de Vigilância em Saúde 2024', () => {
  assert.equal(fichaMeningiteAdulto.versao, '2026-10-27.1')
  assert.ok(fichaMeningiteAdulto.fontes.some((f) => /Guia de vigilância em saúde.*2024/i.test(f.citacao)))
})
