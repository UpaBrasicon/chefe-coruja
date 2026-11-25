// node --experimental-strip-types --test src/lib/recepcaoRevisao.test.ts
// Revisão do perfil Recepção (RT, 24/11/2026): tempo nas filas (RF1), etapa das
// fichas de hoje (RE1), o que falta no cadastro (RE3) e o responsável (CA2).
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { acimaDoAlvo, horaDaFicha, maiorEspera, tempoNaFila, textoTempo } from './tempoFila.ts'
import { inicioDoDia, rotuloEtapa } from './fichasDeHoje.ts'
import { faltaNoCadastro, menorDeIdade, mostraResponsavel, porExtenso } from './cadastroRecepcao.ts'

const MIN = 60_000
const agora = Date.parse('2026-11-24T15:00:00-03:00')
const antes = (min: number) => new Date(agora - min * MIN).toISOString()

test('RF1: em atendimento conta desde o início do atendimento, não a espera congelada', () => {
  // classificado há 34 dias, atendimento começou 65 min depois da classificação
  const e = { etapa: 'atendimento', chegada_em: antes(34 * 1440 + 90), classificado_em: antes(34 * 1440), atendimento_iniciado_em: antes(34 * 1440 - 65) }
  const t = tempoNaFila(e, agora)
  assert.equal(t.tipo, 'atendimento')
  assert.equal(t.minutos, 34 * 1440 - 65)
  assert.match(textoTempo(t), /^em atendimento há 33 dias/)
})

test('RF1: a espera da fila médica conta da classificação; a da triagem, da ficha', () => {
  const medica = { etapa: 'atendimento', chegada_em: antes(100), classificado_em: antes(40), atendimento_iniciado_em: null }
  assert.deepEqual(tempoNaFila(medica, agora), { tipo: 'espera', desde: medica.classificado_em, minutos: 40 })
  assert.equal(textoTempo(tempoNaFila(medica, agora)), 'espera 40 min')
  const triagem = { etapa: 'triagem', chegada_em: antes(25), classificado_em: null, atendimento_iniciado_em: null }
  assert.equal(tempoNaFila(triagem, agora).minutos, 25)
  // sem a classificação gravada, a espera médica cai na ficha
  assert.equal(tempoNaFila({ ...medica, classificado_em: null }, agora).minutos, 100)
  // na UBS não há classificação: conta da ficha
  assert.equal(tempoNaFila(medica, agora, true).minutos, 100)
})

test('RF1: maior espera ignora quem já está em atendimento', () => {
  const itens = [
    { etapa: 'atendimento', chegada_em: antes(300), classificado_em: antes(200), atendimento_iniciado_em: antes(10) },
    { etapa: 'atendimento', chegada_em: antes(90), classificado_em: antes(70), atendimento_iniciado_em: null },
  ]
  assert.equal(maiorEspera(itens, agora), '1h10')
  assert.equal(maiorEspera([itens[0]], agora), '—')
})

test('RF1: acima do alvo só para quem espera o médico, pela cor', () => {
  const amarelo = { etapa: 'atendimento', chegada_em: antes(90), classificado_em: antes(61), atendimento_iniciado_em: null, cor_atual: 'amarelo' as const }
  assert.equal(acimaDoAlvo(amarelo, agora), true)
  assert.equal(acimaDoAlvo({ ...amarelo, classificado_em: antes(59) }, agora), false)
  assert.equal(acimaDoAlvo({ ...amarelo, atendimento_iniciado_em: antes(1) }, agora), false)
  assert.equal(acimaDoAlvo(amarelo, agora, true), false)
})

test('RF1: a hora da ficha leva a data quando não é de hoje', () => {
  assert.equal(horaDaFicha('2026-11-24T11:49:00-03:00', '2026-11-24'), 'Ficha às 11:49')
  assert.equal(horaDaFicha('2026-10-21T11:49:00-03:00', '2026-11-24'), 'Ficha em 21/10 às 11:49')
  // 23h30 em Brasília ainda é o dia de Brasília, mesmo já sendo o dia seguinte em UTC
  assert.equal(horaDaFicha('2026-11-24T02:30:00Z', '2026-11-23'), 'Ficha às 23:30')
})

