// node --experimental-strip-types --test src/lib/folhaSumarioObito.test.ts
// Lacuna 5 (O2): o Sumário de óbito é documento do prontuário e diz isso no
// próprio texto; nunca tem cara de Declaração de Óbito.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { montarFolha, type ContextoFolha } from './folhas.ts'

const ctx: ContextoFolha = {
  unidade: { nome: 'UPA Teste' }, paciente: { nome: 'Paciente <Teste>', nascimento: '1950-01-01' },
  autor: { nome: 'Médico Teste', registro: 'CRM 9' },
  emissao: { modo: 'emitido', numero: '2026-000123', versao: 1, protocolo: 'IMP-ABCDEF0123', em: '2026-11-10T15:10:00Z', codigo: 'ABC123' },
}
const conteudo = {
  formato: 'obito', aviso: 'Registro para o prontuário. A Declaração de Óbito é o formulário oficial do Ministério da Saúde.',
  hora_obito: '2026-11-10T15:00:00Z', origem: 'porta', setor: 'Pronto Socorro', tipo_morte: 'natural_assistida', encaminhamento: 'unidade',
  numero_do: '123456789', atestado_condicao: 'substituto', cid_interno: 'I46.9', relato: 'PCR refratária após 40 minutos de RCP',
  causas: { a: 'Choque cardiogênico', b: 'Infarto agudo do miocárdio', parte2: 'Diabetes <tipo 2>' },
}

test('sumário de óbito: frase do prontuário, causas em texto, sem título de D.O.', () => {
  const html = montarFolha('sumario_obito', conteudo, ctx)
  assert.match(html, /Registro para o prontuário\. A Declaração de Óbito é o formulário oficial do Ministério da Saúde\./)
  assert.match(html, /Sumário de óbito/)
  assert.match(html, /Parte I, a<\/span>Choque cardiogênico/)
  assert.match(html, /Diabetes &lt;tipo 2&gt;/)
  assert.match(html, /123456789/)
  assert.match(html, /Natural, com assistência/)
  assert.doesNotMatch(html, /<title>[^<]*Declaração de Óbito/)
  assert.doesNotMatch(html, /via (branca|amarela|rosa)/i)
})

test('sumário de óbito antigo (texto livre) continua saindo', () => {
  const html = montarFolha('sumario_obito', { texto: 'Óbito às 10h.' }, ctx)
  assert.match(html, /Óbito às 10h\./)
})
