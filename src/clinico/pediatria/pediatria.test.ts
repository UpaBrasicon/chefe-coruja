import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

import { temReferenciaPediatrica } from '../ficha.ts'
import { BOLUS, GRUPOS, avaliarCondicao, calcularBolus, fichaBolusPediatrico, type Bolus } from './bolus.ts'
import { LIVRO_PS_PED, VERSAO_FICHAS_PEDIATRICAS, fichaPediatrica } from './fonte.ts'

const b = (id: string): Bolus => {
  const x = BOLUS.find((y) => y.id === id)
  assert.ok(x, id)
  return x
}
const r3 = (x: number) => Math.round(x * 1000) / 1000
const faixa = (id: string, peso: number, meses?: number) => calcularBolus(b(id), peso, meses)!.faixa.map(r3)
const vol = (id: string, peso: number) => calcularBolus(b(id), peso)!.volumeMl!.map(r3)
const anos = (a: number) => a * 12

test('fonte: livro do ICr é a principal; Anexo 2 do adulto só como secundária; versão .3', () => {
  assert.equal(temReferenciaPediatrica(fichaBolusPediatrico), true)
  assert.equal(fichaBolusPediatrico.versao, '2026-09-27.3')
  assert.equal(VERSAO_FICHAS_PEDIATRICAS, '2026-09-27.3')
  assert.match(fichaBolusPediatrico.fontes[0].citacao, /Pronto-Socorro — Pediatria ICr-HCFMUSP\. 4ª ed\..*Manole; 2023\. ISBN 978-65-5576-759-9/)
  assert.match(fichaBolusPediatrico.fontes[0].citacao, /Schvartsman C/)
  assert.match(fichaBolusPediatrico.fontes[1].citacao, /Manual de Medicina de Emergência.*Anexo 2/)
  assert.equal(LIVRO_PS_PED.pediatrica, true)
  const f = fichaPediatrica('x', 'X', 'p. 1', LIVRO_PS_PED)
  assert.equal(f.fontes.length, 1)
  assert.match(f.fontes[0].citacao, /ISBN 978-65-5576-759-9\. p\. 1\.$/)
})

test('nenhum arquivo da pediatria cita PedGuide nem ANY App', () => {
  const dir = new URL('.', import.meta.url)
  for (const nome of readdirSync(dir).filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'))) {
    assert.doesNotMatch(readFileSync(new URL(nome, dir), 'utf8'), /PedGuide|ANY App/i, nome)
  }
  assert.doesNotMatch(JSON.stringify([fichaBolusPediatrico, BOLUS]), /PedGuide|ANY App/i)
})

test('bolus: ids únicos, grupo conhecido, página em todo item, faixa ordenada', () => {
  const ids = BOLUS.map((x) => x.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const x of BOLUS) {
    assert.ok(GRUPOS[x.grupo], x.id)
    assert.match(x.pagina, /^p\. \d/, x.id)
    assert.ok(x.faixa[0] <= x.faixa[1], x.id)
    if (x.apresentacao) assert.match(x.apresentacao, /p\. \d/, `${x.id}: apresentação sem página`)
    for (const t of [x.nota, x.errata, x.anexo2Adulto, x.semCalculo].filter(Boolean)) assert.match(t!, /p\. \d/, `${x.id}: texto sem página`)
  }
  // antibióticos não entram nesta ferramenta
  assert.equal(BOLUS.some((x) => /cilina|cef|micina|penem|vancomicina|aciclovir/i.test(x.nome)), false)
  // itens só do manual do adulto (caps. 3, 11, 99) saíram
  for (const fora of ['cisatracurio-ataque', 'cisatracurio-infusao', 'hidroxicobalamina', 'nitrito-sodio', 'tiossulfato', 'cristaloide-anafilaxia'])
    assert.equal(BOLUS.some((x) => x.id === fora), false, fora)
})

