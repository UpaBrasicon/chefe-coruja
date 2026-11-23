// node --experimental-strip-types --test src/clinico/pediatria/ampolas.test.ts
// Dose em mL pela ampola escolhida (lote 0; decisões ML1–ML11 do RT, 19/11/2026).
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { AMPOLAS, ITENS_COM_AMPOLA, ampolasDoItem, doseNaUnidadeDaAmpola, fichaAmpolas, problemasDasAmpolas, volumeAbaixoDe01, volumeDaAmpola, type Apresentacao } from './ampolas.ts'
import { BOLUS } from './bolus.ts'
import { DROGAS_RCP } from './rcp.ts'
import { DOSES_SRI } from './viaAerea.ts'
import { DOSES_DA_FITA } from './dosesDaFita.ts'
import { DOSES_CRISE } from './criseEpileptica.ts'
import { DOSES_ASMA } from './asma.ts'
import { DOSES_ANAFILAXIA } from './anafilaxia.ts'
import { DOMICILIAR, DOSES_SBP_2024, ESPECIAIS, HOSPITALAR } from './pneumoniaPed.ts'
import { DOSES_ITU_ORAL, DOSES_ITU_PARENTERAL } from './ituPed.ts'
import { DOSES_CRISE_ALGICA } from './falciformePed.ts'
import { DOSES_IRA, DOSES_TABELA8 } from './injuriaRenalPed.ts'
import { DOSES_HEMOSTASIA, DOSES_PTI } from './hemostasiaTromboPed.ts'
import { DOSES_COMPRESSIVAS, DOSES_HEMATO_ONCO, DOSES_NEUTROPENIA, DOSES_SLT } from './oncologiaPed.ts'
import { DOSES_NEFRITICA, DOSES_NEFROTICA, DOSES_SHU } from './glomerulopatiasPed.ts'
import { DOSES_CAPITULO_INTOX } from './intoxicacaoPed.ts'
import { DOSES_COMA } from './comaHicPed.ts'
import { DOSES_HDA } from './digestivoHepaticoPed.ts'
import { DOSES_PELE, DOSES_SCT } from './choqueToxicoPartesMolesPed.ts'
import { DOSES_IC_ORAIS } from './insuficienciaCardiacaPed.ts'
import { CLORETO_CA_TABELA7, FOSFORO, HIPERCALCEMIA, HIPERCALEMIA, HIPERMAGNESEMIA, HIPOCALCEMIA, HIPOMAGNESEMIA, K_IV, K_VO, calcularDose } from './eletrolitosPed.ts'
import { calcularDoseLivro } from './fonteP4.ts'
import { DOSES_MENINGITE, DOSES_PROFILAXIA } from './meningitePed.ts'
import { DROGAS_PCR } from '../adulto/pcr.ts'

// dados de teste, não são concentrações para a tela
const A3: Apresentacao = { id: 'x-3', rotulo: 'X 3 mg/mL', porMl: 3, fonte: 'teste' }
const SAL: Apresentacao = { id: 'ca-sal', rotulo: 'sal 100 mg/mL', porMl: 100, base: 'sal', fonte: 'teste' }
const DIL: Apresentacao = { id: 'd-50', rotulo: 'D 50 mg/mL', porMl: 50, diluir: true, fonte: 'teste' }

test('sem ampola escolhida não há mL (ML: nenhuma vem marcada)', () => {
  assert.equal(volumeDaAmpola([1, 2], undefined), null)
})

test('volume = dose ÷ concentração da ampola escolhida', () => {
  assert.deepEqual(volumeDaAmpola([1.5, 3], A3), { ml: [0.5, 1], aspirar: false })
})

test('dose e ampola em bases diferentes não dão mL (ML6)', () => {
  assert.equal(volumeDaAmpola([90, 90], SAL, 'elemento'), null)
  assert.deepEqual(volumeDaAmpola([200, 200], SAL, 'sal'), { ml: [2, 2], aspirar: false })
})

test('ampola que pede diluição marca o volume como "a aspirar" (ML5)', () => {
  assert.equal(volumeDaAmpola([100, 100], DIL)?.aspirar, true)
})

test('dose inválida não dá mL', () => {
  assert.equal(volumeDaAmpola([NaN, 1], A3), null)
  assert.equal(volumeDaAmpola([1, 1], { ...A3, porMl: 0 }), null)
})

test('a guarda acusa lista local, insulina do frasco, concentração repetida e base faltando', () => {
  const p = problemasDasAmpolas(
    {
      x: [A3, { ...A3, id: 'x-3b' }],
      insulina: [{ id: 'i', rotulo: 'frasco', porMl: 100, fonte: 'bula' }],
      y: [{ id: 'y', rotulo: 'y', porMl: 6, fonte: 'data/padronizacao.csv' }],
      calcio: [SAL, { id: 'ca-el', rotulo: 'elemento 9 mg/mL', porMl: 9, base: 'elemento', fonte: 'teste' }],
    },
    { 'rcp:calcio': { principio: 'calcio' }, 'rcp:z': { principio: 'z' }, 'Fora:padrao': { principio: 'x' } },
  )
  assert.ok(p.some((x) => /concentração repetida/.test(x)))
  assert.ok(p.some((x) => /insulina do frasco/.test(x)))
  assert.ok(p.some((x) => /lista local/.test(x)))
  assert.ok(p.some((x) => /precisa dizer a base/.test(x)))
  assert.ok(p.some((x) => /princípio z sem ampola/.test(x)))
  assert.ok(p.some((x) => /fora do padrão/.test(x)))
})

