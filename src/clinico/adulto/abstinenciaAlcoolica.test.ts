import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import type { Respostas } from '../escore.ts'
import {
  CRITERIOS_CAINE, DOSES_ABSTINENCIA, ERRATA_CIWA, FATORES_RISCO_SAA, ITENS_CIWA, caine, ciwaAr, doseDiaria, faixaCiwa,
  fichaAbstinenciaAlcoolica, midazolamDelirium,
} from './abstinenciaAlcoolica.ts'

const d = (id: string) => DOSES_ABSTINENCIA.find((x) => x.id === id)!

/** Respostas com o mesmo nível em todos os itens (orientação limitada a 4). */
function todos(n: number): Respostas {
  return Object.fromEntries(ITENS_CIWA.map((i) => [i.id, i.id === 'orientacao' ? Math.min(n, 4) : n]))
}

test('abstinência: ficha adulto do cap. 78, id kebab, sem referência pediátrica', () => {
  assert.equal(fichaAbstinenciaAlcoolica.id, 'adulto-abstinencia-alcoolica')
  assert.equal(fichaAbstinenciaAlcoolica.publico, 'adulto')
  assert.match(fichaAbstinenciaAlcoolica.fontes[0].citacao, /Manual de Medicina de Emergência.*p\. 1024–1035/)
  assert.equal(temReferenciaPediatrica(fichaAbstinenciaAlcoolica), false)
  for (const x of DOSES_ABSTINENCIA) assert.match(x.pagina, /^p\. \d+/, x.id)
})

test('CIWA-Ar: 10 itens, nove de 0 a 7 e orientação de 0 a 4 — máximo 67 (Tabela 3, p. 1028–1030)', () => {
  assert.equal(ITENS_CIWA.length, 10)
  const maximos = ITENS_CIWA.map((i) => (i.tipo === 'escolha' ? Math.max(...i.opcoes.map((o) => o.valor)) : -1))
  assert.deepEqual(maximos, [7, 7, 7, 7, 7, 7, 7, 7, 7, 4])
  assert.equal(ciwaAr.calcular(todos(7))!.valor, '67')
  assert.equal(ciwaAr.calcular(todos(0))!.valor, '0')
})

test('CIWA-Ar: âncoras do livro conferidas (p. 1028–1030)', () => {
  const op = (id: string, n: number) => {
    const i = ITENS_CIWA.find((x) => x.id === id)!
    return i.tipo === 'escolha' ? i.opcoes[n].rotulo : ''
  }
  assert.match(op('tremor', 4), /moderado com os braços estendidos/)
  assert.match(op('sudorese', 4), /gotas de suor visíveis na fronte/)
  assert.match(op('orientacao', 3), /mais de 2 dias/)
  assert.match(op('nauseas', 2), /intermediário/)
  assert.match(op('cefaleia', 2), /leve/)
})

test('CIWA-Ar: faixas leve < 15, moderada 16–20, grave > 20 e o buraco no 15 (p. 1030)', () => {
  assert.equal(faixaCiwa(0), 'leve')
  assert.equal(faixaCiwa(14), 'leve')
  assert.equal(faixaCiwa(15), 'sem-faixa')
  assert.equal(faixaCiwa(16), 'moderada')
  assert.equal(faixaCiwa(20), 'moderada')
  assert.equal(faixaCiwa(21), 'grave')
  assert.match(ERRATA_CIWA.faixa15, /15 pontos não cai em nenhuma faixa/)
})

test('CIWA-Ar: incompleto é null; 15 pontos traz a errata; > 20 cita a via parenteral (p. 1032)', () => {
  assert.equal(ciwaAr.calcular({ nauseas: 3 }), null)
  const r15 = ciwaAr.calcular({ ...todos(0), nauseas: 7, tremor: 7, orientacao: 1 })!
  assert.deepEqual([r15.valor, r15.estado, r15.alerta], ['15', 1, ERRATA_CIWA.faixa15])
  const r21 = ciwaAr.calcular({ ...todos(0), nauseas: 7, tremor: 7, sudorese: 7 })!
  assert.equal(r21.estado, 2)
  assert.ok(r21.derivados.some(([, v]) => /parenteral/.test(v)))
  assert.ok(r21.derivados.some(([k]) => /Tabela 1/.test(k)))
})

test('Caine: quatro critérios, diagnóstico com dois (Tabela 4, p. 1032)', () => {
  assert.equal(CRITERIOS_CAINE.length, 4)
  assert.equal(caine(1).preenche, false)
  assert.equal(caine(2).preenche, true)
  assert.equal(caine(9).marcados, 4)
})

test('abstinência: doses do capítulo (p. 1031–1034)', () => {
  assert.deepEqual(d('diazepam-vo').mg, [5, 10])
  assert.deepEqual(doseDiaria(d('diazepam-vo').mg!, 6), [20, 40])
  assert.deepEqual(doseDiaria(d('diazepam-vo').mg!, 8), [15, 30])
  assert.deepEqual(d('diazepam-ev').mg, [5, 10])
  assert.deepEqual(d('lorazepam-ev').mg, [2, 4])
  assert.deepEqual(d('haloperidol').mg, [5, 5])
  assert.deepEqual(d('olanzapina').mg, [10, 10])
  assert.deepEqual(d('tiamina-im').mg, [100, 200])
  assert.match(d('tiamina-vo').texto, /100 a 300 mg/)
  assert.match(d('magnesio').texto, /1 a 2 g diluídos em 100 mL/)
  assert.match(d('volume-dt').texto, /2 litros/)
  const cbz = d('carbamazepina')
  assert.deepEqual([doseDiaria(cbz.mg!, 12), cbz.tetoDiaMg], [[400, 800], [1200, 1600]])
  assert.equal(doseDiaria([5, 10], 5), null)
})

test('abstinência: midazolam no delirium tremens 5 mg + 2 mg/h (p. 1033) no preparo do Anexo 1 (1 mg/mL)', () => {
  assert.deepEqual(midazolamDelirium(), { bolusMg: 5, mgH: 2, mgMl: 1, mlH: 2, bolusMl: 5 })
})

test('abstinência: Tabela 1 com nove fatores de risco (p. 1026)', () => {
  assert.equal(FATORES_RISCO_SAA.itens.length, 9)
  assert.ok(FATORES_RISCO_SAA.itens.includes('Escore CIWA-Ar > 15 na admissão'))
})
