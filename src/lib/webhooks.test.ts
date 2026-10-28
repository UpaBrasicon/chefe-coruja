// node --experimental-strip-types --test src/lib/webhooks.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { enderecoValido, podeReenviar, respostaEntrega, resumo24h, rotuloEvento, situacaoDestino, type DestinoWebhook, type EntregaWebhook } from './webhooks.ts'

const destino = (o: Partial<DestinoWebhook> = {}): DestinoWebhook => ({
  id: 'd', nome: 'ERP', url: 'https://erp.exemplo.com.br/hook', eventos: ['internacao.alta'],
  chave: { id: 'c', nome: 'ERP', prefixo: 'cc_live_00000000', valida: true }, unidades: [],
  ligado: true, desligado_em: null, desligado_por: null, motivo_desligamento: null, desligado_automatico: false,
  falhando_desde: null, segredo_girado_em: null, criado_por: null, criado_em: '2026-10-27T10:00:00Z',
  entregas_24h: { entregue: 0, pendente: 0, falhou: 0 }, pode_editar: true, ...o,
})
const entrega = (o: Partial<EntregaWebhook> = {}): EntregaWebhook => ({
  id: 'e', evento_id: 'v', tipo: 'internacao.alta', ocorrido_em: '2026-10-27T10:00:00Z', unidade: 'UPA',
  situacao: 'pendente', tentativas: 0, proxima_em: '2026-10-27T10:00:00Z', ultima_em: null, ultimo_status: null,
  ultimo_erro: null, entregue_em: null, reenviada_em: null, ...o,
})

test('situação do destino', () => {
  assert.equal(situacaoDestino(destino()), 'ligado')
  assert.equal(situacaoDestino(destino({ falhando_desde: '2026-10-27T13:10:00Z' })), 'falhando')
  assert.equal(situacaoDestino(destino({ chave: { id: 'c', nome: 'ERP', prefixo: 'x', valida: false }, falhando_desde: 'x' })), 'sem_chave')
  assert.equal(situacaoDestino(destino({ ligado: false, falhando_desde: 'x' })), 'desligado')
})

test('resumo das últimas 24 h', () => {
  assert.deepEqual(resumo24h({ entregue: 1, pendente: 0, falhou: 0 }), [{ texto: '1 entregue' }])
  assert.deepEqual(resumo24h({ entregue: 38, pendente: 6, falhou: 2 }),
    [{ texto: '38 entregues' }, { texto: '6 na fila', tom: 'atencao' }, { texto: '2 falharam', tom: 'critico' }])
  assert.equal(resumo24h({ entregue: 0, pendente: 0, falhou: 1 })[1].texto, '1 falhou')
})

test('resposta da entrega', () => {
  assert.equal(respostaEntrega(entrega()), '')
  assert.equal(respostaEntrega(entrega({ tentativas: 3, ultimo_status: 503, ultimo_erro: 'HTTP 503: Service Unavailable' })), '3ª tentativa · 503 · Service Unavailable')
  assert.equal(respostaEntrega(entrega({ tentativas: 2, ultimo_status: 500, ultimo_erro: 'HTTP 500' })), '2ª tentativa · 500')
  assert.equal(respostaEntrega(entrega({ tentativas: 1, ultimo_erro: 'Tempo esgotado (10 s)' })), '1ª tentativa · Tempo esgotado (10 s)')
})

test('reenvio e rótulos', () => {
  assert.equal(podeReenviar(entrega({ situacao: 'falhou' }), true), true)
  assert.equal(podeReenviar(entrega({ situacao: 'pendente' }), true), false)
  assert.equal(podeReenviar(entrega({ situacao: 'entregue' }), false), false)
  assert.equal(rotuloEvento('internacao.alta'), 'Alta da internação')
  assert.equal(rotuloEvento('desconhecido'), 'desconhecido')
})

test('endereço (mesma regra do banco)', () => {
  assert.ok(enderecoValido(' https://erp.exemplo.com.br/hook?x=1 '))
  for (const u of ['http://erp.exemplo.com.br', 'https://localhost/x', 'https://10.0.0.1/x', 'https://intranet/x', 'https://erp.internal/x', 'nada']) {
    assert.equal(enderecoValido(u), false, u)
  }
})
