import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { faltasDoRelato, prazoDoRelato, temDadoPessoal, textoPrazo } from './tecnovigilancia.ts'

const migration = readFileSync(new URL('../../supabase/migrations/20270418000094_lg12_tecnovigilancia.sql', import.meta.url), 'utf8')

test('LG12: a tela recusa os mesmos textos que o banco', () => {
  for (const t of ['paciente CPF 123.456.789-09 com erro', 'cpf 12345678909', 'CNS 898 0011 2233 4455', 'ligar (62) 99876-5432']) {
    assert.ok(temDadoPessoal(t), `deveria recusar: ${t}`)
  }
  assert.ok(!temDadoPessoal('Versão 2026-11-17.1: dose de 1000 mg em 18/11/2026, plaquetas 150000'))
  // as quatro expressões da tela estão no banco
  for (const re of ["\\d{3}\\.\\d{3}\\.\\d{3}-?\\d{2}", "(^|\\D)\\d{11}(\\D|$)", "(^|\\D)[1-9]\\d{14}(\\D|$)", "\\(?\\d{2}\\)?\\s?9?\\d{4}[\\s-]\\d{4}"]) {
    assert.ok(migration.includes(re), `falta no banco: ${re}`)
  }
})

test('LG12: o que falta para enviar', () => {
  assert.deepEqual(faltasDoRelato({ tipo: '', desfecho: '', descricao: '' }), ['o tipo do problema', 'a descrição (10 caracteres ou mais)'])
  assert.deepEqual(faltasDoRelato({ tipo: 'paciente', desfecho: '', descricao: 'A dose saiu errada na tela.' }), ['o desfecho no paciente'])
  assert.deepEqual(faltasDoRelato({ tipo: 'conteudo', desfecho: '', descricao: 'Conta errada, CPF 123.456.789-09' }), ['tirar CPF, CNS ou telefone do texto'])
  assert.deepEqual(faltasDoRelato({ tipo: 'sistema', desfecho: '', descricao: 'A tela travou ao abrir.' }), [])
})

test('LG12: prazo do art. 8º igual ao do banco', () => {
  assert.equal(prazoDoRelato('paciente', 'obito'), '72 horas')
  assert.equal(prazoDoRelato('paciente', 'grave'), '10 dias')
  assert.equal(prazoDoRelato('conteudo', ''), '30 dias')
  assert.ok(migration.includes("interval '72 hours'") && migration.includes("interval '10 days'") && migration.includes("interval '30 days'"))
  const agora = Date.parse('2026-11-18T12:00:00Z')
  assert.equal(textoPrazo('2026-11-18T17:00:00Z', agora), 'vence em 5 h')
  assert.equal(textoPrazo('2026-11-28T12:00:00Z', agora), 'vence em 10 dias')
  assert.equal(textoPrazo('2026-11-15T12:00:00Z', agora), 'venceu há 3 dias')
})
