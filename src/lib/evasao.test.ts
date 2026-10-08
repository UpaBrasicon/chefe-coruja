// node --experimental-strip-types --test src/lib/evasao.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MOTIVOS_EVASAO, rotuloMomento, rotuloMotivo, taxa } from './evasao.ts'

test('taxa com uma casa e vírgula', () => {
  assert.equal(taxa(0, 0), '—')
  assert.equal(taxa(3, 40), '7,5%')
  assert.equal(taxa(1, 3), '33,3%')
  assert.equal(taxa(0, 10), '0%')
})

test('motivos da lista batem com os do banco (registrar_motivo_evasao)', () => {
  assert.deepEqual(MOTIVOS_EVASAO.map((m) => m.valor), ['demora', 'melhorou', 'outro_servico', 'sem_informacao', 'outro'])
  assert.equal(rotuloMotivo('outro_servico'), 'Foi a outro serviço')
  assert.equal(rotuloMomento('aguardando_medico'), 'Esperando o médico')
})
