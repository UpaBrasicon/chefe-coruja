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
