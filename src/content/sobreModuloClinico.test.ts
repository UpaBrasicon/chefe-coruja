import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { ROTA_SOBRE_MODULO, SOBRE_MODULO_CLINICO } from './sobreModuloClinico.ts'

// LG11, C5: o texto aprovado pelo RT em 17/11/2026 não pode perder as frases de segurança.
const tudo = SOBRE_MODULO_CLINICO.flatMap((p) => [p.titulo, p.texto ?? '', ...(p.itens ?? [])]).join('\n')

test('frases de segurança do texto aprovado', () => {
  for (const frase of [
    'A decisão é sempre do profissional',
    'Não converte dose de adulto para criança',
    'até 13 anos, 11 meses e 29 dias',
    'A cor da classificação de risco é da enfermagem',
    'Não mande nome nem documento do paciente',
    'contato@chefecoruja.com.br',
    'RDC 657/2022',
  ]) assert.ok(tudo.includes(frase), `falta: ${frase}`)
})

test('cada parte tem título e conteúdo', () => {
  assert.equal(SOBRE_MODULO_CLINICO.length, 8)
  for (const p of SOBRE_MODULO_CLINICO) assert.ok(p.titulo && (p.texto || p.itens?.length), p.titulo)
})

test('a rota não colide com uma seção da Central e está ligada no app, nas ferramentas e na Central', () => {
  const slug = ROTA_SOBRE_MODULO.split('/').at(-1)
  const registry = readFileSync(new URL('./registry.tsx', import.meta.url), 'utf8')
  assert.ok(!registry.includes(`slug: '${slug}'`))
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
  const rota = app.indexOf('path={ROTA_SOBRE_MODULO}')
  assert.ok(rota > 0 && rota < app.indexOf('path="/plantonista/:section"'))
  assert.match(readFileSync(new URL('../components/plantonista/ToolLayout.tsx', import.meta.url), 'utf8'), /ROTA_SOBRE_MODULO/)
  assert.match(readFileSync(new URL('../pages/plantonista/PlantonistaHome.tsx', import.meta.url), 'utf8'), /ROTA_SOBRE_MODULO/)
})
