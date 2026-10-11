// node --experimental-strip-types --test supabase/functions/api/contrato.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { caminhoDaApi, chaveDoCabecalho, interpretar, ipDeOrigem, problema } from './contrato.ts'

const U = '21000000-0000-4000-8000-000000000001'
const q = (s: string) => new URLSearchParams(s)

test('caminho: tira /api e /v1', () => {
  assert.equal(caminhoDaApi('/api/v1/unidades'), '/unidades')
  assert.equal(caminhoDaApi('/functions/v1/api/v1/pacientes/abc'), '/pacientes/abc')
  assert.equal(caminhoDaApi('/api/unidades/'), '/unidades')
  assert.equal(caminhoDaApi('/api'), '/')
})

test('rotas do contrato', () => {
  assert.deepEqual(interpretar('/unidades', q('')), { recurso: 'unidades', params: {} })
  assert.deepEqual(interpretar('/pacientes', q(`unidade_id=${U}&cns=898001160012344`)),
    { recurso: 'paciente_busca', params: { unidade_id: U, cns: '898001160012344' } })
  assert.equal((interpretar(`/pacientes/${U}`, q('')) as { recurso: string }).recurso, 'paciente')
  assert.equal((interpretar('/producao/fechamentos', q(`unidade_id=${U}&instrumento=apac`)) as { recurso: string }).recurso, 'fechamentos')
  assert.deepEqual(interpretar('/financeiro', q('')), { erro: { status: 404, codigo: 'nao_encontrado', detalhe: 'Recurso inexistente.' } })
})

test('parâmetros conferidos antes do banco', () => {
  const e = (r: unknown) => (r as { erro?: { status: number; detalhe: string } }).erro
  assert.equal(e(interpretar('/leitos', q('')))?.detalhe, 'Informe unidade_id.')
  assert.equal(e(interpretar('/pacientes', q(`unidade_id=${U}`)))?.detalhe, 'Informe cns ou cpf (um dos dois).')
  assert.equal(e(interpretar('/pacientes', q(`unidade_id=${U}&cns=898001160012344&cpf=52998224725`)))?.detalhe, 'Informe cns ou cpf (um dos dois).')
  assert.equal(e(interpretar('/atendimentos', q(`unidade_id=${U}&desde=ontem&ate=hoje`)))?.status, 400)
  assert.equal(e(interpretar('/atendimentos', q(`unidade_id=${U}&desde=2026-10-01T00:00:00Z`)))?.detalhe, 'Informe desde e ate.')
  assert.equal(e(interpretar('/leitos', q(`unidade_id=${U}&limite=500`)))?.detalhe, 'limite vai de 1 a 100.')
  assert.equal(e(interpretar('/producao/aih', q(`unidade_id=${U}&competencia=202613`)))?.status, 400)
  assert.equal(e(interpretar('/pacientes/nao-uuid', q('')))?.status, 404)
  assert.deepEqual((interpretar('/leitos', q(`unidade_id=${U}&limite=20&status=livre`)) as { params: unknown }).params,
    { unidade_id: U, limite: 20, status: 'livre' })
})

test('chave no cabeçalho Bearer', () => {
  const k = 'cc_live_' + 'a'.repeat(48)
  assert.equal(chaveDoCabecalho(`Bearer ${k}`), k)
  assert.equal(chaveDoCabecalho(`Bearer cc_live_curta`), null)
  assert.equal(chaveDoCabecalho(null), null)
})

test('IP: o do Worker só com o segredo da borda', () => {
  const cab = (h: Record<string, string>) => (n: string) => h[n] ?? null
  assert.equal(ipDeOrigem(cab({ 'x-coruja-ip-cliente': '1.1.1.1', 'x-forwarded-for': '9.9.9.9, 8.8.8.8' }), 's'), '9.9.9.9')
  assert.equal(ipDeOrigem(cab({ 'x-coruja-ip-cliente': '1.1.1.1', 'x-coruja-borda': 'errado', 'x-forwarded-for': '9.9.9.9' }), 's'), '9.9.9.9')
  assert.equal(ipDeOrigem(cab({ 'x-coruja-ip-cliente': '1.1.1.1', 'x-coruja-borda': 's', 'x-forwarded-for': '9.9.9.9' }), 's'), '1.1.1.1')
  assert.equal(ipDeOrigem(cab({ 'x-coruja-ip-cliente': '1.1.1.1', 'x-coruja-borda': 's' }), undefined), null)
})

test('erro no formato RFC 9457', () => {
  assert.deepEqual(problema(403, 'fora_do_escopo', 'x', 'r1'), {
    type: 'https://api.chefecoruja.com.br/erros/fora-do-escopo', title: 'Fora do escopo da chave', status: 403, detail: 'x', codigo: 'fora_do_escopo', requisicao: 'r1',
  })
})
