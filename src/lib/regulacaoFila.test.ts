// node --experimental-strip-types --test src/lib/regulacaoFila.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { FORMULARIO_VAZIO, isolamentoParaDefinir, type Sla } from './regulacao.ts'
import {
  agrupar, comExtras, compatibilidade, contarAtalhos, demandaIsolamento, distanciaKm, distribuicaoPrioridade, esperaPorLeito,
  filtrarLocal, horasSemEvolucao, idsVisiveis, matchVagas, mensagemCobrarEvolucao, nivelEvolucao, ordenar, porMunicipio,
  saldoDoTipo, vizinho, ATALHOS_ORIGEM, seloIsolamento, type PedidoFila, type UnidadeVagas,
} from './regulacaoFila.ts'

const AGORA = Date.parse('2026-11-25T12:00:00Z')
const sla = (horas: number, prazo = 12, limite = 72): Sla => ({
  fila: { prazo_min: null, central_seg: 0, correndo: true, atrasado: false }, pendencia: null,
  evolucao: { ultima_em: new Date(AGORA - horas * 3_600_000).toISOString(), prazo_h: prazo, vence_em: '', atrasada: horas > prazo,
    limite_h: limite, risco_cancelamento: horas >= limite },
  atrasado_central: false, atrasado_origem: horas > prazo,
})
let n = 0
const p = (o: Partial<PedidoFila> = {}): PedidoFila => ({
  id: `id${++n}`, numero: n, status: 'enviada', prioridade: 'urgencia', prioridade_regulador: null, tipo_leito: 'uti_adulto',
  isolamento: false, isolamento_tipo: null, vulnerabilidades: [], espera_segundos: 3600, sla: sla(1),
  origem: { id: 'o1', nome: 'UPA A' }, paciente: { nome: 'Paciente' }, municipio: 'Cidade A', ...o,
})

test('evolução: horas e nível pelos prazos que vêm da central', () => {
  assert.equal(horasSemEvolucao(sla(30), AGORA), 30)
  assert.equal(nivelEvolucao(sla(5)), 'em_dia')
  assert.equal(nivelEvolucao(sla(13)), 'vencida')
  assert.equal(nivelEvolucao(sla(80)), 'risco')
  // prazo ajustado pela central: 24 h
  assert.equal(nivelEvolucao(sla(20, 24)), 'em_dia')
  assert.equal(horasSemEvolucao(null, AGORA), null)
})

test('cobrar na conversa: mensagem pronta com horas e o prazo da central', () => {
  const m = mensagemCobrarEvolucao({ numero: 42, sla: sla(30) }, AGORA)
  assert.match(m, /Pedido nº 42/)
  assert.match(m, /30 h sem evolução; 12 h, prazo da central/)
  assert.match(mensagemCobrarEvolucao({ numero: 1, sla: sla(80) }, AGORA), /72 h, prazo de cancelamento/)
})

test('atalhos com contagem e filtros locais', () => {
  const itens = [
    p({ isolamento: true, isolamento_tipo: 'aerossol', agente: 'TB bacilífera' }),
    p({ sla: sla(30), vulnerabilidades: ['judicializado'] }),
    p({ sla: sla(80), vulnerabilidades: ['idoso'], municipio: 'Cidade B' }),
  ]
  assert.deepEqual(contarAtalhos(itens), { isolamento: 1, evolucao_vencida: 2, risco: 1, judicial: 1, vulnerabilidade: 1 })
  assert.equal(filtrarLocal(itens, { atalhos: ['evolucao_vencida'] }).length, 2)
  assert.equal(filtrarLocal(itens, { atalhos: ['evolucao_vencida', 'judicial'] }).length, 1)
  assert.equal(filtrarLocal(itens, { isolamento: 'qualquer' }).length, 1)
  assert.equal(filtrarLocal(itens, { isolamento: 'nenhum' }).length, 2)
  assert.equal(filtrarLocal(itens, { isolamento: 'contato' }).length, 0)
  assert.equal(filtrarLocal(itens, { municipio: 'Cidade B' }).length, 1)
  // busca sem acento acha o agente
  assert.equal(filtrarLocal(itens, { busca: 'bacilifera' }).length, 1)
  assert.equal(filtrarLocal(itens, { busca: String(itens[2].numero) }).length >= 1, true)
})

