// VD8 do lote "Virada de data" (BACKLOG.md, RT em 01/11/2026): a idade no
// caderno do leito. O navegador da UPA roda no fuso de Brasília, e a data de
// hoje chega como "AAAA-MM-DD"; lida como meia-noite UTC, virava 21h da véspera
// e a idade ficava um dia atrás o dia todo.
process.env.TZ = 'America/Sao_Paulo'

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { idadeTexto } from './rascunho.ts'

test('caderno: no dia do aniversário já mostra a idade nova', () => {
  assert.equal(idadeTexto('01/11/2016', '2026-11-01'), '10 anos')
  assert.equal(idadeTexto('02/11/2016', '2026-11-01'), '9 anos')
})

test('caderno: meses e dias contam o dia de hoje', () => {
  assert.equal(idadeTexto('01/09/2026', '2026-11-01'), '2 meses')
  assert.equal(idadeTexto('25/10/2026', '2026-11-01'), '7 dias')
  assert.equal(idadeTexto('01/11/2026', '2026-11-01'), '0 dias')
})

test('caderno: virada do ano', () => {
  assert.equal(idadeTexto('01/01/2013', '2027-01-01'), '14 anos')
  assert.equal(idadeTexto('31/12/2026', '2027-01-01'), '1 dias')
})