test('o cadastro real não tem problema e toda chave aponta para um item existente', () => {
  assert.deepEqual(problemasDasAmpolas(), [])
  const ids: Record<string, Set<string>> = {
    bolus: new Set(BOLUS.map((b) => b.id)), rcp: new Set(DROGAS_RCP.map((d) => d.id)), sri: new Set(DOSES_SRI.map((d) => d.id)),
    fita: new Set(DOSES_DA_FITA.map((d) => d.id)),
    crise: new Set(DOSES_CRISE.map((d) => d.id)),
    asma: new Set(DOSES_ASMA.map((d) => d.id)), anafilaxia: new Set(DOSES_ANAFILAXIA.map((d) => d.id)),
    pneumonia: new Set([...DOSES_SBP_2024, ...ESPECIAIS.flatMap((e) => e.doses),
      ...Object.values(DOMICILIAR).flatMap((t) => [...t.inicial, ...t.falha]), ...Object.values(HOSPITALAR).flatMap((t) => [...t.inicial, ...t.falha])].map((d) => d.id)),
    itu: new Set([...DOSES_ITU_ORAL, ...DOSES_ITU_PARENTERAL].map((d) => d.id)),
    falciforme: new Set(DOSES_CRISE_ALGICA.map((d) => d.id)),
    renal: new Set([...DOSES_IRA, ...DOSES_TABELA8].map((d) => d.id)),
    hemostasia: new Set([...DOSES_HEMOSTASIA, ...DOSES_PTI].map((d) => d.id)),
    oncologia: new Set([...DOSES_SLT, ...DOSES_HEMATO_ONCO, ...DOSES_NEUTROPENIA, ...DOSES_COMPRESSIVAS].map((d) => d.id)),
    eletrolitos: new Set([...HIPERCALEMIA, CLORETO_CA_TABELA7, ...HIPOCALCEMIA, ...HIPERCALCEMIA, ...Object.values(HIPOMAGNESEMIA), ...HIPERMAGNESEMIA, ...FOSFORO, K_IV, K_VO].map((d) => d.id)),
    glomerulo: new Set([...DOSES_NEFROTICA, ...DOSES_NEFRITICA, ...DOSES_SHU].map((d) => d.id)),
    intoxicacao: new Set(DOSES_CAPITULO_INTOX.map((d) => d.id)), coma: new Set(DOSES_COMA.map((d) => d.id)),
    hda: new Set(DOSES_HDA.map((d) => d.id)), pele: new Set([...DOSES_SCT, ...DOSES_PELE].map((d) => d.id)),
    meningite: new Set([...DOSES_MENINGITE, ...DOSES_PROFILAXIA].map((d) => d.id)),
    // adulto: a PCR tem lista de itens; bradicardia e taquiarritmias são blocos nomeados da tela
    'adulto-pcr': new Set(DROGAS_PCR.map((d) => d.id)),
    'adulto-bradi': new Set(['atropina']),
    'adulto-taqui': new Set(['adenosina', 'amiodarona', 'lidocaina', 'magnesio']),
  }
  for (const chave of Object.keys(ITENS_COM_AMPOLA)) {
    const [lista, id] = chave.split(':')
    assert.ok(ids[lista]?.has(id), `${chave} não existe`)
  }
})

test('lote 1: concentrações das bulas aprovadas pelo RT', () => {
  assert.deepEqual(AMPOLAS.adenosina.map((a) => a.porMl), [3])
  assert.deepEqual(AMPOLAS.amiodarona.map((a) => [a.porMl, a.diluir]), [[50, true]])
  assert.deepEqual(AMPOLAS.lidocaina.map((a) => a.porMl), [10, 20])
  assert.deepEqual(AMPOLAS.calcio.map((a) => [a.porMl, a.base]), [[9, 'elemento'], [27, 'elemento']])
  assert.equal(fichaAmpolas.versao, '2026-11-23.3')
  assert.equal(fichaAmpolas.publico, 'pediatrico')
})

test('lote 1: lidocaína traqueal fica sem mL (decisão do RT); a atropina ganhou mL pela CMED no lote 3', () => {
  assert.deepEqual(ampolasDoItem('rcp:lidocaina-et'), [])
  assert.deepEqual(ampolasDoItem('rcp:atropina').map((a) => a.porMl), [0.25, 0.5])
})

test('guia de parada: ampola só onde a fita não traz mL (sem dois volumes na mesma dose)', () => {
  for (const chave of Object.keys(ITENS_COM_AMPOLA).filter((c) => c.startsWith('fita:'))) {
    const d = DOSES_DA_FITA.find((x) => x.id === chave.slice(5))!
    assert.equal(d.porMl, undefined, `${chave} já tem mL`)
  }
  for (const chave of Object.keys(ITENS_COM_AMPOLA).filter((c) => c.startsWith('bolus:'))) {
    assert.equal(BOLUS.find((x) => x.id === chave.slice(6))!.porMl, undefined, `${chave} já tem mL`)
  }
  for (const chave of Object.keys(ITENS_COM_AMPOLA).filter((c) => c.startsWith('rcp:'))) {
    const d = DROGAS_RCP.find((x) => x.id === chave.slice(4))!
    assert.ok(d.porMl === undefined && d.mlPorKg === undefined, `${chave} já tem mL`)
  }
  for (const [prefixo, lista] of [['asma:', DOSES_ASMA], ['anafilaxia:', DOSES_ANAFILAXIA]] as const) {
    for (const chave of Object.keys(ITENS_COM_AMPOLA).filter((c) => c.startsWith(prefixo))) {
      const d = lista.find((x) => x.id === chave.slice(prefixo.length))!
      assert.ok(d.porMl === undefined && d.mlPorKg === undefined, `${chave} já tem mL`)
    }
  }
})

