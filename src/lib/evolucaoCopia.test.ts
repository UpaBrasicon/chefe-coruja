// node --experimental-strip-types --test src/lib/evolucaoCopia.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  SEM_ALTERACOES, blocoDoCampo, copiadosSemRevisao, copiarBloco, temNoAnterior, temTermoVago, vitaisDaEnfermagem,
  type BlocoCopiavel,
} from './evolucaoCopia.ts'

const vazio = { s: '', exame_fisico: { geral: '', acv: 'RCR 2T', ar: '' }, outros_achados: '', exames: '', a: '', p: '' }

test('copia só o bloco pedido; o resto fica', () => {
  const f = copiarBloco({ ...vazio, a: 'minha avaliação' }, { s: 'ontem', a: 'avaliação de ontem' }, 's')
  assert.equal(f.s, 'ontem')
  assert.equal(f.a, 'minha avaliação')
})

test('exame físico copiado não apaga o que veio vazio na anterior', () => {
  const f = copiarBloco(vazio, { exame_fisico: { geral: 'REG', acv: '' } }, 'exame_fisico')
  assert.deepEqual(f.exame_fisico, { geral: 'REG', acv: 'RCR 2T', ar: '' })
})

test('só oferece copiar o que a anterior tem', () => {
  assert.equal(temNoAnterior({ s: '  ' }, 's'), false)
  assert.equal(temNoAnterior({ exame_fisico: { ar: 'MV+' } }, 'exame_fisico'), true)
  assert.equal(temNoAnterior(null, 'p'), false)
})

test('o campo diz o bloco (para tirar a marca ao editar)', () => {
  assert.equal(blocoDoCampo('exame_fisico.acv'), 'exame_fisico')
  assert.equal(blocoDoCampo('p'), 'p')
  assert.equal(blocoDoCampo('sv.pa'), null)
})

test('blocos copiados sem revisão saem na ordem do formulário', () => {
  assert.deepEqual(copiadosSemRevisao(new Set<BlocoCopiavel>(['p', 's'])), ['Subjetivo', 'Conduta / plano'])
})

test('vitais da enfermagem entram crus e só nos campos vazios', () => {
  const r = vitaisDaEnfermagem({ pa: '', fc: '98', fr: '', temp: '', spo2: '', glic: '', diurese: '' }, '',
    { pa: '128/76', fc: '102', fr: null, temp: '37.85', spo2: '94', glic: '', condicao: 'o2' })
  assert.equal(r.sv.pa, '128/76')
  assert.equal(r.sv.fc, '98', 'o que o médico escreveu fica')
  assert.equal(r.sv.temp, '37.85', 'sem arredondar')
  assert.equal(r.sv_condicao, 'o2')
  assert.deepEqual(r.trouxe, ['pa', 'temp', 'spo2'])
})

test('o atalho exato "sem alterações" do exame físico não é termo vago; escrito no texto, é', () => {
  assert.equal(temTermoVago(['febre há 2 dias'], [SEM_ALTERACOES]), false)
  assert.equal(temTermoVago(['paciente bem'], []), true)
  assert.equal(temTermoVago([''], ['sem alterações']), true)
})
