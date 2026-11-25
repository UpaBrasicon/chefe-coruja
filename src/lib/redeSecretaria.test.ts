import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  montarArvore, normalizar, quemDesigna, ramoParaGravar, resumoRamos, tipoDoRamo, totalPessoas, type OrganizacaoRede, type UnidadeNaRede,
  termoDeBuscaDeConta,
} from './redeSecretaria.ts'

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

// Nova unidade a partir do grupo da árvore (RT, 24/11/2026)
test('o grupo da árvore já traz o tipo; só ambulatório e central gravam o ramo', () => {
  assert.equal(tipoDoRamo('hospital'), 'hospital')
  assert.equal(tipoDoRamo('ubs'), 'ubs')
  assert.equal(tipoDoRamo('ambulatorio'), 'clinica')
  assert.equal(tipoDoRamo('central_regulacao'), '')
  assert.equal(tipoDoRamo(null), '')
  assert.equal(ramoParaGravar('hospital'), null)
  assert.equal(ramoParaGravar('ambulatorio'), 'ambulatorio')
  assert.equal(ramoParaGravar('central_regulacao'), 'central_regulacao')
  assert.equal(ramoParaGravar(null), null)
})

// Pessoas: o gestor da unidade ou a gestão da secretaria (RT, 24/11/2026)
test('quem designa as pessoas da unidade', () => {
  assert.equal(quemDesigna(['Ana'], ['Bia', 'Caio'], 'SMS'),
    'Quem convida e muda as pessoas desta unidade: o gestor da unidade (Ana), a gestão de SMS (Bia e Caio) e o administrador.')
  assert.equal(quemDesigna([], [], 'SMS'),
    'Quem convida e muda as pessoas desta unidade: o gestor da unidade (hoje sem gestor ativo), a gestão de SMS (ainda sem pessoa designada) e o administrador.')
  assert.equal(quemDesigna(['Ana', 'Davi', 'Eva'], [], null),
    'Quem convida e muda as pessoas desta unidade: o gestor da unidade (Ana, Davi e Eva) e o administrador.')
})

// RT, 25/11/2026 (teste de fluxo A, A-17): o gestor da secretaria designa o gestor da unidade
test('Designar gestor: busca por e-mail inteiro ou 3 letras do nome; só o perfil da secretaria vê o botão', () => {
  assert.equal(termoDeBuscaDeConta('  Maria  Silva '), 'Maria Silva')
  assert.equal(termoDeBuscaDeConta('ma'), null)
  assert.equal(termoDeBuscaDeConta('Maria@Rede.gov.br'), 'maria@rede.gov.br')
  assert.equal(termoDeBuscaDeConta('maria@'), null, 'pedaço de e-mail não busca')
  const tela = readFileSync('src/pages/admin/RedeSecretaria.tsx', 'utf8')
  assert.match(tela, /\{!admin && u\.ativo && !u\.eh_sede_rede && <DesignarGestor /)
  const janela = readFileSync('src/pages/admin/DesignarGestor.tsx', 'utf8')
  assert.match(janela, /rpc\('secretaria_buscar_contas'/)
  assert.match(janela, /rpc\('secretaria_designar_gestor'/)
  const sql = readFileSync('supabase/migrations/20270426000015_secretaria_designar_gestor.sql', 'utf8')
  assert.equal((sql.match(/NOT private\.secretaria_gere_unidade\(p_unidade\)/g) ?? []).length, 2, 'as duas RPCs conferem a secretaria da unidade')
  assert.match(sql, /registrar_auditoria\('gestor_designado_pela_secretaria'/)
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
