import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { custoNaTela, custoParaCampo, lerCusto, podeDefinirCusto, SEM_CUSTO, totalMateriais, valorDaLinha } from './custoMaterial.ts'

// Custo unitário dos materiais (RT, 24/11/2026; migration 20270421000090).
const semEspacoFixo = (s: string) => s.replace(/\s/g, ' ')

test('custo na tela: real brasileiro; sem custo não vira R$ 0,00', () => {
  assert.equal(semEspacoFixo(custoNaTela(2.5)), 'R$ 2,50')
  assert.equal(semEspacoFixo(custoNaTela('1234.5')), 'R$ 1.234,50')
  assert.equal(semEspacoFixo(custoNaTela(0)), 'R$ 0,00')
  for (const v of [null, undefined, '']) assert.equal(custoNaTela(v), SEM_CUSTO)
  assert.equal(SEM_CUSTO, 'Sem custo')
})

test('custo no campo de edição', () => {
  assert.equal(custoParaCampo(2.5), '2,50')
  assert.equal(custoParaCampo('0.9'), '0,90')
  assert.equal(custoParaCampo(null), '')
})

test('ler o custo digitado: vírgula, milhar, R$ e vazio', () => {
  const valor = (t: string) => { const r = lerCusto(t); return r.valido ? r.valor : 'inválido' }
  assert.equal(valor('2,50'), 2.5)
  assert.equal(valor('R$ 3'), 3)
  assert.equal(valor('1.234,56'), 1234.56)
  assert.equal(valor('1.234'), 1234)
  assert.equal(valor('2.5'), 2.5)
  assert.equal(valor('0'), 0)
  assert.equal(valor('  '), null)
  for (const t of ['-1', '1,555', 'abc', '1e3', '2,5,0', '100000000']) assert.equal(valor(t), 'inválido', t)
})

test('valor da linha: quantidade × custo em centavos exatos', () => {
  assert.equal(valorDaLinha(3, 2.5), 7.5)
  assert.equal(valorDaLinha('1.5', '0.1'), 0.15)
  assert.equal(valorDaLinha(3, 0.1), 0.3)
  assert.equal(valorDaLinha(2, null), null)
  assert.equal(valorDaLinha(2, undefined), null)
})

test('total dos materiais: só as linhas não retiradas com custo', () => {
  const l = (quantidade: number, custo_unitario: number | null, retirado_em: string | null = null, valor?: number | null) =>
    ({ quantidade, custo_unitario, retirado_em, valor })
  assert.deepEqual(totalMateriais([l(3, 2.5), l(2, null), l(1, 10, '2026-11-24T10:00:00Z'), l(0.1, 0.1)]), { total: 7.51, semCusto: 1 })
  // o banco já manda o valor da linha; a tela usa o do banco
  assert.deepEqual(totalMateriais([l(3, 2.5, null, 7.5)]), { total: 7.5, semCusto: 0 })
  assert.deepEqual(totalMateriais([l(2, null)]), { total: null, semCusto: 1 })
  assert.deepEqual(totalMateriais([]), { total: null, semCusto: 0 })
  // conta fechada antes da migration: o JSON congelado não tem as chaves de custo
  assert.deepEqual(totalMateriais([{ quantidade: 2, retirado_em: null }]), { total: null, semCusto: 1 })
})

test('quem define o custo: gestor, farmacêutico e administrador geral', () => {
  assert.ok(podeDefinirCusto(['gestor'], false))
  assert.ok(podeDefinirCusto(['faturamento', 'farmaceutico'], false))
  assert.ok(podeDefinirCusto([], true))
  assert.ok(!podeDefinirCusto(['faturamento'], false))
  assert.ok(!podeDefinirCusto(['recepcao', 'enfermeiro'], false))
})

test('as telas usam a RPC e os auxiliares do custo', () => {
  const pagina = readFileSync('src/pages/faturamento/Materiais.tsx', 'utf8')
  assert.match(pagina, /rpc\('material_definir_custo'/)
  assert.match(pagina, /Custo unitário \(R\$\)/)
  assert.match(pagina, /podeDefinirCusto\(/)
  const conta = readFileSync('src/pages/faturamento/Contas.tsx', 'utf8')
  assert.match(conta, /totalMateriais\(/)
  assert.match(conta, /custoNaTela\(/)
  assert.doesNotMatch(conta, /Sem valor e sem baixa de estoque/)
})