test('volume só quando o livro dá a concentração (com página)', () => {
  for (const x of BOLUS) if (x.porMl) assert.ok(x.apresentacao, x.id)
  assert.equal(calcularBolus(b('etomidato'), 20)!.volumeMl, null)
  assert.equal(calcularBolus(b('rocuronio'), 20)!.volumeMl, null)
  assert.equal(calcularBolus(b('fentanil'), 20)!.volumeMl, null)
  assert.deepEqual(vol('epinefrina-pcr', 20), [2, 2]) // 0,01 mg/kg × 20 = 0,2 mg ÷ 0,1 mg/mL
  assert.deepEqual(vol('epinefrina-im', 20), [0.2, 0.2]) // 1:1.000
  assert.deepEqual(vol('epinefrina-et', 20), [2, 2]) // 0,1 mg/kg de 1:1.000 = 0,1 mL/kg
  assert.deepEqual(vol('bicarbonato-pcr', 10), [5, 10]) // 8,4% = 1 mEq/mL
  assert.deepEqual(vol('cetamina-iv', 10), [0.1, 0.4]) // 50 mg/mL
  assert.deepEqual(vol('manitol', 10), [12.5, 50]) // 20% = 0,2 g/mL
  assert.deepEqual(vol('magnesio-asma', 20), [1, 3]) // 500 mg/mL
  assert.deepEqual(vol('gluconato-pcr', 10), [6, 10]) // 10% = 100 mg/mL
})

test('Tabela 1: valores e máximos do apêndice', () => {
  assert.deepEqual(faixa('amiodarona-fvtv', 20), [100, 100])
  assert.deepEqual(faixa('amiodarona-fvtv', 80), [300, 300])
  assert.deepEqual(faixa('atropina-bradicardia', 10), [0.2, 0.2])
  assert.deepEqual(faixa('atropina-bradicardia', 40), [0.5, 0.5])
  assert.deepEqual(faixa('atropina-pre', 30), [0.3, 0.4])
  assert.deepEqual(faixa('etomidato', 100), [10, 20])
  assert.deepEqual(faixa('flumazenil', 30), [0.2, 0.2])
  assert.deepEqual(faixa('gluconato-pcr', 40), [2400, 3000])
  assert.deepEqual(faixa('lidocaina-iv', 120), [100, 100])
  assert.deepEqual(faixa('midazolam-im', 100), [10, 10])
  assert.deepEqual(faixa('succinilcolina-im', 50), [150, 150])
  assert.deepEqual(faixa('rocuronio', 10), [6, 12])
  assert.deepEqual(faixa('sugamadex', 10), [20, 160])
  assert.deepEqual(faixa('epinefrina-im', 60), [0.5, 0.5])
  assert.equal(calcularBolus(b('epinefrina-im'), 60)!.noMaximo, true)
  assert.equal(calcularBolus(b('epinefrina-im'), 10)!.noMaximo, false)
  assert.deepEqual(faixa('epinefrina-nebulizacao', 12), [3, 5]) // mL, não por kg
  assert.equal(calcularBolus(b('rocuronio'), 0), null)
  assert.equal(calcularBolus(b('rocuronio'), Number.NaN), null)
})

test('Tabela 2: antídotos e emergência', () => {
  assert.deepEqual(faixa('acetilcisteina-1', 20), [3000, 3000])
  assert.deepEqual(faixa('acetilcisteina-2', 20), [1000, 1000])
  assert.deepEqual(faixa('acetilcisteina-3', 20), [2000, 2000])
  assert.deepEqual(faixa('carvao', 80), [40, 50])
  assert.deepEqual(faixa('pralidoxima', 50), [1000, 2000])
  assert.deepEqual(faixa('fenitoina', 60), [900, 1000])
  assert.deepEqual(faixa('azul-metileno', 10), [10, 20])
  assert.deepEqual(vol('azul-metileno', 10), [1, 2]) // 1% = 10 mg/mL (p. 102)
})

