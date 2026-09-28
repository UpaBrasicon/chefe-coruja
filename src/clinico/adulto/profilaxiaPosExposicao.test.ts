import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import {
  HBV, TABELA5_TETANO, TRATAMENTO_TETANO, fichaHepatiteBAdulto, fichaRaivaAdulto, fichaTetanoAdulto, hbigMl,
  profilaxiaHepatiteB, profilaxiaRaiva, profilaxiaTetano, tratamentoTetanoPorPeso,
} from './profilaxiaPosExposicao.ts'

const r2 = (x: number) => Math.round(x * 100) / 100

test('profilaxias: três fichas de adulto, manual do HC, ids kebab distintos', () => {
  const fichas = [fichaTetanoAdulto, fichaRaivaAdulto, fichaHepatiteBAdulto]
  for (const f of fichas) {
    assert.equal(f.publico, 'adulto')
    assert.match(f.id, /^adulto-[a-z0-9-]+$/)
    assert.match(f.fontes[0].citacao, /Manual de Medicina de Emergência/)
    assert.equal(temReferenciaPediatrica(f), false)
  }
  assert.equal(new Set(fichas.map((f) => f.id)).size, 3)
})

test('tétano: Anexo 7 (p. 1511) — vacina × SAT/IGHAT por histórico e ferimento', () => {
  const v = (h: Parameters<typeof profilaxiaTetano>[0], f: Parameters<typeof profilaxiaTetano>[1]) => {
    const r = profilaxiaTetano(h, f)
    return [r.vacina, r.imunoglobulina]
  }
  assert.deepEqual([v('incerta', 'limpo'), v('incerta', 'outros')], [[true, false], [true, true]])
  assert.deepEqual([v('menos5', 'limpo'), v('menos5', 'outros')], [[false, false], [false, false]])
  assert.deepEqual([v('entre5e10', 'limpo'), v('entre5e10', 'outros')], [[false, false], [true, false]])
  assert.deepEqual([v('mais10', 'limpo'), v('mais10', 'outros')], [[true, false], [true, false]])
  assert.match(TABELA5_TETANO.errata, /Anexo 7/)
})

test('tétano: magnésio 40 mg/kg + 2 g/h (> 45 kg) ou 1,5 g/h (≤ 45 kg); rocurônio e vecurônio (p. 1254)', () => {
  const a = tratamentoTetanoPorPeso(70)!
  assert.deepEqual([r2(a.magnesioAtaqueG), a.magnesioManutencaoGH, a.rocuronioMg, r2(a.vecuronioPrimingMg), r2(a.vecuronioMg)], [2.8, 2, 70, 0.7, 10.5])
  assert.equal(tratamentoTetanoPorPeso(45)!.magnesioManutencaoGH, 1.5)
  assert.equal(tratamentoTetanoPorPeso(45.1)!.magnesioManutencaoGH, 2)
  assert.equal(tratamentoTetanoPorPeso(0), null)
  assert.ok(TRATAMENTO_TETANO.espasmos.errata)
})

test('raiva: fluxograma do Anexo 4 (p. 1497)', () => {
  assert.equal(profilaxiaRaiva('indireto-morcego', 'leve', 'sem-suspeita', null)!.esquema, 'sorovacinacao-4')
  assert.equal(profilaxiaRaiva('direto', 'leve', 'raivoso-silvestre-economico', null)!.esquema, 'vacina-4')
  assert.equal(profilaxiaRaiva('direto', 'grave', 'raivoso-silvestre-economico', null)!.esquema, 'sorovacinacao-4')
  const leveCom = profilaxiaRaiva('direto', 'leve', 'com-suspeita', null)!
  assert.deepEqual([leveCom.esquema, leveCom.observar10Dias], ['vacina-2', true])
  assert.deepEqual(profilaxiaRaiva('direto', 'leve', 'sem-suspeita', null), { esquema: 'nenhum', texto: 'Observar o animal 10 dias', observar10Dias: true })
  const graveCom = profilaxiaRaiva('direto', 'grave', 'com-suspeita', null)!
  assert.deepEqual([graveCom.esquema, graveCom.observar10Dias], ['sorovacinacao-4', true])
  assert.equal(profilaxiaRaiva('direto', 'grave', 'sem-suspeita', null), null) // precisa da pergunta da área
  assert.equal(profilaxiaRaiva('direto', 'grave', 'sem-suspeita', true)!.esquema, 'nenhum')
  assert.equal(profilaxiaRaiva('direto', 'grave', 'sem-suspeita', false)!.esquema, 'vacina-2')
})

test('hepatite B: Anexo 6 (p. 1504–1510) por fonte × situação do profissional', () => {
  assert.equal(profilaxiaHepatiteB('positivo-ou-risco', 'nao-vacinado').dosesHbig, 1)
  assert.equal(profilaxiaHepatiteB('desconhecido-sem-risco', 'nao-vacinado').dosesHbig, 0)
  assert.equal(profilaxiaHepatiteB('positivo-ou-risco', 'incompleto').dosesHbig, 1)
  assert.equal(profilaxiaHepatiteB('negativo', 'incompleto').dosesHbig, 0)
  for (const f of ['positivo-ou-risco', 'desconhecido-sem-risco', 'negativo'] as const) {
    assert.deepEqual(profilaxiaHepatiteB(f, 'resposta-adequada').itens, ['Nenhuma medida específica.'])
    assert.deepEqual(profilaxiaHepatiteB(f, 'infeccao-previa').itens, ['Nenhuma medida específica.'])
  }
  assert.equal(profilaxiaHepatiteB('positivo-ou-risco', 'sem-resposta-1').dosesHbig, 1)
  assert.equal(profilaxiaHepatiteB('negativo', 'sem-resposta-1').dosesHbig, 0)
  assert.equal(profilaxiaHepatiteB('positivo-ou-risco', 'sem-resposta-2').dosesHbig, 2)
  assert.equal(profilaxiaHepatiteB('desconhecido-sem-risco', 'sem-resposta-2').dosesHbig, 2)
  assert.equal(profilaxiaHepatiteB('negativo', 'sem-resposta-2').dosesHbig, 0)
  assert.equal(profilaxiaHepatiteB('positivo-ou-risco', 'resposta-desconhecida').hbigSeAntiHbsBaixo, true)
  assert.equal(profilaxiaHepatiteB('negativo', 'resposta-desconhecida').hbigSeAntiHbsBaixo, false)
  assert.match(HBV.errata, /alegria/)
})

test('hepatite B: HBIG 0,06 mL/kg IM', () => {
  assert.equal(r2(hbigMl(70)!), 4.2)
  assert.equal(hbigMl(0), null)
})
