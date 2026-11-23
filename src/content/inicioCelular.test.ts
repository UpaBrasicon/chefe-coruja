import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { ROTA_DA_FICHA } from '../clinico/indice.ts'
import { GUIA_ADULTO, GUIA_CRIANCA, ROTA_TODAS_FERRAMENTAS, cartaoDoGuia } from './guiaRapido.ts'
import { INICIO_ADULTO, INICIO_CRIANCA, URGENCIAS_RAPIDAS, categoriasDoInicio, rotaDaBusca } from './inicioCelular.ts'

// Início do celular (item 6; mescla A + B escolhida pelo RT em 23/11/2026).
const rotas = new Set(Object.values(ROTA_DA_FICHA))
// Farmácia não tem ficha clínica (consulta e diluição revisada por farmacêutico):
// confere no cadastro da Central.
const registro = readFileSync('src/content/registry.tsx', 'utf8')
const existe = (rota: string) => {
  const guia = /^\/plantonista\?guia=([\w-]+)$/.exec(rota)
  if (guia) return guia[1] === 'parada-adulto' || guia[1] === 'cronometro' || !!cartaoDoGuia(guia[1])
  if (rotas.has(rota)) return true
  const farmacia = /^\/plantonista\/farmacia\/([\w-]+)$/.exec(rota)
  return !!farmacia && registro.includes(`t('${farmacia[1]}'`)
}

test('todo item e todo atalho abrem uma tela que existe', () => {
  for (const c of [...INICIO_ADULTO, ...INICIO_CRIANCA]) {
    for (const i of c.itens) assert.ok(existe(i.rota), `${c.nome}: ${i.nome} ${i.rota}`)
    if (c.rota) assert.equal(c.rota, ROTA_TODAS_FERRAMENTAS)
    assert.ok(c.itens.length > 0 || !!c.rota, `${c.nome} sem itens nem rota`)
  }
  for (const u of Object.values(URGENCIAS_RAPIDAS)) {
    for (const r of [u.pcr, u.sepse.rota, u.cad.rota]) assert.ok(existe(r), r)
  }
})

test('as mesmas seis categorias nos dois lados, na ordem do CM5 (sem as que ainda não existem)', () => {
  const ids = ['urgencias', 'doses', 'calculadoras', 'escores', 'intoxicacao', 'todas']
  assert.deepEqual(INICIO_ADULTO.map((c) => c.id), ids)
  assert.deepEqual(INICIO_CRIANCA.map((c) => c.id), ids)
  assert.equal(categoriasDoInicio('crianca'), INICIO_CRIANCA)
  assert.equal(categoriasDoInicio('adulto'), INICIO_ADULTO)
})

test('Urgências reaproveita os cartões do Guia rápido, parada primeiro', () => {
  assert.equal(INICIO_ADULTO[0].itens.length, GUIA_ADULTO.length)
  assert.equal(INICIO_CRIANCA[0].itens.length, GUIA_CRIANCA.length)
  assert.equal(INICIO_ADULTO[0].itens[0].rota, '/plantonista?guia=parada-adulto')
  assert.equal(INICIO_CRIANCA[0].itens[0].rota, '/plantonista?guia=parada-crianca')
  for (const i of [...INICIO_ADULTO, ...INICIO_CRIANCA].flatMap((c) => c.itens)) assert.ok(i.sigla.length <= 4, i.sigla)
})

test('criança só abre telas da pediatria (ou a farmácia); adulto, nenhuma da pediatria', () => {
  const crianca = INICIO_CRIANCA.flatMap((c) => c.itens.map((i) => i.rota)).filter((r) => !r.includes('?guia='))
  assert.ok(crianca.every((r) => r.startsWith('/plantonista/pediatria/') || r.startsWith('/plantonista/farmacia/')), crianca.join(' '))
  const adulto = INICIO_ADULTO.flatMap((c) => c.itens.map((i) => i.rota))
  assert.ok(adulto.every((r) => !r.startsWith('/plantonista/pediatria/')))
  assert.ok(URGENCIAS_RAPIDAS.crianca.sepse.rota.startsWith('/plantonista/pediatria/'))
  assert.ok(URGENCIAS_RAPIDAS.crianca.cad.rota.startsWith('/plantonista/pediatria/'))
})

test('a busca abre a Central completa com o texto', () => {
  assert.equal(rotaDaBusca('  '), ROTA_TODAS_FERRAMENTAS)
  assert.equal(rotaDaBusca(' noradrenalina '), '/plantonista?todas=1&q=noradrenalina')
  assert.equal(rotaDaBusca('K+ & Na'), '/plantonista?todas=1&q=K%2B%20%26%20Na')
})
