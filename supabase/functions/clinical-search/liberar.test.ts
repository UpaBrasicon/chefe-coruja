// Trilha Hermes / Evidências, E2: a pergunta só sai liberada.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { hashEntrada, liberarPergunta, mascararNomes, nomeAlemDoPseudonimo, TIPO_NOME_NER } from './liberar.ts'

const nerLimpo = async () => ({ found: [], ner_ativo: true })
const naoChamar = async () => { throw new Error('não devia consultar o NER') }

test('pergunta clínica sem identificação sai, com o NER ativo', async () => {
  const r = await liberarPergunta('dose de amoxicilina na otite', [], 'ask', nerLimpo)
  assert.equal(r.tipo, 'ok')
  if (r.tipo === 'ok') assert.equal(r.texto, 'dose de amoxicilina na otite')
})

test('nome conhecido da unidade vira pseudônimo e é contado', async () => {
  let enviado = ''
  const r = await liberarPergunta('Maria Lima com febre há 3 dias', [{ valor: 'Maria Lima', categoria: 'PACIENTE' }], 'ask',
    async (t) => { enviado = t; return { found: [], ner_ativo: true } })
  assert.equal(r.tipo, 'ok')
  assert.ok(!enviado.includes('Maria'))
  if (r.tipo === 'ok') {
    assert.ok(!r.texto.includes('Maria'))
    assert.equal(r.contagem.PACIENTE, 1)
  }
})

test('resíduo com cara de identificador bloqueia antes do NER', async () => {
  // um número de 11 dígitos sem CPF válido não vira pseudônimo e sobra
  const r2 = await liberarPergunta('cartão 123 456 789 01 com febre', [], 'ask', naoChamar)
  assert.equal(r2.tipo, 'bloqueada')
  if (r2.tipo === 'bloqueada') assert.equal(r2.tipos['sequência de 11 dígitos'], 1)
})

test('nome encontrado pelo NER bloqueia o modo ask', async () => {
  const r = await liberarPergunta('a joana do leito está com dispneia', [], 'ask', async () => ({ found: ['Joana'], ner_ativo: true }))
  assert.equal(r.tipo, 'bloqueada')
  if (r.tipo === 'bloqueada') assert.equal(r.tipos[TIPO_NOME_NER], 1)
})

test('NER sem o modelo carregado: não sai (falha fechada)', async () => {
  const r = await liberarPergunta('conduta na asma grave', [], 'ask', async () => ({ found: [], ner_ativo: false }))
  assert.deepEqual(r.tipo === 'indisponivel' && r.motivo, 'ner_inativo')
})

test('NER fora do ar ou resposta estranha: não sai', async () => {
  const rede = await liberarPergunta('conduta na asma grave', [], 'ask', async () => { throw new TypeError('fetch failed') })
  const tempo = await liberarPergunta('conduta na asma grave', [], 'ask', async () => {
    const e = new Error('t'); e.name = 'TimeoutError'; throw e
  })
  const estranha = await liberarPergunta('conduta na asma grave', [], 'ask', async () => ({ found: 'x', ner_ativo: true }))
  assert.equal(rede.tipo === 'indisponivel' && rede.motivo, 'rede')
  assert.equal(tempo.tipo === 'indisponivel' && tempo.motivo, 'timeout')
  assert.equal(estranha.tipo === 'indisponivel' && estranha.motivo, 'resposta_invalida')
})

test('busca simples sem o NER segue, mas sem registrar o texto', async () => {
  const r = await liberarPergunta('a Maria Souza está com asma', [], 'search', naoChamar)
  assert.equal(r.tipo, 'ok')
  if (r.tipo === 'ok') assert.equal(r.registro, null)
  const inativo = await liberarPergunta('amoxicilina', [], 'search', async () => ({ found: [], ner_ativo: false }))
  assert.equal(inativo.tipo === 'ok' && inativo.registro, null)
})

test('busca simples: nome achado pelo NER sai do texto e do registro (E2b)', async () => {
  const r = await liberarPergunta('a Maria Souza está com asma', [], 'search', async () => ({ found: ['Maria Souza'], ner_ativo: true }))
  assert.equal(r.tipo, 'ok')
  if (r.tipo === 'ok') {
    assert.equal(r.texto, 'a [PESSOA] está com asma')
    assert.equal(r.registro, 'a [PESSOA] está com asma')
  }
})

test('busca simples limpa registra o texto', async () => {
  const r = await liberarPergunta('salbutamol', [], 'search', nerLimpo)
  assert.equal(r.tipo === 'ok' && r.registro, 'salbutamol')
})

test('mascararNomes troca o nome inteiro, sem pegar pedaço de palavra', () => {
  assert.equal(mascararNomes('Ana e Anaflávia', ['Ana']), '[PESSOA] e Anaflávia')
  assert.equal(mascararNomes('Maria  Souza com febre', ['Maria Souza', 'Maria']), '[PESSOA] com febre')
})

test('pseudônimo e nome do sistema não contam como nome', () => {
  assert.equal(nomeAlemDoPseudonimo('[PACIENTE_1]'), false)
  assert.equal(nomeAlemDoPseudonimo('[PESSOA_2] da'), false)
  assert.equal(nomeAlemDoPseudonimo('Corujinha'), false)
  assert.equal(nomeAlemDoPseudonimo('Joana [PESSOA_1]'), true)
})

test('hash da entrada é sha256 em hexadecimal e não contém o texto', async () => {
  const h = await hashEntrada('Maria Lima')
  assert.match(h, /^[0-9a-f]{64}$/)
  assert.ok(!h.includes('Maria'))
})
