import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  ATB_CIRROTICO_HDA, OMEPRAZOL_HDA, VASOATIVOS_VARIZES, eritromicinaMg, fichaHemorragiaDigestiva, fichaOakland, hdbMacica, indiceDeChoque, oakland,
  omeprazolAltaDose, referenciaForrest, testeOrtostatico, vasoativosTotais24h,
} from './hemorragiaDigestiva.ts'

test('HDA/HDB: fichas de adulto do manual do HC, sem referência pediátrica', () => {
  for (const f of [fichaHemorragiaDigestiva, fichaOakland]) {
    assert.equal(f.publico, 'adulto')
    assert.match(f.id, /^adulto-[a-z0-9-]+$/)
    assert.match(f.fontes[0].citacao, /Manual de Medicina de Emergência.*cap\. 5[01]/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
})

test('omeprazol: 80 mg bolus + 8 mg/h por 72 h = 656 mg; convencional 80 mg/dia (p. 701)', () => {
  assert.equal(OMEPRAZOL_HDA.pagina, 'cap. 50, p. 701')
  const o = omeprazolAltaDose()
  assert.deepEqual(o, { bolusMg: 80, mgDiaInfusao: 192, infusaoTotalMg: 576, totalMg: 656 })
  assert.equal(OMEPRAZOL_HDA.convencionalMgDia, 80)
})

test('vasoativos no sangramento varicoso: doses e totais de 24 h (p. 703)', () => {
  assert.deepEqual(VASOATIVOS_VARIZES.terlipressina.ataqueMg, [2, 4])
  assert.equal(VASOATIVOS_VARIZES.somatostatina.diasMax, 5)
  assert.deepEqual(vasoativosTotais24h(), { terlipressinaMgDia: [6, 12], somatostatinaUgDia: [6000, 12000], octreotideoUgDia: 1200 })
})

test('eritromicina 3 mg/kg antes da EDA (p. 697)', () => {
  assert.equal(eritromicinaMg(70), 210)
  assert.equal(eritromicinaMg(0), null)
})

test('Forrest: I a IIa com terapia endoscópica e IBP em dose alta; III convencional (p. 701)', () => {
  assert.match(referenciaForrest('IIa').texto, /dose alta/)
  assert.match(referenciaForrest('IIb').texto, /deslocar o coágulo/)
  assert.match(referenciaForrest('III').texto, /80 mg/)
})

test('teste ortostático > 10 mmHg ou > 10 bpm; índice de choque > 1 (p. 696, 714)', () => {
  assert.equal(testeOrtostatico(120, 110, 80, 90)!.positivo, false)
  assert.equal(testeOrtostatico(120, 105, 80, 85)!.positivo, true)
  assert.deepEqual(indiceDeChoque(110, 100), { indice: 1.1, acimaDe1: true })
  assert.equal(indiceDeChoque(100, 100)!.acimaDe1, false)
  assert.deepEqual(hdbMacica(9, 2), { quedaHt: true, transfusao: false })
})

test('ciprofloxacina profilática com errata de unidade (p. 704 x 786)', () => {
  const c = ATB_CIRROTICO_HDA.find((x) => x.droga === 'Ciprofloxacina')!
  assert.ok(c.errata)
})

test('Oakland: soma da Tabela 6 e corte em 8 com as duas leituras (p. 714–716)', () => {
  const base = { idade: 0, sexo: 0, previa: 0, fc: 0, pas: 4, hb: 5 }
  assert.equal(oakland.calcular({ idade: 0 }), null)
  const r0 = oakland.calcular(base)!
  assert.equal(r0.valor, '0')
  assert.equal(r0.estado, 0)
  const oito = oakland.calcular({ ...base, hb: 3 })!
  assert.equal(oito.valor, '8')
  assert.ok(oito.alerta)
  const max = oakland.calcular({ idade: 2, sexo: 1, previa: 1, fc: 3, pas: 0, hb: 0 })!
  assert.equal(max.valor, '34')
  assert.equal(max.estado, 2)
})
