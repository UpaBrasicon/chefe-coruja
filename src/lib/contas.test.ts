// node --experimental-strip-types --test src/lib/contas.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acoesDaConta, ondeCorrigir, reais } from './contas.ts'

const base = { tipo: 'ambulatorial' as const, atendimento_terminou: true, pode_conduzir: true, pode_reabrir: false }
const paras = (a: ReturnType<typeof acoesDaConta>) => a.map((x) => x.para)

test('faturamento conduz: aberta → em conferência → fechada → faturada', () => {
  assert.deepEqual(paras(acoesDaConta({ ...base, status: 'aberta' })), ['em_conferencia'])
  assert.deepEqual(paras(acoesDaConta({ ...base, status: 'em_conferencia' })), ['fechada', 'aberta'])
  assert.deepEqual(paras(acoesDaConta({ ...base, status: 'fechada' })), ['faturada'])
  assert.deepEqual(paras(acoesDaConta({ ...base, status: 'faturada' })), [])
})

test('fechar só depois do fim do atendimento; voltar a aberta pede motivo', () => {
  const a = acoesDaConta({ ...base, status: 'em_conferencia', atendimento_terminou: false })
  assert.equal(a[0].bloqueio, 'O atendimento ainda não terminou.')
  assert.equal(acoesDaConta({ ...base, tipo: 'internacao', status: 'em_conferencia', atendimento_terminou: false })[0].bloqueio,
    'A internação ainda não teve alta.')
  assert.equal(a[1].pedeMotivo, true)
})

test('pendência bloqueante sem liberação trava o fechamento; o fim do atendimento vem antes', () => {
  assert.match(acoesDaConta({ ...base, status: 'em_conferencia', bloqueantes_sem_liberacao: 2 })[0].bloqueio ?? '', /^Há 2 pendência/)
  assert.equal(acoesDaConta({ ...base, status: 'em_conferencia', bloqueantes_sem_liberacao: 0 })[0].bloqueio, undefined)
  assert.equal(acoesDaConta({ ...base, status: 'em_conferencia', atendimento_terminou: false, bloqueantes_sem_liberacao: 2 })[0].bloqueio,
    'O atendimento ainda não terminou.')
})

test('onde corrigir: pelo código, senão pelo grupo', () => {
  assert.match(ondeCorrigir({ grupo: 'procedimento', codigo: 'sem_codigo' }, 'ambulatorial'), /BPA → Configuração/)
  assert.equal(ondeCorrigir({ grupo: 'paciente', codigo: 'raca' }, 'ambulatorial'), 'Cadastro do paciente')
  assert.match(ondeCorrigir({ grupo: 'procedimento', codigo: 'sexo' }, 'internacao'), /Laudo da AIH/)
})

test('gestor só reabre, com motivo', () => {
  const g = { ...base, pode_conduzir: false, pode_reabrir: true }
  assert.deepEqual(paras(acoesDaConta({ ...g, status: 'aberta' })), [])
  assert.deepEqual(acoesDaConta({ ...g, status: 'faturada' }).map((x) => [x.para, x.pedeMotivo]), [['aberta', true]])
})

test('valor de referência em reais', () => {
  assert.equal(reais(12).replace(/\s/g, ' '), 'R$ 12,00')
  assert.equal(reais(null), '—')
})
