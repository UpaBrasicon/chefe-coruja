// node --experimental-strip-types --test src/lib/nirPainel.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  casaBusca, contagens, estadoDoLeito, etiquetaIsolamento, idsNavegaveis, indicadoresMapa, indicadoresPendencias, linhasDoMapa, listaNir, precisaAcaoNir,
  precisaCobrarMedico, resumoDoPlantao, rotuloEvolucao, rotuloIsolamento, sinalPrincipal, tempoDesde, textoParaWhatsApp, vizinho,
  type MapaLeitos, type PendenciaUnidade,
} from './nirPainel.ts'
import { montarLinhaDoTempo } from './regulacaoLinhaTempo.ts'
import type { PacienteRegulacao, PedidoResumo } from './regulacaoPaciente.ts'
import type { Sla } from './regulacao.ts'

const AGORA = Date.parse('2026-11-25T12:00:00Z')
const horasAtras = (h: number) => new Date(AGORA - h * 3_600_000).toISOString()

const sla = (evo: Partial<NonNullable<Sla['evolucao']>> = {}): Sla => ({
  fila: { prazo_min: null, central_seg: 0, correndo: false, atrasado: false }, pendencia: null,
  evolucao: { ultima_em: horasAtras(2), prazo_h: 12, vence_em: horasAtras(-10), atrasada: false, limite_h: 72, risco_cancelamento: false, ...evo },
  atrasado_central: false, atrasado_origem: false,
})

const pedido = (id: string, x: Partial<PedidoResumo> = {}): PedidoResumo => ({
  id, numero: Number(id.replace(/\D/g, '')) || 1, status: 'enviada', tipo: 'leito', carater: 'urgencia', prioridade: 'urgencia',
  prioridade_regulador: null, especialidade: null, procedimento: null, procedimento_nome: null, tipo_leito: 'uti_adulto',
  transporte: null, cid: 'I21.9', destino: null, criada_em: horasAtras(30), em_aberto: true,
  pendencia_pergunta: null, pendencia_em: null, motivo_devolucao: null, sla: sla(),
  conversa: { total: 0, novas: 0, aguardando: [] }, ...x,
})

const pac = (id: string, leito: string | null, pedidos: PedidoResumo[], setor = { id: 's1', nome: 'Observação' }, nome = `Paciente ${id}`): PacienteRegulacao => ({
  paciente: { id, nome, nascimento: '1970-01-01' }, internacao: { id: `i-${id}`, tipo: 'urgencia', admissao: horasAtras(40), episodio_id: null },
  setor, leito, pedidos,
})

const pend = (id: string, solicitacao: string, x: Partial<PendenciaUnidade> = {}): PendenciaUnidade => ({
  id, solicitacao_id: solicitacao, numero: 7, pedido_status: 'enviada',
  paciente: { id: 'pX', nome: 'Paciente com nome', nascimento: null }, setor: { id: 's1', nome: 'Observação' }, leito: 'OBS-01',
  dono: 'medico', motivo: 'evolucao', titulo: 'Atualizar a evolução', urgencia: 'normal', status: 'medico_avisado',
  responsaveis: [{ id: 'm1', nome: 'Dra. Plantão' }], criada_em: horasAtras(3), criada_por: 'NIR', avisado_em: horasAtras(3), avisos: 1,
  resolvida_em: null, resolvida_por: null, resolucao: null, ...x,
})

