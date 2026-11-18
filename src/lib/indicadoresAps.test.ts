// Percurso da UBS, U13 (PR 1): classificação e nota final pelas notas C1 a C7 da
// SAPS (junho de 2026) e pela NT 8/2026.
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('U13: C1 é ótimo acima de 50% até 70% e regular acima de 70%', async () => {
  const { conceitoC1 } = await import('../domain/indicadoresAps.ts')
  assert.equal(conceitoC1(60), 'otimo')
  assert.equal(conceitoC1(70), 'otimo')
  assert.equal(conceitoC1(71), 'regular')
  assert.equal(conceitoC1(50), 'bom')
  assert.equal(conceitoC1(20), 'suficiente')
  assert.equal(conceitoC1(10), 'regular')
})

test('U13: C2 a C7 pelas faixas 75/50/25; C7 soma as partes com os pesos da nota', async () => {
  const { conceitoBoasPraticas, c7Ministerio } = await import('../domain/indicadoresAps.ts')
  assert.equal(conceitoBoasPraticas(76), 'otimo')
  assert.equal(conceitoBoasPraticas(75), 'bom')
  assert.equal(conceitoBoasPraticas(25), 'regular')
  // colo 1/2 × 20 + saúde sexual 1/2 × 30 + mamografia 1/1 × 20 = 45 (vacina HPV fora do app)
  assert.equal(c7Ministerio({ colo: { faixa: 2, feito: 1 }, ssr: { faixa: 2, feito: 1 }, mama: { faixa: 1, feito: 1 } }), 45)
  assert.equal(c7Ministerio({ colo: { faixa: 0, feito: 0 }, ssr: { faixa: 0, feito: 0 }, mama: { faixa: 0, feito: 0 } }), 0)
})

test('U13: nota final da NT 8/2026 (pesos 1 e 2, total 10)', async () => {
  const { notaFinal, conceitoNotaFinal } = await import('../domain/indicadoresAps.ts')
  assert.equal(notaFinal({ C1: 'otimo', C2: 'otimo', C3: 'otimo', C4: 'otimo', C5: 'otimo', C6: 'otimo', C7: 'otimo' }), 10)
  assert.equal(notaFinal({ C1: 'regular', C2: 'regular', C3: 'regular', C4: 'regular', C5: 'regular', C6: 'regular', C7: 'regular' }), 2.5)
  assert.equal(conceitoNotaFinal(7.5), 'bom')
  assert.equal(conceitoNotaFinal(2.5), 'regular')
  const painel = readFileSync('src/pages/gestor/PainelGestor.tsx', 'utf8')
  assert.match(painel, /unidadeAtiva\?\.unidade\.tipo === 'ubs' && <IndicadoresAps unidadeId=\{unidadeId\} \/>/)
})
