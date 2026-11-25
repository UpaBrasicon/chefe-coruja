import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// A folha do servidor e a provisória do aparelho saem do mesmo modelo.
test('a cópia da edge function é igual a src/lib/folhas.ts', () => {
  const origem = readFileSync('src/lib/folhas.ts', 'utf8')
  const copia = readFileSync('supabase/functions/_shared/folhas.ts', 'utf8')
  assert.equal(copia.replace(/^\/\/ GERADO[^\n]*\n/, ''), origem, 'rode: npm run folhas:copiar')
})

// RG5 (modelo da Regulação, 25/11/2026): a folha leva as precauções do arquivo de dados, sem desvio.
test('as precauções do documento de transferência são as de src/clinico/isolamento/precaucoes.ts', async () => {
  const { PRECAUCOES_FOLHA } = await import('./folhas.ts')
  const { PRECAUCOES, FONTES_PRECAUCAO, fontesDaPrecaucao } = await import('../clinico/isolamento/precaucoes.ts')
  for (const t of ['contato', 'goticula', 'aerossol'] as const) {
    const p = PRECAUCOES[t]
    const it = (xs: { texto: string; fonte: keyof typeof FONTES_PRECAUCAO; secao: string }[]) =>
      xs.map((i) => `${i.texto} (${FONTES_PRECAUCAO[i.fonte].titulo.split(' — ')[0]}, ${i.secao})`)
    assert.deepEqual(PRECAUCOES_FOLHA[t], {
      rotulo: p.rotulo, quarto: it(p.quarto), paramentacao: it(p.paramentacao), transporte: it(p.transporte),
      fontes: fontesDaPrecaucao(p).map((f) => `${f.titulo}${f.ano ? ` (${f.ano})` : ''}: ${f.link}`),
    }, `${t}: copie de novo a partir de precaucoes.ts`)
  }
})
