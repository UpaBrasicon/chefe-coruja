// node --experimental-strip-types --test src/clinico/clinico.test.ts   (npm run test:clinico)
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica, type Ficha } from './ficha.ts'
import { ROTA_DA_FICHA } from './indice.ts'
import { ESCORES } from './escores/index.ts'
import { fichaDengue, grupoDengue, hidratacaoAdulto } from './dengue.ts'
import { fichaAcessoVenoso, recomendarAcesso } from './acessoVenoso.ts'
import { DIVERGENCIA_MANUAL_HC, NEONATO_FORA, avaliarHiperpotassemia, avaliarHiperpotassemiaPed, faixaPotassio, fichaHiperpotassemia, neonatoPelaIdade } from './hiperpotassemia.ts'
import { CLORETO_CA_TABELA7, HIPERCALEMIA, LIMIARES_K, calcularDose } from './pediatria/eletrolitosPed.ts'
import { BOLUS } from './pediatria/bolus.ts'

// ---- casco ----
const base: Ficha = { id: 'x', titulo: 'x', versao: '1', publico: 'ambos', fontes: [{ citacao: 'adulto' }], revisadoEm: '' }

test('casco: ficha de adulto nunca calcula para criança, mesmo com fonte marcada pediátrica', () => {
  assert.equal(temReferenciaPediatrica({ ...base, publico: 'adulto', fontes: [{ citacao: 'p', pediatrica: true }] }), false)
})
test('casco: ficha mista sem fonte pediátrica declarada não calcula para criança', () => {
  assert.equal(temReferenciaPediatrica(base), false)
})
test('casco: ficha mista com fonte pediátrica declarada calcula', () => {
  assert.equal(temReferenciaPediatrica({ ...base, fontes: [{ citacao: 'p', pediatrica: true }] }), true)
})
test('casco: toda ficha do pacote tem fonte e versão', () => {
  for (const f of [fichaDengue, fichaAcessoVenoso, fichaHiperpotassemia, ...ESCORES.map((e) => e.ficha)]) {
    assert.ok(f.fontes.length > 0, f.id)
    assert.ok(f.versao, f.id)
    assert.ok(ROTA_DA_FICHA[f.id], `ficha sem rota no índice: ${f.id}`)
  }
})

