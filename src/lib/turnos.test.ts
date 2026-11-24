// node --experimental-strip-types --test src/lib/turnos.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  TURNOS_PADRAO, horaCurta, horarioDoTurno, inicioDoCodigo, minutosDoTurno, rotuloHoras, rotuloTurno, turnosAtivos, validarTurno,
  type Turno,
} from './turnos.ts'
import { ehRetroativo, inicioDoTurno } from './retroativo.ts'

const diurno: Turno = {
  codigo: 't0a1b2c3d4e', nome: 'Diurno', inicio: '07:00:00', fim: '19:00:00', duracao_min: 720,
  cobre: 'todos', sobreaviso: false, padrao: false, ordem: 40, ativo: true,
}
const diarista: Turno = { ...diurno, codigo: 't5f6a7b8c9d', nome: 'Diarista', inicio: '08:00:00', fim: '17:30:00', duracao_min: 570, ordem: 50 }
const desligado: Turno = { ...diurno, codigo: 'tffffffffff', nome: 'Sobreaviso', ativo: false, ordem: 5 }

test('turnos: os três de sempre têm o horário de private.inicio_do_turno', () => {
  assert.deepEqual(TURNOS_PADRAO.map((t) => `${t.codigo} ${horarioDoTurno(t)} ${t.duracao_min}`),
    ['manha 07h–13h 360', 'tarde 13h–19h 360', 'noite 19h–07h 720'])
  for (const t of TURNOS_PADRAO) assert.equal(minutosDoTurno(t.inicio, t.fim), t.duracao_min)
})

test('turnos: minutos passam da meia-noite e início = fim vale 24 h (igual ao banco)', () => {
  assert.equal(minutosDoTurno('07:00', '19:00'), 720)
  assert.equal(minutosDoTurno('19:00', '07:00'), 720)
  assert.equal(minutosDoTurno('08:00', '17:30'), 570)
  assert.equal(minutosDoTurno('07:00', '07:00'), 1440)
  assert.equal(minutosDoTurno('23:59', '00:00'), 1)
})

test('turnos: rótulos de hora e de duração', () => {
  assert.equal(horaCurta('07:00:00'), '07h')
  assert.equal(horaCurta('17:30'), '17h30')
  assert.equal(horarioDoTurno(diarista), '08h–17h30')
  assert.equal(rotuloHoras(720), '12 h')
  assert.equal(rotuloHoras(570), '9 h 30')
})

test('turnos: lista ativa na ordem do cadastro; sem cadastro, os de sempre', () => {
  assert.deepEqual(turnosAtivos([diarista, desligado, ...TURNOS_PADRAO, diurno]).map((t) => t.nome),
    ['Manhã', 'Tarde', 'Noite', 'Diurno', 'Diarista'])
  assert.equal(turnosAtivos([]), TURNOS_PADRAO)
  assert.equal(turnosAtivos(undefined), TURNOS_PADRAO)
})

test('turnos: nome pelo código, também de turno desativado e dos códigos antigos', () => {
  const lista = [...TURNOS_PADRAO, diurno, desligado]
  assert.equal(rotuloTurno('t0a1b2c3d4e', lista), 'Diurno')
  assert.equal(rotuloTurno('tffffffffff', lista), 'Sobreaviso')
  assert.equal(rotuloTurno('manha'), 'Manhã')
  assert.equal(rotuloTurno('madrugada', lista), 'Madrugada')
  assert.equal(rotuloTurno('t9999999999'), 't9999999999')
  assert.equal(rotuloTurno(null), '')
})

test('turnos: formulário confere nome, horário e 1 hora no mínimo', () => {
  assert.equal(validarTurno({ nome: 'Diurno', inicio: '07:00', fim: '19:00' }), null)
  assert.match(validarTurno({ nome: '  ', inicio: '07:00', fim: '19:00' }) ?? '', /nome/)
  assert.match(validarTurno({ nome: 'x'.repeat(41), inicio: '07:00', fim: '19:00' }) ?? '', /40 letras/)
  assert.match(validarTurno({ nome: 'Curto', inicio: '08:00', fim: '08:30' }) ?? '', /1 hora/)
  assert.match(validarTurno({ nome: 'Sem hora', inicio: '', fim: '08:30' }) ?? '', /início e o fim/)
})

test('turnos: o aviso de acerto retroativo usa o início do turno cadastrado', () => {
  assert.equal(inicioDoCodigo('t5f6a7b8c9d', [diarista]), '08:00')
  assert.equal(inicioDoCodigo('noite'), '19:00')
  assert.equal(inicioDoTurno('2026-11-24', 't5f6a7b8c9d', '08:00').toISOString(), '2026-11-24T11:00:00.000Z')
  // os de sempre continuam iguais sem o cadastro
  assert.equal(inicioDoTurno('2026-11-24', 'manha').toISOString(), '2026-11-24T10:00:00.000Z')
  const agora = new Date('2026-11-24T10:30:00Z').getTime()  // 07h30 em Brasília
  assert.equal(ehRetroativo('2026-11-24', 'manha', agora), true)
  assert.equal(ehRetroativo('2026-11-24', 't5f6a7b8c9d', agora, '08:00'), false)
})
