// node --experimental-strip-types --test src/lib/validadePrescricao.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  decisoesParaServidor, ehRenovacao, estadoValidade, faltaNaRenovacao, faltaPara, MOTIVO_RENOVACAO, paraRenovar, resumoValidade,
  seloValidade, textoResumoValidade, textoValidoAte, validadeDoItem, type DecisaoRenovacao,
} from './validadePrescricao.ts'
import { montarFolha, type ContextoFolha } from './folhas.ts'

const agora = Date.parse('2026-11-10T15:00:00Z')
const em = (min: number) => new Date(agora + min * 60_000).toISOString()

test('estado: como o servidor (2 h antes, no minuto do vencimento)', () => {
  assert.equal(estadoValidade(null, agora), 'sem_prazo')
  assert.equal(estadoValidade(em(121), agora), 'em_dia')
  assert.equal(estadoValidade(em(120), agora), 'vence_logo')
  assert.equal(estadoValidade(em(1), agora), 'vence_logo')
  assert.equal(estadoValidade(em(0), agora), 'vencido')
  assert.equal(estadoValidade(em(-30), agora), 'vencido')
})

test('vencido no servidor continua vencido na tela', () => {
  assert.equal(validadeDoItem({ valida_ate: em(300), validade: 'vencido' }, agora), 'vencido')
  assert.equal(validadeDoItem({ valida_ate: em(-1), validade: 'em_dia' }, agora), 'vencido')
})

test('selo: vencido, vence em, e nada em dia ou sem prazo', () => {
  assert.equal(seloValidade({ valida_ate: em(-5) }, agora)?.texto, 'Vencido, peça renovação')
  assert.equal(seloValidade({ valida_ate: em(-5) }, agora)?.tom, 'critico')
  assert.deepEqual(seloValidade({ valida_ate: em(80) }, agora) && { ...seloValidade({ valida_ate: em(80) }, agora), titulo: '' },
    { texto: 'Vence em 1h20', tom: 'ambar', titulo: '' })
  assert.match(seloValidade({ valida_ate: em(80) }, agora)!.titulo, /COFEN 689\/2022/)
  assert.equal(seloValidade({ valida_ate: em(500) }, agora), null)
  assert.equal(seloValidade({ valida_ate: null }, agora), null)
})

test('falta para o vencimento', () => {
  assert.equal(faltaPara(em(40), agora), '40 min')
  assert.equal(faltaPara(em(125), agora), '2h05')
  assert.equal(faltaPara(em(-3), agora), '0 min')
})

test('impressão: "válido até DD/MM HH:MM" no fuso de Brasília; "Agora" sem texto', () => {
  assert.equal(textoValidoAte('2026-11-11T17:00:00Z'), 'válido até 11/11 14:00')
  assert.equal(textoValidoAte(null), '')
})

test('renovação: vencendo e vencidos, sem contenção nem "Agora"', () => {
  const itens = [
    { id: 'a', tipo: 'medicamento', valida_ate: em(-10) },
    { id: 'b', tipo: 'cuidado', valida_ate: em(60) },
    { id: 'c', tipo: 'medicamento', valida_ate: em(600) },
    { id: 'd', tipo: 'medicamento', valida_ate: null },
    { id: 'e', tipo: 'contencao', valida_ate: em(-10) },
  ]
  assert.deepEqual(paraRenovar(itens, agora).map((i) => i.id), ['a', 'b'])
  assert.deepEqual(resumoValidade(itens, agora), { vencidos: 1, vencendo: 1, proximo: em(60) })
  assert.equal(textoResumoValidade(resumoValidade(itens, agora), agora)?.texto, 'Prescrição vencida: 1 item')
  assert.equal(textoResumoValidade({ vencidos: 0, vencendo: 2, proximo: em(30) }, agora)?.texto, 'Prescrição vence em 30 min (2 itens)')
  assert.equal(textoResumoValidade({ vencidos: 0, vencendo: 0, proximo: null }, agora), null)
})

const d = (x: Partial<DecisaoRenovacao>): DecisaoRenovacao => ({
  acao: null, motivo: '', mudancas: { dose: '1 g', via: 'EV', posologia: '6/6h', se_necessario: false }, ...x,
})

test('renovação: cada item com a marca e o motivo', () => {
  assert.deepEqual(faltaNaRenovacao([{ descricao: 'Dipirona', tipo: 'medicamento', d: d({}), mudou: false }]),
    ['Dipirona: marque manter, alterar ou suspender'])
  assert.deepEqual(faltaNaRenovacao([{ descricao: 'Dipirona', tipo: 'medicamento', d: d({ acao: 'manter' }), mudou: false }]), [])
  assert.deepEqual(faltaNaRenovacao([{ descricao: 'Dipirona', tipo: 'medicamento', d: d({ acao: 'alterar', motivo: 'Ajuste de dose' }), mudou: false }]),
    ['Dipirona: diga o que muda'])
  assert.deepEqual(faltaNaRenovacao([{ descricao: 'Dieta', tipo: 'cuidado', d: d({ acao: 'alterar', motivo: 'Ajuste' }), mudou: true }]),
    ['Dieta: cuidado não se altera; suspenda e prescreva de novo'])
  assert.deepEqual(faltaNaRenovacao([{ descricao: 'Dieta', tipo: 'cuidado', d: d({ acao: 'suspender', motivo: 'x' }), mudou: false }]),
    ['Dieta: diga o motivo'])
})

test('renovação: o corpo da RPC', () => {
  assert.deepEqual(decisoesParaServidor([
    { id: 'a', d: d({ acao: 'manter', motivo: 'ignorado' }) },
    { id: 'b', d: d({ acao: 'suspender', motivo: ' Sem indicação ' }) },
    { id: 'c', d: d({ acao: 'alterar', motivo: 'Ajuste', mudancas: { dose: ' 2 g ', via: 'EV', posologia: '8/8h', se_necessario: false } }) },
  ]), [
    { item_id: 'a', acao: 'manter' },
    { item_id: 'b', acao: 'suspender', motivo: 'Sem indicação' },
    { item_id: 'c', acao: 'alterar', mudancas: { dose: '2 g', via: 'EV', posologia: '8/8h', se_necessario: false }, motivo: 'Ajuste' },
  ])
})

test('versão renovada não é alteração', () => {
  assert.equal(ehRenovacao(MOTIVO_RENOVACAO), true)
  assert.equal(ehRenovacao('Ajuste de dose'), false)
  assert.equal(ehRenovacao(null), false)
})

test('folha da prescrição: "válido até" em cada item (V9); "Agora" sem', () => {
  const ctx: ContextoFolha = {
    unidade: { nome: 'UPA Teste' }, paciente: { nome: 'Paciente Teste', nascimento: '1980-01-01' },
    autor: { nome: 'Médico Teste', registro: 'CRM 9' }, emissao: { modo: 'rascunho' },
  }
  const html = montarFolha('prescricao', {
    paciente: { nome: 'Paciente Teste' },
    itens: [
      { med: 'Dipirona 1 g', via: 'EV', pos: '6/6h', apr: '06:00 12:00', val: textoValidoAte('2026-11-11T17:00:00Z') },
      { med: 'Ondansetrona 4 mg', via: 'EV', pos: 'Agora', apr: '', val: textoValidoAte(null) },
    ],
    obs: '',
  }, ctx)
  assert.match(html, /Dipirona 1 g<\/strong><br><span class="val">válido até 11\/11 14:00<\/span>/)
  assert.match(html, /Ondansetrona 4 mg<\/strong><\/td>/)
})