test('adenosina: < 50 kg por kg com máx. 6/12 mg; > 50 kg dose fixa; 50 kg exato fica fora das duas', () => {
  assert.deepEqual(faixa('adenosina-1', 20), [2, 2])
  assert.deepEqual(faixa('adenosina-1', 49), [4.9, 4.9])
  assert.deepEqual(faixa('adenosina-2', 49), [9.8, 9.8])
  assert.deepEqual(faixa('adenosina-50-1', 60), [6, 6])
  assert.deepEqual(faixa('adenosina-50-2', 60), [12, 12])
  assert.equal(calcularBolus(b('adenosina-1'), 20)!.aplica, 'sim')
  assert.equal(calcularBolus(b('adenosina-50-1'), 20)!.aplica, 'nao')
  assert.equal(calcularBolus(b('adenosina-1'), 60)!.aplica, 'nao')
  assert.equal(calcularBolus(b('adenosina-1'), 50)!.aplica, 'nao')
  assert.equal(calcularBolus(b('adenosina-50-1'), 50)!.aplica, 'nao')
})

test('naloxona: < 5 anos ou < 20 kg × > 5 anos ou > 20 kg (o livro sobrepõe)', () => {
  const menor = b('naloxona-menor')
  const maior = b('naloxona-maior')
  assert.deepEqual(faixa('naloxona-menor', 12), [1.2, 1.2])
  assert.deepEqual(faixa('naloxona-menor', 30), [2, 2]) // máx. 2 mg
  assert.deepEqual(faixa('naloxona-maior', 30), [2, 2])
  assert.equal(avaliarCondicao(menor.condicao, 12), 'sim') // < 20 kg basta
  assert.equal(avaliarCondicao(maior.condicao, 12), 'indefinido') // sem idade não dá para excluir
  assert.equal(avaliarCondicao(maior.condicao, 12, anos(3)), 'nao')
  assert.equal(avaliarCondicao(maior.condicao, 25, anos(8)), 'sim')
  assert.equal(avaliarCondicao(menor.condicao, 25, anos(8)), 'nao')
  // 4 anos e 22 kg: cabe nas duas linhas do livro
  assert.equal(avaliarCondicao(menor.condicao, 22, anos(4)), 'sim')
  assert.equal(avaliarCondicao(maior.condicao, 22, anos(4)), 'sim')
})

test('midazolam IV: máx. 6 mg < 5 anos e 10 mg > 5 anos; idade em anos completos', () => {
  assert.deepEqual(faixa('midazolam-iv-menor5', 20), [2, 6])
  assert.deepEqual(faixa('midazolam-iv-maior5', 30), [3, 10])
  assert.equal(calcularBolus(b('midazolam-iv-menor5'), 15, anos(4) + 11)!.aplica, 'sim')
  assert.equal(calcularBolus(b('midazolam-iv-maior5'), 15, anos(4) + 11)!.aplica, 'nao')
  assert.equal(calcularBolus(b('midazolam-iv-maior5'), 25, anos(6))!.aplica, 'sim')
  // 5 anos completos: o livro não define (< 5 e > 5)
  assert.equal(calcularBolus(b('midazolam-iv-menor5'), 18, anos(5) + 3)!.aplica, 'nao')
  assert.equal(calcularBolus(b('midazolam-iv-maior5'), 18, anos(5) + 3)!.aplica, 'nao')
  assert.equal(calcularBolus(b('midazolam-iv-menor5'), 18)!.aplica, 'indefinido')
})

