// node --experimental-strip-types --test src/lib/contextoPacienteFarmacia.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  idadeDetalhada, lerContexto, lerHorariosFalta, ordenarQuemFicaSem, resumoAlergias, textoIdade, textoProximoHorario,
  type HorarioFalta,
} from './contextoPacienteFarmacia.ts'

const resposta = (o: Record<string, unknown> = {}) => ({
  idade: { texto: '68 anos', anos: 68, meses: 5, dias: 14, total_dias: 25004 },
  publico: 'adulto',
  alergias: { estado: 'nao_registrada', ativas: [] },
  peso_kg: 80, peso_em: '2026-10-20T13:03:27Z',
  ...o,
})

test('lerContexto: a resposta da função, sem confiar no formato', () => {
  const c = lerContexto(resposta())!
  assert.equal(c.idade?.texto, '68 anos')
  assert.equal(c.publico, 'adulto')
  assert.equal(c.alergias.estado, 'nao_registrada')
  assert.equal(c.peso_kg, 80)
  assert.equal(lerContexto(null), null)
  assert.equal(lerContexto({}), null)
  // estado desconhecido: não se afirma nada
  assert.equal(lerContexto(resposta({ alergias: { estado: 'talvez', ativas: [] } })), null)
})

test('lerContexto: sem idade, nunca adulto', () => {
  const c = lerContexto(resposta({ idade: null, publico: 'adulto' }))!
  assert.equal(c.idade, null)
  assert.equal(c.publico, 'desconhecida')
  assert.deepEqual(textoIdade(c), { principal: 'Idade não registrada', faixa: 'sem data de nascimento: não trate como adulto' })
})

test('lerContexto: peso zero ou inválido não vira peso', () => {
  assert.equal(lerContexto(resposta({ peso_kg: 0 }))!.peso_kg, null)
  assert.equal(lerContexto(resposta({ peso_kg: '70' }))!.peso_kg, null)
})

test('idadeDetalhada: partes zeradas saem, plural certo', () => {
  assert.equal(idadeDetalhada({ anos: 13, meses: 11, dias: 29 }), '13 anos, 11 meses e 29 dias')
  assert.equal(idadeDetalhada({ anos: 1, meses: 1, dias: 1 }), '1 ano, 1 mês e 1 dia')
  assert.equal(idadeDetalhada({ anos: 0, meses: 8, dias: 3 }), '8 meses e 3 dias')
  assert.equal(idadeDetalhada({ anos: 5, meses: 0, dias: 0 }), '5 anos')
  assert.equal(idadeDetalhada({ anos: 0, meses: 0, dias: 12 }), '12 dias')
  assert.equal(idadeDetalhada({ anos: 0, meses: 0, dias: 0 }), '0 dias')
})

test('textoIdade: pediatria com anos, meses e dias; adulto com o texto curto', () => {
  const ped = lerContexto(resposta({ idade: { texto: '13 anos', anos: 13, meses: 11, dias: 29, total_dias: 5112 }, publico: 'pediatrico' }))!
  assert.deepEqual(textoIdade(ped), { principal: '13 anos, 11 meses e 29 dias', faixa: 'Pediatria' })
  const adulto = lerContexto(resposta({ idade: { texto: '14 anos', anos: 14, meses: 0, dias: 0, total_dias: 5114 }, publico: 'adulto' }))!
  assert.deepEqual(textoIdade(adulto), { principal: '14 anos', faixa: null })
})

