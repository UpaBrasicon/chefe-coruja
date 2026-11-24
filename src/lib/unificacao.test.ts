// node --experimental-strip-types --test src/lib/unificacao.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  chavePar, compararCampos, documentosDivergentes, motivoMinimo, porQueSugerido, sugerirPrincipal, type Cadastro,
} from './unificacao.ts'

const base = (id: string, p: Partial<Cadastro>): Cadastro => ({
  id, nome: 'X', nome_mae: null, data_nascimento: null, prontuario: null, cpf: null, cns: null,
  criado_em: '2026-01-01T00:00:00Z', atendimentos: 0, aberto: false, ultimo_atendimento: null, ...p,
})

test('principal sugerido: o que tem atendimento aberto vence', () => {
  assert.equal(sugerirPrincipal([base('a', { atendimentos: 9 }), base('b', { aberto: true, atendimentos: 1 })]), 'b')
})

test('sem aberto: mais atendimentos; empate: o mais antigo', () => {
  assert.equal(sugerirPrincipal([base('a', { atendimentos: 1 }), base('b', { atendimentos: 3 })]), 'b')
  assert.equal(sugerirPrincipal([
    base('novo', { criado_em: '2026-10-08T00:00:00Z' }), base('velho', { criado_em: '2026-01-01T00:00:00Z' }),
  ]), 'velho')
})

test('documentos divergentes: só CPF/CNS preenchidos nos dois e diferentes', () => {
  assert.deepEqual(documentosDivergentes([base('a', { cpf: '529.982.247-25' }), base('b', { cpf: '11144477735' })]), ['CPF'])
  assert.deepEqual(documentosDivergentes([base('a', { cpf: '529.982.247-25' }), base('b', { cpf: '52998224725' })]), [])
  assert.deepEqual(documentosDivergentes([base('a', { cpf: '52998224725' }), base('b', {})]), [])
  assert.deepEqual(documentosDivergentes([base('a', { cpf: '52998224725', cns: '1' }), base('b', { cpf: '11144477735', cns: '2' })]), ['CPF', 'CNS'])
  assert.equal(motivoMinimo(['CPF']), 30)
  assert.equal(motivoMinimo([]), 10)
})

test('comparação campo a campo: acento, caixa e pontuação não contam como diferença', () => {
  const linhas = compararCampos(
    base('a', { nome: 'José  da Silva', cpf: '529.982.247-25', data_nascimento: '1980-01-02', nome_mae: 'Maria' }),
    base('b', { nome: 'JOSE DA SILVA', cpf: '52998224725', data_nascimento: '1980-01-03', nome_mae: null }),
  )
  const por = Object.fromEntries(linhas.map((l) => [l.chave, l.situacao]))
  assert.equal(por.nome, 'igual')
  assert.equal(por.cpf, 'igual')
  assert.equal(por.data_nascimento, 'diferente')
  assert.equal(por.nome_mae, 'so_um')
  assert.equal(por.cns, 'vazio')
})

test('comparação: campo que a consulta não trouxe fica de fora', () => {
  const linhas = compararCampos({ nome: 'A', prontuario: '1' }, { nome: 'A', prontuario: '2' })
  assert.deepEqual(linhas.map((l) => l.chave), ['nome', 'prontuario'])
})

test('por que sugerido: explica a regra que decidiu', () => {
  assert.match(porQueSugerido([base('a', { atendimentos: 9 }), base('b', { aberto: true })]), /atendimento aberto/)
  assert.match(porQueSugerido([base('a', { atendimentos: 1 }), base('b', { atendimentos: 3 })]), /mais atendimentos \(3 contra 1\)/)
  assert.equal(porQueSugerido([base('a', {}), base('b', {})]), 'é o cadastro mais antigo')
})

test('chave do par não depende da ordem', () => {
  assert.equal(chavePar(['b', 'a']), chavePar(['a', 'b']))
})
