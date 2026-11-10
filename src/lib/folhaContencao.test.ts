// node --experimental-strip-types --test src/lib/folhaContencao.test.ts
// Lacuna 4 (K10): a folha "Registro de contenção mecânica" (folha_relatorio,
// tipo 'contencao'), montada pelo mesmo modelo no servidor e no aparelho.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { montarRelatorio, TIPOS_RELATORIO, type ContextoFolha } from './folhas.ts'

const ctx: ContextoFolha = {
  unidade: { nome: 'UPA Teste' }, paciente: { nome: 'Paciente <Teste>', nascimento: '2021-01-01' },
  autor: { nome: 'Enfermeira Teste', registro: 'COREN 1' }, emissao: { modo: 'relatorio', protocolo: 'IMP-ABCDEF0123', em: '2026-11-10T15:00:00Z' },
}
const contencao = {
  pediatrico: true, motivo: 'Agitação com risco de queda', alternativas: 'Abordagem verbal', locais: ['msd', 'mse'], pontos: 2,
  iniciada_em: '2026-11-10T13:00:00Z', iniciada_por: 'Enfermeira Teste', iniciada_por_registro: 'COREN 1', papel_inicio: 'enfermeiro',
  prescricoes: [
    { descricao: 'Contenção mecânica em 2 pontos', observacao: 'Motivo: agitação. Período previsto: até 4 h.', prescrita_em: '2026-11-10T13:10:00Z',
      medico: 'Médico Teste', medico_registro: 'CRM 9', suspenso_em: '2026-11-10T15:00:00Z', motivo_suspensao: 'Contenção retirada: calmo' },
  ],
  familia_informada: false, familia_detalhe: 'Sem acompanhante', familia_em: '2026-11-10T13:05:00Z', familia_registrado_por: 'Enfermeira Teste',
  lista_revisoes: [
    { revisada_em: '2026-11-10T14:00:00Z', consciencia: 'Agitada', rass: null, sinais_vitais: 'FC 128 FR 30 SpO2 97%', pele: 'Íntegra',
      perfusao: 'Preservada', necessidades: null, intercorrencia: 'Lesão por pressão ou de pele (leve)', observacao: null,
      registrado_por: 'Técnico Teste', papel: 'tecnico_enfermagem', retificada: false, retifica_id: null },
    { revisada_em: '2026-11-10T13:55:00Z', consciencia: 'Agitada', rass: null, sinais_vitais: 'FC 130', pele: 'x', perfusao: 'x',
      necessidades: null, intercorrencia: null, observacao: null, registrado_por: 'Técnico Teste', papel: 'tecnico_enfermagem', retificada: true, retifica_id: null },
  ],
  retirada_em: '2026-11-10T15:00:00Z', retirada_por: 'Técnico Teste', motivo_retirada: 'Calma, com a mãe', retirada_automatica: false,
}

test('folha da contenção: início, prescrição, revisões (crus) e retirada, com protocolo', () => {
  assert.ok(TIPOS_RELATORIO.includes('contencao'))
  const html = montarRelatorio('contencao', { contencoes: [contencao] }, ctx)
  assert.ok(html.startsWith('<!doctype html>'))
  for (const trecho of [
    'Registro de contenção mecânica', 'IMP-ABCDEF0123', 'Paciente &lt;Teste&gt;', '<b>Pediátrico</b>', '2 pontos · membro superior direito, membro superior esquerdo',
    'Contenção mecânica em 2 pontos', 'Médico Teste · CRM 9', 'FC 128 FR 30 SpO2 97%', 'Intercorrência: Lesão por pressão ou de pele (leve)',
    'Técnico Teste · técnico de enfermagem', 'Não informada · Sem acompanhante', 'Calma, com a mãe', 'Resolução COFEN 746/2024',
  ]) assert.ok(html.includes(trecho), trecho)
  // a retificada fica, marcada, e a ordem é a da hora
  assert.ok(html.indexOf('FC 130') < html.indexOf('FC 128 FR 30'))
  assert.ok(html.includes('<i>retificada</i>'))
})

test('sem contenção e sem prescrição', () => {
  assert.ok(montarRelatorio('contencao', { contencoes: [] }, ctx).includes('Nenhuma contenção selecionada.'))
  const html = montarRelatorio('contencao', { contencoes: [{ ...contencao, prescricoes: [], lista_revisoes: [], retirada_em: null, pediatrico: false }] }, ctx)
  assert.ok(html.includes('Sem prescrição médica registrada.'))
  assert.ok(html.includes('Contenção em curso.'))
  assert.ok(!html.includes('<b>Pediátrico</b>'))
})
