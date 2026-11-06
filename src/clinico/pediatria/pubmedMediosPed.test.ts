// node --experimental-strip-types --test src/clinico/pediatria/pubmedMediosPed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import type { Ficha, Fonte } from '../ficha.ts'
import { pram } from '../escores/pram.ts'
import * as cad from './cadPed.ts'
import * as choque from './choque.ts'
import * as kawasaki from './kawasaki.ts'
import * as onco from './oncologiaPed.ts'

// Revisão PubMed de 09/10/2026, itens de prioridade média (decisão do RT em
// 06/11/2026: A em H1 a H22). Pediatria: Kawasaki (4.1), Phoenix (4.2),
// neutropenia febril (4.3), PRAM (4.4) e CAD com Ringer lactato (4.9). Cada
// nota tem fonte pediátrica com PMID, a ficha sobe de versão e a tela mostra a
// nota. Nenhuma dose muda; a glargina precoce não entra (H17).

const VERSAO = '2026-11-06.1'
const pagina = (nome: string) => readFileSync(new URL(`../../pages/plantonista/pediatria/${nome}`, import.meta.url), 'utf8')
const doModulo = (m: object, nome: string) => (m as Record<string, unknown>)[nome]

function confereFonte(ficha: Ficha, fonte: unknown, pmid: string) {
  const f = fonte as Fonte | undefined
  assert.ok(f, `fonte do PMID ${pmid} não exportada`)
  assert.match(f.citacao, new RegExp(`PMID ${pmid}\\)`))
  assert.equal(f.pediatrica, true, pmid)
  assert.match(f.url ?? '', /^https:\/\/doi\.org\/10\./, pmid)
  assert.ok(ficha.versao >= VERSAO, `${ficha.id}: ${ficha.versao}`)
  assert.ok(ficha.fontes.some((x) => x.citacao.includes(`PMID ${pmid})`)), `${ficha.id} sem PMID ${pmid}`)
  assert.match(ficha.revisadoEm, /06\/11\/2026.*revisão PubMed, itens médios/)
}

test('4.1 Kawasaki: nota do ECR de prednisolona na linha "Corticoide", com as duas fontes', () => {
  confereFonte(kawasaki.fichaKawasaki, doModulo(kawasaki, 'PREDNISOLONA_KAWASAKI_2026'), '41985133')
  confereFonte(kawasaki.fichaKawasaki, doModulo(kawasaki, 'CORTICOIDE_KAWASAKI_META_2026'), '42736452')
  const nota = doModulo(kawasaki, 'NOTA_PREDNISOLONA_KAWASAKI') as string
  assert.match(nota, /3\.208 crianças/)
  assert.match(nota, /nenhuma dose muda/)
  const corticoide = kawasaki.DIFERENCAS_KAWASAKI_2024.find((d) => d.tema === 'Corticoide') as { nota?: string } | undefined
  assert.equal(corticoide?.nota, nota)
  assert.match(pagina('KawasakiPed.tsx'), /d\.nota && <p role="note"/)
})

test('4.2 Phoenix: nota das validações externas abaixo do "não vale"', () => {
  confereFonte(choque.fichaPhoenixPed, doModulo(choque, 'PHOENIX_SENTINEL_2025'), '40116825')
  confereFonte(choque.fichaPhoenixPed, doModulo(choque, 'PHOENIX_HONG_KONG_2026'), '42228369')
  const nota = doModulo(choque, 'NOTA_PHOENIX_VALIDACAO') as string
  assert.match(nota, /SENTINEL/)
  assert.match(nota, /define sepse, não faz triagem/)
  const tela = pagina('PhoenixPed.tsx')
  assert.match(tela, /NOTA_PHOENIX_VALIDACAO/)
  assert.match(tela, /role="note"/)
})

test('4.3 neutropenia febril: nota do ECR dinamarquês depois das diferenças da IPFNG 2023', () => {
  confereFonte(onco.fichaOncologiaPed, doModulo(onco, 'NF_SUSPENSAO_PRECOCE_2026'), '41990768')
  const nota = doModulo(onco, 'NOTA_NF_SUSPENSAO_PRECOCE') as string
  assert.match(nota, /4,0 dias/)
  assert.match(nota, /só no baixo risco/)
  const tela = pagina('EmergenciasOncologicasPed.tsx')
  const lista = tela.indexOf('DIFERENCAS_NF_2023.map')
  const nota1 = tela.indexOf('{NOTA_NF_SUSPENSAO_PRECOCE}')
  assert.ok(lista > 0 && nota1 > lista, 'a nota vem depois da lista DIFERENCAS_NF_2023')
  assert.match(tela, /<p role="note"[^>]*>\{NOTA_NF_SUSPENSAO_PRECOCE\}/)
})

test('4.4 PRAM: nota em cuidados e linha da faixa etária reescrita (H10)', () => {
  const ficha = pram.ficha
  const fontes: [string, string][] = [['42392843', 'CASPER'], ['42448296', 'Pergo'], ['41996743', 'Courselle']]
  for (const [pmid, nome] of fontes) {
    const f = ficha.fontes.find((x) => x.citacao.includes(`PMID ${pmid})`))
    assert.ok(f, nome)
    assert.equal(f.pediatrica, true, nome)
    assert.match(f.url ?? '', /^https:\/\/doi\.org\/10\./, nome)
  }
  assert.ok(ficha.versao >= VERSAO)
  assert.match(ficha.revisadoEm, /06\/11\/2026.*revisão PubMed, itens médios/)
  const r = pram.calcular({ supraesternal: 0, escalenos: 0, entrada: 1, sibilos: 1, spo2: 0 })
  assert.ok(r)
  const cuidados = r.cuidados ?? []
  assert.ok(cuidados.includes('Validado de 2 a 17 anos; abaixo de 2 anos há só um estudo pequeno e unicêntrico (92 lactentes).'))
  assert.ok(!cuidados.some((c) => /não foi estudado/.test(c)))
  assert.ok(cuidados.some((c) => /CASPER/.test(c) && /não decide sozinho a internação/.test(c)))
})

test('4.9 CAD pediátrica: nota do Ringer lactato sem dose; glargina precoce não entra (H17)', () => {
  confereFonte(cad.fichaCadPed, doModulo(cad, 'RINGER_CAD_AGARWAL_2025'), '40194836')
  confereFonte(cad.fichaCadPed, doModulo(cad, 'RINGER_CAD_SINGHAL_2024'), '39302535')
  assert.match(cad.fichaCadPed.fontes[0].citacao, /cap\. 52, p\. 512–526/)
  const nota = doModulo(cad, 'NOTA_RINGER_CAD') as string
  assert.match(nota, /12,9/)
  assert.match(nota, /16,8/)
  assert.doesNotMatch(nota, /mL|UI|mg|\/kg|mEq/, 'a nota não traz dose nem volume')
  assert.match(pagina('CadEhhPed.tsx'), /<p role="note"[^>]*>\{NOTA_RINGER_CAD\}/)
  const fonteCad = readFileSync(new URL('./cadPed.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(fonteCad, /glargin/i)
  assert.doesNotMatch(pagina('CadEhhPed.tsx'), /glargin/i)
})
