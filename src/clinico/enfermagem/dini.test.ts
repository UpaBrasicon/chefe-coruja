// node --experimental-strip-types --test src/clinico/enfermagem/dini.test.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  CATEGORIAS_DINI, DINI_IDADE_NOTA_ANOS, fichaDini, INDICADORES_DINI, NOTA_DINI_MENOR_DE_6, categoriaDini, notaDiniMenorDe6, totalDini,
} from './dini.ts'

const todos = (v: number) => Object.fromEntries(INDICADORES_DINI.map((a) => [a.id, v]))
// soma exata: parte de 1 em todos e sobe um indicador por vez
const comTotal = (t: number) => {
  const r = todos(1)
  let falta = t - 11
  for (const a of INDICADORES_DINI) {
    const sobe = Math.min(3, falta)
    r[a.id] = 1 + sobe
    falta -= sobe
  }
  return r
}

test('11 indicadores, cada um com 4 situações, nos 3 domínios', () => {
  assert.equal(INDICADORES_DINI.length, 11)
  assert.ok(INDICADORES_DINI.every((a) => a.situacoes.length === 4))
  assert.deepEqual([...new Set(INDICADORES_DINI.map((a) => a.dominio))], ['Família', 'Paciente', 'Procedimentos terapêuticos'])
  assert.deepEqual(INDICADORES_DINI.map((a) => a.id), [
    'participacao_acompanhante', 'rede_apoio',
    'atividade', 'oxigenacao', 'mobilidade', 'alimentacao', 'eliminacoes', 'higiene',
    'intervalo_controles', 'terapeutica', 'integridade_pele',
  ])
})

test('situações iguais, palavra por palavra, ao resumo aprovado pelo RT', () => {
  const doc = readFileSync('docs/clinico/DINI-PEDIATRICO-DIAGNOSTICO.md', 'utf8').replace(/\r/g, '')
  const resumo = doc.slice(doc.indexOf('## Resumo das situações'), doc.indexOf('### Categorias'))
  for (const a of INDICADORES_DINI) {
    const ini = resumo.indexOf(`**${a.rotulo}** (\`${a.id}\`)`)
    assert.ok(ini >= 0, `indicador ${a.id} fora do resumo`)
    const bloco = resumo.slice(ini).split(/\n(?=\d+\. \*\*|### )/)[0]
    const doResumo = [...bloco.matchAll(/^\s+\d\. (.+)$/gm)].map((m) => m[1].trim())
    assert.deepEqual(a.situacoes, doResumo, a.id)
  }
})

test('soma só com os 11 indicadores entre 1 e 4', () => {
  assert.equal(totalDini(todos(1)), 11)
  assert.equal(totalDini(todos(4)), 44)
  const falta = todos(2)
  delete falta.rede_apoio
  assert.equal(totalDini(falta), null)
  assert.equal(totalDini({ ...todos(2), oxigenacao: 5 }), null)
  assert.equal(totalDini({ ...todos(2), oxigenacao: 0 }), null)
  assert.equal(totalDini({ ...todos(2), oxigenacao: 2.5 }), null)
})

test('faixas nos limites (11, 17/18, 23/24, 30/31, 36/37, 44)', () => {
  assert.deepEqual(CATEGORIAS_DINI.map((c) => c.min), [11, 18, 24, 31, 37])
  const casos: [number, RegExp][] = [
    [11, /mínimos/], [17, /mínimos/], [18, /intermediários/], [23, /intermediários/],
    [24, /Alta dependência/], [30, /Alta dependência/], [31, /semi-intensivos/], [36, /semi-intensivos/],
    [37, /Cuidados intensivos/], [44, /Cuidados intensivos/],
  ]
  for (const [t, re] of casos) {
    assert.equal(totalDini(comTotal(t)), t)
    assert.match(categoriaDini(t).rotulo, re, String(t))
  }
})

test('ficha pediátrica, com as três fontes e o DOI', () => {
  assert.equal(fichaDini.id, 'dini-pediatrico')
  assert.equal(fichaDini.versao, '2026-11-06.1')
  assert.equal(fichaDini.publico, 'pediatrico')
  assert.deepEqual(fichaDini.fontes.map((f) => f.url), [
    'https://doi.org/10.1590/s0080-6234201400005000003',
    'https://doi.org/10.1590/0104-1169.3575.2457',
    'https://doi.org/10.1590/s0080-62342011000300004',
  ])
  assert.ok(fichaDini.fontes.every((f) => f.pediatrica))
})

test('D6: menos de 6 anos em mínimos ou intermediários ganha a nota; a categoria não muda', () => {
  assert.equal(DINI_IDADE_NOTA_ANOS, 6)
  assert.equal(notaDiniMenorDe6(17, 5), NOTA_DINI_MENOR_DE_6)
  assert.equal(notaDiniMenorDe6(23, 0), NOTA_DINI_MENOR_DE_6)
  assert.equal(notaDiniMenorDe6(24, 5), null)
  assert.equal(notaDiniMenorDe6(17, 6), null)
  assert.equal(notaDiniMenorDe6(17, null), null)
  assert.match(categoriaDini(17).rotulo, /mínimos/)
})

test('o servidor tem os mesmos indicadores, faixas e versão', () => {
  const sql = readFileSync('supabase/migrations/20270303000001_dini_pediatrico.sql', 'utf8').replace(/\r/g, '')
  const corpo = sql.slice(sql.indexOf('FUNCTION private.dini_definicao()'))
  const json = JSON.parse(corpo.slice(corpo.indexOf("SELECT '") + 8, corpo.indexOf("'::jsonb")))
  assert.equal(json.versao, fichaDini.versao)
  assert.deepEqual(json.indicadores, INDICADORES_DINI.map((a) => a.id))
  assert.deepEqual(json.faixas, CATEGORIAS_DINI.map((c) => [c.min, c.rotulo]))
})