test('lote 1: contas de exemplo', () => {
  // adenosina 0,1 mg/kg em 15 kg = 1,5 mg = 0,5 mL da ampola de 3 mg/mL
  assert.deepEqual(volumeDaAmpola([1.5, 1.5], ampolasDoItem('rcp:adenosina-1')[0])?.ml, [0.5, 0.5])
  // amiodarona 5 mg/kg em 10 kg = 50 mg = 1 mL, a aspirar e diluir
  assert.deepEqual(volumeDaAmpola([50, 50], ampolasDoItem('bolus:amiodarona-fvtv')[0]), { ml: [1, 1], aspirar: true })
  // cálcio elementar 5 a 7 mg/kg em 10 kg = 50 a 70 mg: gluconato 10% (9 mg/mL) ≈ 5,6 a 7,8 mL
  const gl = volumeDaAmpola([50, 70], ampolasDoItem('rcp:calcio')[0], 'elemento')!
  assert.ok(Math.abs(gl.ml[0] - 50 / 9) < 1e-9 && Math.abs(gl.ml[1] - 70 / 9) < 1e-9)
})

test('lote 2: concentrações das bulas aprovadas pelo RT (20/11/2026)', () => {
  const c = (p: string) => AMPOLAS[p].map((a) => a.porMl)
  assert.deepEqual(c('fentanila'), [50])
  assert.deepEqual(c('midazolam'), [1, 5])
  assert.deepEqual(c('escetamina'), [50])
  assert.deepEqual(c('etomidato'), [2])
  assert.deepEqual(c('propofol'), [10, 20])
  assert.deepEqual(c('rocuronio'), [10])
  assert.deepEqual(AMPOLAS.dexmedetomidina.map((a) => [a.porMl, a.diluir]), [[100, true]])
  assert.deepEqual(c('naloxona'), [0.4])
  assert.deepEqual(c('naloxona-ug'), [400])
})

test('lote 2: succinilcolina (pó) e dexmedetomidina em ataque (infusão) ficam sem mL', () => {
  for (const chave of ['sri:succinilcolina-menor10', 'sri:succinilcolina-maior10', 'fita:fita-succinilcolina-lactente', 'bolus:dexmedetomidina-ataque']) {
    assert.deepEqual(ampolasDoItem(chave), [], chave)
  }
  // a morfina ficou sem mL no lote 2 e entrou no lote 5 (L5-3)
})

test('lote 2: contas de exemplo', () => {
  // fentanila 2 µg/kg em 15 kg = 30 µg = 0,6 mL de 50 µg/mL
  assert.deepEqual(volumeDaAmpola([30, 30], ampolasDoItem('sri:fentanil')[0])?.ml, [0.6, 0.6])
  // midazolam 3 mg: 3 mL de 1 mg/mL ou 0,6 mL de 5 mg/mL (o médico escolhe)
  const mid = ampolasDoItem('bolus:midazolam-iv-maior5')
  assert.deepEqual(mid.map((a) => volumeDaAmpola([3, 3], a)?.ml[0]), [3, 0.6])
  // naloxona dose baixa 20 µg = 0,05 mL de 400 µg/mL; dose de intoxicação 1,5 mg = 3,75 mL de 0,4 mg/mL
  assert.deepEqual(volumeDaAmpola([20, 20], ampolasDoItem('bolus:dose-baixa-naloxona')[0])?.ml, [0.05, 0.05])
  assert.deepEqual(volumeDaAmpola([1.5, 1.5], ampolasDoItem('bolus:naloxona-menor')[0])?.ml, [3.75, 3.75])
})

test('lote 3 (crise) e CMED: concentrações aprovadas pelo RT (20/11/2026)', () => {
  assert.deepEqual(AMPOLAS.diazepam.map((a) => [a.porMl, a.diluir ?? false]), [[5, false]])
  assert.deepEqual(AMPOLAS.fenitoina.map((a) => [a.porMl, a.diluir]), [[50, true]])
  assert.deepEqual(AMPOLAS.fenobarbital.map((a) => a.porMl), [100])
  assert.deepEqual(AMPOLAS.atropina.map((a) => a.porMl), [0.25, 0.5])
  // sem injetável à venda: levetiracetam, valproato e lorazepam; diazepam retal fica fora (VR)
  for (const c of ['crise:levetiracetam', 'crise:valproato', 'crise:lorazepam', 'crise:diazepam-vr']) assert.deepEqual(ampolasDoItem(c), [], c)
  // diazepam 0,3 mg/kg em 10 kg = 3 mg = 0,6 mL de 5 mg/mL; fenitoína 20 mg/kg em 10 kg = 200 mg = 4 mL a aspirar e diluir
  assert.deepEqual(volumeDaAmpola([3, 3], ampolasDoItem('crise:diazepam-iv')[0])?.ml, [0.6, 0.6])
  assert.deepEqual(volumeDaAmpola([200, 200], ampolasDoItem('crise:fenitoina')[0]), { ml: [4, 4], aspirar: true })
})

test('lote 4 (L4-3 do RT, 20/11/2026): magnésio 10% e 50% pela CMED, no sal, nenhuma marcada', () => {
  assert.deepEqual(AMPOLAS.magnesio.map((a) => [a.porMl, a.base]), [[100, 'sal'], [500, 'sal']])
  for (const c of ['asma:magnesio-tabela', 'asma:magnesio-texto', 'bolus:magnesio-asma', 'bolus:magnesio-torsades', 'fita:fita-magnesio-asma', 'fita:fita-magnesio-torsades']) {
    assert.deepEqual(ampolasDoItem(c).map((a) => a.id), ['magnesio-100', 'magnesio-500'], c)
  }
  // a RCP do livro (Tabela 2) nomeia a 50%: fica como está
  assert.deepEqual(ampolasDoItem('rcp:magnesio'), [])
  // asma 50 mg/kg em 20 kg = 1.000 mg = 10 mL da 10% ou 2 mL da 50%
  const [mg10, mg50] = AMPOLAS.magnesio
  assert.deepEqual(volumeDaAmpola([1000, 1000], mg10, 'sal')?.ml, [10, 10])
  assert.deepEqual(volumeDaAmpola([1000, 1000], mg50, 'sal')?.ml, [2, 2])
  // sem ampola escolhida, nada de mL; dose em elemento não usa a ampola do sal (ML6)
  assert.equal(volumeDaAmpola([1000, 1000], undefined), null)
  assert.equal(volumeDaAmpola([100, 100], mg50, 'elemento'), null)
})

