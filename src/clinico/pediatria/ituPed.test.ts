// node --experimental-strip-types --test src/clinico/pediatria/ituPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import {
  AVISO_AAP_2026, DOSES_ITU_ORAL, DOSES_ITU_PARENTERAL, FATORES_FIGURA2, NOTA_CONTAGEM_AAP, NOTA_ESCOLHA_AAP, NOTA_FIGURA2, NOTA_LIMIARES_AAP, QUADRO3, REFERENCIA_AAP, REFERENCIA_LIVRO,
  faixaCompativel, fichaItuPed, lerUrinaliseAap, lerUrocultura, piuriaAap, usaAap, type Urinalise,
} from './ituPed.ts'

const d = (id: string) => [...DOSES_ITU_ORAL, ...DOSES_ITU_PARENTERAL].find((x) => x.id === id)!
const ua = (leucocitos: Urinalise['leucocitos'], esterase: Urinalise['esterase']): Urinalise => ({ leucocitos, esterase })
const texto = (l: ReturnType<typeof lerUrocultura>) => l!.linhas.join(' ')

test('faixa de idade decide a referência: AAP só de 8 dias a 5 anos', () => {
  assert.equal(temReferenciaPediatrica(fichaItuPed), true)
  assert.deepEqual((['ate7d', '8d_2m', '2m_5a', 'acima5a'] as const).map(usaAap), [false, true, true, false])
  assert.equal(lerUrocultura('ate7d', 'sondagem', 60_000, true)!.referencia, REFERENCIA_LIVRO)
  assert.equal(lerUrocultura('acima5a', 'sondagem', 60_000, true)!.referencia, REFERENCIA_LIVRO)
  assert.equal(lerUrocultura('8d_2m', 'sondagem', 60_000, true)!.referencia, REFERENCIA_AAP)
  assert.equal(lerUrocultura('2m_5a', 'sondagem', 60_000, true)!.referencia, REFERENCIA_AAP)
  assert.equal(lerUrocultura('2m_5a', 'sondagem', -1, true), null)
})

test('faixa marcada confere com a idade digitada', () => {
  assert.equal(faixaCompativel('2m_5a', 0, 0, false), true) // idade não digitada
  assert.equal(faixaCompativel('ate7d', 0, 0, true), true)
  assert.equal(faixaCompativel('2m_5a', 0, 0, true), false)
  assert.equal(faixaCompativel('8d_2m', 0, 1, false), true)
  assert.equal(faixaCompativel('ate7d', 0, 1, false), false)
  assert.equal(faixaCompativel('2m_5a', 3, 0, false), true)
  assert.equal(faixaCompativel('acima5a', 3, 0, false), false)
  assert.equal(faixaCompativel('2m_5a', 8, 0, false), false)
  assert.equal(faixaCompativel('acima5a', 8, 0, false), true)
})

test('livro (p. 594–595) fora de 8 dias a 5 anos, sem atribuir os 50.000 à AAP 2026', () => {
  assert.match(texto(lerUrocultura('acima5a', 'saco', 100_000, true)), /não é aceito/)
  assert.match(texto(lerUrocultura('acima5a', 'sondagem', 60_000, true)), /≥ 50\.000.*AAP de 2011/)
  assert.match(texto(lerUrocultura('acima5a', 'sondagem', 20_000, true)), /Entre 10\.000 e 50\.000/)
  assert.match(texto(lerUrocultura('acima5a', 'jato', 60_000, true)), /abaixo do limiar/)
  assert.match(texto(lerUrocultura('acima5a', 'jato', 100_000, true)), /≥ 100\.000/)
  assert.match(texto(lerUrocultura('ate7d', 'psp', 5_000, true)), /< 10\.000/)
  assert.match(texto(lerUrocultura('ate7d', 'sondagem', 80_000, false)), /Mais de um germe/)
})

test('AAP 2026: urocultura por sonda ou punção ≥ 10.000, jato ≥ 100.000 só a partir de 2 meses (Tabela 1, CPG p. 5)', () => {
  const comPiuria = ua('5a9', 'negativa')
  assert.match(texto(lerUrocultura('2m_5a', 'sondagem', 60_000, true, comPiuria)), /≥ 10\.000 UFC\/mL.*positiva/)
  assert.match(texto(lerUrocultura('2m_5a', 'sondagem', 20_000, true, comPiuria)), /≥ 10\.000 UFC\/mL.*positiva/)
  assert.match(texto(lerUrocultura('2m_5a', 'sondagem', 9_000, true, comPiuria)), /Abaixo de 10\.000.*não positiva/)
  assert.match(texto(lerUrocultura('8d_2m', 'psp', 10_000, true, comPiuria)), /positiva/)
  assert.match(texto(lerUrocultura('2m_5a', 'psp', 10_000, true, comPiuria)), /só aparece na linha de 0 a < 2 meses/)
  assert.doesNotMatch(texto(lerUrocultura('2m_5a', 'psp', 5_000, true, comPiuria)), /qualquer contagem/)
  assert.match(texto(lerUrocultura('2m_5a', 'jato', 60_000, true, comPiuria)), /Abaixo de 100\.000/)
  assert.match(texto(lerUrocultura('2m_5a', 'jato', 100_000, true, comPiuria)), /≥ 100\.000.*positiva/)
  assert.match(texto(lerUrocultura('8d_2m', 'jato', 200_000, true, comPiuria)), /jato médio não serve/)
  assert.match(texto(lerUrocultura('2m_5a', 'sondagem', 80_000, false, comPiuria)), /Mais de um germe/)
  assert.match(texto(lerUrocultura('2m_5a', 'saco', 100_000, true, comPiuria)), /basta para colher por sonda/)
})

