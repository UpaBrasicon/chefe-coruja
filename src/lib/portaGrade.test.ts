// node --experimental-strip-types --test src/lib/portaGrade.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ETAPAS_GRADE, temAtraso, type LinhaGrade } from './portaGrade.ts'

const linha = (p: Partial<LinhaGrade>): LinhaGrade => ({
  episodio_id: 'e', nome: 'Paciente', cor: 'amarelo', setor: 'PS', etapa: 'atendimento', chegada_em: '2026-10-27T12:00:00Z',
  no_ps_min: 30, no_ps_atrasado: false,
  classificacao: { em: null, atrasada: false }, chamada: { em: null, vezes: 0, atrasada: false },
  atendimento: { em: null, atrasado: false }, exames: { feitos: 0, total: 0, desde: null, atrasado: false },
  medicacao: { ultima_em: null, pendentes: 0, desde: null, atrasada: false },
  reavaliacao: { feita_em: null, prevista_em: null, atrasada: false }, desfecho: { tipo: null, em: null }, ...p,
})
const celula = (chave: string, l: LinhaGrade) => ETAPAS_GRADE.find((e) => e.chave === chave)!.celula(l)

test('as colunas são as sete etapas, na ordem do atendimento', () => {
  assert.deepEqual(ETAPAS_GRADE.map((e) => e.chave), ['classificacao', 'chamada', 'atendimento', 'exames', 'medicacao', 'reavaliacao', 'desfecho'])
})

test('feito mostra a hora em Brasília', () => {
  const l = linha({ classificacao: { em: '2026-10-27T12:05:00Z', atrasada: false } })
  assert.deepEqual(celula('classificacao', l), { texto: '09:05', estado: 'feito' })
})

test('classificação: falta só na triagem; atrasada pelo alvo da unidade', () => {
  assert.equal(celula('classificacao', linha({ etapa: 'triagem' })).estado, 'pedido')
  assert.deepEqual(celula('classificacao', linha({ etapa: 'triagem', classificacao: { em: null, atrasada: true } })), { texto: 'falta', estado: 'atrasado' })
  assert.equal(celula('chamada', linha({ etapa: 'triagem' })).estado, 'vazio')
})

test('chamada repetida: a hora da última e quantas vezes', () => {
  const l = linha({ chamada: { em: '2026-10-27T13:04:00Z', vezes: 3, atrasada: false } })
  assert.deepEqual(celula('chamada', l), { texto: '10:04 · 3ª', estado: 'feito' })
  assert.equal(celula('chamada', linha({ chamada: { em: '2026-10-27T13:04:00Z', vezes: 1, atrasada: false } })).texto, '10:04')
})

test('atendimento: falta só depois da chamada', () => {
  assert.equal(celula('atendimento', linha({})).estado, 'vazio')
  assert.equal(celula('atendimento', linha({ chamada: { em: '2026-10-27T13:04:00Z', vezes: 1, atrasada: false }, atendimento: { em: null, atrasado: true } })).estado, 'atrasado')
})

test('exames: "N de M"; todos com resultado é feito; sem pedido é vazio', () => {
  assert.equal(celula('exames', linha({})).estado, 'vazio')
  assert.deepEqual(celula('exames', linha({ exames: { feitos: 1, total: 3, desde: 'x', atrasado: false } })), { texto: '1 de 3', estado: 'pedido' })
  assert.deepEqual(celula('exames', linha({ exames: { feitos: 2, total: 2, desde: null, atrasado: false } })), { texto: '2 de 2', estado: 'feito' })
})

test('medicação: pendentes no plural; sem pendente mostra a última checagem', () => {
  assert.equal(celula('medicacao', linha({ medicacao: { ultima_em: null, pendentes: 1, desde: 'x', atrasada: false } })).texto, '1 pendente')
  assert.equal(celula('medicacao', linha({ medicacao: { ultima_em: null, pendentes: 2, desde: 'x', atrasada: true } })).estado, 'atrasado')
  assert.deepEqual(celula('medicacao', linha({ medicacao: { ultima_em: '2026-10-27T12:24:00Z', pendentes: 0, desde: null, atrasada: false } })), { texto: '09:24', estado: 'feito' })
})

test('reavaliação: a prevista vale mais que a feita', () => {
  const l = linha({ reavaliacao: { feita_em: '2026-10-27T12:00:00Z', prevista_em: '2026-10-27T13:14:00Z', atrasada: true } })
  assert.deepEqual(celula('reavaliacao', l), { texto: '10:14', estado: 'atrasado' })
  assert.equal(celula('reavaliacao', linha({ reavaliacao: { feita_em: '2026-10-27T12:00:00Z', prevista_em: null, atrasada: false } })).estado, 'feito')
})

test('desfecho com o rótulo e a hora', () => {
  assert.equal(celula('desfecho', linha({ desfecho: { tipo: 'alta_apos_medicacao', em: '2026-10-27T13:00:00Z' } })).texto, 'Alta após medicação 10:00')
})

test('temAtraso: o "No PS" ou qualquer etapa', () => {
  assert.equal(temAtraso(linha({})), false)
  assert.equal(temAtraso(linha({ no_ps_atrasado: true })), true)
  assert.equal(temAtraso(linha({ chamada: { em: null, vezes: 0, atrasada: true } })), true)
})
