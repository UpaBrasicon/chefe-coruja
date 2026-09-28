import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  CHOQUE_SEPTICO_REFRATARIO, CRISE_ADRENAL, DROGAS_CRISE_TIREOTOXICA, burchWartofsky, escoreMixedema, esmololMgMin, fichaBurchWartofsky, fichaCriseTireotoxica,
  fichaEscoreMixedema, fichaInsuficienciaAdrenal, fichaMixedema, leituraCortisolActh, leituraCortisolBasal, totaisCriseAdrenal, totaisTireotoxica,
  volumeCriseAdrenal,
} from './endocrino.ts'

test('endócrino: fichas de adulto do manual do HC, sem referência pediátrica', () => {
  for (const f of [fichaCriseTireotoxica, fichaMixedema, fichaInsuficienciaAdrenal, fichaBurchWartofsky, fichaEscoreMixedema]) {
    assert.equal(f.publico, 'adulto')
    assert.match(f.id, /^adulto-[a-z0-9-]+$/)
    assert.match(f.fontes[0].citacao, /Manual de Medicina de Emergência.*cap\. 7[012]/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
})

test('Burch-Wartofsky: soma e faixas; 45 exato sem classe (Tabela 4, p. 951–952)', () => {
  const zero = { temp: 0, snc: 0, gi: 0, fc: 0, ic: 0, fa: 0, precipitante: 0 }
  assert.equal(burchWartofsky.calcular({ temp: 0 }), null)
  assert.match(burchWartofsky.calcular(zero)!.nota, /improvável/)
  const iminente = burchWartofsky.calcular({ ...zero, temp: 3, fc: 2 })!
  assert.equal(iminente.valor, '25')
  assert.match(iminente.nota, /iminente/)
  const q40 = burchWartofsky.calcular({ ...zero, temp: 3, fc: 3, fa: 1 })!
  assert.equal(q40.valor, '40')
  const x45 = burchWartofsky.calcular({ ...zero, temp: 1, fc: 5, fa: 1, ic: 1 })!
  assert.equal(x45.valor, '45')
  assert.ok(x45.alerta)
  const max = burchWartofsky.calcular({ temp: 6, snc: 3, gi: 2, fc: 5, ic: 3, fa: 1, precipitante: 1 })!
  assert.equal(max.valor, '140')
})

test('crise tireotóxica: totais diários e errata do PTU (p. 953–954)', () => {
  const t = totaisTireotoxica()
  assert.deepEqual(t.ptuManutencaoMgDia, [800, 1800])
  assert.deepEqual(t.ptuEscritoMgDia, [1200, 1500])
  assert.deepEqual(t.metimazolMgDia, [80, 120])
  assert.equal(t.hidrocortisonaMgDia, 400)
  assert.ok(DROGAS_CRISE_TIREOTOXICA.find((d) => d.droga === 'Propiltiouracil')!.errata)
  const e = esmololMgMin(70)!
  assert.ok(Math.abs(e.mgMin[0] - 3.5) < 1e-9 && e.mgMin[1] === 70)
  assert.ok(Math.abs(e.mgH[0] - 210) < 1e-9 && e.mgH[1] === 4200)
})

test('escore do estado mixedematoso: soma, faixas e bradicardia < 40 sem linha (Tabela 3, p. 960–961)', () => {
  const base = { temp: 0, snc: 0, gi: 0, precipitante: 0, bradi: 0 }
  assert.match(escoreMixedema.calcular(base)!.nota, /improvável/)
  const r = escoreMixedema.calcular({ ...base, temp: 1, snc: 1, precipitante: 1, hiponatremia: true })!
  assert.equal(r.valor, '40')
  assert.match(r.nota, /sugestivo/)
  const alto = escoreMixedema.calcular({ temp: 2, snc: 4, gi: 3, precipitante: 1, bradi: 2 })!
  assert.equal(alto.valor, '100')
  assert.equal(alto.estado, 2)
  const nt = escoreMixedema.calcular({ ...base, bradi: 3 })!
  assert.ok(nt.alerta)
})

test('insuficiência adrenal: cortes do cortisol (p. 969)', () => {
  assert.match(leituraCortisolBasal(3)!.texto, /confirma/)
  assert.match(leituraCortisolBasal(19)!.texto, /ACTH/)
  assert.match(leituraCortisolBasal(19.5)!.texto, /exclui/)
  assert.match(leituraCortisolActh(18)!.texto, /sem classe/)
  assert.match(leituraCortisolActh(17)!.texto, /confirma/)
})

test('crise adrenal: hidrocortisona e fludrocortisona em µg; errata da p. 970', () => {
  assert.equal(CRISE_ADRENAL.hidrocortisonaAtaqueMg, 100)
  assert.equal(CRISE_ADRENAL.fludrocortisona.ug, 50)
  const t = totaisCriseAdrenal()
  assert.deepEqual(t.hidrocortisonaMgDia, [200, 400])
  assert.equal(t.fludrocortisonaUgDia, 150)
  assert.equal(t.hidrocortisonaChoqueMgDia, 200)
  assert.match(CHOQUE_SEPTICO_REFRATARIO.fludrocortisonaImpresso, /50 mg/)
  assert.match(CHOQUE_SEPTICO_REFRATARIO.errata, /µg/)
  assert.deepEqual(volumeCriseAdrenal(70), { figuraMl: [1400, 2100] })
})
