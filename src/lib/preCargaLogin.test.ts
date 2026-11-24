// node --experimental-strip-types --test src/lib/preCargaLogin.test.ts
//
// F1 da trilha Desempenho (P2 = A): o build põe no <head> o modulepreload do
// pedaço do Login, o preload da fonte do texto e o prefetch da casca logada.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { tagsPreCarga } from './preCargaLogin.ts'

const ch = (fileName: string, o: { id?: string; isEntry?: boolean; imports?: string[] } = {}) => ({
  type: 'chunk' as const, fileName, facadeModuleId: o.id ?? null, isEntry: !!o.isEntry, imports: o.imports ?? [],
})
const asset = (fileName: string) => ({ type: 'asset' as const, fileName })

const bundle = {
  a: ch('assets/index-1.js', { id: 'C:\\app\\index.html', isEntry: true, imports: ['assets/vendor-react-2.js', 'assets/utils-3.js'] }),
  b: ch('assets/vendor-react-2.js'),
  c: ch('assets/utils-3.js'),
  d: ch('assets/Login-4.js', { id: 'C:\\app\\src\\pages\\Login.tsx', imports: ['assets/utils-3.js', 'assets/input-5.js'] }),
  e: ch('assets/input-5.js'),
  f: ch('assets/AppShell-6.js', { id: '/app/src/components/AppShell.tsx', imports: ['assets/registry-7.js', 'assets/input-5.js', 'assets/vendor-react-2.js'] }),
  g: ch('assets/registry-7.js'),
  h: ch('assets/Faturamento-8.js', { id: '/app/src/pages/faturamento/Contas.tsx', imports: ['assets/utils-3.js'] }),
  i: asset('assets/geist-latin-wght-normal-AbC123.woff2'),
  j: asset('assets/geist-latin-ext-wght-normal-XyZ.woff2'),
  k: asset('assets/geist-mono-latin-wght-normal-QwE.woff2'),
}

const resumo = (b: Parameters<typeof tagsPreCarga>[0]) =>
  tagsPreCarga(b).map((t) => `${t.attrs.rel}${t.attrs.as ? `:${t.attrs.as}` : ''} ${t.attrs.href}`)

test('modulepreload do Login (sem repetir a entrada), preload da Geist latin e prefetch da casca', () => {
  assert.deepEqual(resumo(bundle), [
    'modulepreload /assets/Login-4.js',
    'modulepreload /assets/input-5.js',
    'preload:font /assets/geist-latin-wght-normal-AbC123.woff2',
    'prefetch /assets/AppShell-6.js',
    'prefetch /assets/registry-7.js',
  ])
})

test('todas as tags vão para o head, com crossorigin (módulos e fonte pedem CORS)', () => {
  for (const t of tagsPreCarga(bundle)) {
    assert.equal(t.tag, 'link')
    assert.equal(t.injectTo, 'head')
    assert.equal(t.attrs.crossorigin, true)
  }
  const fonte = tagsPreCarga(bundle).find((t) => t.attrs.as === 'font')
  assert.equal(fonte?.attrs.type, 'font/woff2')
})

test('sem Login, sem casca e sem fonte no pacote, não inventa tag', () => {
  assert.deepEqual(tagsPreCarga({ a: bundle.a, b: bundle.b, c: bundle.c }), [])
})
