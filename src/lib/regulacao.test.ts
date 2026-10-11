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

test('priorização: prioridade efetiva e marcadores pela idade', async () => {
  const { prioridadeEfetiva, marcadoresPelaIdade } = await import('./regulacao.ts')
  assert.equal(prioridadeEfetiva({ prioridade: 'eletiva', prioridade_regulador: 'emergencia' }), 'emergencia')
  assert.equal(prioridadeEfetiva({ prioridade: 'nao_classificada', prioridade_regulador: null }), 'nao_classificada')
  assert.deepEqual(marcadoresPelaIdade('1960-10-11', '2026-10-11'), ['idoso'])
  assert.deepEqual(marcadoresPelaIdade('1966-10-12', '2026-10-11'), [])
  assert.deepEqual(marcadoresPelaIdade('2012-10-12', '2026-10-11'), ['crianca'])
  assert.deepEqual(marcadoresPelaIdade('2012-10-11', '2026-10-11'), [])
  assert.deepEqual(marcadoresPelaIdade(null, '2026-10-11'), [])
})

test('decisão: pedidos em decisão e data prevista', async () => {
  const { emDecisao, dataHoraLocalParaIso, MOTIVOS_NEGACAO } = await import('./regulacao.ts')
  assert.equal(emDecisao('pendencia'), true)
  assert.equal(emDecisao('devolvida'), false)
  assert.equal(emDecisao('autorizada'), false)
  assert.equal(dataHoraLocalParaIso(''), null)
  assert.equal(typeof dataHoraLocalParaIso('2026-10-11T18:30'), 'string')
  assert.equal(Object.keys(MOTIVOS_NEGACAO).length, 6)
})

test('anexos: tipo, tamanho, limite e caminho', async () => {
  const { erroArquivo, caminhoAnexo } = await import('./regulacao.ts')
  assert.equal(erroArquivo({ type: 'application/pdf', size: 1000 }), null)
  assert.equal(erroArquivo({ type: 'image/gif', size: 1000 }), 'Envie PDF, JPG ou PNG.')
  assert.equal(erroArquivo({ type: 'image/png', size: 11 * 1024 * 1024 }), 'O arquivo vai até 10 MB.')
  assert.equal(caminhoAnexo('abc', 'Eletrocardiograma às 14h.pdf', 5), 'abc/5-Eletrocardiograma-as-14h.pdf')
})

test('prazos (SLA): formulário, validação e selos', async () => {
  const { alertasSla, errosPrazos, prazosParaEnvio, prazosParaForm } = await import('./regulacao.ts')
  const form = prazosParaForm({
    central_id: 'c', fila: { emergencia: 30, urgencia: 60, prioritaria: null, eletiva: null },
    evolucao_h: 12, pendencia_h: 3, sem_evolucao_h: 72, ajustado: false, atualizado_em: null, atualizado_por: null,
  })
  assert.equal(form.fila.prioritaria, '')
  assert.deepEqual(errosPrazos(form), [])
  assert.deepEqual(prazosParaEnvio(form), {
    fila: { emergencia: 30, urgencia: 60, prioritaria: null, eletiva: null }, evolucao_h: 12, pendencia_h: 3, sem_evolucao_h: 72,
  })
  assert.equal(errosPrazos({ ...form, sem_evolucao_h: '12' }).length, 1)
  assert.equal(errosPrazos({ ...form, fila: { ...form.fila, urgencia: '0' } }).length, 1)
  assert.equal(errosPrazos({ ...form, pendencia_h: '1,5' }).length, 1)

  const agora = Date.parse('2026-10-11T12:00:00Z')
  assert.deepEqual(alertasSla(null, agora), [])
  const base = { atrasado_central: false, atrasado_origem: false, pendencia: null, evolucao: null }
  assert.deepEqual(alertasSla({ ...base, fila: { prazo_min: null, central_seg: 9000, correndo: true, atrasado: false } }, agora), [])
  assert.deepEqual(alertasSla({ ...base, fila: { prazo_min: 60, central_seg: 7200, correndo: true, atrasado: true } }, agora),
    [{ texto: 'Fila: prazo vencido (2 h 00 min de 1 h 00 min)', tom: 'critico' }])
  assert.equal(alertasSla({ ...base, fila: { prazo_min: 60, central_seg: 7200, correndo: false, atrasado: true } }, agora)[0].tom, 'neutro')
  const evol = (atrasada: boolean, risco: boolean, vence: string) => ({
    ...base, fila: { prazo_min: null, central_seg: 0, correndo: true, atrasado: false },
    evolucao: { ultima_em: '2026-10-11T00:00:00Z', prazo_h: 12, vence_em: vence, atrasada, limite_h: 72, risco_cancelamento: risco },
  })
  assert.equal(alertasSla(evol(true, true, '2026-10-11T00:00:00Z'), agora)[0].texto, '72 h sem evolução: risco de cancelamento')
  assert.equal(alertasSla(evol(true, false, '2026-10-11T00:00:00Z'), agora)[0].texto, 'Evolução vencida (12 h)')
  assert.equal(alertasSla(evol(false, false, '2026-10-11T13:00:00Z'), agora)[0].tom, 'atencao')
  assert.deepEqual(alertasSla(evol(false, false, '2026-10-11T20:00:00Z'), agora), [])
  assert.equal(alertasSla({ ...base, fila: { prazo_min: null, central_seg: 0, correndo: false, atrasado: false },
    pendencia: { desde: '2026-10-11T08:00:00Z', prazo_h: 3, vence_em: '2026-10-11T11:00:00Z', atrasada: true } }, agora)[0].texto,
    'Resposta à central vencida (3 h)')
})

test('mapa de vagas: formulário do serviço', async () => {
  const { SERVICO_VAZIO, errosServico, servicoParaEnvio } = await import('./regulacao.ts')
  assert.equal(errosServico(SERVICO_VAZIO).length, 3)
  const tc = { ...SERVICO_VAZIO, nome: ' Tomografia ', tipo: 'exame' as const, situacao: 'restrito' as const, procedimento: '0206010079', vagas: '2' }
  assert.deepEqual(errosServico(tc), [])
  assert.deepEqual(errosServico({ ...tc, procedimento: '02060' }), ['Procedimento SIGTAP: 10 dígitos.'])
  assert.deepEqual(errosServico({ ...tc, vagas: '-1' }), ['Vagas: número de 0 a 9999, ou vazio.'])
  assert.deepEqual(servicoParaEnvio({ ...tc, vagas: '', observacao: '  ' }),
    { nome: 'Tomografia', tipo: 'exame', situacao: 'restrito', procedimento: '0206010079', vagas: null, observacao: null })
})
