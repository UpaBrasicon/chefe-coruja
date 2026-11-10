// node --experimental-strip-types --test src/lib/contencao.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ativasPorPaciente, duracaoContencao, percentual, revisoesVigentes, rotuloLocais, rotuloPontos, rotuloRass, selosDaContencao,
  type ContencaoAtiva, type RevisaoContencao,
} from './contencao.ts'

const estado = { ativa: true, revisao_atrasada: false, sem_prescricao: false, renovacao: 'em_dia' as const }

test('selos: nada quando em dia ou retirada', () => {
  assert.deepEqual(selosDaContencao(estado), [])
  assert.deepEqual(selosDaContencao({ ...estado, ativa: false, revisao_atrasada: true, sem_prescricao: true }), [])
})

test('selos: atraso, sem prescrição e renovação, do mais urgente', () => {
  assert.deepEqual(selosDaContencao({ ...estado, revisao_atrasada: true, sem_prescricao: true, renovacao: null }).map((s) => s.texto),
    ['Revisão da contenção atrasada', 'Contenção sem prescrição'])
  assert.deepEqual(selosDaContencao({ ...estado, renovacao: 'perto' }), [{ texto: 'Renovar a prescrição da contenção', tom: 'ambar' }])
  assert.deepEqual(selosDaContencao({ ...estado, renovacao: 'vencida' }), [{ texto: 'Prescrição da contenção vencida', tom: 'critico' }])
})

test('locais e pontos', () => {
  assert.equal(rotuloLocais(['mie', 'msd']), 'Membro superior direito, membro inferior esquerdo')
  assert.equal(rotuloLocais([]), '')
  assert.equal(rotuloPontos(1), '1 ponto')
  assert.equal(rotuloPontos(4), '4 pontos')
})

const r = (id: string, em: string, retificada = false): RevisaoContencao => ({
  id, revisada_em: em, consciencia: 'x', rass: null, sinais_vitais: 'PA 120/80', pele: 'x', perfusao: 'x', necessidades: null,
  observacao: null, intercorrencia_id: null, intercorrencia: null, registrado_por: null, papel: 'enfermeiro', registrado_em: em,
  retifica_id: null, retificada,
})

test('revisões vigentes, da mais nova', () => {
  const l = [r('a', '2026-11-10T10:00:00Z', true), r('b', '2026-11-10T10:00:00Z'), r('c', '2026-11-10T11:00:00Z')]
  assert.deepEqual(revisoesVigentes(l).map((x) => x.id), ['c', 'b'])
})

test('duração', () => {
  const ini = '2026-11-10T10:00:00Z'
  assert.equal(duracaoContencao(ini, '2026-11-10T10:45:00Z', 0), '45 min')
  assert.equal(duracaoContencao(ini, '2026-11-10T12:05:00Z', 0), '2h05')
  assert.equal(duracaoContencao(ini, null, Date.parse('2026-11-13T10:00:00Z')), '3 dias')
})

test('percentual com vírgula; sem denominador, null', () => {
  assert.equal(percentual(1, 2), '50%')
  assert.equal(percentual(1, 3), '33,3%')
  assert.equal(percentual(0, 0), null)
})

test('ativas por paciente e RASS', () => {
  const a = { contencao_id: 'c', paciente_id: 'p', iniciada_em: 'x', pediatrico: false, revisoes: 0, ultima_revisao_em: null,
    proxima_revisao_em: null, prescricao_vence_em: null, ...estado } satisfies ContencaoAtiva
  assert.equal(ativasPorPaciente([a]).get('p')?.contencao_id, 'c')
  assert.equal(ativasPorPaciente(undefined).size, 0)
  assert.deepEqual([4, 0, -3].map(rotuloRass), ['+4', '0', '−3'])
})
