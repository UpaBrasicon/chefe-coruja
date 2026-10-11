// node --experimental-strip-types --test src/lib/regulacao.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FORMULARIO_VAZIO, dadosParaEnvio, faltasFormulario, resumoPedido, type Formulario } from './regulacao.ts'

const leito: Formulario = {
  ...FORMULARIO_VAZIO, tipo: 'leito', tipo_leito: 'uti_adulto', prioridade: 'emergencia', cid: 'I21.9',
  justificativa: 'IAM com supra, precisa de UTI e hemodinâmica.',
}

test('regulação: o que falta no formulário, por tipo e destino', () => {
  assert.deepEqual(faltasFormulario(leito), [])
  assert.deepEqual(faltasFormulario({ ...leito, tipo_leito: '' }), ['tipo de leito'])
  assert.deepEqual(faltasFormulario({ ...leito, tipo: 'consulta' }), ['especialidade'])
  assert.deepEqual(faltasFormulario({ ...leito, tipo: 'exame' }), ['procedimento do SIGTAP'])
  assert.deepEqual(faltasFormulario({ ...leito, tipo: 'transferencia' }), ['transporte'])
  assert.deepEqual(faltasFormulario({ ...leito, destino_tipo: 'rede' }), ['unidade de destino'])
  assert.deepEqual(faltasFormulario({ ...leito, destino_tipo: 'externo', destino_externo: 'X' }), ['serviço de destino'])
  assert.deepEqual(faltasFormulario({ ...FORMULARIO_VAZIO }),
    ['tipo de leito', 'prioridade', 'CID-10', 'justificativa (mínimo de 20 letras)'])
})

test('regulação: só os campos do tipo vão para o banco', () => {
  const d = dadosParaEnvio({ ...leito, especialidade: 'Cardiologia', transporte: 'uti_movel', destino_externo: 'lixo' },
    { episodio_id: 'e1' })
  assert.equal(d.tipo_leito, 'uti_adulto')
  assert.equal(d.especialidade, null)
  assert.equal(d.transporte, null)
  assert.equal(d.destino_externo, null)
  assert.equal(d.episodio_id, 'e1')
  assert.equal(d.internacao_id, null)
})

test('regulação: resumo do pedido', () => {
  assert.equal(resumoPedido({ tipo: 'leito', tipo_leito: 'uti_adulto' }), 'Leito · UTI adulto')
  assert.equal(resumoPedido({ tipo: 'consulta', especialidade: 'Cardiologia' }), 'Consulta · Cardiologia')
  assert.equal(resumoPedido({ tipo: 'exame', procedimento: '0206010079', procedimento_nome: 'TOMOGRAFIA' }), 'Exame · 0206010079 TOMOGRAFIA')
  assert.equal(resumoPedido({ tipo: 'transferencia', transporte: 'uti_movel' }), 'Transferência · UTI móvel')
})
