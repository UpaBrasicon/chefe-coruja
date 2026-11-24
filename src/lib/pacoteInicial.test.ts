import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Item 22 do kit de desempenho (docs/desempenho/AUDITORIA.md): o manualChunks
// mandava toda dependência não listada para um "vendor-other" único, baixado
// no início, e com ele as dependências das libs que só abrem sob demanda
// (jsPDF, Recharts). Medido em 09/11/2026: 504 KB → 371 KB de JavaScript
// inicial em gzip.
const config = readFileSync('vite.config.ts', 'utf8')

test('o manualChunks não junta o resto num pedaço único baixado no início', () => {
  assert.doesNotMatch(config, /return 'vendor-other'/)
})

test('as libs pesadas continuam fora do mapeamento (vêm sob demanda)', () => {
  for (const lib of ['jspdf', 'pdfjs-dist', 'tesseract.js', 'html2canvas', 'recharts']) assert.match(config, new RegExp(`'${lib}'`))
})

// F1 da trilha Desempenho (pedidos 31, 6 e 10 de 23/11/2026): 74% do
// `index-*.js` era a casca logada e o catálogo da Central, baixados também no
// login. Medido no build local: 358.387 → 272.942 bytes de JavaScript inicial
// em gzip, já contando o pedaço do Login, que agora desce junto.
const app = readFileSync('src/App.tsx', 'utf8')

test('F1: a casca logada não entra no pacote de entrada (import sob demanda)', () => {
  assert.doesNotMatch(app, /^import\s+\{[^}]*\bAppShell\b[^}]*\}\s+from/m)
  assert.match(app, /lazy\(\(\) => import\('@\/components\/AppShell'\)/)
})

test('F1: o App.tsx importa só a rota da página "Sobre o módulo clínico", sem o texto', () => {
  assert.doesNotMatch(app, /from '@\/content\/sobreModuloClinico'/)
  assert.match(app, /from '@\/content\/rotaSobreModulo'/)
})

test('F1: o build pré-carrega o pedaço do Login pelo plugin do vite.config.ts', () => {
  assert.match(config, /preCargaLogin\(\)/)
  assert.match(config, /transformIndexHtml/)
})

test('F1: sem a linha do framer-motion, removido no #520', () => {
  assert.doesNotMatch(config, /framer-motion/)
})