test('lote 8: dexametasona VO, IM ou IV (asma e crupe) com a ampola e o aviso de via mista', () => {
  for (const c of ['asma:dexametasona', 'bolus:dexametasona-crupe', 'fita:fita-dexametasona-crupe']) {
    assert.deepEqual(ampolasDoItem(c).map((a) => a.porMl), [2, 4], c)
    assert.equal(ITENS_COM_AMPOLA[c].viaMista, true, c)
  }
})

test('L4-5: aviso de volume abaixo de 0,1 mL', () => {
  assert.equal(volumeAbaixoDe01([0.03, 0.06]), true)
  assert.equal(volumeAbaixoDe01([0.05, 0.2]), true)
  assert.equal(volumeAbaixoDe01([0.1, 0.1]), false)
  assert.equal(volumeAbaixoDe01([0.3 / 3, 1]), false) // 0,1 com resto de ponto flutuante
  assert.equal(volumeAbaixoDe01([0, 0]), false)
  assert.equal(volumeAbaixoDe01(null), false)
  assert.equal(volumeAbaixoDe01(undefined), false)
})

test('lote 5 (L5-1 a L5-6 do RT, 20/11/2026): concentrações da CMED, nenhuma marcada', () => {
  const ids = (c: string) => ampolasDoItem(c).map((a) => [a.id, a.porMl])
  assert.deepEqual(ids('bolus:flumazenil'), [['flumazenil-0-1', 0.1]])
  assert.deepEqual(ids('bolus:hidralazina'), [['hidralazina-20', 20]])
  assert.deepEqual(ids('bolus:terbutalina-ataque'), [['terbutalina-500', 500]]) // µg/mL
  assert.deepEqual(ids('fita:fita-ondansetrona-iv'), [['ondansetrona-2', 2]])
  assert.deepEqual(ids('bolus:octreotida-ataque'), [['octreotida-50', 50], ['octreotida-100', 100], ['octreotida-500', 500]]) // µg/mL (L5-4)
  for (const c of ['bolus:neostigmina-0a2', 'bolus:neostigmina-maior2']) assert.deepEqual(ids(c), [['neostigmina-0-5', 0.5]], c) // L5-6
  // L5-3: 1 e 10 mg/mL; 0,1 e 0,2 mg/mL entraram no lote 7 (a bula do Dimorf permite IV)
  for (const c of ['bolus:morfina-menor6m', 'bolus:morfina-maior6m', 'fita:fita-morfina-iv']) assert.deepEqual(ids(c), [['morfina-0-1', 0.1], ['morfina-0-2', 0.2], ['morfina-1', 1], ['morfina-10', 10]], c)
  // terbutalina 10 µg/kg em 20 kg = 200 µg = 0,4 mL
  assert.deepEqual(volumeDaAmpola([200, 200], AMPOLAS.terbutalina[0])?.ml, [0.4, 0.4])
  // morfina 0,1 mg/kg em 10 kg = 1 mg: 1 mL da 1 mg/mL ou 0,1 mL da 10 mg/mL
  const morfina = (id: string) => AMPOLAS.morfina.find((a) => a.id === id)
  assert.deepEqual(volumeDaAmpola([1, 1], morfina('morfina-1'))?.ml, [1, 1])
  assert.deepEqual(volumeDaAmpola([1, 1], morfina('morfina-10'))?.ml, [0.1, 0.1])
})

test('lote 5, L5-5 e ML7: insulina só pelo preparo de 0,1 UI/mL do livro, nunca pelo frasco', () => {
  const [prep] = ampolasDoItem('bolus:polarizante-insulina')
  assert.equal(prep.porMl, 0.1)
  assert.match(prep.rotulo, /50 UI em 500 mL/)
  assert.ok(Object.values(AMPOLAS).flat().every((a) => !/insulina/i.test(a.id) || a.porMl < 100))
  // 0,1 UI/kg em 20 kg = 2 UI = 20 mL do preparo (1 mL/kg)
  assert.deepEqual(volumeDaAmpola([2, 2], prep)?.ml, [20, 20])
})

test('lote 5: vitamina K IV (bulas contraindicam a veia) e pralidoxima ficam sem mL (L5-2)', () => {
  for (const c of ['bolus:vitamina-k', 'bolus:pralidoxima']) {
    assert.deepEqual(ampolasDoItem(c), [], c)
  }
})

test('lote 6a (L6-1 e L6-2 do RT, 20/11/2026): soluções prontas, dipirona e morfina da crise álgica', () => {
  const ids = (c: string) => ampolasDoItem(c).map((a) => [a.id, a.porMl, a.pronta ?? false])
  assert.deepEqual(ids('pneumonia:sbp-levo-menor5'), [['levofloxacino-5', 5, true]])
  assert.deepEqual(ids('pneumonia:sbp-levo-maior5'), [['levofloxacino-5', 5, true]])
  assert.deepEqual(ids('pneumonia:sbp-metro'), [['metronidazol-5', 5, true]])
  assert.deepEqual(ids('pneumonia:sbp-linez'), [['linezolida-2', 2, true]])
  assert.deepEqual(ids('itu:cipro-iv'), [['ciprofloxacino-2', 2, true]])
  assert.deepEqual(ids('falciforme:dipirona'), [['dipirona-500', 500, false]])
  for (const c of ['falciforme:morfina-figura', 'falciforme:morfina-texto']) assert.deepEqual(ampolasDoItem(c).map((a) => a.porMl), [0.1, 0.2, 1, 10], c)
  // solução pronta nunca é "aspirar e diluir"
  assert.ok(Object.values(AMPOLAS).flat().every((a) => !(a.pronta && a.diluir)))
  // L6-1: o mL sai da dose por tomada. Metronidazol 30 mg/kg/dia em 4 doses, 20 kg = 150 mg/dose = 30 mL
  const metro = DOSES_SBP_2024.find((d) => d.id === 'sbp-metro')!
  const r = calcularDoseLivro(metro, 20)!
  assert.deepEqual(r.porDose, [150, 150])
  assert.deepEqual(volumeDaAmpola(r.porDose!, AMPOLAS.metronidazol[0])?.ml, [30, 30])
  // aminoglicosídeos da ITU são IV ou IM (lote 7): o aviso de diluir só vale na veia
  assert.deepEqual(ampolasDoItem('itu:amicacina'), [])
  assert.deepEqual(ampolasDoItem('itu:gentamicina'), [])
})

