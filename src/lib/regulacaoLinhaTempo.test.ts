// node --experimental-strip-types --test src/lib/regulacaoLinhaTempo.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  ESPERANDO_DECISAO, esperandoDecisao, montarLinhaDoTempo, rotuloEvento, temposComAtual, textoDoEvento, textoTempos,
} from './regulacaoLinhaTempo.ts'
import { avisoPeriodoVazio, dataCurta, diasDoPeriodo, secoesComDados, type Indicadores } from './indicadoresRegulacao.ts'

test('RD2: os eventos saem com nome legível, sem código cru', () => {
  assert.equal(rotuloEvento('devolvida_a_fila'), 'devolvida à fila')
  assert.equal(rotuloEvento('anexo_incluido'), 'anexo incluído')
  assert.equal(rotuloEvento('pendencia_respondida'), 'pergunta respondida')
  // evento novo, sem rótulo: sai sem nenhum sublinhado
  assert.equal(rotuloEvento('algo_novo_aqui'), 'algo novo aqui')
})

test('RD2: o texto útil do evento vem dos detalhes', () => {
  assert.equal(textoDoEvento({ evento: 'anexo_incluido', detalhes: { nome: 'raio-x.pdf' } }), 'raio-x.pdf')
  assert.equal(textoDoEvento({ evento: 'pendencia', detalhes: { pergunta: ' Tem troponina? ' } }), 'Tem troponina?')
  // na negação o motivo é código; fica o texto do regulador
  assert.equal(textoDoEvento({ evento: 'negada', detalhes: { motivo: 'sem_vaga', texto: 'Sem leito na rede' } }), 'Sem leito na rede')
  assert.equal(textoDoEvento({ evento: 'assumida', detalhes: null }), null)
})

test('RD2: uma linha do tempo só, da mais recente para a mais antiga', () => {
  const itens = montarLinhaDoTempo({
    eventos: [
      { evento: 'enviada', por: 'A', em: '2026-10-11T10:00:00Z', detalhes: null },
      { evento: 'anexo_incluido', por: 'A', em: '2026-10-11T10:01:00Z', detalhes: { nome: 'ecg.pdf' } },
      { evento: 'anexo_aberto', por: 'B', em: '2026-10-11T11:00:00Z', detalhes: { nome: 'ecg.pdf' } },
      { evento: 'evolucao_atualizada', por: 'A', em: '2026-10-12T08:00:00Z', detalhes: null },
      { evento: 'devolvida_a_fila', por: 'B', em: '2026-10-12T09:00:00Z', detalhes: null },
    ],
    evolucoes: [{ texto: 'Estável', sinais_vitais: 'PA 120x80', em: '2026-10-12T08:00:00Z', autor: 'A' }],
  })
  // anexo aberto é registro de acesso; a evolução entra uma vez, com o texto
  assert.deepEqual(itens.map((i) => i.titulo), ['devolvida à fila', 'evolução atualizada', 'anexo incluído', 'enviada à central'])
  assert.deepEqual(itens.map((i) => i.tipo), ['situacao', 'evolucao', 'anexo', 'situacao'])
  assert.equal(itens[1].texto, 'Estável\nSinais vitais: PA 120x80')
  assert.ok(itens.every((i) => !i.titulo.includes('_')))
})

test('RD2: com a conversa, a mensagem entra com o texto e o evento repetido sai', () => {
  const itens = montarLinhaDoTempo({
    eventos: [{ evento: 'mensagem', por: 'B', em: '2026-10-12T09:00:00Z', detalhes: null }],
    mensagens: [{ id: '1', lado: 'central', texto: 'Mande o ECG', em: '2026-10-12T09:00:00Z', autor: 'B' }],
  })
  assert.equal(itens.length, 1)
  assert.equal(itens[0].titulo, 'mensagem do regulador')
  assert.equal(itens[0].texto, 'Mande o ECG')
  // sem a conversa (rota antiga), o evento fica
  assert.equal(montarLinhaDoTempo({ eventos: [{ evento: 'mensagem', por: 'B', em: '2026-10-12T09:00:00Z', detalhes: null }] })[0].titulo, 'mensagem na conversa')
})

