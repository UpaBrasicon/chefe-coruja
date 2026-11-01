// node --experimental-strip-types --test src/lib/admissaoReavaliacao.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { admissaoVigente, dadosReavaliacao, pendenciasReavaliacao, REAVALIACAO_VAZIA, textoReavaliacao } from './admissaoReavaliacao.ts'

const doc = (p: Partial<{ id: string; tipo: string; internacao_id: string | null; estado: string; versao: number }>) =>
  ({ id: 'x', tipo: 'admissao_anamnese', internacao_id: 'i1', estado: 'ativo', versao: 1, ...p })

test('a admissão que vale é a versão em vigor, não a corrigida', () => {
  const lista = [doc({ id: 'v1', estado: 'retificado' }), doc({ id: 'v2', versao: 2 }), doc({ id: 'outra', internacao_id: 'i2' })]
  assert.equal(admissaoVigente(lista, 'i1')?.id, 'v2')
  assert.equal(admissaoVigente(lista, 'i2')?.id, 'outra')
  assert.equal(admissaoVigente(lista, 'i3'), null)
  assert.equal(admissaoVigente(lista, null), null)
})

test('admissão cancelada continua sendo a da internação (não abre outra)', () => {
  assert.equal(admissaoVigente([doc({ id: 'c', estado: 'cancelado' })], 'i1')?.id, 'c')
})

test('reavaliação: tudo obrigatório, como no servidor', () => {
  assert.deepEqual(pendenciasReavaliacao(REAVALIACAO_VAZIA), ['O que mudou no quadro', 'História', 'Exame', 'Hipótese diagnóstica', 'Plano'])
  const f = { motivo: 'Evoluiu com AVC', subjetivo: 'Hemiparesia', objetivo: 'Força 3', cid: 'I63.9 — Infarto cerebral', cidOk: true, plano: 'Tomografia' }
  assert.deepEqual(pendenciasReavaliacao(f), [])
  assert.deepEqual(pendenciasReavaliacao({ ...f, plano: '   ' }), ['Plano'])
})

test('texto e dados da reavaliação', () => {
  const f = { motivo: ' Evoluiu com AVC ', subjetivo: 'Hemiparesia', objetivo: 'Força 3', cid: 'I63.9', cidOk: false, plano: 'Tomografia' }
  const tx = textoReavaliacao(f, '30/10/2026 08:00')
  assert.ok(tx.startsWith('REAVALIAÇÃO DO QUADRO\n\nLigada à admissão de 30/10/2026 08:00'))
  assert.ok(tx.includes('O QUE MUDOU NO QUADRO\nEvoluiu com AVC'))
  assert.ok(tx.includes('Hipótese diagnóstica: I63.9'))
  assert.deepEqual(dadosReavaliacao(f), { motivo: 'Evoluiu com AVC', subjetivo: 'Hemiparesia', objetivo: 'Força 3', cid: 'I63.9', plano: 'Tomografia' })
})