test('ordenar: gravidade + tempo, maior tempo e evolução mais antiga', () => {
  const a = p({ prioridade: 'eletiva', espera_segundos: 9000, sla: sla(2) })
  const b = p({ prioridade: 'emergencia', espera_segundos: 100, sla: sla(10) })
  const c = p({ prioridade: 'emergencia', espera_segundos: 500, sla: sla(40) })
  const d = p({ prioridade: 'nao_classificada', espera_segundos: 10, sla: null })
  assert.deepEqual(ordenar([a, b, c, d], 'gravidade').map((x) => x.id), [d.id, c.id, b.id, a.id])
  assert.deepEqual(ordenar([a, b, c, d], 'maior_tempo').map((x) => x.id), [a.id, c.id, b.id, d.id])
  assert.deepEqual(ordenar([a, b, c, d], 'evolucao_antiga').map((x) => x.id), [c.id, b.id, a.id, d.id])
  // a prioridade do regulador vale
  const e = p({ prioridade: 'eletiva', prioridade_regulador: 'emergencia', espera_segundos: 1 })
  assert.equal(ordenar([a, e], 'gravidade')[0].id, e.id)
})

test('agrupar e navegar com J/K pulando grupos recolhidos', () => {
  const itens = [p({ prioridade: 'eletiva' }), p({ prioridade: 'emergencia' }), p({ prioridade: 'emergencia' })]
  const g = agrupar(itens, 'prioridade')
  assert.deepEqual(g.map((x) => x.chave), ['emergencia', 'eletiva'])
  const ids = idsVisiveis(g, new Set(['emergencia']))
  assert.deepEqual(ids, [itens[0].id])
  assert.equal(vizinho([ 'a', 'b', 'c' ], 'b', 1), 'c')
  assert.equal(vizinho([ 'a', 'b', 'c' ], 'c', 1), 'c')
  assert.equal(vizinho([ 'a', 'b', 'c' ], null, -1), 'c')
  assert.equal(agrupar(itens, 'nenhum').length, 1)
  const m = agrupar([p({ municipio: null }), p({ municipio: 'Beta' }), p({ municipio: 'Alfa' })], 'municipio')
  assert.deepEqual(m.map((x) => x.rotulo), ['Alfa', 'Beta', 'Município não informado'])
})

const un = (id: string, livre: number, iso: number, pn: number, extra: Partial<UnidadeVagas> = {}): UnidadeVagas => ({
  id, nome: `Hosp ${id}`, cnes: null, municipio: null, uf: null, latitude: null, longitude: null,
  leitos: [{ tipo_leito: 'uti_adulto', livre, livre_isolamento: iso, livre_pressao_negativa: pn }], ...extra,
})

test('RG3: saldo e compatibilidade (aerossol e combinado exigem pressão negativa)', () => {
  const s = saldoDoTipo(un('h', 5, 1, 1), 'uti_adulto')
  assert.deepEqual(s, { geral: 3, isolamento: 1, pressao_negativa: 1 })
  assert.equal(compatibilidade('aerossol', { geral: 3, isolamento: 2, pressao_negativa: 0 }).compativel, false)
  assert.equal(compatibilidade('contato_aerossol', { geral: 0, isolamento: 0, pressao_negativa: 1 }).compativel, true)
  assert.equal(compatibilidade('contato', { geral: 3, isolamento: 0, pressao_negativa: 1 }).vagas, 1)
  assert.equal(compatibilidade('reverso', { geral: 3, isolamento: 0, pressao_negativa: 0 }).compativel, false)
  assert.equal(compatibilidade(null, { geral: 1, isolamento: 1, pressao_negativa: 1 }).vagas, 3)
})

