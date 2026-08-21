// Teste de integração do envio WhatsApp sem credenciais válidas.
// O .env de dev tem META_ACCESS_TOKEN placeholder → a Graph API retorna 401.
// Verifica que enviarTexto retorna {ok:false, erro} SEM lançar exceção
// (o pipeline depende disso para nunca crashar).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { enviarTexto } from './whatsapp.js'
import { env } from '../config/env.js'

const temMetaPlaceholder =
  Boolean(env.META_ACCESS_TOKEN) && !env.META_ACCESS_TOKEN.startsWith('EAAG') // token real da Meta começa com EAAG

test('enviarTexto — sem token válido retorna erro (não lança)', { skip: !temMetaPlaceholder }, async () => {
  const resultado = await enviarTexto('5511999990001', 'teste')
  assert.equal(resultado.ok, false, 'deve falhar sem token Meta válido')
  assert.ok(resultado.erro && resultado.erro.length > 0, 'deve conter mensagem de erro')
})

test('enviarTexto — com PHONE_NUMBER_ID placeholder ainda não lança', async () => {
  // Mesmo com número placeholder, a função trata o erro e retorna objeto.
  const resultado = await enviarTexto('5511999990002', 'oi')
  assert.equal(typeof resultado.ok, 'boolean')
})