test('NIR1: filtros Ação NIR, Cobrar médico, Vaga / remoção e Sem regulação', () => {
  const espera = pac('a', 'OBS-01', [pedido('r1', { status: 'pendencia', pendencia_pergunta: 'Tem troponina?' })])
  const vencida = pac('b', 'OBS-02', [pedido('r2', { sla: sla({ atrasada: true, ultima_em: horasAtras(30) }) })])
  const vaga = pac('c', 'OBS-03', [pedido('r3', { status: 'autorizada', destino: 'Hospital X', transporte: 'ambulancia_avancada',
    sla: sla({ atrasada: true }) })])
  const sem = pac('d', 'OBS-04', [])
  const comPendNir = pac('e', 'OBS-05', [pedido('r5')])
  const pends = [pend('p1', 'r5', { dono: 'nir', titulo: 'Anexar ECG', status: 'pendente' }), pend('p2', 'r2', { status: 'resolvida' })]
  const lista = [espera, vencida, vaga, sem, comPendNir]
  assert.deepEqual(contagens(lista, pends), { todos: 5, acao_nir: 2, cobrar_medico: 1, vaga_remocao: 1, sem_regulacao: 1 })
  assert.equal(precisaAcaoNir(comPendNir, pends), true)
  // vaga autorizada não entra em "cobrar médico" mesmo com evolução vencida
  assert.equal(precisaCobrarMedico(vaga, pends), false)
  assert.equal(precisaCobrarMedico(comPendNir, [pend('p3', 'r5')]), true)
})

test('NIR1: lista com regulação primeiro, busca, setor e J/K', () => {
  const a = pac('a', 'OBS-01', [], { id: 's1', nome: 'Observação' }, 'Ana Souza')
  const b = pac('b', 'EST-01', [pedido('r12', { sla: sla({ atrasada: true, risco_cancelamento: true }) })], { id: 's2', nome: 'Estabilização' })
  const c = pac('c', 'OBS-02', [pedido('r13')])
  const g = listaNir([a, b, c], [], { busca: '', setor: '', filtro: 'todos' })
  assert.deepEqual(g.comRegulacao.map((l) => l.paciente.id), ['b', 'c'])
  assert.deepEqual(g.semRegulacao.map((l) => l.paciente.id), ['a'])
  assert.deepEqual(idsNavegaveis(g, false), ['b', 'c'])
  assert.deepEqual(idsNavegaveis(g, true), ['b', 'c', 'a'])
  assert.equal(vizinho(['b', 'c', 'a'], 'b', 1), 'c')
  assert.equal(vizinho(['b', 'c', 'a'], 'b', -1), 'b')
  assert.equal(vizinho(['b', 'c', 'a'], null, 1), 'b')
  assert.equal(vizinho([], null, 1), null)
  assert.deepEqual(listaNir([a, b, c], [], { busca: '', setor: 's2', filtro: 'todos' }).comRegulacao.map((l) => l.paciente.id), ['b'])
  assert.equal(casaBusca(a, 'ana souza'), true)
  assert.equal(casaBusca(b, 'nº 12'), true)
  assert.equal(casaBusca(b, 'I21'), true)
  assert.equal(casaBusca(c, 'estabilizacao'), false)
  assert.equal(casaBusca(a, 'dra. plantão', ['Dra. Plantão']), true)
  // "n" de um nome não vira o prefixo do número
  assert.equal(casaBusca(pac('n', 'X', [], undefined, 'Nara'), 'nara'), true)
})

test('NIR1: sinal principal da linha', () => {
  assert.deepEqual(sinalPrincipal(pac('a', 'A', []), [], AGORA), { texto: 'Sem regulação', tom: 'neutro' })
  assert.deepEqual(sinalPrincipal(pac('b', 'B', [pedido('r1', { status: 'autorizada', destino: 'Hospital X', transporte: 'ambulancia_avancada' })]), [], AGORA),
    { texto: 'Hospital X · Ambulância avançada — USA / UTI móvel (D)', tom: 'sucesso' })
  assert.deepEqual(sinalPrincipal(pac('b', 'B', [pedido('r1', { status: 'autorizada', destino: 'Hospital X' })]), [], AGORA).texto,
    'Hospital X · transporte a acionar')
  assert.deepEqual(sinalPrincipal(pac('c', 'C', [pedido('r1', { status: 'pendencia', pendencia_pergunta: 'Tem troponina?' })]), [], AGORA),
    { texto: 'Pergunta da central: Tem troponina?', tom: 'info' })
  assert.deepEqual(sinalPrincipal(pac('d', 'D', [pedido('r1', { sla: sla({ atrasada: true, risco_cancelamento: true, ultima_em: horasAtras(73) }) })]), [], AGORA),
    { texto: '3 d 1 h sem evolução · risco de cancelamento', tom: 'critico' })
  assert.deepEqual(sinalPrincipal(pac('e', 'E', [pedido('r1', { sla: sla({ atrasada: true, ultima_em: horasAtras(26) }) })]), [], AGORA),
    { texto: '26 h sem evolução (vencida)', tom: 'atencao' })
  assert.deepEqual(sinalPrincipal(pac('f', 'F', [pedido('r1')]), [], AGORA), { texto: 'Em regulação', tom: 'neutro' })
})