test('lote 6b (renal, hemostasia e oncologia, 20/11/2026): concentrações da CMED e do livro, nenhuma marcada', () => {
  const ids = (c: string) => ampolasDoItem(c).map((a) => [a.id, a.porMl])
  for (const c of ['renal:furosemida', 'renal:furo-k', 'oncologia:furo']) assert.deepEqual(ids(c), [['furosemida-10', 10]], c)
  assert.deepEqual(ids('hemostasia:atx-iv'), [['acido-tranexamico-50', 50]])
  assert.deepEqual(ids('oncologia:enoxa-svcs'), [['enoxaparina-100', 100]])
  assert.equal(AMPOLAS.enoxaparina[0].seringa, true)
  assert.deepEqual(ids('oncologia:manitol'), [['manitol-20', 0.2]])
  assert.equal(AMPOLAS.manitol[0].pronta, true)
  for (const c of ['renal:insulina', 'oncologia:insulina']) assert.deepEqual(ids(c), [['insulina-0-1', 0.1]], c)
  for (const c of ['oncologia:midaz-iv', 'oncologia:midaz-im', 'oncologia:midaz-in']) assert.deepEqual(ampolasDoItem(c).map((a) => a.porMl), [1, 5], c)
  for (const c of ['oncologia:fenitoina-ataque', 'oncologia:fenitoina-man']) assert.deepEqual(ids(c), [['fenitoina-50', 50]], c)
  assert.deepEqual(ids('oncologia:linezolida'), [['linezolida-2', 2]])
  assert.deepEqual(ids('oncologia:metronidazol'), [['metronidazol-5', 5]])
  assert.deepEqual(ids('oncologia:cipro-iv'), [['ciprofloxacino-2', 2]])
  assert.deepEqual(ids('oncologia:levo'), [['levofloxacino-5', 5]])
})

test('lote 6b: item sem via escrita, VO, por bula ou por decisão própria fica sem mL', () => {
  // cálcio e bicarbonato da injúria renal e o gluconato da oncologia ganharam mL no lote 6c
  for (const c of ['hemostasia:atx-vo', 'renal:beta2',
    'renal:mg', 'renal:nac-contraste', 'renal:sorcal', 'oncologia:bic3',
    'oncologia:cipro-vo', 'oncologia:nacl3-bolo']) {
    assert.deepEqual(ampolasDoItem(c), [], c)
  }
})

test('lote 6b: contas de exemplo, só da dose por tomada (L6-1)', () => {
  const doItem = (lista: { id: string }[], id: string) => lista.find((d) => d.id === id) as (typeof DOSES_IRA)[number]
  const furo = calcularDoseLivro(doItem(DOSES_IRA, 'furosemida'), 20)!
  assert.deepEqual(volumeDaAmpola(furo.porDose!, AMPOLAS.furosemida[0])?.ml, [2, 3])
  const atx = calcularDoseLivro(doItem(DOSES_HEMOSTASIA, 'atx-iv'), 20)!
  assert.deepEqual(volumeDaAmpola(atx.porDose!, AMPOLAS['acido-tranexamico'][0])?.ml, [4, 4])
  const manitol = calcularDoseLivro(doItem(DOSES_COMPRESSIVAS, 'manitol'), 20)!
  assert.deepEqual(volumeDaAmpola(manitol.porDose!, AMPOLAS.manitol[0])?.ml.map((x) => Math.round(x * 1e6) / 1e6), [25, 100])
  // fenitoína de manutenção: 4 a 8 mg/kg/dia em 2 doses, 20 kg = 40 a 80 mg por dose = 0,8 a 1,6 mL a aspirar
  const fen = calcularDoseLivro(doItem(DOSES_COMPRESSIVAS, 'fenitoina-man'), 20)!
  assert.deepEqual(volumeDaAmpola(fen.porDose!, AMPOLAS.fenitoina[0]), { ml: [0.8, 1.6], aspirar: true })
  // enoxaparina no lactente de 3 kg: 3 a 4,5 mg = 0,03 a 0,045 mL, com o aviso de volume pequeno (L4-5)
  const enoxa = calcularDoseLivro(doItem(DOSES_COMPRESSIVAS, 'enoxa-svcs'), 3)!
  const v = volumeDaAmpola(enoxa.porDose!, AMPOLAS.enoxaparina[0])!
  assert.deepEqual(v.ml.map((x) => Math.round(x * 1e6) / 1e6), [0.03, 0.045])
  assert.equal(volumeAbaixoDe01(v.ml), true)
  // insulina da hipercalemia (oncologia): 0,1 UI/kg, máx. 10 UI = 100 mL do preparo de 0,1 UI/mL
  const ins = calcularDoseLivro(doItem(DOSES_SLT, 'insulina'), 150)!
  assert.deepEqual(volumeDaAmpola(ins.porDose!, AMPOLAS['insulina-preparo'][0])?.ml.map((x) => Math.round(x * 1e6) / 1e6), [100, 100])
})

test('lote 6b: seringa preenchida não pode ser solução pronta nem "aspirar e diluir"', () => {
  const p = problemasDasAmpolas({ x: [{ id: 'x-1', rotulo: 'x', porMl: 1, seringa: true, pronta: true, fonte: 'teste' }] }, {})
  assert.ok(p.some((x) => /seringa preenchida/.test(x)))
  assert.ok(Object.values(AMPOLAS).flat().every((a) => !(a.seringa && (a.pronta || a.diluir))))
})

