import assert from 'node:assert/strict'
import { test } from 'node:test'

import { DOCS_INICIAL, nomeMed, sugestoesDaPrescricao } from './documentosAlta.ts'

test('trazer da prescrição: só o medicamento, uma vez, sem dose', () => {
  const s = sugestoesDaPrescricao([
    { tipo: 'medicamento', descricao: 'Dipirona sódica', medicamento_id: 'm1', dose: '1 g EV' },
    { tipo: 'medicamento', descricao: 'Dipirona sódica', medicamento_id: 'm1', dose: '500 mg' },
    { tipo: 'cuidado', descricao: 'Cabeceira elevada', medicamento_id: null },
    { tipo: 'medicamento', descricao: 'Item livre', medicamento_id: null },
    { tipo: 'medicamento', descricao: 'Omeprazol', medicamento_id: 'm2', dose: '40 mg' },
  ])
  assert.deepEqual(s, [
    { id: 'm1', principio_ativo: 'Dipirona sódica', apresentacao: null, concentracao: null },
    { id: 'm2', principio_ativo: 'Omeprazol', apresentacao: null, concentracao: null },
  ])
  assert.ok(s.every((m) => !JSON.stringify(m).includes('mg') && !JSON.stringify(m).includes(' g ')), 'nenhuma dose vem junto')
})

test('nome do medicamento e estado inicial da receita e do atestado', () => {
  assert.equal(nomeMed({ principio_ativo: 'Amoxicilina', apresentacao: 'cápsula 500 mg' }), 'Amoxicilina cápsula 500 mg')
  assert.equal(nomeMed(null), '')
  assert.deepEqual(DOCS_INICIAL.receita, [])
  assert.equal(DOCS_INICIAL.atCid, false)
})
