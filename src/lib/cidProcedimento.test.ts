// node --experimental-strip-types --test src/lib/cidProcedimento.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SEM_LISTA, codigoProcedimento, conflitoCid, rpcAusente, type CidsDoProcedimento } from './cidProcedimento.ts'

const lista = (compativel: boolean | null): CidsDoProcedimento => ({
  procedimento: '0303140151', tem_lista: true, competencia: '202611', total: 34, compativel, principal: compativel ? true : null,
  itens: [{ codigo: 'J18.9', descricao: 'Pneumonia não especificada', principal: true }],
})

test('CID fora da lista do procedimento é conflito, com a frase da tela', () => {
  assert.equal(conflitoCid('03.03.14.015-1', 'i10', lista(false)),
    'CID I10 não é compatível com o procedimento 0303140151. Escolha um CID da lista do procedimento ou troque o procedimento.')
})

test('sem conflito: compatível, sem lista, sem CID, sem procedimento ou ainda conferindo', () => {
  assert.equal(conflitoCid('0303140151', 'J18.9', lista(true)), null)
  assert.equal(conflitoCid('0303140151', 'I10', SEM_LISTA), null)
  assert.equal(conflitoCid('0303140151', '', lista(false)), null)
  assert.equal(conflitoCid('', 'I10', lista(false)), null)
  assert.equal(conflitoCid('0303140151', 'I10', undefined), null)
  assert.equal(conflitoCid('0303140151', 'I10', lista(null)), null)
})

test('código do procedimento só com dígitos e a RPC que ainda não existe', () => {
  assert.equal(codigoProcedimento('03.03.14.015-1'), '0303140151')
  assert.ok(rpcAusente({ code: 'PGRST202', message: 'Could not find the function public.regulacao_cids_do_procedimento' }))
  assert.ok(!rpcAusente({ code: 'P0001', message: 'Acesso negado.' }))
  assert.ok(!rpcAusente(null))
})
