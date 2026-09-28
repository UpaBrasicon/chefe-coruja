import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  TERLIPRESSINA_SHR, albuminaComTerlipressina, albuminaParacentese, albuminaPbe, albuminaShr, classificarLiquidoAscitico, criteriosDispensaAlbuminaPbe,
  criteriosPeritoniteSecundaria, degrausContinua, dietaEh, estadioIcaAki, fichaAsciteShr, fichaInsuficienciaHepatica, fichaMaddrey, frascosAlbumina,
  funcaoMaddrey, gasa, kingsCollege, lactuloseMlDia, maddrey, nacCap60, pfcHepatiteMl, quedaPmn, respostaTerlipressina, terlipressinaContinua,
} from './hepatopata.ts'

test('hepatopata: fichas de adulto do manual do HC, sem referência pediátrica', () => {
  for (const f of [fichaAsciteShr, fichaInsuficienciaHepatica, fichaMaddrey]) {
    assert.equal(f.publico, 'adulto')
    assert.match(f.id, /^adulto-[a-z0-9-]+$/)
    assert.match(f.fontes[0].citacao, /Manual de Medicina de Emergência.*cap\. 5[5-9]|cap\. 60/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
})

test('GASA = albumina sérica − ascítica; 1,1 exato sem classe (p. 758)', () => {
  assert.equal(gasa(3, 1.2)!.leitura, 'aumentado')
  assert.equal(gasa(3, 2.5)!.leitura, 'diminuido')
  const l = gasa(2.6, 1.5)!
  assert.equal(l.gasa, 1.1)
  assert.equal(l.leitura, 'limite')
})

test('albumina pós-paracentese: só acima de 5 L, 8 g/L nas duas leituras (p. 766)', () => {
  assert.deepEqual(albuminaParacentese(5), { acimaDoLimite: false })
  const r = albuminaParacentese(7)
  assert.ok(r && r.acimaDoLimite)
  if (r && r.acimaDoLimite) {
    assert.equal(r.gVolumeTotal, 56)
    assert.equal(r.gSoExcedente, 16)
    assert.deepEqual(r.frascosTotal, { exato: 5.6, inteiros: 6 })
  }
})

test('frasco de albumina 20% 50 mL = 10 g (p. 794)', () => {
  assert.deepEqual(frascosAlbumina(70), { exato: 7, inteiros: 7 })
  assert.equal(frascosAlbumina(0), null)
})

test('albumina na PBE: 1,5 g/kg D1 e 1 g/kg D3 (p. 785); dispensa lista cada critério', () => {
  const r = albuminaPbe(70)!
  assert.equal(r.d1G, 105)
  assert.equal(r.d3G, 70)
  assert.deepEqual(criteriosDispensaAlbuminaPbe(0.9, 5, 80), ['creatinina < 1 mg/dL'])
})

test('albumina na SHR: 1 g/kg/dia por 2 dias, teto 100 g/dia (p. 794)', () => {
  assert.deepEqual(albuminaShr(70), { gDia: 70, limitadoA100: false, totalG: 140, frascosDia: { exato: 7, inteiros: 7 } })
  const g = albuminaShr(120)!
  assert.equal(g.gDia, 100)
  assert.equal(g.limitadoA100, true)
  const t = albuminaComTerlipressina(120)!
  assert.equal(t.d1G, 120)
  assert.equal(t.d1AcimaDe100, true)
  assert.equal(t.sugeridaGDia, 30)
})

test('terlipressina na SHR: degraus em bolus até 12 mg/dia (p. 797)', () => {
  assert.deepEqual(TERLIPRESSINA_SHR.degraus.map((d) => d.mgDia), [4, 6, 8, 12])
  assert.equal(TERLIPRESSINA_SHR.degraus[3].mgDia, TERLIPRESSINA_SHR.maxMgDia)
  assert.deepEqual(degrausContinua().map((d) => d.mgDia), [3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  assert.equal(degrausContinua()[1].diaInicio, 3)
  const c = terlipressinaContinua(3)!
  assert.equal(c.concentracaoMgMl, 0.06)
  assert.equal('mlH24h' in c, false) // o livro não dá a velocidade
})

test('resposta à terlipressina: queda ≥ 25%; completa até basal + 0,3 (p. 795)', () => {
  const r = respostaTerlipressina(4, 3, 1)!
  assert.equal(r.quedaPct, 25)
  assert.equal(r.atingiu25, true)
  assert.equal(r.completa, false)
  assert.equal(respostaTerlipressina(4, 1.3, 1)!.completa, true)
  assert.equal(respostaTerlipressina(4, 3.5)!.completa, null)
})

test('estádio ICA-AKI como escrito na Tabela 2 (p. 791)', () => {
  assert.equal(estadioIcaAki(1, 1.2)!.estadio, 0)
  assert.equal(estadioIcaAki(1, 1.3)!.estadio, 1)
  assert.equal(estadioIcaAki(1, 2)!.estadio, 1)
  assert.equal(estadioIcaAki(1, 2.1)!.estadio, 2)
  assert.equal(estadioIcaAki(1, 3)!.estadio, 2)
  assert.equal(estadioIcaAki(1, 3.1)!.estadio, 3)
  assert.equal(estadioIcaAki(3.8, 4.1)!.estadio, 3)
  assert.equal(estadioIcaAki(1, 1.1, true)!.estadio, 3)
})

test('PBE: categorias do líquido e peritonite secundária (p. 781–783)', () => {
  assert.match(classificarLiquidoAscitico(300, 'positiva')!.texto, /PBE clássica/)
  assert.match(classificarLiquidoAscitico(250, 'negativa')!.texto, /neutrocítica/)
  assert.match(classificarLiquidoAscitico(100, 'positiva')!.texto, /Bacteriascite/)
  assert.equal(criteriosPeritoniteSecundaria(300, 40, 1.5).criterioDoLivro, true)
  assert.equal(criteriosPeritoniteSecundaria(250, 40, 1.5).criterioDoLivro, false)
  assert.equal(quedaPmn(1000, 750)!.atingiu25, true)
})

test('Maddrey: 4,6 × (TP − controle) + BT; > 32 grave (p. 817)', () => {
  assert.ok(Math.abs(funcaoMaddrey(20, 13, 5)! - 37.2) < 1e-9)
  const r = maddrey.calcular({ tp: 20, controle: 13, bt: 5 })!
  assert.equal(r.valor, '37,2')
  assert.equal(r.estado, 2)
  assert.equal(maddrey.calcular({ tp: 15, controle: 13, bt: 3 })!.estado, 0)
  assert.equal(maddrey.calcular({ tp: 15 }), null)
})

test("King's College: paracetamol e outras etiologias (Tabela 5, p. 818–819)", () => {
  assert.equal(kingsCollege({ etiologia: 'paracetamol', phMenor730: true, inrMaior65: false, crMaior34: false, encefalopatia3ou4: false }).preenchido, true)
  assert.equal(kingsCollege({ etiologia: 'paracetamol', phMenor730: false, inrMaior65: true, crMaior34: true, encefalopatia3ou4: false }).preenchido, false)
  assert.equal(kingsCollege({ etiologia: 'paracetamol', phMenor730: false, inrMaior65: true, crMaior34: true, encefalopatia3ou4: true }).preenchido, true)
  const outras = { etiologia: 'outras' as const, inrMaior65: false, idadeMaior40: true, causaMedicamentosaOuIndeterminada: true, ictericiaMais7Dias: false, inrMaior35: false, btMaior175: false }
  assert.equal(kingsCollege(outras).preenchido, false)
  assert.equal(kingsCollege({ ...outras, btMaior175: true }).preenchido, true)
  assert.equal(kingsCollege({ ...outras, idadeMaior40: false, causaMedicamentosaOuIndeterminada: false, inrMaior65: true }).preenchido, true)
})

test('NAC do cap. 60: 150 mg/kg em 15 min e 50 mg/kg em 4 h; VO 140 + 70 mg/kg (p. 817–818)', () => {
  const n = nacCap60(70)!
  assert.equal(n.ev[0].mg, 10500)
  assert.equal(n.ev[0].mgH, 42000)
  assert.equal(n.ev[1].mg, 3500)
  assert.equal(n.ev[1].mgH, 875)
  assert.equal(n.vo.ataqueMg, 9800)
  assert.equal(n.vo.manutencaoMg, 4900)
})

test('encefalopatia: lactulose 60–240 mL/dia; dieta por kg; PFC 15 mL/kg (p. 805–806, 817)', () => {
  assert.deepEqual(lactuloseMlDia(), [60, 240])
  const d = dietaEh(60)!
  assert.deepEqual(d.kcal, [2100, 2400])
  assert.deepEqual(d.proteinaTabela, [72, 90])
  assert.equal(pfcHepatiteMl(70), 1050)
})