test('outras regras por idade: diazepam, vecurônio, morfina, neostigmina, polarizante', () => {
  assert.deepEqual(faixa('diazepam-iv-menor5', 40), [5, 5])
  assert.deepEqual(faixa('diazepam-iv-maior5', 80), [10, 10])
  assert.equal(calcularBolus(b('diazepam-vr-2a5'), 12, anos(1))!.aplica, 'nao') // 6 m a 2 a: dose não estabelecida
  assert.equal(calcularBolus(b('diazepam-vr-2a5'), 15, anos(5) + 6)!.aplica, 'sim')
  assert.equal(calcularBolus(b('diazepam-vr-6a11'), 25, anos(11) + 11)!.aplica, 'sim')
  assert.deepEqual(faixa('diazepam-vr-12', 120), [20, 20])
  assert.equal(calcularBolus(b('vecuronio'), 8, 6)!.aplica, 'nao')
  assert.equal(calcularBolus(b('vecuronio'), 30, anos(10) + 11)!.aplica, 'sim')
  assert.equal(calcularBolus(b('vecuronio'), 40, anos(11))!.aplica, 'nao')
  assert.equal(calcularBolus(b('morfina-menor6m'), 6, 5)!.aplica, 'sim')
  assert.equal(calcularBolus(b('morfina-maior6m'), 6, 5)!.aplica, 'nao')
  assert.equal(calcularBolus(b('neostigmina-0a2'), 12, anos(2) + 11)!.aplica, 'sim')
  assert.equal(calcularBolus(b('neostigmina-maior2'), 12, anos(2) + 11)!.aplica, 'nao')
  assert.equal(calcularBolus(b('polarizante-g10'), 12, anos(3))!.aplica, 'sim')
  assert.equal(calcularBolus(b('polarizante-g25'), 12, anos(3))!.aplica, 'nao')
  assert.deepEqual(faixa('polarizante-g25', 30), [60, 60]) // 2 mL/kg de G25% = 0,5 g/kg
  assert.deepEqual(faixa('glucagon-menor20', 18), [0.36, 0.5])
})

test('glucagon > 20 kg: o livro só dá o máximo — sem cálculo', () => {
  const g = b('glucagon-maior20')
  assert.ok(g.semCalculo)
  assert.equal(calcularBolus(g, 30), null)
})

test('erratas conferidas no PDF', () => {
  // solução polarizante: apêndice "1 un/kg"; caps. p. 549 e 701 dão 0,1 UI/kg (máx. 10)
  assert.deepEqual(faixa('polarizante-insulina', 20), [2, 2])
  assert.deepEqual(faixa('polarizante-insulina', 150), [10, 10])
  assert.match(b('polarizante-insulina').errata!, /1 un\/kg.*p\. 897.*p\. 549/)
  // dexametasona no crupe: apêndice "máx. 12 g"; crupe p. 294 dá máx. 10 mg
  assert.deepEqual(faixa('dexametasona-crupe', 30), [10, 10])
  assert.match(b('dexametasona-crupe').errata!, /12 g/)
  // octreotida: tabela 2 sem "/kg"; vale a tabela 1
  assert.deepEqual(faixa('octreotida-ataque', 10), [10, 20])
  assert.match(b('octreotida-ataque').errata!, /p\. 905/)
})

test('atropina: sem mínimo imposto; aviso abaixo de 0,1 mg com as duas páginas', () => {
  const at = calcularBolus(b('atropina-bradicardia'), 3)!
  assert.deepEqual(at.faixa.map(r3), [0.06, 0.06])
  assert.equal(at.abaixoDoAviso, true)
  assert.equal(calcularBolus(b('atropina-bradicardia'), 10)!.abaixoDoAviso, false)
  assert.match(b('atropina-bradicardia').aviso!.texto, /p\. 894.*p\. 71/)
})

test('divergências com o Anexo 2 do manual do adulto ficam só como nota', () => {
  const comAnexo2 = BOLUS.filter((x) => x.anexo2Adulto)
  for (const x of comAnexo2) assert.match(x.anexo2Adulto!, /Anexo 2 do manual do adulto: .*p\. 149\d/, x.id)
  for (const id of ['succinilcolina-iv', 'succinilcolina-im', 'etomidato', 'fentanil', 'lidocaina-sri', 'propofol', 'atropina-bradicardia', 'diazepam-iv-menor5'])
    assert.ok(b(id).anexo2Adulto, id)
  // rocurônio: mesma faixa nos dois livros (0,6 a 1,2) — sem nota do adulto
  assert.equal(b('rocuronio').anexo2Adulto, undefined)
  // o cálculo usa o apêndice, não o Anexo 2
  assert.deepEqual(faixa('succinilcolina-iv', 10), [10, 20])
  assert.deepEqual(faixa('propofol', 10), [10, 20])
})