test('RE1: etapa de cada ficha de hoje', () => {
  const f = (etapa: string, iniciado: string | null = null, desfecho: string | null = null) => ({ etapa, atendimento_iniciado_em: iniciado, desfecho })
  assert.equal(rotuloEtapa(f('triagem')).rotulo, 'Aguardando triagem')
  assert.equal(rotuloEtapa(f('triagem'), true).rotulo, 'Aguardando a escuta')
  assert.equal(rotuloEtapa(f('atendimento')).rotulo, 'Aguardando médico')
  assert.equal(rotuloEtapa(f('atendimento', antes(5))).rotulo, 'Em atendimento')
  assert.equal(rotuloEtapa(f('observacao')).rotulo, 'Em observação')
  assert.equal(rotuloEtapa(f('encerrado', antes(5), 'alta')).rotulo, 'Alta')
  assert.equal(rotuloEtapa(f('encerrado', null, 'cancelado')).rotulo, 'Saiu da fila')
  assert.equal(rotuloEtapa(f('encerrado')).rotulo, 'Encerrada')
  assert.equal(rotuloEtapa(f('encerrado')).tom, 'saida')
  assert.equal(rotuloEtapa(f('encerrado', null, 'alta_a_pedido')).tom, 'alta')
  assert.equal(inicioDoDia('2026-11-24'), '2026-11-24T00:00:00-03:00')
})

test('RE3: o que falta no cadastro numa linha', () => {
  const completo = { cpf_final: '***.123', cns_final: '***4567', nome_mae: 'Mãe', data_nascimento: '1990-01-01' }
  assert.equal(faltaNoCadastro(completo), '')
  assert.equal(faltaNoCadastro({ ...completo, cpf_final: null, cns_final: null }), 'Falta CPF e CNS')
  assert.equal(faltaNoCadastro({ cpf_final: null, cns_final: null, nome_mae: ' ', data_nascimento: null }), 'Falta CPF, CNS, nascimento e mãe')
  assert.equal(porExtenso(['CPF']), 'CPF')
})

test('CA2: responsável aparece para menor de 18 anos, marcado ou já preenchido', () => {
  const hoje = '2026-11-24'
  assert.equal(menorDeIdade('2008-11-25', hoje), true) // faz 18 amanhã
  assert.equal(menorDeIdade('2008-11-24', hoje), false) // fez 18 hoje
  assert.equal(menorDeIdade('', hoje), false)
  assert.equal(mostraResponsavel('2015-01-01', hoje, false, {}), true)
  assert.equal(mostraResponsavel('1980-01-01', hoje, false, {}), false)
  assert.equal(mostraResponsavel('1980-01-01', hoje, true, {}), true)
  assert.equal(mostraResponsavel(null, hoje, false, { responsavel_nome: 'Fulano' }), true)
  assert.equal(mostraResponsavel(null, hoje, false, { responsavel_nome: '  ' }), false)
})

test('RE2: menu da recepção em grupos, Entrada, Filas e Equipe', async () => {
  const { agruparNavegacao, inicioDoPapel, itensDeNavegacao } = await import('../components/casca/navegacao.ts')
  const blocos = (tipo: 'upa' | 'ubs') => agruparNavegacao(itensDeNavegacao('recepcao', false, false, tipo))
    .map((b) => `${b.grupo ?? '-'}: ${b.itens.map((i) => i.rotulo).join(', ')}`)
  assert.deepEqual(blocos('upa'), [
    'Entrada: Nova ficha, Cadastros duplicados',
    'Filas: Fila da triagem, Fila médica, Painel de chamada',
    'Equipe: Escala',
  ])
  assert.deepEqual(blocos('ubs'), [
    '-: Hoje',
    'Entrada: Nova ficha, Cadastros duplicados, Agenda de consultas',
    'Filas: Fila da enfermagem, Fila médica',
    'Equipe: Escala',
  ])
  assert.equal(inicioDoPapel('recepcao', 'upa'), '/recepcao')
  assert.equal(inicioDoPapel('recepcao', 'ubs'), '/recepcao/hoje')
})
