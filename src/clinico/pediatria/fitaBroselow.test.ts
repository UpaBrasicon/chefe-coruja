import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CORES_BROSELOW, fichaFitaBroselow, pesoDaCor, rotuloAlturaIdade, rotuloPesoDaCor } from './fitaBroselow.ts'

// Fita de Broselow no Guia rápido (decisões do RT de 17/11/2026): tabela da
// fita 2017 (Oommen 2021, Tabela 5) e peso pelo meio da faixa, escrito por extenso.

test('nove cores, na ordem da fita, com altura e peso da Tabela 5 de Oommen 2021', () => {
  assert.deepEqual(CORES_BROSELOW.map((c) => c.id), ['cinza', 'rosa', 'vermelho', 'roxo', 'amarelo', 'branco', 'azul', 'laranja', 'verde'])
  const t5: Record<string, [number[], number[]]> = {
    cinza: [[46.6, 59], [3, 5]], rosa: [[59, 66.7], [6, 7]], vermelho: [[66.7, 74], [8, 9]], roxo: [[74, 83.6], [10, 11]],
    amarelo: [[83.6, 95.2], [12, 14]], branco: [[95.2, 108], [15, 18]], azul: [[108, 121.2], [19, 22]],
    laranja: [[121.2, 130.4], [24, 28]], verde: [[130.4, 143.3], [30, 36]],
  }
  for (const c of CORES_BROSELOW) {
    assert.deepEqual(c.alturaCm, t5[c.id][0], c.id)
    assert.deepEqual(c.pesoKg, t5[c.id][1], c.id)
  }
  // a altura é contínua de uma cor para a outra
  for (let i = 1; i < CORES_BROSELOW.length; i++) assert.equal(CORES_BROSELOW[i].alturaCm[0], CORES_BROSELOW[i - 1].alturaCm[1])
})

test('peso pelo meio da faixa, escrito para o médico entender (exemplos do RT)', () => {
  const rosa = CORES_BROSELOW.find((c) => c.id === 'rosa')!
  const amarelo = CORES_BROSELOW.find((c) => c.id === 'amarelo')!
  assert.equal(pesoDaCor(rosa), 6.5)
  assert.equal(rotuloPesoDaCor(rosa), '6–7 kg → 6,5 kg')
  assert.equal(pesoDaCor(amarelo), 13)
  assert.equal(rotuloPesoDaCor(amarelo), '12–14 kg → 13 kg')
  assert.equal(rotuloAlturaIdade(rosa), '59–66,7 cm · 4 a 6 meses')
})

test('ficha pediátrica com fonte pediátrica própria', () => {
  assert.equal(fichaFitaBroselow.publico, 'pediatrico')
  assert.ok(fichaFitaBroselow.fontes.every((f) => f.pediatrica))
})
