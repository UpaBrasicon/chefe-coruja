import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  REVERSAO_DOAC, ccpUnidades, conferirPasHip, crioUnidades, escoreIch, fichaEscoreIch, fichaReversaoAnticoagulacaoAdulto,
  plasmaMl, protamina, reversaoVarfarina,
} from './reversaoAnticoagulacao.ts'

test('reversão: fichas de adulto do manual do HC, sem referência pediátrica', () => {
  for (const f of [fichaReversaoAnticoagulacaoAdulto, fichaEscoreIch]) {
    assert.equal(f.publico, 'adulto')
    assert.match(f.id, /^adulto-[a-z0-9-]+$/)
    assert.match(f.fontes[0].citacao, /Manual de Medicina de Emergência.*cap\. 39/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
})

test('varfarina: Tabela 4 por INR × sangramento (p. 1043)', () => {
  assert.match(reversaoVarfarina(3, 'nao')!.linhas[0].texto, /^Diminuir dose/)
  assert.match(reversaoVarfarina(3, 'leve')!.linhas[0].texto, /1,5 a 5 mg VO/)
  assert.match(reversaoVarfarina(7, 'nao')!.linhas[0].texto, /1,5 a 2,5 mg VO/)
  assert.match(reversaoVarfarina(9, 'leve')!.linhas[0].texto, /5 a 10 mg VO ou EV/)
  assert.match(reversaoVarfarina(10, 'nao')!.linhas[0].texto, /2,5 a 5 mg VO/)
  assert.match(reversaoVarfarina(1.5, 'grave')!.linhas[0].texto, /10 mg EV em 20 minutos/)
})

test('varfarina: bordas e buracos da Tabela 4', () => {
  const cinco = reversaoVarfarina(5, 'nao')!
  assert.equal(cinco.linhas.length, 2)
  assert.match(cinco.nota!, /se tocam/)
  assert.deepEqual(reversaoVarfarina(1.8, 'nao')!.linhas, [])
  assert.deepEqual(reversaoVarfarina(10, 'leve')!.linhas, [])
  assert.equal(reversaoVarfarina(0, 'nao'), null)
})

test('CCP 50 U/kg só com INR > 6; plasma 15–20 mL/kg; crio 1 U/10 kg (p. 1042–1043, 548)', () => {
  assert.deepEqual(ccpUnidades(70, 7), { unidades: 3500, nota: '50 U/kg (INR > 6)' })
  assert.equal(ccpUnidades(70, 6)!.unidades, null)
  assert.deepEqual(plasmaMl(70), { hip: [1050, 1400], hepatopatia: 1050 })
  assert.equal(crioUnidades(70), 7)
  assert.equal(crioUnidades(0), null)
})

test('protamina: Tabela 5 por tempo desde a heparina, teto de 50 mg (p. 1044)', () => {
  assert.deepEqual(protamina(1000, 'imediato'), { mg: [10, 15], limitadoAoTeto: false, ampolas: [0.2, 0.3] })
  assert.deepEqual(protamina(1000, '30-60min')!.mg, [5, 7.5])
  assert.deepEqual(protamina(1000, 'mais-2h')!.mg, [2.5, 3.75])
  const teto = protamina(5000, 'imediato')! // 50–75 → 50
  assert.deepEqual([teto.mg, teto.limitadoAoTeto, teto.ampolas], [[50, 50], true, [1, 1]])
  assert.equal(protamina(0, 'imediato'), null)
})

test('DOAC: sem dose de idarucizumabe no livro', () => {
  assert.ok(REVERSAO_DOAC[0].maior[0].includes('sem dose'))
})

test('HIP: PAS 150–220 → alvo 140 (p. 547)', () => {
  assert.match(conferirPasHip(180)!, /140/)
  assert.match(conferirPasHip(230)!, /não traz alvo/)
  assert.match(conferirPasHip(140)!, /fora da faixa/)
})

test('escore ICH: pontos e mortalidade da Tabela 2 (p. 543–544); 0 e 6 sem linha', () => {
  const zero = { glasgow: 0, volume: 0, ventricular: 0, infratentorial: 0, idade: 0 }
  assert.equal(escoreIch.calcular({ glasgow: 0 }), null)
  const r0 = escoreIch.calcular(zero)!
  assert.equal(r0.valor, '0')
  assert.ok(r0.alerta)
  assert.match(escoreIch.calcular({ ...zero, glasgow: 2, volume: 1 })!.nota, /72%/)
  assert.match(escoreIch.calcular({ ...zero, glasgow: 1 })!.nota, /13%/)
  const seis = escoreIch.calcular({ glasgow: 2, volume: 1, ventricular: 1, infratentorial: 1, idade: 1 })!
  assert.equal(seis.valor, '6')
  assert.match(seis.nota, /sem linha/)
})
