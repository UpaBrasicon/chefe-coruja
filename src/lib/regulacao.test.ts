// node --experimental-strip-types --test src/lib/regulacao.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FORMULARIO_VAZIO, dadosParaEnvio, ehNeonato, faltasFormulario, resumoPedido, type Formulario } from './regulacao.ts'

const leito: Formulario = {
  ...FORMULARIO_VAZIO, tipo: 'leito', tipo_leito: 'uti_adulto', procedimento: '0303060190', carater: 'urgencia',
  prioridade: 'emergencia', cid: 'I21.9', quadro_clinico: 'IAM com supra, precisa de UTI e hemodinâmica.',
}

test('regulação: o que falta, por tipo, destino e campos do MIRA', () => {
  assert.deepEqual(faltasFormulario(leito), [])
  assert.deepEqual(faltasFormulario({ ...leito, procedimento: '' }), ['procedimento do SIGTAP'])
  assert.deepEqual(faltasFormulario({ ...leito, tipo_leito: '' }), ['tipo de leito'])
  assert.deepEqual(faltasFormulario({ ...leito, tipo: 'consulta', especialidade: 'Cardiologia' }), ['especialidade (CBO)'])
  assert.deepEqual(faltasFormulario({ ...leito, tipo_leito: 'psiquiatrico' }), ['tipo de internação psiquiátrica'])
  assert.deepEqual(faltasFormulario({ ...leito, isolamento: true }), ['tipo de isolamento'])
  assert.deepEqual(faltasFormulario({ ...leito, tipo: 'transferencia', transporte: 'ambulancia_avancada' }, { neonato: true }),
    ['incubadora (recém-nascido)'])
  assert.deepEqual(faltasFormulario({ ...leito, destino_tipo: 'rede' }), ['unidade de destino'])
  assert.deepEqual(faltasFormulario({ ...leito, carater: '' }), ['caráter'])
  assert.deepEqual(faltasFormulario(leito, { semDocumento: true }), ['CNS/CPF do paciente ou a marca de não identificado'])
  assert.deepEqual(faltasFormulario(leito, { semDocumento: true, naoIdentificado: true }), [])
  assert.deepEqual(faltasFormulario({ ...FORMULARIO_VAZIO }),
    ['procedimento do SIGTAP', 'tipo de leito', 'caráter', 'prioridade', 'CID-10', 'quadro clínico (mínimo de 20 letras)'])
})

test('regulação: só os campos do tipo vão para o banco', () => {
  const d = dadosParaEnvio({ ...leito, especialidade: 'Cardiologia', transporte: 'aereo', destino_externo: 'lixo', incubadora: 'sim',
    isolamento_tipo: 'contato', sinais_vitais: '  ' }, { episodio_id: 'e1' })
  assert.equal(d.tipo_leito, 'uti_adulto')
  assert.equal(d.especialidade, null)
  assert.equal(d.transporte, null)
  assert.equal(d.incubadora, null)
  assert.equal(d.isolamento_tipo, null)
  assert.equal(d.destino_externo, null)
  assert.equal(d.sinais_vitais, null)
  assert.equal(d.procedimento, '0303060190')
  assert.equal(d.episodio_id, 'e1')
  const t = dadosParaEnvio({ ...leito, tipo: 'transferencia', transporte: 'ambulancia_avancada', incubadora: 'nao' }, {})
  assert.equal(t.incubadora, false)
  assert.equal(t.tipo_leito, 'uti_adulto')
})

test('regulação: resumo do pedido e recém-nascido', () => {
  assert.equal(resumoPedido({ tipo: 'leito', tipo_leito: 'uci_neonatal' }), 'Leito · UCI neonatal')
  assert.equal(resumoPedido({ tipo: 'consulta', especialidade: 'Cardiologia' }), 'Consulta · Cardiologia')
  assert.equal(resumoPedido({ tipo: 'exame', procedimento: '0206010079', procedimento_nome: 'TOMOGRAFIA' }), 'Exame · 0206010079 TOMOGRAFIA')
  assert.equal(resumoPedido({ tipo: 'transferencia', transporte: 'embarcacao' }), 'Transferência · Embarcação (F)')
  assert.equal(ehNeonato('2026-10-08', '2026-10-11'), true)
  assert.equal(ehNeonato('2026-09-13', '2026-10-11'), false)
  assert.equal(ehNeonato(null, '2026-10-11'), false)
})

test('fila: tempo de espera, filtros e novos', async () => {
  const { formatarEspera, filtrosParaEnvio, novosDesde } = await import('./regulacao.ts')
  assert.equal(formatarEspera(20), 'agora')
  assert.equal(formatarEspera(12 * 60), '12 min')
  assert.equal(formatarEspera(125 * 60), '2 h 05 min')
  assert.equal(formatarEspera((3 * 24 + 4) * 3600), '3 d 4 h')
  assert.deepEqual(filtrosParaEnvio({ tipo: 'leito', busca: '  ', status: [], isolamento: false }), { tipo: 'leito', isolamento: false })
  assert.deepEqual(filtrosParaEnvio({ busca: ' Maria ' }), { busca: 'Maria' })
  assert.deepEqual([...novosDesde(null, ['a'])], [])
  assert.deepEqual([...novosDesde(new Set(['a']), ['a', 'b'])], ['b'])
})
