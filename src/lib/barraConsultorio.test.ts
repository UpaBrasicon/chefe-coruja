// node --experimental-strip-types --test src/lib/barraConsultorio.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { portasComConsultorio, rotulosCurtos } from './barraConsultorio.ts'

const sala = (id: string, nome: string, tipo: string, setor_id: string) => ({ id, nome, tipo, setor_id, setor_nome: setor_id === 'ps' ? 'Pronto Socorro' : null })

test('BT1: só os setores com consultório entram, sem a triagem e na ordem da escala', () => {
  const salas = [
    sala('t1', 'Triagem 1', 'triagem', 'ps'), sala('c1', 'Consultório 1', 'consultorio', 'ps'),
    sala('c2', 'Consultório 2', 'consultorio', 'ps'), sala('e1', 'Sala de Emergência', 'emergencia', 'ps'),
  ]
  // médico escalado no PS e em três setores sem consultório (o caso da homologação)
  const r = portasComConsultorio(['cm', 'ps', 'obs', 'vermelha'], salas)
  assert.equal(r.length, 1)
  assert.equal(r[0].setor, 'ps')
  assert.equal(r[0].setorNome, 'Pronto Socorro')
  assert.deepEqual(r[0].consultorios.map((c) => c.id), ['c1', 'c2', 'e1'])
  assert.deepEqual(portasComConsultorio(['cm'], salas), [])
  assert.deepEqual(portasComConsultorio([], salas), [])
})

test('BT1: rótulo curto repete só o número quando o nome antes do número é o mesmo', () => {
  assert.deepEqual(rotulosCurtos(['Consultório 1', 'Consultório 2', 'Consultório 3', 'Sala de Emergência']),
    ['Consultório 1', '2', '3', 'Sala de Emergência'])
  assert.deepEqual(rotulosCurtos(['Sala 1', 'Consultório 2']), ['Sala 1', 'Consultório 2'])
  assert.deepEqual(rotulosCurtos(['Consultório']), ['Consultório'])
})
