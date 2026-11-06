// node --experimental-strip-types --test src/clinico/escores/pubmedMediosEscores.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { Escore, Respostas } from '../escore.ts'
import type { Ficha } from '../ficha.ts'
import { fichaAcessoVenoso, NOTA_ACESSO_9A_EDICAO } from '../acessoVenoso.ts'
import { FONTE_INGIELEWICZ_2025, NOTA_SUBTRIAGEM_IDOSO } from '../triagem/subtriagemIdoso.ts'
import { abcd2, NOTA_ABCD2_BAIXO_RISCO } from './abcd2.ts'
import { alvarado, NOTA_ALVARADO_WSES_2025 } from './alvarado.ts'
import { bisap, NOTA_ESCORES_PANCREATITE } from './bisap.ts'
import { canadianCtHead, NOTA_CCHR_JAPAO } from './canadianCtHead.ts'
import { civdIsth, NOTA_CIVD_ISTH_2025 } from './civdIsth.ts'
import { glasgowBlatchford, NOTA_ESGE_2026_EDA } from './glasgowBlatchford.ts'
import { grace, NOTA_GRACE_3, URL_GRACE_3 } from './grace.ts'
import { news2, NOTA_NEWS2_BRASIL } from './news2.ts'
import { ranson } from './ranson.ts'
import { NOTA_SOFA2_SEPSE, sepseAdulto } from './sepseAdulto.ts'
import { sofa2 } from './sofa2.ts'
import { NOTA_D_DIMERO_IDADE_TVP, wellsTvp } from './wellsTvp.ts'
import { NOTA_YEARS_CANCER, years } from './years.ts'

// Revisão PubMed de 09/10/2026, itens médios, área dos escores (decisão do RT
// em 06/11/2026: A em H11 a H16 e H18). Cada nota entra com a fonte conferida
// no PubMed; nenhuma regra de pontuação muda.

const VERSAO = '2026-11-06.1'

/** Resposta completa e válida: primeira opção de cada escolha, número no mínimo da faixa. */
function respostaCompleta(e: Escore): Respostas {
  const r: Respostas = {}
  for (const i of e.itens) {
    if (i.tipo === 'escolha') r[i.id] = 0
    else if (i.tipo === 'numero' && !i.opcional) r[i.id] = i.min ?? 1
  }
  return r
}

function cuidados(e: Escore): string[] {
  const r = e.calcular(respostaCompleta(e))
  assert.ok(r, `${e.ficha.id}: a resposta completa deveria calcular`)
  return r.cuidados
}

function temPmid(f: Ficha, pmid: string) {
  return f.fontes.some((x) => x.citacao.includes(`PMID ${pmid}`) && !!x.url)
}

function versaoNova(f: Ficha) {
  assert.ok(f.versao >= VERSAO, `${f.id}: versão ${f.versao}`)
  assert.match(f.revisadoEm, /06\/11\/2026.*revisão PubMed, itens médios/, f.id)
}

test('4.5 SOFA-2: nota na sepse com as validações no PS; a sepse segue no SOFA-1', () => {
  versaoNova(sepseAdulto.ficha)
  for (const pmid of ['41159833', '42687193', '42542312']) assert.ok(temPmid(sepseAdulto.ficha, pmid), pmid)
  assert.match(NOTA_SOFA2_SEPSE, /SOFA-2/)
  assert.match(NOTA_SOFA2_SEPSE, /62,3%/)
  assert.ok(cuidados(sepseAdulto).includes(NOTA_SOFA2_SEPSE))
  // SOFA-1: os itens continuam os seis do SOFA original (Glasgow abaixo de 6 = 4; PAM abaixo de 70 = 1)
  assert.ok(sepseAdulto.itens.some((i) => i.id === 'snc' && i.tipo === 'escolha' && i.opcoes.some((o) => o.rotulo === 'Abaixo de 6' && o.valor === 4)))
  assert.ok(sepseAdulto.itens.some((i) => i.id === 'cv' && i.tipo === 'escolha' && i.opcoes.some((o) => /PAM abaixo de 70/.test(o.rotulo) && o.valor === 1)))
  assert.ok(!sepseAdulto.itens.some((i) => i.id === 'cerebro' || i.id === 'hemostasia'))
})

test('4.5 SOFA-2: a ferramenta separada cita as validações no PS (Ahn 2026, Yen 2026)', () => {
  versaoNova(sofa2.ficha)
  assert.ok(temPmid(sofa2.ficha, '42687193'))
  assert.ok(temPmid(sofa2.ficha, '42542312'))
  const c = cuidados(sofa2)
  assert.ok(!c.some((x) => /validado só em UTI/.test(x)), 'a frase "validado só em UTI" saiu')
  assert.ok(c.some((x) => /pronto-socorro/.test(x) && /2\.669/.test(x) && /173\.079/.test(x)))
})

test('4.6 acesso venoso: nota da 9ª edição e citação completa da 8ª, regra igual', () => {
  versaoNova(fichaAcessoVenoso)
  assert.ok(temPmid(fichaAcessoVenoso, '33394637'))
  assert.ok(temPmid(fichaAcessoVenoso, '38211609'))
  assert.ok(fichaAcessoVenoso.fontes.some((f) => /Gorski LA, Hadaway L, Hagle ME, et al\..*2021;44\(1S Suppl 1\):S1–S224/.test(f.citacao)))
  assert.match(NOTA_ACESSO_9A_EDICAO, /9ª edição/)
  assert.match(NOTA_ACESSO_9A_EDICAO, /segue a 8ª edição/)
})

