import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Item 11 do kit de desempenho (docs/desempenho/AUDITORIA.md): dependência que
// ninguém importa sai do package.json. framer-motion e mammoth estavam lá sem
// uso. Esta guarda falha se voltar a aparecer dependência de produção sem uso.
//
// Usadas sem import direto, de propósito:
// - html2canvas: o jsPDF carrega para gerar PDF a partir da tela;
// - shadcn: só o CSS (src/index.css).
const SEM_IMPORT_DIRETO = new Set(['html2canvas', 'shadcn'])

function fontes(dir: string): string[] {
  const saida: string[] = []
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome.startsWith('.')) continue
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) saida.push(...fontes(caminho))
    else if (/\.(ts|tsx|mjs|js|css)$/.test(nome)) saida.push(caminho)
  }
  return saida
}

test('toda dependência de produção é usada por algum arquivo do projeto', () => {
  const pacote = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string> }
  const texto = [...fontes('src'), ...fontes('scripts'), ...fontes('services'), ...fontes('supabase/functions'), 'vite.config.ts']
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n')
  const semUso = Object.keys(pacote.dependencies).filter(
    (d) => !SEM_IMPORT_DIRETO.has(d) && !texto.includes(`'${d}'`) && !texto.includes(`"${d}"`) && !texto.includes(`'${d}/`) && !texto.includes(`"${d}/`),
  )
  assert.deepEqual(semUso, [])
})