test('LGPD: os textos copiados não levam o nome do paciente', () => {
  const t = textoParaWhatsApp({ leito: 'OBS-01', numero: 7, setor: 'Observação', pendencia: 'Atualizar a evolução.', medico: 'Dra. Plantão' })
  assert.equal(t, '[NIR] Leito OBS-01 (Observação) · Regulação nº 7 — Para: Dra. Plantão — Atualizar a evolução.')
  assert.equal(textoParaWhatsApp({ leito: null, numero: null, setor: null, pendencia: 'Ver exame' }), '[NIR] Sem leito — Ver exame.')
  const r = resumoDoPlantao([pend('p1', 'r1'), pend('p2', 'r2', { status: 'resolvida' }), pend('p3', 'r3', { dono: 'nir' })], '25/11/2026, 09:00')
  assert.equal(r, 'NIR — pendências com médicos (25/11/2026, 09:00)\n• OBS-01 (Observação) | Reg. nº 7 | Dra. Plantão: Atualizar a evolução [Médico avisado]')
  assert.ok(!r.includes('Paciente com nome'))
  assert.equal(resumoDoPlantao([], 'x'), '')
})

test('NIR3: indicadores das pendências com médicos', () => {
  const lista = [pac('a', 'A', [pedido('r1', { sla: sla({ risco_cancelamento: true, atrasada: true }) })]), pac('b', 'B', [pedido('r2')])]
  const ps = [
    pend('p1', 'r1'), pend('p2', 'r2', { status: 'pendente' }),
    pend('p3', 'r2', { status: 'resolvida', resolvida_em: horasAtras(2) }),
    pend('p4', 'r2', { status: 'resolvida', resolvida_em: horasAtras(20) }),
    pend('p5', 'r2', { dono: 'nir', status: 'pendente' }),
  ]
  // NI4: a janela das resolvidas é a do filtro (24 h): a de 20 h conta
  assert.deepEqual(indicadoresPendencias(ps, lista, AGORA), { abertas: 2, avisados: 1, risco72h: 1, resolvidas: 2 })
  assert.equal(indicadoresPendencias([pend('p6', 'r2', { status: 'resolvida', resolvida_em: horasAtras(25) })], lista, AGORA).resolvidas, 0)
})

test('NI4: tempo no mesmo formato da tela', () => {
  const antes = (min: number) => new Date(AGORA - min * 60_000).toISOString()
  assert.equal(tempoDesde(antes(0), AGORA), 'menos de 1 min')
  assert.equal(tempoDesde(antes(42), AGORA), '42 min')
  assert.equal(tempoDesde(antes(4 * 60 + 42), AGORA), '4 h 42 min')
  assert.equal(tempoDesde(antes(5 * 60), AGORA), '5 h')
  assert.equal(tempoDesde(antes(51 * 60), AGORA), '2 d 3 h')
})

