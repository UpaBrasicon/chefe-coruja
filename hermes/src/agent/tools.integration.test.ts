// Teste de integração das tools de leitura contra o Supabase real.
// Uso: $env:SVC_KEY=... node --test src/agent/tools.integration.test.ts
// ⚠️ Requer rede + Supabase. Pula se SVC_KEY não estiver setada.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const SVC = process.env.SVC_KEY
const pular = !SVC

test('resolverIdentidadePorWaId — número não cadastrado → null', { skip: pular }, async () => {
  const { resolverIdentidadePorWaId } = await import('./identidade.ts')
  const ident = await resolverIdentidadePorWaId('5511999999999') // número inexistente
  assert.equal(ident, null)
})

test('get_plantao_do_dia — plantonista sem permissão (filtro no código)', { skip: pular }, async () => {
  const { executarTool } = await import('./tools.ts')
  const identidade = {
    perfilId: 'df02d652-070f-4e2d-be82-18e432f128f7',
    nome: 'Plantonista Teste',
    email: 'plantonista@teste.com',
    papel: 'plantonista' as const,
    unidadeId: '00000000-0000-0000-0000-000000000101',
    unidadeNome: 'UPA Centro',
    organizacaoId: '00000000-0000-0000-0000-000000000001',
  }
  const r = await executarTool(identidade, '5511999990002', 'get_plantao_do_dia', { data: '2026-08-21' })
  assert.equal(r.resultado.ok, false)
  assert.match(r.resultado.erro ?? '', /sem permissão/)
})

test('get_meus_plantoes — gestor consulta plantões do plantonista? NÃO: filtra por perfil resolvido', { skip: pular }, async () => {
  // A tool get_meus_plantoes sempre filtra por identidade.perfilId — mesmo um
  // gestor só vê os PRÓPRIOS plantões. Verificar que retorna ok (vazio p/ gestor).
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
  const r = await executarTool(identidade, '5511999990001', 'get_meus_plantoes', { periodo: 'semana' })
  assert.equal(r.resultado.ok, true)
  assert.ok(Array.isArray(r.resultado.dados))
})
