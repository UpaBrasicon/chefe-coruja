// Perfis em todas as unidades (RT, 25/11/2026): o menu "Trocar perfil" agrupa
// os papéis por unidade, a ativa primeiro.
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  BUSCA_DE_UNIDADES_A_PARTIR, agruparPerfisPorUnidade, filtrarGrupos, recolherOutrasUnidades, registroNoMenu, totalDePerfis, type VinculoDoPerfil,
} from './perfisPorUnidade.ts'

const v = (unidade_id: string, nome: string, tipo: VinculoDoPerfil['unidade']['tipo'], papel: VinculoDoPerfil['papel']): VinculoDoPerfil => ({
  papel,
  unidade_id,
  unidade: { nome, tipo },
})

const vinculos: VinculoDoPerfil[] = [
  v('upa', 'UPA Homologação', 'upa', 'enfermeiro'),
  v('upa', 'UPA Homologação', 'upa', 'plantonista'),
  v('central', 'Central de Regulação', 'clinica', 'regulador'),
  v('hosp', 'Hospital de Referência', 'hospital', 'nir'),
  v('hosp', 'Hospital de Referência', 'hospital', 'gestor'),
  v('hosp', 'Hospital de Referência', 'hospital', 'plantonista'),
  v('hosp', 'Hospital de Referência', 'hospital', 'recepcao'),
  v('ubs', 'UBS Homologação', 'ubs', 'plantonista'),
  v('ubs', 'UBS Homologação', 'ubs', 'enfermeiro'),
  v('ubs', 'UBS Homologação', 'ubs', 'plantonista'),
]

test('a unidade ativa vem primeiro e as outras pelo nome; nenhum papel some', () => {
  const grupos = agruparPerfisPorUnidade(vinculos, 'ubs')
  assert.deepEqual(grupos.map((g) => g.nome), ['UBS Homologação', 'Central de Regulação', 'Hospital de Referência', 'UPA Homologação'])
  assert.deepEqual(grupos.map((g) => g.ativa), [true, false, false, false])
  assert.equal(totalDePerfis(grupos), 9, 'todos os papéis de todas as unidades, sem repetir o médico da UBS')
})

test('o médico da UBS e o do hospital ficam em grupos diferentes', () => {
  const grupos = agruparPerfisPorUnidade(vinculos, 'ubs')
  const comMedico = grupos.filter((g) => g.papeis.includes('plantonista')).map((g) => g.nome)
  assert.deepEqual(comMedico, ['UBS Homologação', 'Hospital de Referência', 'UPA Homologação'])
})

test('dentro da unidade, papéis na ordem de precedência e sem repetição', () => {
  const grupos = agruparPerfisPorUnidade(vinculos, 'upa')
  assert.deepEqual(grupos[0].papeis, ['plantonista', 'enfermeiro'])
  const hosp = grupos.find((g) => g.unidadeId === 'hosp')!
  assert.deepEqual(hosp.papeis, ['gestor', 'plantonista', 'recepcao', 'nir'])
  assert.deepEqual(grupos.find((g) => g.unidadeId === 'ubs')!.papeis, ['plantonista', 'enfermeiro'])
})

test('ME2: o administrador geral sai dos grupos e não muda com a unidade em uso', () => {
  const comAdmin = [...vinculos, v('central', 'Central de Regulação', 'clinica', 'admin')]
  for (const ativa of ['central', 'upa', 'ubs']) {
    const grupos = agruparPerfisPorUnidade(comAdmin, ativa, true)
    assert.ok(!grupos.some((g) => g.papeis.includes('admin')), 'o administrador fica à parte, uma vez só')
    assert.deepEqual(grupos.find((g) => g.unidadeId === 'central')!.papeis, ['regulador'], `a Central tem o mesmo perfil com ${ativa} em uso`)
  }
  // sem administrador geral, o vínculo de admin de uma unidade continua no grupo dela
  assert.deepEqual(agruparPerfisPorUnidade(comAdmin, 'upa').find((g) => g.unidadeId === 'central')!.papeis, ['admin', 'regulador'])
})

