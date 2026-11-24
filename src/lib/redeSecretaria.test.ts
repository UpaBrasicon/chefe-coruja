import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { montarArvore, normalizar, resumoRamos, totalPessoas, type OrganizacaoRede, type UnidadeNaRede } from './redeSecretaria.ts'

// Rede a partir da Secretaria (pedido do RT, 24/11/2026).

function un(p: Partial<UnidadeNaRede> & Pick<UnidadeNaRede, 'id' | 'nome' | 'ramo'>): UnidadeNaRede {
  return {
    tipo: p.ramo, cnes: null, municipio: null, uf: null, endereco: null, whatsapp: null, ativo: true,
    secretaria_id: null, ramo_rede: null, eh_central: false, eh_sede_rede: false, pessoas: {}, gestores: [], ...p,
  }
}
const sec = (id: string, nome: string, municipio: string | null = null) => ({
  id, nome, esfera: 'municipal' as const, municipio, uf: null, cnpj: null, responsavel: null, telefone: null, email: null,
  endereco: null, ativo: true, atualizado_em: '2026-11-24T00:00:00Z',
})

const org: OrganizacaoRede = {
  id: 'o1',
  nome: 'Rede Goiás',
  secretarias: [sec('s1', 'Secretaria Municipal de Saúde', 'Goiânia'), sec('s2', 'Secretaria Estadual'), sec('s3', 'Secretaria Nova')],
  unidades: [
    un({ id: 'u1', nome: 'UPA Centro', ramo: 'upa', secretaria_id: 's1', municipio: 'Goiânia', cnes: '1234567' }),
    un({ id: 'u2', nome: 'Hospital Regional', ramo: 'hospital', secretaria_id: 's1' }),
    un({ id: 'u3', nome: 'UBS Vila Nova', ramo: 'ubs', secretaria_id: 's1', pessoas: { gestor: 1, enfermeiro: 3 } }),
    un({ id: 'u4', nome: 'Central Estadual', ramo: 'central_regulacao', tipo: 'hospital', eh_central: true, secretaria_id: 's2' }),
    un({ id: 'u5', nome: 'Clínica Sem Dono', ramo: 'clinica' }),
  ],
}

test('cada secretaria vira um galho, com os ramos na ordem da rede', () => {
  const g = montarArvore([org])
  assert.deepEqual(g.map((x) => x.secretaria?.nome ?? 'sem'), ['Secretaria Municipal de Saúde', 'Secretaria Estadual', 'Secretaria Nova', 'sem'])
  assert.deepEqual(g[0].ramos.map((r) => r.ramo), ['hospital', 'upa', 'ubs'])
  assert.equal(g[0].total, 3)
  assert.deepEqual(g[1].ramos.map((r) => r.ramo), ['central_regulacao'])
})

test('secretaria sem unidade aparece para receber a primeira', () => {
  const nova = montarArvore([org]).find((x) => x.secretaria?.id === 's3')
  assert.ok(nova)
  assert.equal(nova.ramos.length, 0)
})

test('unidade sem secretaria vai para o galho próprio da organização', () => {
  const solta = montarArvore([org]).at(-1)
  assert.equal(solta?.secretaria, null)
  assert.deepEqual(solta?.ramos.flatMap((r) => r.unidades.map((u) => u.id)), ['u5'])
})

test('a busca acha a unidade sem acento e sem caixa, pelo nome, município ou CNES', () => {
  const porNome = montarArvore([org], 'clinica sem')
  assert.deepEqual(porNome.map((x) => x.chave), ['sem:o1'])
  const porCnes = montarArvore([org], '1234567')
  assert.deepEqual(porCnes.flatMap((x) => x.ramos.flatMap((r) => r.unidades.map((u) => u.id))), ['u1'])
  // a contagem do galho segue com o total da secretaria
  assert.equal(porCnes[0].total, 3)
})

test('a busca pelo nome da secretaria traz o galho inteiro', () => {
  const g = montarArvore([org], 'estadual')
  // "Central Estadual" casa também, mas o galho é um só
  assert.deepEqual(g.map((x) => x.chave), ['s2'])
  assert.equal(g[0].ramos[0].unidades.length, 1)
})

test('resumo, total de pessoas e normalização', () => {
  assert.equal(resumoRamos(montarArvore([org])[0].ramos), '1 hospital, 1 UPA, 1 UBS')
  assert.equal(totalPessoas(org.unidades[2]), 4)
  assert.equal(normalizar('  Clínica ÁGUA '), 'clinica agua')
})

// A tela fica só no perfil Administrador (a rota /painel) e grava só pelas RPCs.
test('a aba Secretarias escreve só pelas RPCs do administrador', () => {
  const tela = readFileSync('src/pages/admin/RedeSecretaria.tsx', 'utf8')
  assert.match(tela, /rpc\('admin_rede_arvore'/)
  assert.match(tela, /rpc\('admin_salvar_secretaria'/)
  assert.match(tela, /rpc\('admin_unidade_na_rede'/)
  assert.doesNotMatch(tela, /from\('(secretarias|unidades)'\)\s*\.(insert|update|upsert|delete)/)
  const grupo = readFileSync('src/pages/grupos/OrganizacaoGrupo.tsx', 'utf8')
  assert.match(grupo, /valor: 'secretarias'/)
  assert.match(grupo, /valor: 'censo'/)
})
