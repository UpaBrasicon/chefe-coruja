import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { estadoDoItem, PONTOS, pontosDoPaciente, resumoHiperdia, temPendencia, TETO_NO_APP, type HiperdiaLinha } from '../domain/hiperdia.ts'
import { itensDeNavegacao } from '../components/casca/navegacao.ts'

// 5A, tarefa 7 (decisões J1 a J5 e opção A da tela, RT em 03/11/2026): a régua
// das notas C5 e C4 da SAPS/MS. Os pontos repetem o Quadro 01 de cada nota.
const AGORA = Date.parse('2026-11-03T12:00:00Z')
const linha = (programas: ('hipertensao' | 'diabetes')[], r: Partial<HiperdiaLinha> = {}): HiperdiaLinha => ({
  paciente_id: 'p', nome: 'Paciente', nome_social: null, data_nascimento: null, desde: '2026-01-01T00:00:00Z',
  programas: programas.map((programa, i) => ({ id: String(i), programa, origem: 'consulta', entrada_em: '2026-01-01T00:00:00Z' })),
  ultima_consulta: null, ultima_pa: null, ultimo_peso_altura: null, ultima_hba1c: null, ultima_avaliacao_pes: null,
  pes_com_alteracao: null, proxima_consulta: null, ...r,
})

test('pontos das notas C5 e C4 somam 100; o teto no app é sem o ACS', () => {
  for (const p of ['hipertensao', 'diabetes'] as const) {
    const soma = Object.values(PONTOS[p]).reduce((a, b) => a + b!, 0)
    assert.equal(soma, 100)
    assert.equal(TETO_NO_APP[p], soma - PONTOS[p].acs!)
  }
})

test('em dia, atrasado e sem registro pela janela de 6 e 12 meses', () => {
  const l = linha(['hipertensao'], { ultima_consulta: '2026-05-04T12:00:00Z', ultima_pa: '2026-05-02T12:00:00Z', ultimo_peso_altura: '2025-11-10T12:00:00Z' })
  assert.equal(estadoDoItem(l, 'consulta', AGORA), 'em_dia')
  assert.equal(estadoDoItem(l, 'pa', AGORA), 'atrasado')
  assert.equal(estadoDoItem(l, 'peso_altura', AGORA), 'em_dia')
  assert.equal(estadoDoItem(l, 'hba1c', AGORA), 'nao_se_aplica')
  assert.equal(estadoDoItem(l, 'acs', AGORA), 'fora_do_app')
  assert.equal(estadoDoItem(linha(['diabetes']), 'pes', AGORA), 'sem_registro')
})

test('pontuação por programa e o resumo do painel', () => {
  const recente = '2026-10-01T12:00:00Z'
  const tudo = linha(['hipertensao', 'diabetes'], { ultima_consulta: recente, ultima_pa: recente, ultimo_peso_altura: recente,
    ultima_hba1c: recente, ultima_avaliacao_pes: recente, proxima_consulta: '2026-11-20T12:00:00Z' })
  assert.deepEqual(pontosDoPaciente(tudo, AGORA), { hipertensao: 75, diabetes: 80 })
  assert.equal(temPendencia(tudo, AGORA), false)
  const so = linha(['diabetes'], { ultima_consulta: recente, ultima_hba1c: '2025-09-20T12:00:00Z' })
  assert.deepEqual(pontosDoPaciente(so, AGORA), { diabetes: 20 })
  assert.equal(temPendencia(so, AGORA), true)
  const r = resumoHiperdia([tudo, so], AGORA)
  assert.deepEqual(r, { total: 2, hipertensao: 1, diabetes: 2, emDia: 1, pendentes: 1, semConsultaMarcada: 1, mediaHipertensao: 75, mediaDiabetes: 50 })
})

test('o painel só aparece na UBS, para médico, enfermagem e gestor (J5)', () => {
  for (const papel of ['enfermeiro', 'tecnico_enfermagem', 'plantonista', 'gestor'] as const) {
    assert.ok(itensDeNavegacao(papel, false, false, 'ubs').some((i) => i.to === '/hiperdia'), `${papel} sem o hiperdia na UBS`)
    assert.ok(!itensDeNavegacao(papel, false, false, 'upa').some((i) => i.to === '/hiperdia'), `${papel} vê o hiperdia na UPA`)
  }
  assert.ok(!itensDeNavegacao('recepcao', false, false, 'ubs').some((i) => i.to === '/hiperdia'), 'a recepção não vê')
  const app = readFileSync('src/App.tsx', 'utf8')
  assert.match(app, /papeis=\{\['enfermeiro', 'tecnico_enfermagem', 'plantonista', 'gestor'\]\} \/>\}>\s*<Route path="\/hiperdia"/)
})

test('J4: a avaliação dos pés sai da consulta da UBS para a RPC', () => {
  const comp = readFileSync('src/components/hiperdia/HiperdiaNaConsulta.tsx', 'utf8')
  assert.match(comp, /rpc\('registrar_avaliacao_pes', \{ p_episodio: episodioId, p_resultado: resultado/)
  const conduta = readFileSync('src/pages/plantao/porta/AbaConduta.tsx', 'utf8')
  assert.match(conduta, /<HiperdiaNaConsulta /)
})