test('lote 6c (eletrólitos; L6-6 e L6-7 do RT, 20/11/2026): bicarbonato e cálcio no sal, nenhum marcado', () => {
  const ids = (c: string) => ampolasDoItem(c).map((a) => [a.id, Math.round(a.porMl * 1000) / 1000])
  for (const c of ['eletrolitos:bic', 'renal:bic']) assert.deepEqual(ids(c), [['bicarbonato-8-4', 1], ['bicarbonato-10', 1.19]], c)
  for (const c of ['eletrolitos:cloreto-ca-mg', 'renal:cacl']) assert.deepEqual(ids(c), [['cloreto-sal-10', 100]], c)
  for (const c of ['eletrolitos:gluconato-ca-mg', 'renal:gluconato', 'renal:gluconato-assint', 'oncologia:gluconato']) assert.deepEqual(ids(c), [['gluconato-sal-10', 100]], c)
  // dose em sal nunca vê a concentração elementar (ML6), e o cloreto nunca vê o gluconato
  for (const c of Object.keys(ITENS_COM_AMPOLA).filter((k) => ITENS_COM_AMPOLA[k].base === 'sal')) {
    assert.ok(ampolasDoItem(c).every((a) => a.base === 'sal'), c)
  }
  assert.deepEqual(ampolasDoItem('rcp:calcio').map((a) => a.base), ['elemento', 'elemento'])
  // magnésio grave: 10% e 50% no sal, sem o 10% fixo
  assert.deepEqual(ids('eletrolitos:mg-grave'), [['magnesio-100', 100], ['magnesio-500', 500]])
  assert.deepEqual(ids('eletrolitos:furosemida-k'), [['furosemida-10', 10]])
  // revisão de 23/11/2026: furosemida-ca não escreve a via (item sem via fica sem mL)
  assert.deepEqual(ids('eletrolitos:furosemida-ca'), [])
  // magnésio 50%: o livro dá concentração máxima de 20% (p. 908), então a ampola pede diluição
  assert.equal(ampolasDoItem('eletrolitos:mg-grave').find((a) => a.id === 'magnesio-500')?.diluir, true)
  assert.deepEqual(ids('eletrolitos:insulina'), [['insulina-0-1', 0.1]])
})

test('lote 6c: glicose, 3%, magnésio elementar, dose por dia e itens já em mL ficam sem a escolha', () => {
  for (const c of ['oncologia:bic3', 'renal:mg', 'eletrolitos:mg-moderada', 'eletrolitos:mg-leve',
    'eletrolitos:k-iv', 'eletrolitos:p-ev', 'eletrolitos:gluconato-ca', 'eletrolitos:cloreto-ca', 'eletrolitos:cloreto-ca-tab7', 'eletrolitos:gluconato-rapido',
    'eletrolitos:hidrocortisona-ca', 'eletrolitos:calcitonina']) {
    assert.deepEqual(ampolasDoItem(c), [], c)
  }
})

test('lote 6c: contas de exemplo', () => {
  // bicarbonato 1 a 2 mEq/kg, 10 kg: 10 a 20 mL do 8,4%; 8,4 a 16,8 mL do 10%
  const bic = calcularDose(HIPERCALEMIA.find((d) => d.id === 'bic')!, 10)!
  assert.deepEqual(volumeDaAmpola(bic.faixa, AMPOLAS.bicarbonato[0])?.ml, [10, 20])
  assert.deepEqual(volumeDaAmpola(bic.faixa, AMPOLAS.bicarbonato[1])?.ml.map((x) => Math.round(x * 100) / 100), [8.4, 16.8])
  // cloreto de cálcio 20 mg/kg do sal, 10 kg = 200 mg = 2 mL (o livro: 0,2 mL/kg, p. 549)
  const cacl = calcularDose(HIPERMAGNESEMIA.find((d) => d.id === 'cloreto-ca-mg')!, 10)!
  assert.deepEqual(volumeDaAmpola(cacl.faixa, AMPOLAS['cloreto-de-calcio'][0], 'sal')?.ml, [2, 2])
  // gluconato 100 mg/kg, máx. 3 g: 50 kg = 30 mL
  const glu = calcularDose(HIPERMAGNESEMIA.find((d) => d.id === 'gluconato-ca-mg')!, 50)!
  assert.deepEqual(volumeDaAmpola(glu.faixa, AMPOLAS['gluconato-de-calcio'][0], 'sal')?.ml, [30, 30])
  // magnésio grave 25 a 50 mg/kg do sal, 20 kg = 500 a 1.000 mg: 5 a 10 mL do 10% e 1 a 2 mL do 50%
  const mg = calcularDose(HIPOMAGNESEMIA.grave, 20)!
  assert.deepEqual(volumeDaAmpola(mg.faixa, AMPOLAS.magnesio[0], 'sal')?.ml, [5, 10])
  assert.deepEqual(volumeDaAmpola(mg.faixa, AMPOLAS.magnesio[1], 'sal')?.ml, [1, 2])
})

