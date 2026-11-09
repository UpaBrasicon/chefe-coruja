import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Item 01 do kit de desempenho, decisão do RT em 09/11/2026: esqueleto ao
// carregar, começando por Central do Plantonista, Observação, Internação da
// enfermagem, fila da Triagem e Regulação. O esqueleto tem a forma da lista e
// avisa o leitor de tela; não é só um círculo girando.
const TELAS: [arquivo: string, antes: RegExp][] = [
  ['src/components/plantonista/central/CartaoTurno.tsx', /'Carregando o turno…'/],
  ['src/components/observacao/PainelObservacao.tsx', /painel\.isLoading \? \(\s*<div className="flex h-40 items-center justify-center"><Spinner \/><\/div>/],
  ['src/pages/enfermagem/InternacaoEnfermagem.tsx', /\{carregando && <div className="flex justify-center py-6"><Spinner \/><\/div>\}/],
  ['src/pages/enfermagem/triagem/Fila.tsx', /Carregando a fila…<\/p>/],
  ['src/pages/regulacao/Regulacao.tsx', /\{lista\.isLoading \? <Spinner \/> : lista\.error/],
]

test('as cinco telas usam esqueleto no carregamento principal', () => {
  const faltam: string[] = []
  for (const [arquivo, antes] of TELAS) {
    const fonte = readFileSync(arquivo, 'utf8')
    if (antes.test(fonte)) faltam.push(`${arquivo} (ainda com o carregamento antigo)`)
    if (!/<EsqueletoLinhas\b|<Skeleton\b/.test(fonte)) faltam.push(`${arquivo} (sem esqueleto)`)
  }
  assert.deepEqual(faltam, [])
})

test('o esqueleto avisa o leitor de tela e some do leitor nas faixas', () => {
  const fonte = readFileSync('src/components/ui/esqueleto-linhas.tsx', 'utf8')
  assert.match(fonte, /role="status"/)
  assert.match(fonte, /sr-only/)
  assert.match(fonte, /<Skeleton\b/)
})