test('RD2: uma situação atual só, a do pedido', () => {
  const tempos = [
    { status: 'enviada' as const, segundos: 44 * 86_400 + 3 * 3600, vezes: 2, atual: true },
    { status: 'em_analise' as const, segundos: 10, vezes: 1, atual: true },
  ]
  const marcados = temposComAtual(tempos, 'em_analise')
  assert.deepEqual(marcados.map((t) => t.atual), [false, true])
  assert.equal(textoTempos(tempos, 'em_analise'), 'Enviada 44 d 3 h (2×) · Em análise menos de 1 min, atual')
  // pedido encerrado: nenhuma situação antiga fica como atual
  assert.deepEqual(temposComAtual(tempos, 'cancelada').map((t) => t.atual), [false, false])
})

test('MR2: esperando decisão são os mesmos do painel de prazos', () => {
  assert.deepEqual([...ESPERANDO_DECISAO], ['enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino'])
  assert.ok(esperandoDecisao('pendencia'))
  assert.ok(!esperandoDecisao('autorizada'))
  assert.ok(!esperandoDecisao('cancelada'))
})

const vazio: Indicadores = {
  periodo: { de: '2026-10-26', ate: '2026-11-24' }, escopo: 'unidades', total: 0,
  tempos: {
    decisao: { geral: { n: 0, mediana: null, p90: null }, por_prioridade: [], por_tipo: [] },
    aceite: { geral: null, por_prioridade: [], por_tipo: [] },
    chegada: { geral: null, por_prioridade: [], por_tipo: [] },
  },
  fila_atual: { por_tipo: { leito: 1 }, por_prioridade: { urgencia: 1 } },
  volume: { por_dia: [], por_tipo: {}, por_origem: [], por_destino: [] },
  desfechos: { autorizadas: 0, negadas: 0, devolvidas: 0, canceladas: 0, realizadas: 0, faltas: 0, negacao_por_motivo: {}, respostas_destino: 0, recusas_destino: 0, recusa_por_motivo: {} },
  prazos: { fila: { n: 0, no_prazo: 0 }, pendencia: { n: 0, no_prazo: 0 }, evolucao: { n: 0, no_prazo: 0 }, destino: { n: 0, no_prazo: 0 } },
  gargalos: { por_origem: [], por_destino: [], por_tipo_leito: [] },
}

test('RD3: sem pedido no período, as seções vazias somem e a fila de agora fica', () => {
  assert.deepEqual(secoesComDados(vazio), { tempos: false, fila: true, desfechos: false, prazos: false, gargalos: false, volume: false })
  const cheio = { ...vazio, total: 3, prazos: { ...vazio.prazos, fila: { n: 2, no_prazo: 1 } }, volume: { ...vazio.volume, por_dia: [{ dia: '2026-11-01', n: 3 }] } }
  assert.deepEqual(secoesComDados(cheio), { tempos: false, fila: true, desfechos: true, prazos: true, gargalos: false, volume: true })
})

test('RD3: o aviso diz o período e quando foi o último pedido', () => {
  assert.equal(avisoPeriodoVazio('2026-10-26', '2026-11-24', '2026-10-11'), 'Nenhum pedido entre 26/10 e 24/11; o último foi em 11/10.')
  assert.equal(avisoPeriodoVazio('2026-10-26', '2026-11-24', null), 'Nenhum pedido entre 26/10 e 24/11.')
  assert.equal(avisoPeriodoVazio('2026-10-26', '2026-11-24', '2026-10-11', true), 'Nenhum pedido com esses filtros entre 26/10 e 24/11.')
  assert.equal(dataCurta('2025-12-30', '2026'), '30/12/2025')
  assert.equal(diasDoPeriodo('2026-10-26', '2026-11-24'), 30)
})
