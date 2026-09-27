// node --test "src/domain/*.test.ts"   (npm run test:dominio)
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ehPediatrico, idadeEm, rotuloIdade } from './idade.ts'
import { formatarDuracao, nivelDaObservacao, nivelDoTurno, tempoDeTurno } from './plantao.ts'

test('pediatria: recém-nascido nas primeiras 24 horas é pediátrico', () => {
  assert.equal(ehPediatrico('2026-09-26', '2026-09-26'), true)
})

test('pediatria: 13 anos, 11 meses e 29 dias ainda é pediátrico', () => {
  assert.equal(ehPediatrico('2012-09-27', '2026-09-26'), true)
})

test('pediatria: no dia em que completa 14 anos já é adulto', () => {
  assert.equal(ehPediatrico('2012-09-26', '2026-09-26'), false)
})

test('pediatria: nascido em 29/02 completa 14 anos em 01/03 do ano não bissexto', () => {
  assert.equal(ehPediatrico('2012-02-29', '2026-02-28'), true)
  assert.equal(ehPediatrico('2012-02-29', '2026-03-01'), false)
})

test('idade: nascimento no futuro é inválido, não "zero"', () => {
  assert.equal(idadeEm('2026-10-01', '2026-09-26'), null)
  assert.equal(ehPediatrico('2026-10-01', '2026-09-26'), null)
})

test('idade: anos, meses e dias exatos', () => {
  assert.deepEqual(idadeEm('2000-01-31', '2000-03-01'), { anos: 0, meses: 1, dias: 1, totalDias: 30 })
})

test('rótulo: dias até 30, meses até 23, depois anos', () => {
  assert.equal(rotuloIdade('2026-09-16', '2026-09-26'), '10d')
  assert.equal(rotuloIdade('2025-09-26', '2026-09-26'), '12m')
  assert.equal(rotuloIdade('2020-09-26', '2026-09-26'), '6a')
})

// 2026-09-26T14:30:00-03:00 = 17:30 UTC
const as1430 = new Date('2026-09-26T17:30:00Z')

test('turno da tarde (13–19): às 14h30 faltam 4h30 de 6h', () => {
  assert.deepEqual(tempoDeTurno('tarde', as1430), { restante: 270, duracao: 360 })
})

test('turno da noite atravessa a meia-noite: às 02h faltam 5h', () => {
  const as02 = new Date('2026-09-27T05:00:00Z') // 02:00 em Brasília
  assert.deepEqual(tempoDeTurno('noite', as02), { restante: 300, duracao: 720 })
})

test('turno da noite às 20h: faltam 11h', () => {
  const as20 = new Date('2026-09-26T23:00:00Z')
  assert.equal(tempoDeTurno('noite', as20).restante, 660)
})

test('nível do turno: última hora é atenção, últimos 15 min são críticos', () => {
  assert.equal(nivelDoTurno(61), 'ok')
  assert.equal(nivelDoTurno(60), 'atencao')
  assert.equal(nivelDoTurno(15), 'critico')
})

test('observação: janela de 6 h — âmbar na última hora, vermelho depois', () => {
  assert.equal(nivelDaObservacao(299), 'ok')
  assert.equal(nivelDaObservacao(300), 'atencao')
  assert.equal(nivelDaObservacao(360), 'atencao')
  assert.equal(nivelDaObservacao(361), 'critico')
})

test('duração formatada', () => {
  assert.equal(formatarDuracao(45), '45 min')
  assert.equal(formatarDuracao(185), '3h05')
})

test('janela do plantão: noite de 12 h que começou ontem às 19h, às 02h faltam 5h', async () => {
  const { tempoDaJanela } = await import('./plantao.ts')
  const inicio = new Date('2026-09-25T22:00:00Z') // 19:00 em Brasília
  const fim = new Date('2026-09-26T10:00:00Z')    // 07:00
  const agora = new Date('2026-09-26T05:00:00Z')  // 02:00
  assert.deepEqual(tempoDaJanela(inicio, fim, agora), { restante: 300, duracao: 720 })
})

// ── prioridade legal na fila da triagem ──────────────────────────────────────
import { ordemTriagem, rotulosPrioridade } from './prioridade.ts'

test('fila da triagem: 80+ antes das demais prioridades, que vêm antes da chegada', () => {
  const fila = [
    { id: 'sem', prioridades_legais: [], chegada_em: '2026-09-27T10:00:00Z' },
    { id: 'gestante', prioridades_legais: ['gestante'], chegada_em: '2026-09-27T10:20:00Z' },
    { id: '80', prioridades_legais: ['idoso_60', 'idoso_80'], chegada_em: '2026-09-27T10:30:00Z' },
    { id: '60', prioridades_legais: ['idoso_60'], chegada_em: '2026-09-27T10:10:00Z' },
  ].sort(ordemTriagem)
  assert.deepEqual(fila.map((f) => f.id), ['80', '60', 'gestante', 'sem'])
})

test('rótulo: 80+ aparece uma vez, sem repetir 60+', () => {
  assert.deepEqual(rotulosPrioridade(['idoso_60', 'idoso_80', 'pcd']), ['80 anos ou mais', 'Pessoa com deficiência'])
})
