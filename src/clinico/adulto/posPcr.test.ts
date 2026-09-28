import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  amiodaronaTempestade, fichaPosPcrAdulto, horasResfriamentoExterno, janelasAtingidas, lerMetas, milrinonaAtaque, reaquecimento, sfFrio, velocidadeReaquecimento,
} from './posPcr.ts'

test('pós-PCR: ficha de adulto sem referência pediátrica', () => {
  assert.equal(fichaPosPcrAdulto.id, 'adulto-pos-pcr')
  assert.equal(temReferenciaPediatrica(fichaPosPcrAdulto), false)
})

test('pós-PCR: SF 0,9% a 4 °C, 20–30 mL/kg em 30 min — 70 kg = 1.400–2.100 mL a 2.800–4.200 mL/h (p. 110)', () => {
  const s = sfFrio(70)!
  assert.deepEqual(s.volumeMl, [1400, 2100])
  assert.deepEqual(s.mlH, [2800, 4200])
  assert.equal(sfFrio(0), null)
})

test('pós-PCR: resfriamento externo 0,5–1 °C/h — de 36 a 33 °C em 3–6 h (p. 110)', () => {
  assert.deepEqual(horasResfriamentoExterno(36, 33), [3, 6])
  assert.equal(horasResfriamentoExterno(33, 36), null)
})

test('pós-PCR: reaquecimento 0,25 °C/h (teto 0,5 °C/h) — 33 → 36 °C em 12 h, nunca em menos de 6 h (p. 110)', () => {
  assert.deepEqual(reaquecimento(33, 36), { graus: 3, horasNoAlvo: 12, horasMinimas: 6 })
  assert.equal(velocidadeReaquecimento(33, 34, 1)!.acimaDoTeto, true)
  assert.equal(velocidadeReaquecimento(33, 33.5, 2)!.acimaDoTeto, false)
})

test('pós-PCR: metas — SatO2 > 94, PaO2 > 300, PAM > 65 (80–100), glicemia 140–180', () => {
  const l = lerMetas({ sato2: 94, pao2: 350, pam: 70, glicemia: 200 })
  assert.deepEqual(l.map((x) => x.fora), [true, true, false, true])
  assert.match(l[2].texto, /fora da preferência/)
})

test('pós-PCR: milrinona 50 µg/kg em 10 min — 70 kg = 3.500 µg = 17,5 mL a 200 µg/mL (p. 106; Anexo 1)', () => {
  assert.deepEqual(milrinonaAtaque(70), { ug: 3500, ml: 17.5, mlH10min: 105 })
})

test('pós-PCR: amiodarona na tempestade elétrica — 1.050 mg em 24 h e saldo até 10–15 g (p. 107)', () => {
  const a = amiodaronaTempestade(1050)
  assert.equal(a.esquema.total24hMg, 1050)
  assert.deepEqual(a.saldoAteImpregnacaoMg, [8950, 13950])
  assert.equal(amiodaronaTempestade().saldoAteImpregnacaoMg, null)
})

test('pós-PCR: janelas — TC ≥ 24 h, PESS ≥ 48 h, exame ≥ 72 h, RM em 3–5 dias (p. 112)', () => {
  const at = (h: number) => janelasAtingidas(h)!.filter((j) => j.atingida).map((j) => j.janela.id)
  assert.deepEqual(at(12), [])
  assert.deepEqual(at(50), ['tc', 'pess'])
  assert.deepEqual(at(96), ['tc', 'pess', 'exame', 'rm'])
  assert.deepEqual(at(130), ['tc', 'pess', 'exame'])
})