test('lote 6d: capítulos com princípio já cadastrado, sem princípio novo', () => {
  const ids = (c: string) => ampolasDoItem(c).map((a) => a.id)
  for (const c of ['glomerulo:furo-albumina', 'glomerulo:furo-hiper', 'glomerulo:furo-shu', 'intoxicacao:furosemida-iv']) assert.deepEqual(ids(c), ['furosemida-10'], c)
  assert.deepEqual(ampolasDoItem('intoxicacao:atropina-cap').map((a) => a.porMl), [0.25, 0.5])
  assert.deepEqual(ampolasDoItem('coma:midazolam').map((a) => a.porMl), [1, 5])
  assert.deepEqual(ampolasDoItem('hda:octreotida-bolus').map((a) => a.porMl), [50, 100, 500])
  assert.deepEqual(ids('pele:linezolida'), ['linezolida-2'])
  assert.deepEqual(ids('pele:metronidazol'), ['metronidazol-5'])
  // sem mL: VO, dose por dia sem número de doses, bula pendente e a lista oral da IC
  for (const c of ['glomerulo:furo-gnpe', 'intoxicacao:furosemida-vo', 'intoxicacao:pralidoxima-im', 'pele:clindamicina', 'pele:doxi',
    ...DOSES_IC_ORAIS.map((d) => `ic:${d.id}`)]) {
    assert.deepEqual(ampolasDoItem(c), [], c)
  }
  // furosemida da SHU 2 a 5 mg/kg, 10 kg = 20 a 50 mg = 2 a 5 mL
  const r = calcularDoseLivro(DOSES_SHU.find((d) => d.id === 'furo-shu')!, 10)!
  assert.deepEqual(volumeDaAmpola(r.porDose!, AMPOLAS.furosemida[0])?.ml, [2, 5])
})

test('lote 6d: aviso de diluir no próprio item (infusão do livro), sem ampola marcada', () => {
  assert.equal(ITENS_COM_AMPOLA['intoxicacao:bicarbonato-alcalina'].diluir, true)
  assert.deepEqual(ampolasDoItem('intoxicacao:bicarbonato-alcalina').map((a) => a.id), ['bicarbonato-8-4', 'bicarbonato-10'])
  // a ampola em si não pede diluição; o bolus da hipercalemia segue sem o aviso
  assert.ok(AMPOLAS.bicarbonato.every((a) => !a.diluir))
  assert.equal(ITENS_COM_AMPOLA['eletrolitos:bic'].diluir, undefined)
  // a guarda acusa item para diluir com solução pronta
  const p = problemasDasAmpolas({ s: [{ id: 's-1', rotulo: 's', porMl: 1, pronta: true, fonte: 'teste' }] }, { 'pele:x': { principio: 's', diluir: true } })
  assert.ok(p.some((x) => /item para diluir/.test(x)))
})

test('lote 7 (L7-1 a L7-7 = A do RT, 23/11/2026): bulas lidas, nenhuma ampola marcada', () => {
  const ids = (c: string) => ampolasDoItem(c).map((a) => [a.id, a.porMl, a.diluir ?? false])
  for (const c of ['anafilaxia:difenidramina-tabela', 'anafilaxia:difenidramina-texto', 'bolus:difenidramina', 'fita:fita-difenidramina']) assert.deepEqual(ids(c), [['difenidramina-50', 50, false]], c)
  // L7-1: rótulo do fosfato de dexametasona, só nos itens EV ou IV
  for (const c of ['meningite:dexametasona', 'oncologia:dexa-sms', 'oncologia:dexa-cce-ataque', 'oncologia:dexa-cce-man', 'oncologia:dexa-hic-ataque', 'oncologia:dexa-hic-man']) {
    assert.deepEqual(ids(c), [['dexametasona-2', 2, false], ['dexametasona-4', 4, false]], c)
  }
  for (const c of ['bolus:acetilcisteina-1', 'bolus:acetilcisteina-2', 'bolus:acetilcisteina-3']) assert.deepEqual(ids(c), [['acetilcisteina-100', 100, true]], c)
  assert.deepEqual(ids('bolus:esmolol-bolus'), [['esmolol-10000', 10000, false]]) // µg/mL do cloridrato (L7-4)
  assert.deepEqual(ids('bolus:milrinona-ataque'), [['milrinona-1000', 1000, false]]) // µg/mL (L7-2)
  assert.deepEqual(ids('pele:clinda-iv'), [['clindamicina-150', 150, true]])
  for (const c of ['pneumonia:amicacina', 'oncologia:amicacina']) assert.deepEqual(ids(c), [['amicacina-50', 50, true], ['amicacina-250', 250, true]], c)
  assert.deepEqual(ids('itu:tobramicina'), [['tobramicina-50', 50, true]])
  assert.deepEqual(ids('pneumonia:genta'), [['gentamicina-40', 40, true]]) // L7-3 = B: rótulo; sem a de 20 mg/mL
  assert.deepEqual(ids('hemostasia:ddavp'), [['desmopressina-4', 4, true]]) // µg/mL do acetato (L7-5)
  assert.deepEqual(ids('intoxicacao:vitk-sc'), [['vitamina-k-10', 10, false]]) // só SC (Eskavit e Hyvit K)
  // L7-6: salbutamol injetável (uso adulto) fica sem mL; item sem via escrita ou de via mista também
  for (const c of ['renal:beta2', 'coma:dexa-hic', 'pele:clindamicina']) assert.deepEqual(ampolasDoItem(c), [], c)
})

test('lote 7: contas de exemplo', () => {
  // difenidramina 1 mg/kg em 10 kg = 10 mg = 0,2 mL
  assert.deepEqual(volumeDaAmpola([10, 10], AMPOLAS.difenidramina[0])?.ml, [0.2, 0.2])
  // esmolol 500 µg/kg em 20 kg = 10.000 µg = 1 mL do frasco de 10 mg/mL
  assert.deepEqual(volumeDaAmpola([10000, 10000], AMPOLAS.esmolol[0])?.ml, [1, 1])
  // milrinona 50 µg/kg em 10 kg = 500 µg = 0,5 mL
  assert.deepEqual(volumeDaAmpola([500, 500], AMPOLAS.milrinona[0])?.ml, [0.5, 0.5])
  // acetilcisteína 150 mg/kg em 20 kg = 3.000 mg = 30 mL a aspirar
  assert.deepEqual(volumeDaAmpola([3000, 3000], AMPOLAS.acetilcisteina[0]), { ml: [30, 30], aspirar: true })
  // desmopressina 0,3 µg/kg em 20 kg = 6 µg = 1,5 mL a aspirar
  assert.deepEqual(volumeDaAmpola([6, 6], AMPOLAS.desmopressina[0]), { ml: [1.5, 1.5], aspirar: true })
  // amicacina 250 mg: 5 mL da 50 mg/mL ou 1 mL da 250 mg/mL (5×, nenhuma marcada)
  assert.deepEqual(AMPOLAS.amicacina.map((a) => volumeDaAmpola([250, 250], a)?.ml), [[5, 5], [1, 1]])
})

