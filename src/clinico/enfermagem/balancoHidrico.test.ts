// node --experimental-strip-types --test src/clinico/enfermagem/balancoHidrico.test.ts   (npm run test:clinico)
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { balancoDoDia, inicioDoDia, instanteDaParede, somar, textoBalanco, type LancamentoBalanco } from './balancoHidrico.ts'

// São Paulo está em UTC−3 (sem horário de verão desde 2019): 07:00 local = 10:00Z
const agora = new Date('2026-09-29T15:30:00Z') // 12:30 em São Paulo

test('início do dia do balanço: 07:00 de hoje depois das 7, de ontem antes das 7', () => {
  assert.equal(inicioDoDia(agora).toISOString(), '2026-09-29T10:00:00.000Z')
  assert.equal(inicioDoDia(new Date('2026-09-29T09:59:00Z')).toISOString(), '2026-09-28T10:00:00.000Z') // 06:59 local
  assert.equal(inicioDoDia(new Date('2026-09-29T10:00:00Z')).toISOString(), '2026-09-29T10:00:00.000Z') // 07:00 em ponto
  assert.equal(inicioDoDia(agora, 7, -1).toISOString(), '2026-09-28T10:00:00.000Z')
  assert.equal(inicioDoDia(agora, 19).toISOString(), '2026-09-28T22:00:00.000Z') // antes das 19 locais
  assert.throws(() => inicioDoDia(agora, 24), /entre 0 e 23/)
})

test('somar: entradas menos saídas, cancelado não entra, uma casa decimal', () => {
  const l: LancamentoBalanco[] = [
    { tipo: 'entrada', volume_ml: 500, aferido_em: '2026-09-29T11:00:00Z' },
    { tipo: 'entrada', volume_ml: 0.1, aferido_em: '2026-09-29T11:00:00Z' },
    { tipo: 'entrada', volume_ml: 0.2, aferido_em: '2026-09-29T11:00:00Z' },
    { tipo: 'saida', volume_ml: 300, aferido_em: '2026-09-29T12:00:00Z' },
    { tipo: 'saida', volume_ml: 900, aferido_em: '2026-09-29T12:00:00Z', cancelado_em: '2026-09-29T12:05:00Z' },
  ]
  assert.deepEqual(somar(l), { entradas: 500.3, saidas: 300, balanco: 200.3, lancamentos: 4 })
  assert.deepEqual(somar([]), { entradas: 0, saidas: 0, balanco: 0, lancamentos: 0 })
})

test('dia do balanço: quatro períodos de 6 h, bordas e totais das 24 h', () => {
  const l: LancamentoBalanco[] = [
    { tipo: 'entrada', volume_ml: 1000, aferido_em: '2026-09-29T10:00:00Z' }, // 07:00 — primeiro período
    { tipo: 'saida', volume_ml: 400, aferido_em: '2026-09-29T15:59:59Z' },    // 12:59 — primeiro período
    { tipo: 'saida', volume_ml: 250, aferido_em: '2026-09-29T16:00:00Z' },    // 13:00 — segundo período
    { tipo: 'entrada', volume_ml: 120, aferido_em: '2026-09-30T09:59:00Z' },  // 06:59 do dia seguinte — último período
    { tipo: 'entrada', volume_ml: 777, aferido_em: '2026-09-30T10:00:00Z' },  // 07:00 do dia seguinte — fora
    { tipo: 'entrada', volume_ml: 555, aferido_em: '2026-09-29T09:00:00Z' },  // 06:00 — dia anterior
  ]
  const d = balancoDoDia(l, { agora })
  assert.equal(d.periodos.length, 4)
  assert.deepEqual(d.periodos.map((p) => [p.entradas, p.saidas, p.balanco]), [[1000, 400, 600], [0, 250, -250], [0, 0, 0], [120, 0, 120]])
  assert.deepEqual([d.entradas, d.saidas, d.balanco, d.lancamentos], [1120, 650, 470, 4])
  assert.equal(d.fim.toISOString(), '2026-09-30T10:00:00.000Z')

  const ontem = balancoDoDia(l, { agora, dias: -1 })
  assert.deepEqual([ontem.entradas, ontem.saidas, ontem.balanco], [555, 0, 555])

  const plantao12 = balancoDoDia(l, { agora, horasPeriodo: 12 })
  assert.deepEqual(plantao12.periodos.map((p) => p.balanco), [350, 120])
  assert.throws(() => balancoDoDia(l, { agora, horasPeriodo: 5 }), /dividir as 24 h/)
})

test('hora digitada no relógio de São Paulo vira o instante certo', () => {
  assert.equal(instanteDaParede('2026-09-29T07:00').toISOString(), '2026-09-29T10:00:00.000Z')
  assert.equal(instanteDaParede('2026-09-29T23:30').toISOString(), '2026-09-30T02:30:00.000Z')
  assert.throws(() => instanteDaParede('29/09/2026 07:00'), /formato/)
})

test('texto do balanço com sinal', () => {
  assert.equal(textoBalanco(200), '+200 mL')
  assert.equal(textoBalanco(-350.5), '−350,5 mL')
  assert.equal(textoBalanco(0), '0 mL')
})