test('NIR4: mapa de leitos com o paciente da regulação e os indicadores', () => {
  const mapa: MapaLeitos = {
    setores: [{ id: 's1', nome: 'Observação', medicos: [{ id: 'm1', nome: 'Dra. Plantão' }], leitos: [
      { id: 'l1', identificador: 'OBS-01', tipo: 'observacao', status: 'ocupado', paciente_id: 'a' },
      { id: 'l2', identificador: 'OBS-02', tipo: 'observacao', status: 'ocupado', paciente_id: 'b' },
      { id: 'l3', identificador: 'OBS-03', tipo: 'observacao', status: 'livre', paciente_id: null },
      { id: 'l4', identificador: 'OBS-04', tipo: 'observacao', status: 'higienizacao', paciente_id: null },
    ] }],
    internados: [],
  }
  const lista = [pac('a', 'OBS-01', [pedido('r1', { status: 'autorizada', destino: 'H' })]), pac('b', 'OBS-02', [])]
  const linhas = linhasDoMapa(mapa, lista)
  assert.equal(linhas[0].paciente?.paciente.id, 'a')
  assert.equal(linhas[2].paciente, null)
  assert.deepEqual(indicadoresMapa(linhas), { total: 4, ocupados: 2, livres: 1, ocupacao: 50, emRegulacao: 1, semRegulacao: 1, comVaga: 1, semLeito: 0 })
  assert.deepEqual([estadoDoLeito(linhas[0]), estadoDoLeito(linhas[2]), estadoDoLeito(linhas[3])], ['Ocupado', 'Livre', 'Higienização'])
  // NI5: os internados sem leito entram nas contas de pacientes, como no painel
  const comSemLeito = [...lista, pac('c', null, []), pac('d', null, [pedido('r4')])]
  assert.deepEqual(indicadoresMapa(linhas, comSemLeito),
    { total: 4, ocupados: 2, livres: 1, ocupacao: 50, emRegulacao: 2, semRegulacao: 2, comVaga: 1, semLeito: 2 })
  assert.equal(contagens(comSemLeito, []).sem_regulacao, 2, 'o painel conta os mesmos')
})

test('linha do tempo: pendência da unidade e a evolução atualizada pelo NIR', () => {
  const itens = montarLinhaDoTempo({
    eventos: [{ evento: 'pendencia_unidade', por: 'NIR A', em: '2026-11-25T10:00:00Z', detalhes: { titulo: 'Atualizar a evolução' } },
      { evento: 'pendencia_unidade_resolvida', por: 'NIR A', em: '2026-11-25T11:00:00Z', detalhes: { titulo: 'Atualizar a evolução', nota: 'Evolução do pedido atualizada' } }],
    evolucoes: [{ texto: 'Estável, aguardando vaga.', sinais_vitais: null, em: '2026-11-25T10:30:00Z', autor: 'NIR A', papel: 'nir' }],
  })
  assert.deepEqual(itens.map((i) => i.titulo), ['pendência da unidade resolvida', 'evolução atualizada pelo NIR', 'pendência da unidade registrada'])
  assert.equal(itens[0].texto, 'Atualizar a evolução · Evolução do pedido atualizada')
})

test('rótulos: isolamento e a evolução do pedido com o papel', () => {
  assert.equal(rotuloIsolamento(['aerossol', 'goticula', 'contato']), 'Isolamento: aerossol, gotícula e contato')
  assert.equal(rotuloIsolamento([]), null)
  assert.equal(etiquetaIsolamento(['aerossol', 'goticula']), 'Isolamento: aerossol + gotícula')
  assert.equal(etiquetaIsolamento(null), null)
  assert.equal(rotuloEvolucao(3, 'nir', 'Fulana'), 'Evolução (versão 3) — atualizada pelo NIR, Fulana')
  assert.equal(rotuloEvolucao(1, 'medico', 'Dr. A'), 'Evolução (versão 1) — atualizada pelo médico, Dr. A')
  assert.equal(rotuloEvolucao(2, null, 'Dr. B'), 'Evolução (versão 2) — Dr. B')
})
