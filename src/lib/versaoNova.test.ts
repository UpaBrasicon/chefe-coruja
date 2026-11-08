// node --experimental-strip-types --test src/lib/versaoNova.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { scriptPrincipal, versaoMudou } from './versaoNova.ts'

const pagina = (hash: string) =>
  `<!doctype html><html><head><script type="module" crossorigin src="/assets/index-${hash}.js"></script>` +
  `<link rel="modulepreload" crossorigin href="/assets/vendor-react-abc123.js"></head><body><div id="root"></div></body></html>`

test('acha o script principal do build no index.html', () => {
  assert.equal(scriptPrincipal(pagina('Dc4dOzTQ')), '/assets/index-Dc4dOzTQ.js')
})

test('sem script principal (página de erro, HTML do dev), não acha nada', () => {
  assert.equal(scriptPrincipal('<html><body>Erro 502</body></html>'), null)
  assert.equal(scriptPrincipal('<script type="module" src="/src/main.tsx"></script>'), null)
})

test('o script carregado pode vir com o endereço inteiro', () => {
  assert.equal(versaoMudou('https://www.chefecoruja.com.br/assets/index-Dc4dOzTQ.js', pagina('Dc4dOzTQ')), false)
})

test('o build publicado mudou: há versão nova', () => {
  assert.equal(versaoMudou('/assets/index-Dc4dOzTQ.js', pagina('BnhPK940')), true)
})

test('na dúvida, não avisa', () => {
  assert.equal(versaoMudou(null, pagina('BnhPK940')), false)
  assert.equal(versaoMudou('/assets/index-Dc4dOzTQ.js', '<html>fora do ar</html>'), false)
})
