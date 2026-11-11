// node --experimental-strip-types --test src/lib/atraso.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  atrasoDoFeito, contaAtraso, duracaoTexto, estadoDoHorario, janelaAtrasoMin, linhasCsvAtraso, motivoAtrasoValido, MOTIVOS_ATRASO,
  previstoDoHorario, rotuloMes, rotuloMotivoAtraso, taxa, type ItemAtraso,
} from './atraso.ts'

// 10/11/2026 15:00 em Brasília
const agora = Date.parse('2026-11-10T15:00:00-03:00')
const br = (s: string) => Date.parse(`${s}-03:00`)
const item = (x: Partial<ItemAtraso & { prescrito_em: string | null; valida_ate: string | null }> = {}) => ({
  tipo: 'medicamento', posologia: '12/12h', se_necessario: false, vasoativo: false, horarios: ['08:00', '20:00'],
  prescrito_em: '2026-11-10T00:00:00-03:00', valida_ate: null, ...x,
})

test('janela: 2 h, ou o menor intervalo (como private.janela_atraso)', () => {
  assert.equal(janelaAtrasoMin(['08:00']), 120)
  assert.equal(janelaAtrasoMin(['00:00', '06:00', '12:00', '18:00']), 120)
  assert.equal(janelaAtrasoMin(['08:00', '09:00', '10:00']), 60)
  assert.equal(janelaAtrasoMin(['23:30', '00:15']), 45)
  assert.equal(janelaAtrasoMin(['08:00', '08:00', 'xx']), 120)
  assert.equal(janelaAtrasoMin([]), 120)
})

test('horário previsto: de 2 h antes a 22 h depois (como private.horario_previsto)', () => {
  assert.equal(previstoDoHorario('08:00', br('2026-11-10T10:00:00')), br('2026-11-10T08:00:00'))
  assert.equal(previstoDoHorario('08:00', br('2026-11-10T06:30:00')), br('2026-11-10T08:00:00'))
  assert.equal(previstoDoHorario('08:00', br('2026-11-10T05:00:00')), br('2026-11-09T08:00:00'))
  assert.equal(previstoDoHorario('00:30', br('2026-11-10T23:30:00')), br('2026-11-11T00:30:00'))
  assert.equal(previstoDoHorario('25:00', agora), null)
})

test('A9: "Agora", "Se necessário", contínuo, BIC, vasoativo, contenção e sem horário ficam fora', () => {
  assert.equal(contaAtraso(item()), true)
  assert.equal(contaAtraso(item({ tipo: 'cuidado' })), true)
  assert.equal(contaAtraso(item({ posologia: 'Agora' })), false)
  assert.equal(contaAtraso(item({ se_necessario: true })), false)
  assert.equal(contaAtraso(item({ posologia: 'Contínuo' })), false)
  assert.equal(contaAtraso(item({ posologia: 'infusão contínua' })), false)
  assert.equal(contaAtraso(item({ posologia: 'BIC a 10 mL/h' })), false)
  assert.equal(contaAtraso(item({ posologia: 'em bomba' })), false)
  assert.equal(contaAtraso(item({ posologia: 'cubico 8/8h' })), true)
  assert.equal(contaAtraso(item({ vasoativo: true })), false)
  assert.equal(contaAtraso(item({ tipo: 'contencao' })), false)
  assert.equal(contaAtraso(item({ horarios: [] })), false)
})

