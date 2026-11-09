import { readFileSync, statSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { medidaReduzida, nomeWebp, valeReduzir } from './reduzirImagem.ts'

// Item 02 do kit de desempenho (docs/desempenho/AUDITORIA.md): banner, foto do
// perfil e arte do painel eram enviados no tamanho original (foto de celular
// de vários MB) e o banner aparece na lateral de toda tela.

test('lado maior acima do limite: reduz mantendo a proporção', () => {
  assert.deepEqual(medidaReduzida(4000, 3000, 1600), { largura: 1600, altura: 1200 })
  assert.deepEqual(medidaReduzida(3000, 4000, 1600), { largura: 1200, altura: 1600 })
})

test('imagem menor que o limite não aumenta', () => {
  assert.deepEqual(medidaReduzida(800, 600, 1600), { largura: 800, altura: 600 })
})

test('medida nunca fica com zero pixel', () => {
  assert.deepEqual(medidaReduzida(10000, 3, 1000), { largura: 1000, altura: 1 })
})

test('nome passa a terminar em .webp', () => {
  assert.equal(nomeWebp('foto do celular.JPG'), 'foto do celular.webp')
  assert.equal(nomeWebp('arte.png'), 'arte.webp')
  assert.equal(nomeWebp('semextensao'), 'semextensao.webp')
})

test('só reduz PNG, JPEG e WebP; GIF e SVG passam como estão', () => {
  assert.equal(valeReduzir('image/jpeg'), true)
  assert.equal(valeReduzir('image/png'), true)
  assert.equal(valeReduzir('image/webp'), true)
  assert.equal(valeReduzir('image/gif'), false)
  assert.equal(valeReduzir('image/svg+xml'), false)
  assert.equal(valeReduzir('application/pdf'), false)
})

test('banner, foto do perfil e arte do painel passam pela redução antes de subir', () => {
  assert.match(readFileSync('src/lib/api.ts', 'utf8'), /reduzirImagem\(\w+, 1600\)/)
  assert.match(readFileSync('src/pages/Perfil.tsx', 'utf8'), /reduzirImagem\(\w+, 512\)/)
  assert.match(readFileSync('src/pages/recepcao/PropagandaPainel.tsx', 'utf8'), /reduzirImagem\(\w+, 1920\)/)
  // o ícone do aplicativo não pode voltar a ter megabytes (era 5,9 MB, 2048 px)
  assert.ok(statSync('public/logo.png').size < 600_000)
  assert.ok(statSync('public/logo-192.png').size < 150_000)
})