test('lote 8 (pendências do RT, 23/11/2026): via mista com aviso, tranexâmico da DVW, fenitoína profilática e SMX-TMP', () => {
  for (const c of ['oncologia:linezolida', 'oncologia:metronidazol', 'oncologia:levo', 'pele:linezolida', 'falciforme:dipirona', 'hemostasia:atx-dvw', 'pele:smxtmp', 'oncologia:tmp']) {
    assert.equal(ITENS_COM_AMPOLA[c].viaMista, true, c)
    assert.ok(ampolasDoItem(c).length > 0, c)
  }
  assert.deepEqual(ampolasDoItem('hemostasia:atx-dvw').map((a) => a.porMl), [50])
  assert.deepEqual(ampolasDoItem('oncologia:fenitoina-prof').map((a) => [a.porMl, a.diluir]), [[50, true]])
  // SMX-TMP em trimetoprima (L6-5): 16 mg/mL, a aspirar e diluir
  for (const c of ['pele:smxtmp', 'oncologia:tmp']) assert.deepEqual(ampolasDoItem(c).map((a) => [a.porMl, a.diluir]), [[16, true]], c)
  // TMP 20 mg/kg/dia em 4 doses, 10 kg = 50 mg/dose = 3,125 mL
  assert.deepEqual(volumeDaAmpola([50, 50], AMPOLAS['smx-tmp'][0])?.ml, [3.125, 3.125])
})

test('lote 8: glicose de 5% a 50%, nenhuma marcada, sem a de 75%', () => {
  assert.deepEqual(AMPOLAS.glicose.map((a) => a.porMl), [0.05, 0.1, 0.25, 0.5])
  assert.ok(AMPOLAS.glicose.every((a) => a.porMl < 0.75))
  for (const c of ['renal:glicose', 'eletrolitos:glicose-polarizante', 'bolus:glicose-25', 'crise:glicose25', 'coma:glicose25', 'oncologia:glicose25']) {
    assert.equal(ampolasDoItem(c).length, 4, c)
  }
  // a RCP já mostra o volume da glicose 25%: fica sem a escolha
  assert.deepEqual(ampolasDoItem('rcp:glicose'), [])
  // item em mL de glicose 25%: 2 mL/kg em 10 kg = 20 mL de 25% = 5 g = 10 mL da 50% ou 50 mL da 10%
  const g = doseNaUnidadeDaAmpola([20, 20], 'bolus:glicose-25')
  assert.deepEqual(g, [5, 5])
  const por = (id: string) => AMPOLAS.glicose.find((a) => a.id === id)
  assert.deepEqual(volumeDaAmpola(g, por('glicose-50'))?.ml, [10, 10])
  assert.deepEqual(volumeDaAmpola(g, por('glicose-10'))?.ml, [50, 50])
  assert.deepEqual(volumeDaAmpola(g, por('glicose-25'))?.ml, [20, 20])
  // item já em g: sem conversão
  assert.deepEqual(doseNaUnidadeDaAmpola([5, 10], 'renal:glicose'), [5, 10])
})

test('adulto A0 e A1 (MA1 a MA7 e A1-1 a A1-4 = A do RT, 23/11/2026): cadastro único, PCR e arritmias', () => {
  const ids = (c: string) => ampolasDoItem(c).map((a) => [a.id, a.porMl, a.diluir ?? false])
  assert.deepEqual(ids('adulto-bradi:atropina'), [['atropina-025', 0.25, false], ['atropina-05', 0.5, false]])
  assert.deepEqual(ids('adulto-taqui:adenosina'), [['adenosina-3', 3, false]])
  assert.deepEqual(ids('adulto-taqui:amiodarona'), [['amiodarona-50', 50, true]])
  assert.deepEqual(ids('adulto-taqui:lidocaina').map((a) => a[1]), [10, 20])
  assert.deepEqual(ids('adulto-taqui:magnesio'), [['magnesio-g-10', 0.1, false], ['magnesio-g-50', 0.5, false]])
  assert.equal(ITENS_COM_AMPOLA['adulto-taqui:magnesio'].diluir, true) // 2 g em 15 min
  assert.equal(ampolasDoItem('adulto-pcr:glicose-insulina').length, 4)
  // contas: atropina 1 mg = 2 mL da 0,5 mg/mL; adenosina 12 mg = 4 mL; magnésio 2 g = 20 mL da 10% ou 4 mL da 50%
  assert.deepEqual(volumeDaAmpola([1, 1], AMPOLAS.atropina[1])?.ml, [2, 2])
  assert.deepEqual(volumeDaAmpola([12, 12], AMPOLAS.adenosina[0])?.ml, [4, 4])
  assert.deepEqual(AMPOLAS['magnesio-g'].map((a) => volumeDaAmpola([2, 2], a)?.ml), [[20, 20], [4, 4]])
  // glicose 25 g = 50 mL da 50% ou 100 mL da 25%
  const g = (id: string) => AMPOLAS.glicose.find((a) => a.id === id)
  assert.deepEqual(volumeDaAmpola([25, 25], g('glicose-50'))?.ml, [50, 50])
  assert.deepEqual(volumeDaAmpola([25, 25], g('glicose-25'))?.ml, [100, 100])
  // KCl e aminofilina esperam a bula (A1-3)
  assert.equal(Object.keys(ITENS_COM_AMPOLA).some((c) => /kcl|aminofilina/.test(c)), false)
})