test('ME2: a unidade em uso no topo e as outras sempre em ordem alfabética', () => {
  for (const ativa of ['upa', 'hosp', 'central']) {
    const resto = agruparPerfisPorUnidade(vinculos, ativa).slice(1).map((g) => g.nome)
    assert.deepEqual(resto, [...resto].sort((a, b) => a.localeCompare(b, 'pt-BR')))
  }
  assert.equal(BUSCA_DE_UNIDADES_A_PARTIR, 7, 'busca só com mais de seis unidades')
})

test('ME2: a busca do seletor acha pelo nome da unidade ou do papel, sem acento', () => {
  const grupos = agruparPerfisPorUnidade(vinculos, 'ubs')
  const rotulo = (p: string) => ({ regulador: 'Médico regulador', nir: 'NIR' } as Record<string, string>)[p] ?? p
  assert.deepEqual(filtrarGrupos(grupos, 'homologacao', rotulo).map((g) => g.unidadeId), ['ubs', 'upa'])
  assert.deepEqual(filtrarGrupos(grupos, 'regulador', rotulo).map((g) => g.unidadeId), ['central'])
  assert.equal(filtrarGrupos(grupos, '  ', rotulo).length, grupos.length)
})

test('ME3: o conselho só aparece no papel que assina com ele', () => {
  const medico = { crm: '000000', uf_crm: 'SP' }
  assert.equal(registroNoMenu('plantonista', medico), 'CRM 000000/SP')
  assert.equal(registroNoMenu('regulador', medico), 'CRM 000000/SP')
  assert.equal(registroNoMenu('telemedicina', medico), 'CRM 000000/SP')
  for (const papel of ['nir', 'gestor', 'recepcao', 'admin', 'faturamento', 'gestor_secretaria'] as const) {
    assert.equal(registroNoMenu(papel, medico), null, `${papel} não mostra o CRM`)
  }
  const enf = { conselho: 'COREN', registro_numero: '123', registro_uf: 'GO' }
  assert.equal(registroNoMenu('enfermeiro', enf), 'COREN 123/GO')
  assert.equal(registroNoMenu('tecnico_enfermagem', enf), 'COREN 123/GO')
  assert.equal(registroNoMenu('plantonista', enf), null, 'o COREN não vira CRM')
  assert.equal(registroNoMenu('farmaceutico', enf), null)
  assert.equal(registroNoMenu('regulador', { conselho: 'CRM', registro_numero: '55', registro_uf: 'GO' }), 'CRM 55/GO')
  assert.equal(registroNoMenu(null, medico), null)
})

test('sem unidade ativa conhecida, só ordena pelo nome', () => {
  const grupos = agruparPerfisPorUnidade(vinculos, 'outra')
  assert.ok(grupos.every((g) => !g.ativa))
  assert.equal(grupos[0].nome, 'Central de Regulação')
  assert.deepEqual(agruparPerfisPorUnidade([], null), [])
})

test('a troca de outra unidade muda unidade e rota na mesma transição (super admin caía em /painel)', () => {
  // O BrowserRouter troca a rota em startTransition; a unidade trocada fora
  // dela chegava antes e o RequireRole da rota antiga redirecionava.
  const casca = readFileSync('src/components/AppShell.tsx', 'utf8')
  assert.match(
    casca,
    /React\.startTransition\(\(\) => \{\s*setUnidadeAtivaId\(unidadeDoPapel, p\)\s*navigate\(telaAoEntrar\(p, grupo\?\.tipo \?\? null\)\)\s*\}\)/,
  )
})

test('recolhe as outras unidades quando a lista fica longa', () => {
  assert.equal(recolherOutrasUnidades(agruparPerfisPorUnidade(vinculos, 'ubs')), true)
  const curta = agruparPerfisPorUnidade(vinculos.filter((x) => x.unidade_id === 'ubs' || x.unidade_id === 'upa'), 'ubs')
  assert.equal(recolherOutrasUnidades(curta), false)
})
