// Teste de integração das tools do Gavião (fiscal) contra o Supabase real.
// ⚠️ Requer rede + Supabase. Pula se SVC_KEY não estiver setada.
// As tools de ESCALA foram movidas para a skill do Nous (chefe-coruja) —
// aqui ficam as tools do Cérbero (fiscal) + identidade.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const SVC = process.env.SVC_KEY
const pular = !SVC

test('resolverIdentidadePorWaId — número não cadastrado → null', { skip: pular }, async () => {
  const { resolverIdentidadePorWaId } = await import('./identidade.ts')
  const ident = await resolverIdentidadePorWaId('5511999999999') // número inexistente
  assert.equal(ident, null)
})

test('tools do Cérbero — não-super_admin recebe resposta genérica (não revela)', { skip: pular }, async () => {
  const { executarTool } = await import('./tools.ts')
  const identidade = {
    perfilId: 'da6c5d33-a123-4960-a494-a00c883906a1', // gestor (NÃO super)
    nome: 'Gestor Teste',
    email: 'gestor@teste.com',
    papel: 'gestor' as const,
    unidadeId: '00000000-0000-0000-0000-000000000101',
    unidadeNome: 'UPA Centro',
    organizacaoId: '00000000-0000-0000-0000-000000000001',
  }
  const r = await executarTool(identidade, '5511999990001', 'listar_quarentena', {})
  assert.equal(r.resultado.ok, true)
  const dados = r.resultado.dados as { mensagem?: string }
  assert.ok(dados.mensagem, 'não-admin recebe mensagem genérica')
})

test('tool desconhecida → erro', { skip: pular }, async () => {
  const { executarTool } = await import('./tools.ts')
  const identidade = {
    perfilId: 'da6c5d33-a123-4960-a494-a00c883906a1',
    nome: 'Gestor Teste',
    email: 'gestor@teste.com',
    papel: 'gestor' as const,
    unidadeId: '00000000-0000-0000-0000-000000000101',
    unidadeNome: 'UPA Centro',
    organizacaoId: '00000000-0000-0000-0000-000000000001',
  }
  const r = await executarTool(identidade, '5511999990001', 'get_meus_plantoes', {}) // desativada
  assert.equal(r.resultado.ok, false)
  assert.match(r.resultado.erro ?? '', /desconhecida|não encontrada/i)
})
