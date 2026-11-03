import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { acoesDaLinha, contagem, horariosLivres, linhasDoDia, MOTIVOS_FECHAMENTO, MOTIVOS_RESERVA, type AgendaDia } from '../domain/agenda.ts'
import { itensDeNavegacao } from '../components/casca/navegacao.ts'

// 5A, tarefa 3 (decisões F1 a F6 e opção B do RT, 02/11/2026): agenda de
// consultas da UBS. As regras da tela repetem as do servidor (Manual do PEC).
const migration = readFileSync('supabase/migrations/20270214000001_agenda_ubs.sql', 'utf8').replace(/\r/g, '')
const AGORA = Date.parse('2026-11-10T13:00:00Z') // 10h em São Paulo
const HOJE = '2026-11-10'

const ag = (id: string, inicio: string, situacao: 'agendado' | 'presente' | 'nao_compareceu' = 'agendado', tipo: 'consulta' | 'reserva' = 'consulta') => ({
  id, tipo, situacao, inicio, fim: inicio, paciente_id: tipo === 'consulta' ? 'p' + id : null, nome: 'Paciente ' + id, nome_social: null,
  data_nascimento: null, tipo_atendimento_aps: tipo === 'consulta' ? 'consulta_agendada' as const : null, observacao: null,
  motivo_reserva: tipo === 'reserva' ? 'reuniao' as const : null, especifique: null, episodio_id: null,
})

test('motivos de reserva e de fechamento são os do banco', () => {
  assert.match(migration, new RegExp(`motivo_reserva IN \\(${MOTIVOS_RESERVA.map((m) => `'${m.valor}'`).join(', ')}\\)`))
  assert.match(migration, new RegExp(`motivo IN \\(${MOTIVOS_FECHAMENTO.map((m) => `'${m.valor}'`).join(', ')}\\)`))
})

test('ações da linha: chegada no dia, falta depois do horário, cancelar antes, desfazer falta só no dia', () => {
  const antes = ag('1', '2026-11-10T14:00:00Z')   // 11h, ainda não chegou
  const passou = ag('2', '2026-11-10T12:00:00Z')  // 9h, já passou
  assert.deepEqual(acoesDaLinha(antes, AGORA, HOJE, HOJE), ['chegou', 'cancelar'])
  assert.deepEqual(acoesDaLinha(passou, AGORA, HOJE, HOJE), ['chegou', 'falta'])
  assert.deepEqual(acoesDaLinha(ag('3', '2026-11-12T14:00:00Z'), AGORA, HOJE, '2026-11-12'), ['cancelar'])
  assert.deepEqual(acoesDaLinha(ag('4', '2026-11-10T12:00:00Z', 'nao_compareceu'), AGORA, HOJE, HOJE), ['desfazer_falta'])
  assert.deepEqual(acoesDaLinha(ag('5', '2026-11-09T12:00:00Z', 'nao_compareceu'), AGORA, HOJE, '2026-11-09'), [])
  assert.deepEqual(acoesDaLinha(ag('6', '2026-11-10T12:00:00Z', 'presente'), AGORA, HOJE, HOJE), [])
  assert.deepEqual(acoesDaLinha(ag('7', '2026-11-10T14:00:00Z', 'agendado', 'reserva'), AGORA, HOJE, HOJE), ['cancelar'])
})

test('lista do dia em ordem de horário; livres só no futuro e sem fechamento', () => {
  const dia: AgendaDia = {
    data: HOJE,
    profissionais: [
      { perfil_id: 'b', nome: 'Dr. B', fechamento: null, fora_da_grade: [ag('f', '2026-11-10T11:10:00Z')],
        horarios: [
          { inicio: '2026-11-10T12:00:00Z', fim: '', na_escala: true, agendamento: ag('x', '2026-11-10T12:00:00Z') },
          { inicio: '2026-11-10T14:00:00Z', fim: '', na_escala: false, agendamento: null },
          { inicio: '2026-11-10T12:20:00Z', fim: '', na_escala: true, agendamento: null },
        ] },
      { perfil_id: 'a', nome: 'Dra. A', fechamento: { id: 'z', motivo: 'ferias', especifique: null }, fora_da_grade: [],
        horarios: [{ inicio: '2026-11-10T15:00:00Z', fim: '', na_escala: true, agendamento: null }] },
    ],
  }
  assert.deepEqual(linhasDoDia(dia).map((l) => l.id), ['f', 'x'])
  assert.deepEqual(horariosLivres(dia.profissionais[0], AGORA).map((h) => h.inicio), ['2026-11-10T14:00:00Z'])
  assert.deepEqual(horariosLivres(dia.profissionais[1], AGORA), [])
  assert.deepEqual(contagem(linhasDoDia(dia)), { todos: 2, agendados: 2, presentes: 0, faltas: 0 })
})

test('a agenda de consultas só aparece na UBS, para quem marca', () => {
  for (const papel of ['recepcao', 'enfermeiro', 'tecnico_enfermagem', 'plantonista', 'gestor'] as const) {
    assert.ok(itensDeNavegacao(papel, false, false, 'ubs').some((i) => i.to === '/agenda-consultas'), `${papel} sem a agenda na UBS`)
    assert.ok(!itensDeNavegacao(papel, false, false, 'upa').some((i) => i.to === '/agenda-consultas'), `${papel} vê a agenda na UPA`)
  }
  assert.ok(!itensDeNavegacao('farmaceutico', false, false, 'ubs').some((i) => i.to === '/agenda-consultas'))
  const app = readFileSync('src/App.tsx', 'utf8')
  assert.match(app, /papeis=\{\['recepcao', 'enfermeiro', 'tecnico_enfermagem', 'plantonista', 'gestor'\]\} \/>\}>\s*<Route path="\/agenda-consultas"/)
})