test('estado do horário: no prazo, atrasado, omitido e checado', () => {
  // 08:00 de hoje: 7 h atrás
  assert.deepEqual(estadoDoHorario(item(), '08:00', null, agora), { tipo: 'atrasado', minutos: 420 })
  // 13:30: 1 h 30 min atrás, dentro das 2 h
  assert.deepEqual(estadoDoHorario(item({ horarios: ['13:30', '01:30'] }), '13:30', null, agora), { tipo: 'no_prazo' })
  // 1/1h: 1 h 30 min passa da janela de 1 h
  const umEmUm = item({ posologia: '1/1h', horarios: Array.from({ length: 24 }, (_, k) => `${String(k).padStart(2, '0')}:30`) })
  assert.deepEqual(estadoDoHorario(umEmUm, '13:30', null, agora), { tipo: 'atrasado', minutos: 90 })
  // 02:00: 13 h atrás, omitido
  assert.deepEqual(estadoDoHorario(item({ horarios: ['02:00', '14:00'], prescrito_em: '2026-11-09T20:00:00-03:00' }), '02:00', null, agora),
    { tipo: 'omitido', minutos: 780 })
  // checado hoje: vale a checagem; a de ontem não resolve o horário de hoje
  const hoje = { situacao: 'feito', em: '2026-11-10T08:10:00-03:00' }
  assert.deepEqual(estadoDoHorario(item(), '08:00', hoje, agora), { tipo: 'checado', checagem: hoje })
  assert.equal(estadoDoHorario(item(), '08:00', { situacao: 'feito', em: '2026-11-09T08:10:00-03:00' }, agora).tipo, 'atrasado')
  // antes da prescrição não é dose; depois da validade também não
  assert.deepEqual(estadoDoHorario(item({ prescrito_em: '2026-11-10T09:00:00-03:00' }), '08:00', null, agora), { tipo: 'no_prazo' })
  assert.deepEqual(estadoDoHorario(item({ valida_ate: '2026-11-10T07:00:00-03:00' }), '08:00', null, agora), { tipo: 'fora' })
  // fora da regra: nunca atrasado
  assert.deepEqual(estadoDoHorario(item({ posologia: 'contínuo' }), '08:00', null, agora), { tipo: 'fora' })
})

test('feito atrasado: minutos depois da janela, ou null', () => {
  assert.equal(atrasoDoFeito(item(), '08:00', agora), 420)
  assert.equal(atrasoDoFeito(item({ horarios: ['13:30', '01:30'] }), '13:30', agora), null)
  // horário anterior à prescrição: conta da prescrição (14:20, 40 min atrás)
  assert.equal(atrasoDoFeito(item({ prescrito_em: '2026-11-10T14:20:30-03:00' }), '08:00', agora), null)
  assert.equal(atrasoDoFeito(item({ prescrito_em: '2026-11-10T11:00:00-03:00' }), '08:00', agora), 240)
  assert.equal(atrasoDoFeito(item({ se_necessario: true }), '08:00', agora), null)
})

test('motivo do atraso: lista fechada; "outro" pede 5 letras', () => {
  assert.equal(MOTIVOS_ATRASO.length, 7)
  assert.equal(rotuloMotivoAtraso('falta_medicamento'), 'Falta do medicamento')
  assert.equal(rotuloMotivoAtraso('qualquer'), null)
  assert.equal(motivoAtrasoValido('intercorrencia', ''), true)
  assert.equal(motivoAtrasoValido('outro', 'abc'), false)
  assert.equal(motivoAtrasoValido('outro', 'Paciente no banho'), true)
  assert.equal(motivoAtrasoValido('', ''), false)
})

test('duração, taxa e CSV do indicador', () => {
  assert.equal(duracaoTexto(190), '3 h 10 min')
  assert.equal(duracaoTexto(45), '45 min')
  assert.equal(duracaoTexto(120), '2 h')
  assert.equal(taxa(1, 8), '12,5%')
  assert.equal(taxa(0, 0), '—')
  assert.equal(rotuloMes('2026-11'), '11/2026')
  const csv = linhasCsvAtraso({
    de: '2026-11-01', ate: '2026-11-30',
    linhas: [{ mes: '2026-11', setor_id: 's', setor: 'Pronto Socorro', previstas: 7, feitas: 4, atrasadas: 2, omissoes: 1 }],
    total: { previstas: 7, feitas: 4, atrasadas: 2, omissoes: 1 },
  })
  assert.deepEqual(csv[0], ['11/2026', 'Pronto Socorro', 7, 4, 2, '50%', 1, '14,3%'])
  assert.deepEqual(csv[1], ['Total', '', 7, 4, 2, '50%', 1, '14,3%'])
})
