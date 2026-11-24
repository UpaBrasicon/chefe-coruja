// node --experimental-strip-types --test src/lib/contingencia.test.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { contingenciasDoAtendimento, duracaoContingencia, textoForaDoAcesso, type Contingencia } from './contingencia.ts'

test('duração por extenso', () => {
  assert.equal(duracaoContingencia('2026-10-08T10:00:00Z', '2026-10-08T11:35:00Z'), '1 h 35 min no papel')
  assert.equal(duracaoContingencia('2026-10-08T10:00:00Z', '2026-10-08T10:20:00Z'), '20 min no papel')
  assert.equal(duracaoContingencia('2026-10-08T10:00:00Z', '2026-10-08T12:00:00Z'), '2 h no papel')
})

test('só contingências em que o atendimento já existia (fim + 30 min)', () => {
  const c = (id: string, fim: string): Contingencia => ({
    id, inicio: '2026-10-08T08:00:00Z', fim, motivo: 'x', registrado_por: null, registrado_em: fim, reentradas: 0, atendimentos_no_periodo: 0,
  })
  const lista = [c('antiga', '2026-10-07T09:00:00Z'), c('hoje', '2026-10-08T10:00:00Z')]
  assert.deepEqual(contingenciasDoAtendimento(lista, '2026-10-08T10:20:00Z').map((x) => x.id), ['hoje'])
  assert.deepEqual(contingenciasDoAtendimento(lista, '2026-10-08T11:00:00Z').map((x) => x.id), [])
})

// Ajustes da revisão, item 3 (RT, 24/11/2026): lista dos atendimentos da contingência
test('atendimentos fora do acesso: só a contagem, por extenso', () => {
  assert.equal(textoForaDoAcesso(0, 0), '')
  assert.equal(textoForaDoAcesso(1, 0), '1 atendimento de pacientes fora do seu acesso')
  assert.equal(textoForaDoAcesso(3, 2), '3 atendimentos de pacientes fora do seu acesso, 2 sem reentrada')
})

test('a tela da contingência lista os atendimentos pela RPC nova, com link para o prontuário', () => {
  const pagina = readFileSync('src/pages/Contingencia.tsx', 'utf8')
  assert.match(pagina, /rpc\('contingencia_atendimentos'/)
  assert.match(pagina, /\/prontuarios\/\$\{a\.paciente_id\}/)
})
