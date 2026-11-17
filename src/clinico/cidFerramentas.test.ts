import assert from 'node:assert/strict'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

import { categoriaCid, casaFaixa, ferramentasDoCid } from './cidFerramentas.ts'
import { LIGACOES_CID, fichaMapaCidFerramentas } from './cidFerramentasMapa.ts'
import { ROTA_DA_FICHA } from './indice.ts'
import { TOPOS } from './topos.ts'

// Fichas do pacote (como scripts/fichas-sql.mjs), para conferir o público.
async function fichasDoPacote(): Promise<Map<string, { publico: string }>> {
  const dir = import.meta.dirname
  const arquivos = (d: string): string[] =>
    readdirSync(d).flatMap((a) => {
      const c = join(d, a)
      if (statSync(c).isDirectory()) return arquivos(c)
      return a.endsWith('.ts') && !a.endsWith('.test.ts') ? [c] : []
    })
  const mapa = new Map<string, { publico: string }>()
  for (const arq of arquivos(dir)) {
    const mod = (await import(pathToFileURL(arq).href)) as Record<string, unknown>
    for (const [nome, v] of Object.entries(mod)) {
      const o = v as { id?: string; versao?: string; publico?: string; ficha?: { id?: string; versao?: string; publico?: string } } | null
      if (!o || typeof o !== 'object') continue
      const f = nome.startsWith('ficha') && o.id && o.versao ? o : o.ficha?.id && o.ficha?.versao ? o.ficha : null
      if (f?.id && f.publico) mapa.set(f.id, { publico: f.publico })
    }
  }
  return mapa
}

test('CF3: cada ligação tem trecho literal do topo da própria ferramenta', () => {
  for (const l of LIGACOES_CID) {
    const topo = TOPOS[l.ficha]
    assert.ok(topo, `sem topo: ${l.ficha}`)
    const m = l.origem.match(/^quando:(\d+)$/)
    const texto = l.origem === 'resumo' ? topo.resumo : m ? topo.quandoUsar?.[Number(m[1])]?.texto : undefined
    assert.ok(texto, `origem inválida: ${l.ficha} ${l.origem}`)
    assert.ok(l.motivo.length >= 6 && texto.includes(l.motivo), `trecho não é literal: ${l.ficha} "${l.motivo}"`)
  }
})

test('CF2: códigos são categorias ou faixas da CID-10, em ordem', () => {
  for (const l of LIGACOES_CID) {
    assert.ok(l.cids.length > 0, `sem CID: ${l.ficha}`)
    for (const c of l.cids) {
      assert.match(c, /^[A-Z]\d{2}(-[A-Z]\d{2})?$/, `${l.ficha}: ${c}`)
      const [de, ate] = c.split('-')
      if (ate) assert.ok(de[0] === ate[0] && de < ate, `${l.ficha}: faixa ${c}`)
    }
    assert.ok(!l.cids.includes('R65'), 'R65 não está na CID-10 do DATASUS')
  }
})

test('toda ferramenta do mapa existe na Central e tem o público da ficha', async () => {
  const fichas = await fichasDoPacote()
  for (const l of LIGACOES_CID) {
    assert.ok(ROTA_DA_FICHA[l.ficha], `sem rota na Central: ${l.ficha}`)
    assert.equal(l.publico, fichas.get(l.ficha)?.publico, `público diferente da ficha: ${l.ficha}`)
  }
  assert.equal(fichaMapaCidFerramentas.id, 'mapa-cid-ferramentas')
})

test('categoria do campo CID e faixa', () => {
  assert.equal(categoriaCid('I21.0 — Infarto agudo'), 'I21')
  assert.equal(categoriaCid('i210'), 'I21')
  assert.equal(categoriaCid('dor no peito'), '')
  assert.ok(casaFaixa('I20-I25', 'I21'))
  assert.ok(!casaFaixa('I20-I25', 'I26'))
  assert.ok(casaFaixa('G45', 'G45'))
})

test('exemplos do RT: I20 traz HEART; G45 traz ABCD2; I64 não traz ABCD2', () => {
  const ids = (cid: string) => ferramentasDoCid(cid, 'adulto').map((l) => l.ficha)
  assert.ok(ids('I20.0').includes('heart'))
  assert.ok(ids('G45.9').includes('abcd2'))
  assert.ok(!ids('I64').includes('abcd2'))
  assert.deepEqual(ferramentasDoCid('', 'adulto'), [])
})

test('CF6: criança não vê ferramenta só de adulto, adulto não vê pediátrica', () => {
  for (const l of LIGACOES_CID) {
    for (const c of l.cids) {
      const cat = c.split('-')[0]
      const crianca = ferramentasDoCid(cat, 'pediatrico')
      const adulto = ferramentasDoCid(cat, 'adulto')
      assert.ok(crianca.every((x) => x.publico !== 'adulto'), `${cat}: adulto na criança`)
      assert.ok(adulto.every((x) => x.publico !== 'pediatrico'), `${cat}: pediátrica no adulto`)
    }
  }
})

test('condição do LG: o mapa só leva ficha, CID e trecho (nada de dose, cor ou conduta)', () => {
  for (const l of LIGACOES_CID) {
    assert.deepEqual(Object.keys(l).sort(), ['cids', 'ficha', 'motivo', 'origem', 'publico'])
  }
})
