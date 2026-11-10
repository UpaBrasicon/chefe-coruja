// node --experimental-strip-types --test src/content/duplicadas.test.ts
// Ponto 2 do plantonista (RT, 29/10/2026): a mesma tela não entra duas vezes na
// Central. "Ventilação mecânica — ajuste inicial" (ventilacao-mecanica/
// suporte-ventilatorio) abria a mesma tela de emergencias/vm-ajuste-inicial-adulto
// e saiu; o endereço antigo redireciona.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const registro = readFileSync('src/content/registry.tsx', 'utf8')
const telas = [...registro.matchAll(/import\('([^']+)'\),\s*'([^']+)'\)/g)].map((m) => `${m[1]}#${m[2]}`)

// As duas repetições que já existiam (DenguePed e SdraVentilacaoAdulto) saíram
// por decisão do RT em 10/11/2026 (bloco rápido, item 1): nenhuma tela repete.
const CONHECIDAS = new Set<string>([])

test('nenhuma tela nova aparece em duas entradas da Central', () => {
  const vezes = new Map<string, number>()
  for (const t of telas) vezes.set(t, (vezes.get(t) ?? 0) + 1)
  const repetidas = [...vezes].filter(([t, n]) => n > 1 && !CONHECIDAS.has(t)).map(([t]) => t)
  assert.deepEqual(repetidas, [])
})

test('ajuste inicial da VM: uma entrada só, e o endereço antigo redireciona', () => {
  assert.equal(telas.filter((t) => t.endsWith('#VmAjusteInicialAdulto')).length, 1)
  assert.ok(!registro.includes("t('suporte-ventilatorio'"))
  const app = readFileSync('src/App.tsx', 'utf8')
  assert.ok(app.includes('path="/plantonista/ventilacao-mecanica/suporte-ventilatorio" element={<Redirecionar para="/plantonista/emergencias/vm-ajuste-inicial-adulto" />}'))
  const catalogo = readFileSync('biblioteca/ferramentas.json', 'utf8')
  assert.ok(!catalogo.includes('"id": "suporte-ventilatorio"'), 'a IA não sugere a rota que saiu')
})

test('Dengue e SDRA: uma entrada só, e os endereços antigos redirecionam (RT, 10/11/2026)', () => {
  assert.equal(telas.filter((t) => t.endsWith('#DenguePed')).length, 1)
  assert.equal(telas.filter((t) => t.endsWith('#SdraVentilacaoAdulto')).length, 1)
  assert.ok(!registro.includes("t('manual-dengue'"))
  assert.ok(!registro.includes("t('manobra-recrutamento'"))
  const app = readFileSync('src/App.tsx', 'utf8')
  assert.ok(app.includes('path="/plantonista/dengue/manual-dengue" element={<Redirecionar para="/plantonista/pediatria/dengue-ped" />}'))
  assert.ok(app.includes('path="/plantonista/ventilacao-mecanica/manobra-recrutamento" element={<Redirecionar para="/plantonista/emergencias/sdra-ventilacao-adulto" />}'))
  const catalogo = readFileSync('biblioteca/ferramentas.json', 'utf8')
  assert.ok(!catalogo.includes('"id": "manual-dengue"'), 'a IA não sugere a rota que saiu')
  assert.ok(!catalogo.includes('"id": "manobra-recrutamento"'), 'a IA não sugere a rota que saiu')
})
