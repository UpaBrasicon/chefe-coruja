// node --experimental-strip-types --test src/lib/offline/precache.test.ts
//
// Recarga sem conexão, parte 2, N5 = A (RT, 05/11/2026): login, casca e as
// telas da enfermagem ficam guardadas de antemão pelo service worker.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { FONTES_SEM_CONEXAO, listaPrecache } from './precache.ts'

const ch = (fileName: string, o: { id?: string; isEntry?: boolean; imports?: string[]; css?: string[] } = {}) => ({
  type: 'chunk' as const, fileName, facadeModuleId: o.id ?? null, isEntry: !!o.isEntry, imports: o.imports ?? [],
  viteMetadata: { importedCss: new Set(o.css ?? []) },
})

test('entrada, telas escolhidas e o que elas importam; o resto fica de fora', () => {
  const bundle = {
    a: ch('assets/index-1.js', { id: 'C:\\app\\index.html', isEntry: true, imports: ['assets/vendor-react-2.js'], css: ['assets/index-1.css'] }),
    b: ch('assets/vendor-react-2.js'),
    c: ch('assets/Triagem-3.js', { id: 'C:\\app\\src\\pages\\enfermagem\\Triagem.tsx', imports: ['assets/comum-4.js'] }),
    d: ch('assets/comum-4.js'),
    e: ch('assets/Faturamento-5.js', { id: '/app/src/pages/faturamento/Contas.tsx', imports: ['assets/comum-4.js'] }),
    f: { type: 'asset' as const, fileName: 'assets/logo.png' },
  }
  assert.deepEqual(listaPrecache(bundle, ['src/pages/enfermagem/Triagem.tsx']), [
    '/assets/Triagem-3.js', '/assets/comum-4.js', '/assets/index-1.css', '/assets/index-1.js', '/assets/vendor-react-2.js',
  ])
})

test('N5: login, triagem, enfermagem, checagem e evolução estão na lista', () => {
  for (const f of ['src/pages/Login.tsx', 'src/pages/enfermagem/Triagem.tsx', 'src/pages/enfermagem/InternacaoEnfermagem.tsx',
    'src/pages/enfermagem/ProntoSocorroEnfermagem.tsx', 'src/pages/enfermagem/Checagem.tsx', 'src/pages/plantao/PlantaoToolRouter.tsx', 'src/pages/plantao/secoes/EvolucaoTool.tsx']) {
    assert.ok(FONTES_SEM_CONEXAO.includes(f), f)
    readFileSync(f) // o arquivo existe
  }
})

test('o build gera precache.json e o service worker guarda a lista quando a página pede', () => {
  assert.match(readFileSync('vite.config.ts', 'utf8'), /precacheSemConexao\(/)
  const sw = readFileSync('public/sw.js', 'utf8')
  assert.match(sw, /'\/precache\.json'/)
  assert.match(sw, /data === 'precachear'/)
  const ativar = sw.slice(sw.indexOf("addEventListener('activate'"), sw.indexOf("addEventListener('fetch'"))
  assert.ok(ativar.includes('.then(() => { precachear().catch(() => {}) })'), 'o worker novo guarda ao assumir')
  assert.match(readFileSync('src/main.tsx', 'utf8'), /postMessage\('precachear'\)/)
})
