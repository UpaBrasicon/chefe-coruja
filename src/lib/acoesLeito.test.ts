// node --experimental-strip-types --test src/lib/acoesLeito.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { abaDoEndereco, acoesDoLeito, rotuloPendencias, subResumoInicial } from './acoesLeito.ts'

const base = { ativa: true, ehGestor: false, podeTransferir: true, passagens: [] }

test('quem cuida da internação ativa vê os três botões, na ordem', () => {
  assert.deepEqual(acoesDoLeito(base).map((a) => a.id), ['transferir', 'passar', 'intercorrencia'])
  assert.ok(acoesDoLeito(base).every((a) => a.bloqueio === null))
})

test('gestor e internação encerrada não veem nenhum botão', () => {
  assert.deepEqual(acoesDoLeito({ ...base, ehGestor: true }), [])
  assert.deepEqual(acoesDoLeito({ ...base, ativa: false }), [])
})

test('sem quem saiba transferir, só passar e intercorrência', () => {
  assert.deepEqual(acoesDoLeito({ ...base, podeTransferir: false }).map((a) => a.id), ['passar', 'intercorrencia'])
})

test('passagem aguardando aceite desliga o passar, com o motivo', () => {
  const passar = acoesDoLeito({ ...base, passagens: [{ situacao: 'aguardando' }] }).find((a) => a.id === 'passar')!
  assert.ok(passar.bloqueio)
  const deNovo = acoesDoLeito({ ...base, passagens: [{ situacao: 'recusada' }] }).find((a) => a.id === 'passar')!
  assert.equal(deNovo.bloqueio, null)
  assert.equal(deNovo.rotulo, 'Passar de novo')
})

test('sub-aba inicial e contagem de pendências abertas', () => {
  assert.equal(subResumoInicial(true), 'agora')
  assert.equal(subResumoInicial(false), 'historico')
  assert.equal(rotuloPendencias([{ situacao: 'aberta' }, { situacao: 'resolvida' }, { situacao: 'aberta' }]), 'Pendências (2)')
  assert.equal(rotuloPendencias([{ situacao: 'resolvida' }]), 'Pendências')
})

test('endereço antigo da aba Classificação abre o Resumo com a janela', () => {
  assert.deepEqual(abaDoEndereco('classif'), { aba: 'resumo', classificacao: true })
  assert.deepEqual(abaDoEndereco('diag'), { aba: 'evol', classificacao: false })
  assert.deepEqual(abaDoEndereco('atestado'), { aba: 'alta', classificacao: false })
  assert.deepEqual(abaDoEndereco('exames'), { aba: 'exames', classificacao: false })
})
