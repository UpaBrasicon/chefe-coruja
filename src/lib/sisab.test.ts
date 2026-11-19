// Percurso da UBS, U15 (PR 5): regras da aba SISAB em Integrações.
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const PAINEL = {
  ubs: true, cnes: '9912345',
  config: { codigo_ibge: '3550308', ine: null, pec_url: 'https://pec.exemplo.gov.br', envio_ligado: false, atualizado_em: '2026-11-19T12:00:00Z' },
  contagem: { pendente: 0, retido: 0, erro: 0, enviado: 0 },
}

test('U15 PR 5: ligar o envio pede CNES, IBGE e o endereço do PEC', async () => {
  const { faltaParaLigar } = await import('./sisab.ts')
  assert.deepEqual(faltaParaLigar(PAINEL), [])
  assert.equal(faltaParaLigar({ ...PAINEL, cnes: null }).length, 1)
  assert.deepEqual(faltaParaLigar({ ...PAINEL, config: null }).length, 2)
})

test('U15 PR 5: a configuração confere IBGE (7), INE (10) e https', async () => {
  const { conferirConfig } = await import('./sisab.ts')
  assert.equal(conferirConfig('3550308', '', 'https://pec.x.gov.br'), null)
  assert.match(conferirConfig('355', '', '') ?? '', /IBGE/)
  assert.match(conferirConfig('', '12345', '') ?? '', /INE/)
  assert.match(conferirConfig('', '', 'http://pec.x') ?? '', /https/)
})

test('U15 PR 5: ação e motivo de cada ficha', async () => {
  const { acaoDaFicha, motivoDaFicha } = await import('./sisab.ts')
  const base = { id: 'i', tipo: 'fai' as const, uuid_ficha: 'u', tentativas: 1, criado_em: '', enviado_em: null, proxima_tentativa_em: null }
  assert.equal(acaoDaFicha({ ...base, status: 'erro', ultimo_erro: 'o PEC recusou' }), 'Reenviar')
  assert.equal(acaoDaFicha({ ...base, status: 'retido', ultimo_erro: null }), 'Tentar agora')
  assert.equal(acaoDaFicha({ ...base, status: 'enviado', ultimo_erro: null }), null)
  assert.equal(motivoDaFicha({ ...base, status: 'retido', ultimo_erro: 'retido: paciente sem CNS e sem CPF' }), 'Paciente sem CNS e sem CPF')
})

test('U15 PR 5: a aba SISAB aparece só na UBS', () => {
  const pagina = readFileSync('src/pages/admin/Integracoes.tsx', 'utf8')
  assert.match(pagina, /\.\.\.\(ubs \? \[\{ valor: 'sisab', rotulo: 'SISAB', conteudo: \(\) => <SisabAba \/> \}\] : \[\]\)/)
  assert.match(pagina, /const ubs = unidadeAtiva\?\.unidade\.tipo === 'ubs'/)
})
