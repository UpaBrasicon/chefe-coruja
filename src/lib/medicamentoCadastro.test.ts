import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { FORMAS_FARMACEUTICAS, filtroDaUnidade, rotuloForma } from './medicamentoCadastro.ts'

test('rótulo da forma farmacêutica', () => {
  assert.equal(rotuloForma('po_para_solucao_injetavel'), 'Pó para solução injetável')
  assert.equal(rotuloForma('outra', ' Espuma retal '), 'Espuma retal')
  assert.equal(rotuloForma(null), 'sem forma')
})

test('filtro da unidade: rede e a unidade ativa', () => {
  assert.equal(filtroDaUnidade('u1'), 'unidades_locais.is.null,unidades_locais.cs.{u1}')
  assert.equal(filtroDaUnidade(null), 'unidades_locais.is.null')
})

test('a lista de formas é a mesma que o banco aceita', () => {
  const migration = readFileSync('supabase/migrations/20270106000001_cadastro_medicamentos.sql', 'utf8')
  const check = migration.slice(migration.indexOf('forma_farmaceutica text CHECK'), migration.indexOf("'outra'))") + 8)
  const doBanco = [...check.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
  assert.deepEqual(doBanco, FORMAS_FARMACEUTICAS.map(([k]) => k))
})

// Toda busca no cadastro de medicamentos que oferece item para escolher passa
// pelo filtro da unidade (o item de outra unidade não aparece).
test('as buscas no cadastro usam o filtro da unidade', () => {
  const telas = [
    'src/pages/ReferenciaDiluicao.tsx', 'src/pages/PrescricaoTeste.tsx', 'src/pages/PreferenciasPrescricao.tsx',
    'src/components/prescricao/PrescricaoEstruturada.tsx', 'src/components/paciente/AlergiasEventos.tsx',
    'src/pages/plantao/porta/AbaAtestadoReceita.tsx', 'src/pages/plantao/atendimento/ReceituarioMedico.tsx',
    'src/pages/farmacia/Dispensacao.tsx', 'src/pages/farmacia/Diluicoes.tsx',
  ]
  for (const t of telas) {
    const src = readFileSync(t, 'utf8')
    const buscas = src.split(".from('medicamento')").length - 1
    const filtros = src.split('filtroDaUnidade(').length - 1
    assert.ok(buscas > 0, `${t}: sem busca no cadastro`)
    assert.ok(filtros >= buscas, `${t}: ${buscas} busca(s) e ${filtros} filtro(s) da unidade`)
  }
})
