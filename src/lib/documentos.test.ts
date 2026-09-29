// node --experimental-strip-types --test src/lib/documentos.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { cnsValido, cpfValido, erroCns, erroCpf, erroNascimento, formatarCns, formatarCpf } from './documentos.ts'
import { faltasParaAih } from './cadastro.ts'

test('CPF: dígitos verificadores', () => {
  assert.equal(cpfValido('529.982.247-25'), true)
  assert.equal(cpfValido('52998224725'), true)
  assert.equal(cpfValido('111.444.777-35'), true)
  assert.equal(cpfValido('529.982.247-24'), false, 'segundo DV errado')
  assert.equal(cpfValido('529.982.247-15'), false, 'primeiro DV errado')
  assert.equal(cpfValido('111.111.111-11'), false, 'todos iguais passam na conta, mas não existem')
  assert.equal(cpfValido('00000000000'), false)
  assert.equal(cpfValido('5299822472'), false, '10 dígitos')
  assert.equal(cpfValido(''), false)
  assert.equal(cpfValido(null), false)
})

test('CNS definitivo (1 e 2): gerado a partir do PIS', () => {
  assert.equal(cnsValido('100000000000007'), true)
  assert.equal(cnsValido('100 0000 0000 0007'), true, 'aceita espaços')
  // DV daria 10: o número leva "001" e o DV é recalculado
  assert.equal(cnsValido('104000000000018'), true)
  assert.equal(cnsValido('104000000000008'), false)
  assert.equal(cnsValido('100000000000008'), false)
  // soma ponderada múltipla de 11, mas fora da estrutura PIS + 00x + DV
  assert.equal(cnsValido('100000000000104'), false)
})

test('CNS provisório (7, 8 e 9): soma ponderada múltipla de 11', () => {
  assert.equal(cnsValido('700000000000005'), true)
  assert.equal(cnsValido('700000000000006'), false)
  // 8·15 = 120 ≡ 10 (mod 11); +1 no último dígito fecha 121 = 11·11
  assert.equal(cnsValido('800000000000001'), true)
  assert.equal(cnsValido('800000000000002'), false)
  // 9·15 = 135 ≡ 3; +8 fecha 143 = 11·13
  assert.equal(cnsValido('900000000000008'), true)
  assert.equal(cnsValido('900000000000009'), false)
})

test('CNS: começo e tamanho', () => {
  assert.equal(cnsValido('300000000000000'), false, 'não começa com 3 a 6')
  assert.equal(cnsValido('70000000000005'), false, '14 dígitos')
  assert.equal(cnsValido(undefined), false)
})

test('mensagens ao vivo', () => {
  assert.equal(erroCpf(''), '')
  assert.equal(erroCpf('529.982', false), '', 'digitando: não reclama antes da hora')
  assert.equal(erroCpf('529.982'), 'CPF tem 11 dígitos.')
  assert.match(erroCpf('52998224724', false), /verificadores/)
  assert.equal(erroCns('7000', false), '')
  assert.match(erroCns('300000000000000'), /começa com/)
  assert.match(erroCns('700000000000006'), /não confere/)
})

test('nascimento', () => {
  assert.equal(erroNascimento('', '2026-09-29'), '')
  assert.equal(erroNascimento('2020-02-01', '2026-09-29'), '')
  assert.equal(erroNascimento('2026-09-29', '2026-09-29'), '', 'nasceu hoje')
  assert.match(erroNascimento('2026-09-30', '2026-09-29'), /futuro/)
  assert.match(erroNascimento('2023-02-29', '2026-09-29'), /inválida/)
  assert.match(erroNascimento('1890-01-01', '2026-09-29'), /130 anos/)
  assert.equal(erroNascimento('1896-09-29', '2026-09-29'), '', 'exatamente 130')
})

test('formatação enquanto digita', () => {
  assert.equal(formatarCpf('52998224725'), '529.982.247-25')
  assert.equal(formatarCpf('5299'), '529.9')
  assert.equal(formatarCns('700000000000005'), '700 0000 0000 0005')
})

test('o que falta para a AIH', () => {
  assert.deepEqual(faltasParaAih({ prontuario: '2026.000001', cns: '700000000000005', data_nascimento: '2000-01-01', sexo: 'F',
    raca_cor: 'sem_informacao', nome_mae: 'Maria', endereco: 'Rua A, 1', municipio: 'São Paulo', uf: 'SP' }), [])
  assert.deepEqual(faltasParaAih({ prontuario: '2026.000001', nome_mae: '  ' }),
    ['CNS', 'data de nascimento', 'sexo', 'raça/cor', 'nome da mãe', 'endereço', 'município', 'UF'])
})
