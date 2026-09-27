// node --experimental-strip-types --test src/clinico/clinico.test.ts   (npm run test:clinico)
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica, type Ficha } from './ficha.ts'
import { fichaDengue, grupoDengue, hidratacaoAdulto } from './dengue.ts'
import { fichaAcessoVenoso, recomendarAcesso } from './acessoVenoso.ts'
import { avaliarHiperpotassemia, faixaPotassio, fichaHiperpotassemia } from './hiperpotassemia.ts'

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
  for (const f of [fichaDengue, fichaAcessoVenoso, fichaHiperpotassemia]) {
    assert.ok(f.fontes.length > 0, f.id)
    assert.ok(f.versao, f.id)
  }
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
const hk = { ecg: 'sem_alteracao' as const, diureseComprometida: false, acidose: false, pediatrico: false }
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
  const r = avaliarHiperpotassemia({ ...hk, potassio: 7, pesoKg: 70 })!
  assert.equal(r.blocos.some((b) => b.titulo === 'Na criança'), false)
  assert.ok(!JSON.stringify(r.blocos).match(/\d+ U\b/))
})
test('hiperpotassemia: criança recebe dose por peso da fonte e emergência acima de 7', () => {
  const r = avaliarHiperpotassemia({ ...hk, potassio: 7.2, pediatrico: true, pesoKg: 20 })!
  assert.equal(r.emergenciaPediatrica, true)
  const bloco = r.blocos.find((b) => b.titulo === 'Na criança')!
  assert.match(bloco.linhas[0].texto, /= 2 U/)
  assert.match(bloco.linhas[1].texto, /2\.000 a 4\.000 mg/)
})
test('hiperpotassemia: sem potássio não calcula', () => {
  assert.equal(avaliarHiperpotassemia({ ...hk, potassio: NaN }), null)
})
