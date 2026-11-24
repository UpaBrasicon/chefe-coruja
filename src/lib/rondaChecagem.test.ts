// CK1–CK3 (revisão do perfil Enfermeiro, RT 24/11/2026): a ronda por horário
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { agruparRonda, estadoDaFicha, grupoDoItem, itemVencido, type ItemRonda } from './rondaChecagem.ts'

// 24/11/2026 12:00 em Brasília
const AGORA = Date.parse('2026-11-24T15:00:00Z')
const item = (p: Partial<ItemRonda>): ItemRonda => ({
  tipo: 'medicamento', posologia: '24/24h', se_necessario: false, horarios: null, vasoativo: false,
  prescrito_em: '2026-11-24T09:00:00Z', valida_ate: '2026-11-25T09:00:00Z', ultima_situacao: null, por_horario: null, ...p,
})

test('CK1: grupos pelo horário mais urgente', () => {
  assert.equal(grupoDoItem(item({ horarios: ['12:00'] }), AGORA).grupo, 'agora')
  assert.equal(grupoDoItem(item({ horarios: ['12:20'] }), AGORA).grupo, 'agora')
  assert.equal(grupoDoItem(item({ horarios: ['13:30'] }), AGORA).grupo, 'proximas')
  assert.equal(grupoDoItem(item({ horarios: ['18:00'] }), AGORA).grupo, 'mais_tarde')
  // 11:00 sem checagem: passou, mas dentro da tolerância de 2 h
  assert.equal(grupoDoItem(item({ horarios: ['11:00'] }), AGORA).grupo, 'agora')
  // 09:00 sem checagem: passou da tolerância (regra do servidor)
  assert.equal(grupoDoItem(item({ horarios: ['09:00'] }), AGORA).grupo, 'atrasadas')
  // 09:00 checado às 09:05: o próximo é amanhã
  const checado = item({ horarios: ['09:00'], por_horario: { '09:00': { situacao: 'feito', em: '2026-11-24T12:05:00Z' } } })
  assert.equal(grupoDoItem(checado, AGORA).grupo, 'mais_tarde')
})

test('CK1: horário antes da prescrição não é dose', () => {
  const l = item({ horarios: ['10:00', '22:00'], prescrito_em: '2026-11-24T14:30:00Z' })
  assert.equal(grupoDoItem(l, AGORA).grupo, 'mais_tarde')
})

test('CK2: dose única feita vai para os feitos; Agora pendente é para já; se necessário à parte', () => {
  assert.equal(grupoDoItem(item({ posologia: 'Agora', ultima_situacao: 'feito' }), AGORA).grupo, 'feitos')
  assert.equal(grupoDoItem(item({ posologia: 'Agora' }), AGORA).grupo, 'agora')
  assert.equal(grupoDoItem(item({ se_necessario: true, posologia: 'se dor' }), AGORA).grupo, 'sem_horario')
  assert.equal(grupoDoItem(item({ posologia: '8/8h' }), AGORA).grupo, 'sem_horario')
})

test('CK1: agrupar mantém a ordem dos grupos e ordena pelo horário', () => {
  const a = item({ horarios: ['13:40'] })
  const b = item({ horarios: ['12:30'] })
  const c = item({ horarios: ['13:00'] })
  const g = agruparRonda([a, b, c], AGORA)
  assert.deepEqual(g.map((x) => x.id), ['atrasadas', 'agora', 'proximas', 'mais_tarde', 'sem_horario', 'feitos'])
  assert.deepEqual(g.find((x) => x.id === 'proximas')!.itens, [c, a])
  assert.deepEqual(g.find((x) => x.id === 'agora')!.itens, [b])
})

test('CK3: estado de cada ficha de horário', () => {
  const l = item({ horarios: ['06:00', '09:00', '12:00', '13:00', '18:00'], prescrito_em: '2026-11-24T08:00:00Z',
    por_horario: { '06:00': { situacao: 'feito', em: '2026-11-24T09:10:00Z' } } })
  assert.equal(estadoDaFicha(l, '06:00', AGORA), 'feito')
  assert.equal(estadoDaFicha(l, '09:00', AGORA), 'atrasado')
  assert.equal(estadoDaFicha(l, '12:00', AGORA), 'agora')
  assert.equal(estadoDaFicha(l, '13:00', AGORA), 'proximo')
  assert.equal(estadoDaFicha(l, '18:00', AGORA), 'depois')
})

test('CK2: vencido pela validade do servidor ou pelo prazo', () => {
  assert.equal(itemVencido({ valida_ate: '2026-11-24T14:00:00Z' }, AGORA), true)
  assert.equal(itemVencido({ valida_ate: '2026-11-25T14:00:00Z' }, AGORA), false)
})