test('escores: ids únicos', () => {
  const ids = ESCORES.map((e) => e.ficha.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('escore: item numérico fora da faixa não conta como respondido', async () => {
  const { completo, numero } = await import('./escore.ts')
  const e = { ficha: base, descricao: '', itens: [{ tipo: 'numero' as const, id: 'x', rotulo: 'x', min: 0, max: 10 }], calcular: () => null }
  assert.equal(numero(e, { x: 11 }, 'x'), undefined)
  assert.equal(completo(e, { x: 11 }), false)
  assert.equal(completo(e, { x: 5 }), true)
  assert.equal(completo(e, {}), false)
})

// ---- dengue ----
const semSinais = { sangramentoPele: false, sangramentoMucosa: false, sinaisAlarme: 0, sinaisChoque: 0 }
test('dengue: o sinal mais grave define o grupo', () => {
  assert.equal(grupoDengue(semSinais), 'A')
  assert.equal(grupoDengue({ ...semSinais, sangramentoPele: true }), 'B')
  assert.equal(grupoDengue({ ...semSinais, sangramentoPele: true, sangramentoMucosa: true }), 'C')
  assert.equal(grupoDengue({ ...semSinais, sinaisAlarme: 1 }), 'C')
  assert.equal(grupoDengue({ ...semSinais, sinaisAlarme: 2, sinaisChoque: 1 }), 'D')
})
test('dengue: volumes do adulto por mL/kg', () => {
  assert.deepEqual(hidratacaoAdulto('A', 70).map((f) => f.volumeMl), [4200, 1400, 2800])
  assert.equal(hidratacaoAdulto('C', 70)[0].volumeMl, 700)
  assert.equal(hidratacaoAdulto('D', 70)[0].volumeMl, 1400)
})
test('dengue: sem peso válido não sai volume', () => {
  assert.ok(hidratacaoAdulto('C', 0).every((f) => f.volumeMl === null))
})
test('dengue: volume é só de adulto — criança cai no casco', () => {
  assert.equal(temReferenciaPediatrica(fichaDengue), false)
})

// ---- acesso venoso ----
test('acesso venoso: urgência vem antes de tudo', () => {
  assert.match(recomendarAcesso({ terapia: 'longa', infusao: 'irritante', rede: 'ruim', urgencia: 'urgente' }).dispositivo, /periférico rápido/)
})
test('acesso venoso: infusão irritante vai para central', () => {
  assert.match(recomendarAcesso({ terapia: 'curta', infusao: 'irritante', rede: 'boa', urgencia: 'programada' }).dispositivo, /central/)
})
test('acesso venoso: terapia longa vai para PICC; curta e compatível fica periférico', () => {
  assert.match(recomendarAcesso({ terapia: 'longa', infusao: 'periferica', rede: 'boa', urgencia: 'programada' }).dispositivo, /PICC/)
  assert.match(recomendarAcesso({ terapia: 'curta', infusao: 'periferica', rede: 'boa', urgencia: 'programada' }).dispositivo, /periférico curto/)
})
test('acesso venoso: ramo pediátrico sem fonte saiu (casco)', () => {
  assert.equal(temReferenciaPediatrica(fichaAcessoVenoso), false)
})

// ---- hiperpotassemia ----
const hk = { ecg: 'sem_alteracao' as const, diureseComprometida: false, acidose: false }
test('hiperpotassemia: faixas exclusivas, 5,5 já é moderada e 6,0 ainda é moderada', () => {
  assert.equal(faixaPotassio(4.9), 'Fora da faixa de hiperpotassemia')
  assert.equal(faixaPotassio(5.4), 'Leve')
  assert.equal(faixaPotassio(5.5), 'Moderada')
  assert.equal(faixaPotassio(6.0), 'Moderada')
  assert.equal(faixaPotassio(6.1), 'Grave')
})
test('hiperpotassemia: cálcio indicado por ECG alterado ou K >= 6,5', () => {
  assert.equal(avaliarHiperpotassemia({ ...hk, potassio: 5.6, ecg: 'alterado' })?.calcio, 'indicado')
  assert.equal(avaliarHiperpotassemia({ ...hk, potassio: 6.5 })?.calcio, 'indicado')
  assert.equal(avaliarHiperpotassemia({ ...hk, potassio: 6.4 })?.calcio, 'nao_indicado')
})
test('hiperpotassemia: ECG não feito não é ECG normal', () => {
  const r = avaliarHiperpotassemia({ ...hk, potassio: 5.8, ecg: 'nao_feito' })
  assert.equal(r?.calcio, 'indeterminado')
  assert.equal(r?.gravidade, 2)
  // acima de 6,5 o cálcio já está indicado: o aviso de ECG não faz sentido
  assert.ok(!avaliarHiperpotassemia({ ...hk, potassio: 7, ecg: 'nao_feito' })!.alertas.some((a) => a.startsWith('ECG não feito')))
})
test('hiperpotassemia: poliestirenossulfonato fora de linha, exceto sem diurese', () => {
  const linha = (d: boolean) => avaliarHiperpotassemia({ ...hk, potassio: 6, diureseComprometida: d })!
    .blocos[2].linhas.find((l) => l.item.startsWith('Poliestireno'))!.quando
  assert.equal(linha(false), 'fora de linha')
  assert.equal(linha(true), 'só nesta exceção')
})
test('hiperpotassemia: adulto não recebe dose que a fonte não quantifica', () => {
  const r = avaliarHiperpotassemia({ ...hk, potassio: 7 })!
  assert.equal(r.blocos.some((b) => b.titulo === 'Na criança'), false)
  assert.ok(!JSON.stringify(r.blocos).match(/\d+ U\b/))
})
// Criança: só o livro do ICr-HCFMUSP (auditoria 03/10/2026, R2). Nenhuma dose
// de Geldermann 2026 (insulina 0,1 U/kg com dextrose 25% 2 mL/kg, gluconato
// 100–200 mg/kg, bicarbonato 1–2 mEq/kg "da fonte") pode sair para a criança.
const hkPed = { ecg: 'sem_alteracao' as const, neonato: false }
test('hiperpotassemia (criança): doses iguais às do módulo do ICr (cap. 54), com página', () => {
  const r = avaliarHiperpotassemiaPed({ ...hkPed, potassio: 7.2, pesoKg: 20 })!
  const fonte = [...HIPERCALEMIA, CLORETO_CA_TABELA7]
  assert.deepEqual(r.doses.map((d) => d.id), fonte.map((d) => d.id))
  for (const d of r.doses) {
    const f = fonte.find((x) => x.id === d.id)!
    assert.equal(d.texto, f.texto)
    assert.equal(d.pagina, f.pagina)
    assert.equal(d.unidade, f.unidade)
    assert.deepEqual(d.faixa, calcularDose(f, 20)!.faixa, d.id)
    assert.match(d.pagina, /p\. \d/)
  }
})
test('hiperpotassemia (criança): nenhum texto nem fonte de Geldermann para a criança', () => {
  const r = avaliarHiperpotassemiaPed({ ...hkPed, potassio: 7.2, pesoKg: 20 })!
  const tudo = JSON.stringify(r)
  assert.doesNotMatch(tudo, /Geldermann|lise tumoral pediátrica\)|dextrose a 25%|100 a 200 mg\/kg por dose/i)
  assert.equal('blocos' in r, false)
  // a fonte de 2026 não é mais declarada pediátrica; a pediátrica é o ICr
  assert.ok(fichaHiperpotassemia.fontes.filter((f) => /Geldermann|Arzayus/.test(f.citacao)).every((f) => !f.pediatrica))
  const ped = fichaHiperpotassemia.fontes.filter((f) => f.pediatrica)
  assert.equal(ped.length, 1)
  assert.match(ped[0].citacao, /ICr-HCFMUSP/)
  assert.match(ped[0].citacao, /p\. 546–549/)
})
test('hiperpotassemia (criança): limiares do livro do ICr, não as faixas do adulto', () => {
  const abaixo = avaliarHiperpotassemiaPed({ ...hkPed, potassio: LIMIARES_K.hipercalemia })!
  assert.equal(abaixo.acimaDoLimiar, false)
  assert.equal(avaliarHiperpotassemiaPed({ ...hkPed, potassio: 5.6 })!.acimaDoLimiar, true)
  assert.equal(avaliarHiperpotassemiaPed({ ...hkPed, potassio: 6.9 })!.risco, false)
  assert.equal(avaliarHiperpotassemiaPed({ ...hkPed, potassio: LIMIARES_K.hipercalemiaGrave })!.risco, true)
  assert.ok(avaliarHiperpotassemiaPed({ ...hkPed, ecg: 'nao_feito', potassio: 6.2 })!.alertas.some((a) => /ECG \(p\. 548\)/.test(a)))
  assert.equal(avaliarHiperpotassemiaPed({ ...hkPed, potassio: NaN }), null)
})
test('hiperpotassemia (criança): divergência mostrada a partir do apêndice já modelado (bolus.ts)', () => {
  const r = avaliarHiperpotassemiaPed({ ...hkPed, potassio: 7, pesoKg: 10 })!
  const bic = r.doses.find((d) => d.id === 'bic')!
  const ap = BOLUS.find((b) => b.id === 'bicarbonato-hipercalemia')!
  assert.ok(bic.divergencias.some((x) => x.startsWith('Apêndice') && x.includes(ap.pagina)))
  const ins = r.doses.find((d) => d.id === 'insulina')!
  assert.ok(ins.divergencias.some((x) => x.includes('Errata')))
  for (const d of r.doses) for (const x of d.divergencias) assert.match(x, /p\. \d/, d.id)
})
test('hiperpotassemia (criança): recém-nascido e idade indefinida não calculam dose', () => {
  const rn = avaliarHiperpotassemiaPed({ ...hkPed, neonato: true, potassio: 7, pesoKg: 3 })!
  assert.equal(rn.neonato, true)
  assert.ok(rn.doses.every((d) => d.faixa === null))
  assert.match(NEONATO_FORA, /neonatal \(p\. 894\)/)
  const semIdade = avaliarHiperpotassemiaPed({ ...hkPed, neonato: null, potassio: 7, pesoKg: 3 })!
  assert.ok(semIdade.doses.every((d) => d.faixa === null))
  const semPeso = avaliarHiperpotassemiaPed({ ...hkPed, potassio: 7 })!
  assert.equal(semPeso.semPeso, true)
  assert.ok(semPeso.doses.every((d) => d.faixa === null))
  assert.equal(neonatoPelaIdade(27, 'dias'), true)
  assert.equal(neonatoPelaIdade(28, 'dias'), false)
  assert.equal(neonatoPelaIdade(0, 'meses'), null)
  assert.equal(neonatoPelaIdade(1, 'meses'), false)
  assert.equal(neonatoPelaIdade(null, 'anos'), null)
})
test('hiperpotassemia: o adulto não mostra limite pediátrico de outra fonte', () => {
  const r = avaliarHiperpotassemia({ ...hk, potassio: 7 })!
  assert.doesNotMatch(JSON.stringify(r), /pediatria|criança/i)
})
test('hiperpotassemia: sem potássio não calcula', () => {
  assert.equal(avaliarHiperpotassemia({ ...hk, potassio: NaN }), null)
})

test('hiperpotassemia: mantém a referência de 2026 e mostra o manual HC como divergência com página', () => {
  assert.equal(faixaPotassio(5.2), 'Leve')
  assert.match(DIVERGENCIA_MANUAL_HC.classificacao, /5,5/)
  assert.ok(DIVERGENCIA_MANUAL_HC.itens.every((i) => /^p\. \d/.test(i.pagina)))
  assert.ok(fichaHiperpotassemia.fontes.some((f) => /HCFMUSP/.test(f.citacao)))
})