test('RG3: match fora a origem, compatíveis primeiro; distância só com coordenadas, senão saldo', () => {
  const lista = [un('o1', 9, 9, 9), un('a', 2, 0, 0), un('b', 5, 1, 0), un('c', 1, 0, 1)]
  const m = matchVagas({ tipo_leito: 'uti_adulto', isolamento_tipo: 'contato', origem_id: 'o1' }, lista)
  assert.deepEqual(m.map((l) => l.unidade.id), ['b', 'c', 'a'])
  assert.equal(m[2].compativel, false)
  // com coordenadas em todas as compatíveis, por distância
  const perto = un('d', 1, 1, 0, { latitude: -16.0, longitude: -49.0 })
  const longe = un('e', 9, 9, 0, { latitude: -10.0, longitude: -49.0 })
  const m2 = matchVagas({ tipo_leito: 'uti_adulto', isolamento_tipo: 'contato', origem_id: 'x', origem: { latitude: -16.1, longitude: -49.0 } }, [longe, perto])
  assert.deepEqual(m2.map((l) => l.unidade.id), ['d', 'e'])
  assert.ok(Math.abs(distanciaKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })! - 111.2) < 0.5)
  assert.equal(distanciaKm({ latitude: null, longitude: 0 }, { latitude: 1, longitude: 0 }), null)
})

test('RG6 e indicadores: por município, isolamento × oferta, prioridade e espera por leito', () => {
  const itens = [
    p({ prioridade: 'emergencia', isolamento: true, isolamento_tipo: 'aerossol', municipio: 'A', espera_segundos: 7200 }),
    p({ prioridade: 'urgencia', sla: sla(80), municipio: 'A', origem: { id: 'o2', nome: 'UPA B' }, espera_segundos: 3600 }),
    p({ prioridade: 'eletiva', municipio: 'B', tipo_leito: 'clinico' }),
  ]
  const m = porMunicipio(itens)
  assert.deepEqual(m[0], { municipio: 'A', unidades: ['UPA A', 'UPA B'], total: 2, p1: 1, p2: 1, isolamento: 1, risco: 1 })
  const d = demandaIsolamento(itens, [un('h', 4, 1, 1)])
  assert.deepEqual(d, [{ tipo: 'aerossol', rotulo: 'Aerossol', aguardando: 1, oferta: 1 }])
  const dp = distribuicaoPrioridade(itens)
  assert.deepEqual(dp.map((l) => [l.prioridade, l.casos, l.risco]), [['emergencia', 1, 0], ['urgencia', 1, 1], ['eletiva', 1, 0]])
  const el = esperaPorLeito(itens, [un('h', 4, 1, 1)])
  assert.equal(el[0].tipo_leito, 'uti_adulto')
  assert.equal(el[0].espera_media_seg, 5400)
  assert.deepEqual(el[0].livres, { geral: 2, isolamento: 1, pressao_negativa: 1 })
})

test('extras: município, agente e situação entram no pedido', () => {
  const [x] = comExtras([p({ municipio: undefined })], [{ id: `id${n}`, isolamento_situacao: 'confirmado', isolamento_agente: 'KPC',
    origem_municipio: 'C', origem_uf: 'GO', origem_latitude: null, origem_longitude: null, evolucoes: 2 }])
  assert.equal(x.municipio, 'C'); assert.equal(x.agente, 'KPC'); assert.equal(x.situacao, 'confirmado')
})

test('RG2: situação e agente só vão quando há isolamento e algo preenchido', () => {
  assert.equal(isolamentoParaDefinir(FORMULARIO_VAZIO), null)
  assert.equal(isolamentoParaDefinir({ ...FORMULARIO_VAZIO, isolamento: true, isolamento_tipo: 'contato' }), null)
  assert.deepEqual(isolamentoParaDefinir({ ...FORMULARIO_VAZIO, isolamento: true, isolamento_tipo: 'reverso', isolamento_situacao: 'confirmado', isolamento_agente: ' neutropenia ' }),
    { p_tipo: 'reverso', p_situacao: 'confirmado', p_agente: 'neutropenia' })
})

test('RO2 e RO3: atalhos da origem e selo do isolamento com a situação', () => {
  const itens = [p({ status: 'pendencia' }), p({ status: 'devolvida', sla: sla(30) }), p({})]
  assert.deepEqual(contarAtalhos(itens, ATALHOS_ORIGEM), { perguntou: 1, evolucao_vencida: 1, devolvido: 1, risco: 0 })
  assert.equal(filtrarLocal(itens, { atalhos: ['perguntou'] }).length, 1)
  assert.equal(seloIsolamento({ isolamento_tipo: 'goticula', situacao: 'suspeito' }), 'Gotícula · suspeito')
  assert.equal(seloIsolamento({ isolamento_tipo: 'goticula', situacao: null }), 'Gotícula')
})
