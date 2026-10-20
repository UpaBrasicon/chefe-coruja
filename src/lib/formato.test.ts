// node --experimental-strip-types --test src/lib/formato.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { classificarErro } from './erros.ts'
import { data, dataHora, dataPura, hora, moeda, numero, tempoDecorrido } from './formato.ts'

const norm = (s: string) => s.replace(new RegExp('[' + String.fromCharCode(160, 8239) + ']', 'g'), ' ')

test('formato: hora e data no fuso de Brasília', () => {
  // 22:43 UTC = 19:43 em Brasília
  assert.equal(hora('2026-10-19T22:43:00Z'), '19:43')
  assert.equal(data('2026-10-20T01:00:00Z'), '19/10/2026')
  assert.equal(dataHora('2026-10-19T22:43:00Z'), '19/10/2026, 19:43')
  assert.equal(dataPura('2026-10-19'), '19/10/2026')
})

test('formato: tempo decorrido', () => {
  const agora = '2026-10-19T20:00:00Z'
  assert.equal(tempoDecorrido('2026-10-19T19:59:40Z', agora), 'agora')
  assert.equal(tempoDecorrido('2026-10-19T19:48:00Z', agora), 'há 12 min')
  assert.equal(tempoDecorrido('2026-10-19T18:55:00Z', agora), 'há 1h05')
  assert.equal(tempoDecorrido('2026-10-16T20:00:00Z', agora), 'há 3 d')
})

test('formato: moeda e número com vírgula', () => {
  assert.equal(norm(moeda(1234.56)), 'R$ 1.234,56')
  assert.equal(numero(1234.5), '1.234,5')
  assert.equal(numero(2, 1), '2,0')
})

test('erros: frase da regra do banco aparece como veio; o resto vira a frase genérica', () => {
  assert.deepEqual(classificarErro({ code: 'P0001', message: 'Escreva o motivo da glosa.' }, 'salvar'), { texto: 'Escreva o motivo da glosa.', tecnico: null })
  assert.equal(classificarErro({ code: 'P0001', message: 'CHECKIN_FORA_DO_RAIO: Você está fora do raio.' }, 'salvar').texto, 'Você está fora do raio.')
  const perm = classificarErro({ code: '42501', message: 'permission denied for table perfis' }, 'salvar a evolução')
  assert.equal(perm.texto, 'Não foi possível salvar a evolução. Tente de novo.')
  assert.match(perm.tecnico ?? '', /42501/)
  assert.equal(classificarErro(new TypeError('Failed to fetch'), 'carregar os exames').texto, 'Não foi possível carregar os exames. Tente de novo.')
})

test('formato: dia, semana e por extenso', async () => {
  const { diaMes, dia, semanaCurta, dataPorExtenso } = await import('./formato.ts')
  assert.equal(diaMes('2026-10-19T22:43:00Z'), '19/10')
  assert.equal(dia('2026-10-19T22:43:00Z'), '19')
  assert.equal(semanaCurta('2026-10-19T22:43:00Z'), 'seg')
  assert.equal(dataPorExtenso('2026-10-19T22:43:00Z'), 'Segunda-feira, 19 de outubro')
})