test('AAP 2026: piúria obrigatória, com limiar pela idade (Tabela 1, CPG p. 5)', () => {
  // 2 meses a 5 anos: inflamação ≥ 5/campo ou esterase ≥ 1+; ITU provável ≥ 10/campo ou esterase ≥ 2+
  assert.deepEqual(piuriaAap('2m_5a', ua('5a9', 'nao_feita')), { provavel: 'parcial', inflamacao: 'sim' })
  assert.deepEqual(piuriaAap('2m_5a', ua('nao_feita', '2+')), { provavel: 'sim', inflamacao: 'sim' })
  assert.deepEqual(piuriaAap('2m_5a', ua('lt5', 'tracos')), { provavel: 'nao', inflamacao: 'nao' })
  assert.deepEqual(piuriaAap('2m_5a', ua('lt5', '1+')), { provavel: 'nao', inflamacao: 'sim' })
  // 8 dias a < 2 meses: ≥ 5/campo ou esterase ≥ traços nas duas colunas
  assert.deepEqual(piuriaAap('8d_2m', ua('lt5', 'tracos')), { provavel: 'sim', inflamacao: 'sim' })
  assert.deepEqual(piuriaAap('8d_2m', ua('lt5', 'negativa')), { provavel: 'nao', inflamacao: 'nao' })
  assert.equal(piuriaAap('8d_2m', ua('nao_feita', 'nao_feita')), null)
  assert.equal(piuriaAap('acima5a', ua('ge10', '2+')), null)

  assert.match(texto(lerUrocultura('2m_5a', 'sondagem', 20_000, true)), /Falta a urinálise/)
  assert.match(texto(lerUrocultura('2m_5a', 'sondagem', 20_000, true, ua('lt5', 'tracos'))), /Sem inflamação/)
  assert.match(texto(lerUrocultura('8d_2m', 'sondagem', 20_000, true, ua('lt5', 'tracos'))), /preenche a definição/)

  assert.match(lerUrinaliseAap('2m_5a', ua('ge10', 'negativa'))!, /ITU provável.*antibiótico presuntivo/)
  assert.match(lerUrinaliseAap('2m_5a', ua('5a9', 'negativa'))!, /Inflamação presente.*colher urocultura por sonda/)
  assert.match(lerUrinaliseAap('2m_5a', ua('lt5', 'nao_feita'))!, /outro não foi feito/)
  assert.equal(lerUrinaliseAap('acima5a', ua('ge10', '2+')), null)
  assert.match(NOTA_CONTAGEM_AAP, /não centrifugada/)
  assert.match(NOTA_LIMIARES_AAP, /nota "a" da Tabela 1/)
})

test('quem testar: Figura 2 sem etnia e sem número mínimo (CPG p. 5 e 28)', () => {
  assert.equal(FATORES_FIGURA2.length, 6)
  assert.ok(!FATORES_FIGURA2.join(' ').match(/etnia|raça|branca/i))
  assert.match(NOTA_FIGURA2, /UTICalc/)
  assert.match(NOTA_FIGURA2, /não dá número mínimo/)
})

test('Tabelas 3 e 4 (p. 597–598) com máximos do Apêndice', () => {
  assert.deepEqual(calcularDoseLivro(d('cefalexina'), 10)!.porDose, [125, 500])
  assert.deepEqual(calcularDoseLivro(d('cefalexina'), 60)!.dia, [3000, 4000])
  assert.deepEqual(calcularDoseLivro(d('ceftriaxona'), 20)!.porDose, [700, 1400])
  assert.deepEqual(calcularDoseLivro(d('ceftriaxona'), 40)!.porDose, [1400, 2000])
  assert.deepEqual(calcularDoseLivro(d('gentamicina'), 10)!.porDose, [25, 75])
  assert.deepEqual(calcularDoseLivro(d('cipro-iv'), 40)!.dia, [800, 800])
  assert.equal(QUADRO3.length, 9)
})

test('AAP 2026 lida em 11/11/2026: aviso com os números novos, sem dose e sem cefixima', () => {
  assert.ok(fichaItuPed.fontes.some((f) => f.citacao.includes('PMID 42803578')))
  assert.equal(fichaItuPed.versao, '2026-11-11.1')
  const aviso = AVISO_AAP_2026.join(' ')
  assert.match(aviso, /≥ 10\.000 UFC\/mL/)
  assert.match(aviso, /11\/11\/2026/)
  assert.doesNotMatch(aviso, /não foram conferidos/)
  assert.doesNotMatch(aviso + NOTA_ESCOLHA_AAP, /mg\/kg|cefixima/i)
  assert.ok(!DOSES_ITU_ORAL.some((x) => /cefixima/i.test(x.nome)))
})