test('4.7 Wells TVP: nota do D-dímero ajustado à idade (Le Gal, JAMA 2026)', () => {
  versaoNova(wellsTvp.ficha)
  assert.ok(temPmid(wellsTvp.ficha, '41490105'))
  assert.match(NOTA_D_DIMERO_IDADE_TVP, /26,1%/)
  assert.ok(cuidados(wellsTvp).includes(NOTA_D_DIMERO_IDADE_TVP))
})

test('4.7 YEARS: nota do Hydra no câncer ativo (JAMA 2026)', () => {
  versaoNova(years.ficha)
  assert.ok(temPmid(years.ficha, '42437322'))
  assert.match(NOTA_YEARS_CANCER, /22%/)
  assert.ok(cuidados(years).includes(NOTA_YEARS_CANCER))
})

test('4.8 CIVD: nota da definição ISTH 2025, pontuação de 2001 mantida', () => {
  versaoNova(civdIsth.ficha)
  assert.ok(temPmid(civdIsth.ficha, '40216223'))
  assert.match(NOTA_CIVD_ISTH_2025, /2001/)
  assert.ok(cuidados(civdIsth).includes(NOTA_CIVD_ISTH_2025))
})

test('4.8 NEWS2: nota da versão brasileira oficial, rótulos sem mudança (H14)', () => {
  versaoNova(news2.ficha)
  assert.ok(temPmid(news2.ficha, '33111761'))
  assert.ok(temPmid(news2.ficha, '40767651'))
  assert.match(NOTA_NEWS2_BRASIL, /versão brasileira/i)
  assert.ok(cuidados(news2).includes(NOTA_NEWS2_BRASIL))
})

test('4.8 GRACE: nota do GRACE 3.0 com o endereço da calculadora oficial (H15)', () => {
  versaoNova(grace.ficha)
  assert.ok(temPmid(grace.ficha, '36049493'))
  assert.ok(temPmid(grace.ficha, '41107201'))
  assert.equal(URL_GRACE_3, 'https://www.grace-3.com/')
  assert.ok(grace.ficha.fontes.some((f) => f.url === URL_GRACE_3))
  assert.ok(NOTA_GRACE_3.includes(URL_GRACE_3))
  assert.ok(cuidados(grace).includes(NOTA_GRACE_3))
})

test('4.8 Canadian CT Head: nota da validação japonesa (2026)', () => {
  versaoNova(canadianCtHead.ficha)
  assert.ok(temPmid(canadianCtHead.ficha, '41791185'))
  assert.match(NOTA_CCHR_JAPAO, /91,1%/)
  assert.match(NOTA_CCHR_JAPAO, /33,8%/)
  assert.ok(cuidados(canadianCtHead).includes(NOTA_CCHR_JAPAO))
})

test('4.8 Alvarado: nota da WSES 2025 e do AIR; a WSES 2020 segue como fonte da regra (H16)', () => {
  versaoNova(alvarado.ficha)
  assert.ok(temPmid(alvarado.ficha, '41604201'))
  assert.ok(temPmid(alvarado.ficha, '39923099'))
  assert.ok(alvarado.ficha.fontes.some((f) => /2020 update of the WSES Jerusalem guidelines/.test(f.citacao)))
  assert.match(NOTA_ALVARADO_WSES_2025, /0,86/)
  assert.ok(cuidados(alvarado).includes(NOTA_ALVARADO_WSES_2025))
})

test('4.8 BISAP e Ranson: nota do desempenho ruim para prever pancreatite grave', () => {
  for (const e of [bisap, ranson]) {
    versaoNova(e.ficha)
    for (const pmid of ['37755341', '40651900', '42216617']) assert.ok(temPmid(e.ficha, pmid), `${e.ficha.id} ${pmid}`)
    assert.ok(cuidados(e).includes(NOTA_ESCORES_PANCREATITE), e.ficha.id)
  }
})

test('4.8 Glasgow-Blatchford: nota da ESGE 2026 sobre o horário da EDA', () => {
  versaoNova(glasgowBlatchford.ficha)
  assert.ok(temPmid(glasgowBlatchford.ficha, '42127996'))
  assert.match(NOTA_ESGE_2026_EDA, /≤ 6 h/)
  assert.ok(cuidados(glasgowBlatchford).includes(NOTA_ESGE_2026_EDA))
})

test('4.9 ABCD2: 17,7% dos de baixo risco tiveram AVC no próprio atendimento', () => {
  versaoNova(abcd2.ficha)
  assert.ok(temPmid(abcd2.ficha, '41718567'))
  assert.ok(temPmid(abcd2.ficha, '40944027'))
  assert.match(NOTA_ABCD2_BAIXO_RISCO, /17,7%/)
  assert.ok(cuidados(abcd2).includes(NOTA_ABCD2_BAIXO_RISCO))
})

test('4.9 Manchester no idoso (H18): nota de alerta sem sugerir cor', () => {
  assert.match(FONTE_INGIELEWICZ_2025.citacao, /PMID 40961061/)
  assert.ok(FONTE_INGIELEWICZ_2025.url)
  assert.match(NOTA_SUBTRIAGEM_IDOSO, /Manchester/)
  assert.doesNotMatch(NOTA_SUBTRIAGEM_IDOSO, /vermelh|laranja|amarel|verde|azul/i)
})
