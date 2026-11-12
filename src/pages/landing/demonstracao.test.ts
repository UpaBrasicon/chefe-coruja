// Pedido 8, J3: regras do formulário "Agendar demonstração" na tela.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { CAMPOS_VAZIOS, lerResposta, validarDemonstracao } from './demonstracao.ts'

const valido = { ...CAMPOS_VAZIOS, nome: 'Ana Souza', email: 'ana@exemplo.com', telefone: '(11) 98765-4321' }

test('campos válidos não têm aviso; unidade e mensagem são opcionais', () => {
  assert.deepEqual(validarDemonstracao(valido), {})
})

test('avisa nome, e-mail e telefone', () => {
  const erros = validarDemonstracao(CAMPOS_VAZIOS)
  assert.deepEqual(Object.keys(erros).sort(), ['email', 'nome', 'telefone'])
  assert.ok(validarDemonstracao({ ...valido, telefone: '9876-5432' }).telefone)
})

test('as respostas da função viram mensagens', () => {
  assert.deepEqual(lerResposta(200, { }), { tipo: 'ok' })
  const campo = lerResposta(400, { campo: 'email' })
  assert.equal(campo.tipo, 'campo')
  assert.equal(lerResposta(403, null).tipo, 'erro')
  const limite = lerResposta(429, null)
  assert.ok(limite.tipo === 'erro' && /última hora/.test(limite.mensagem))
  const falha = lerResposta(502, null)
  assert.ok(falha.tipo === 'erro' && /contato@chefecoruja\.com\.br/.test(falha.mensagem))
  assert.equal(lerResposta(400, { campo: 'outro' }).tipo, 'erro')
})
