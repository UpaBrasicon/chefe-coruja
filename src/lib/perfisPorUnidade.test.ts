// Perfis em todas as unidades (RT, 25/11/2026): o menu "Trocar perfil" agrupa
// os papéis por unidade, a ativa primeiro.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { agruparPerfisPorUnidade, recolherOutrasUnidades, totalDePerfis, type VinculoDoPerfil } from './perfisPorUnidade.ts'

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

test('os papéis da ativa vindos do contexto (administrador geral) substituem os do vínculo', () => {
  const grupos = agruparPerfisPorUnidade(vinculos, 'upa', ['admin', 'plantonista', 'enfermeiro'])
  assert.deepEqual(grupos[0].papeis, ['admin', 'plantonista', 'enfermeiro'])
  assert.ok(!grupos.slice(1).some((g) => g.papeis.includes('admin')), 'o administrador geral aparece uma vez, na ativa')
})

test('sem unidade ativa conhecida, só ordena pelo nome', () => {
  const grupos = agruparPerfisPorUnidade(vinculos, 'outra')
  assert.ok(grupos.every((g) => !g.ativa))
  assert.equal(grupos[0].nome, 'Central de Regulação')
  assert.deepEqual(agruparPerfisPorUnidade([], null), [])
})

test('recolhe as outras unidades quando a lista fica longa', () => {
  assert.equal(recolherOutrasUnidades(agruparPerfisPorUnidade(vinculos, 'ubs')), true)
  const curta = agruparPerfisPorUnidade(vinculos.filter((x) => x.unidade_id === 'ubs' || x.unidade_id === 'upa'), 'ubs')
  assert.equal(recolherOutrasUnidades(curta), false)
})