test('resumoAlergias: os quatro estados do app', () => {
  const tem = resumoAlergias({ estado: 'tem', ativas: [
    { substancia: 'Penicilina', tipo: 'medicamento', reacao: 'Anafilaxia em 2019', gravidade: 'grave' },
    { substancia: 'Dipirona', tipo: 'medicamento', reacao: null, gravidade: 'desconhecida' },
  ] })
  assert.equal(tem.tom, 'critico')
  assert.equal(tem.titulo, '2 alergias')
  assert.deepEqual(tem.itens[0], { substancia: 'Penicilina', detalhe: 'grave · Anafilaxia em 2019', grave: true })
  assert.deepEqual(tem.itens[1], { substancia: 'Dipirona', detalhe: 'gravidade não informada', grave: false })
  assert.equal(resumoAlergias({ estado: 'tem', ativas: [] }).titulo, 'Alergia registrada')
  assert.deepEqual(resumoAlergias({ estado: 'nega', ativas: [] }), { tom: 'neutro', titulo: 'Nega alergias', itens: [] })
  assert.equal(resumoAlergias({ estado: 'desconhece', ativas: [] }).tom, 'atencao')
  assert.deepEqual(resumoAlergias({ estado: 'nao_registrada', ativas: [] }), { tom: 'atencao', titulo: 'Alergia não registrada', itens: [] })
})

const h = (o: Partial<HorarioFalta> & { item_id: string }): HorarioFalta => ({
  paciente_id: 'p', medicamento_id: 'm', leito: null, setor: 'Pronto Socorro', local: 'Pronto Socorro',
  se_necessario: false, aprazado: true, proximo_em: null, vencido: false, ...o,
})

test('lerHorariosFalta: tolera lixo e completa o local', () => {
  assert.deepEqual(lerHorariosFalta(null), [])
  const l = lerHorariosFalta([{ item_id: 'a', leito: 'CM-1', setor: 'Clínica Médica', proximo_em: 'x' }, { semId: true }])
  assert.equal(l.length, 1)
  assert.equal(l[0].local, 'CM-1')
  assert.equal(l[0].proximo_em, null)
})

test('ordenarQuemFicaSem: o horário mais próximo primeiro, sem horário no fim pelo nome', () => {
  const pacientes = [
    { item_id: 'c', paciente: 'Carla' }, { item_id: 'a', paciente: 'Ana' }, { item_id: 'b', paciente: 'Bruno' }, { item_id: 'z', paciente: 'Zeca' },
  ]
  const horarios = [
    h({ item_id: 'a', proximo_em: '2026-11-24T20:00:00Z' }),
    h({ item_id: 'b', proximo_em: '2026-11-24T15:00:00Z', leito: 'CM-1', local: 'CM-1' }),
    h({ item_id: 'c', aprazado: false }),
  ]
  const r = ordenarQuemFicaSem(pacientes, horarios)
  assert.deepEqual(r.map((p) => p.paciente), ['Bruno', 'Ana', 'Carla', 'Zeca'])
  assert.equal(r[0].horario?.local, 'CM-1')
  assert.equal(r[3].horario, null)
  // sem a leitura dos horários, só a ordem pelo nome
  assert.deepEqual(ordenarQuemFicaSem(pacientes, null).map((p) => p.paciente), ['Ana', 'Bruno', 'Carla', 'Zeca'])
})

test('textoProximoHorario: hoje, amanhã, se necessário, sem aprazamento, vencida', () => {
  const agora = Date.parse('2026-11-24T15:00:00Z') // 12:00 em Brasília
  assert.equal(textoProximoHorario(h({ item_id: 'a', proximo_em: '2026-11-24T17:00:00Z' }), agora), 'próxima dose hoje 14:00')
  assert.equal(textoProximoHorario(h({ item_id: 'a', proximo_em: '2026-11-25T09:00:00Z' }), agora), 'próxima dose amanhã 06:00')
  assert.equal(textoProximoHorario(h({ item_id: 'a', se_necessario: true, aprazado: false }), agora), 'se necessário')
  assert.equal(textoProximoHorario(h({ item_id: 'a', aprazado: false }), agora), 'sem aprazamento')
  assert.equal(textoProximoHorario(h({ item_id: 'a', vencido: true }), agora), 'prescrição vencida')
  assert.equal(textoProximoHorario(h({ item_id: 'a' }), agora), 'sem dose nas próximas 24 h')
  assert.equal(textoProximoHorario(null, agora), null)
})
