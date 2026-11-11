// node --experimental-strip-types --test src/lib/reabrirAtendimento.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  avisosReabertura, motivoReaberturaValido, podeVerReabrir, resumoQueVolta, rotuloMotivoReabertura, rotuloReaberto, ultimaReabertura,
  type ImpactoReabertura,
} from './reabrirAtendimento.ts'

test('motivo: da lista; "outro" pede 10 letras; até 500', () => {
  assert.equal(motivoReaberturaValido(null, ''), false)
  assert.equal(motivoReaberturaValido('arrependimento', 'qualquer coisa longa'), false)
  assert.equal(motivoReaberturaValido('erro_registro', ''), true)
  assert.equal(motivoReaberturaValido('paciente_voltou', '  '), true)
  assert.equal(motivoReaberturaValido('outro', 'curto'), false)
  assert.equal(motivoReaberturaValido('outro', '   nove letr   '), false)
  assert.equal(motivoReaberturaValido('outro', 'Família trouxe exame'), true)
  assert.equal(motivoReaberturaValido('desfecho_errado', 'x'.repeat(501)), false)
  assert.equal(rotuloMotivoReabertura('paciente_voltou'), 'Paciente voltou')
  assert.equal(rotuloMotivoReabertura('desconhecido'), 'desconhecido')
})

const agora = Date.parse('2026-11-10T15:00:00Z')
const saida = { desfecho: 'alta', desfecho_por: 'med', desfecho_em: '2026-11-10T10:00:00Z', encerrado_em: '2026-11-10T10:00:00Z' }

test('botão: autor ou gestor, desfecho que reabre, até 24 h', () => {
  assert.equal(podeVerReabrir(saida, { perfilId: 'med', ehGestor: false }, agora), true)
  assert.equal(podeVerReabrir(saida, { perfilId: 'outro', ehGestor: false }, agora), false)
  assert.equal(podeVerReabrir(saida, { perfilId: 'outro', ehGestor: true }, agora), true)
  assert.equal(podeVerReabrir(saida, { perfilId: null, ehGestor: false }, agora), false)
  for (const d of ['obito', 'cancelado', 'observacao', 'internacao']) {
    assert.equal(podeVerReabrir({ ...saida, desfecho: d }, { perfilId: 'med', ehGestor: true }, agora), false, d)
  }
  assert.equal(podeVerReabrir({ ...saida, desfecho: 'transferencia' }, { perfilId: 'med', ehGestor: false }, agora), true)
  // retirado da fila (sem médico): nem o gestor
  assert.equal(podeVerReabrir({ ...saida, desfecho: 'evasao', desfecho_por: null }, { perfilId: 'med', ehGestor: true }, agora), false)
  // 24 h contadas do encerramento
  assert.equal(podeVerReabrir({ ...saida, encerrado_em: '2026-11-09T15:00:01Z' }, { perfilId: 'med', ehGestor: false }, agora), true)
  assert.equal(podeVerReabrir({ ...saida, encerrado_em: '2026-11-09T15:00:00Z' }, { perfilId: 'med', ehGestor: false }, agora), false)
  assert.equal(podeVerReabrir({ ...saida, encerrado_em: null, desfecho_em: null }, { perfilId: 'med', ehGestor: false }, agora), false)
})

const vazio: ImpactoReabertura = {
  itens_voltam: [], itens_nao_voltam: [], exames_cancelados: [], pareceres_cancelados: [], isolamentos_encerrados: [],
  contencoes_encerradas: [], documentos: [], rac_enviado: false, contrarreferencias: 0,
}

test('aviso: o rascunho sempre; o resto só quando há', () => {
  assert.deepEqual(avisosReabertura(vazio), ['O rascunho do registro do atendimento não volta.'])
  const tudo = avisosReabertura({
    ...vazio,
    itens_nao_voltam: [{ id: '1', descricao: 'Jejum oral', motivo: 'vencido' }, { id: '2', descricao: 'Contenção', motivo: 'contencao' }],
    exames_cancelados: [{ id: 'e', exame: 'Hemograma' }],
    pareceres_cancelados: [{ id: 'p', especialidade: 'Cirurgia geral' }],
    isolamentos_encerrados: [{ id: 'i', tipo: 'goticula' }],
    rac_enviado: true, contrarreferencias: 1,
  })
  assert.deepEqual(tudo, [
    'Prescrição vencida não volta (fica suspensa): Jejum oral. Prescreva de novo se precisar.',
    'A contenção encerrada no desfecho não volta.',
    'Exame cancelado não volta: Hemograma. Peça de novo se precisar.',
    'Parecer cancelado não volta: Cirurgia geral. Peça de novo se precisar.',
    'O isolamento encerrado não volta (gotícula): a enfermagem marca de novo se precisar.',
    'O rascunho do registro do atendimento não volta.',
    'O retorno avisado à UBS é cancelado.',
    'O registro do atendimento já foi enviado à RNDS: o envio fica como está.',
  ])
  // sem travessão nem "com sucesso" no texto da tela
  for (const l of tudo) assert.doesNotMatch(l, /—|com sucesso/)
})

test('o que volta e o selo', () => {
  assert.equal(resumoQueVolta({ itens_voltam: [] }), null)
  assert.equal(resumoQueVolta({ itens_voltam: [{ id: '1', descricao: 'Cabeceira elevada' }, { id: '2', descricao: 'Dipirona' }] }),
    'Volta a valer: Cabeceira elevada, Dipirona.')
  assert.equal(ultimaReabertura([]), null)
  const r = ultimaReabertura([
    { desfecho_anterior: 'alta', criado_em: '2026-11-10T10:00:00Z' },
    { desfecho_anterior: 'evasao', criado_em: '2026-11-10T12:00:00Z' },
  ])
  assert.equal(r?.desfecho_anterior, 'evasao')
  assert.equal(rotuloReaberto(r), 'Reaberto · antes: Evasão')
  assert.equal(rotuloReaberto(null), null)
})
