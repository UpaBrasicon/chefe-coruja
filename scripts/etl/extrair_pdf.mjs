import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import fs from 'node:fs'
import path from 'node:path'

// Extrai o texto de um PDF e grava um .txt por página + um consolidado.
const cacheDir = path.resolve('data/cache/guias')
const alvo = process.argv[2]
if (!alvo) {
  console.error('Uso: node extrair_pdf.mjs <nome_sem_extensao>')
  process.exit(1)
}

const pdf = path.join(cacheDir, `${alvo}.pdf`)
const outTxt = path.join(cacheDir, `${alvo}.txt`)
const outPages = path.join(cacheDir, `${alvo}_pags`)

const data = new Uint8Array(fs.readFileSync(pdf))
const doc = await getDocument({ data }).promise
fs.mkdirSync(outPages, { recursive: true })

let total = ''
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i)
  const content = await page.getTextContent()
  const lines = []
  let lastY = null
  let buf = []
  for (const item of content.items) {
    if (typeof item.str !== 'string') continue
    const y = item.transform?.[5] ?? 0
    if (lastY !== null && Math.abs(y - lastY) > 2) {
      lines.push(buf.join(' '))
      buf = []
    }
    lastY = y
    buf.push(item.str)
  }
  if (buf.length) lines.push(buf.join(' '))
  const pageTxt = lines.join('\n')
  total += `=== PAGINA ${i} ===\n${pageTxt}\n\n`
  fs.writeFileSync(path.join(outPages, `pag_${String(i).padStart(3, '0')}.txt`), pageTxt, 'utf8')
}

fs.writeFileSync(outTxt, total, 'utf8')
console.log(`[pdf] ${alvo}: ${doc.numPages} páginas extraídas -> ${path.basename(outTxt)} (${(total.length / 1024).toFixed(0)} KB)`)
