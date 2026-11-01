// node --experimental-strip-types --test src/lib/semCategoria.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { agruparSemCategoria } from './semCategoria.ts'

const e = (plantao_id: string, perfil_id: string, nome: string, papel: string | null) =>
  ({ plantao_id, perfil_id, nome, turno: 'manha', papel })

test('semCategoria: M7 — os plantões sem categoria do mês, por pessoa, sem repetir', () => {
  const faixas = [
    { data: '2026-11-03', turno: 'manha', escalados: [e('p1', 'a', 'Ana', null), e('p2', 'b', 'Bia', 'plantonista')] },
    // o plantão de 12 h aparece em duas faixas: conta uma vez
    { data: '2026-11-03', turno: 'tarde', escalados: [e('p1', 'a', 'Ana', null)] },
    { data: '2026-11-05', turno: 'noite', escalados: [e('p3', 'a', 'Ana', null), e('p4', 'c', 'Caio', null)] },
  ]
  const grupos = agruparSemCategoria(faixas)
  assert.deepEqual(grupos.map((g) => [g.nome, g.plantoes.map((p) => p.plantao_id)]), [['Ana', ['p1', 'p3']], ['Caio', ['p4']]])
  assert.equal(grupos[0].plantoes[0].data, '2026-11-03')
  assert.equal(grupos[0].plantoes[0].turno, 'manha')
})

test('semCategoria: mês sem plantão sem categoria, lista vazia', () => {
  assert.deepEqual(agruparSemCategoria([{ data: '2026-11-03', turno: 'manha', escalados: [e('p2', 'b', 'Bia', 'plantonista')] }]), [])
})
