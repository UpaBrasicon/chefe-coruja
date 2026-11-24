import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { ROTA_DA_FICHA } from '../clinico/indice.ts'
import { GUIA_ADULTO, GUIA_CRIANCA, ROTA_TODAS_FERRAMENTAS, cartaoDoGuia } from './guiaRapido.ts'
import { INICIO_ADULTO, INICIO_CRIANCA, ROTA_PCR, categoriasDoInicio, chaveDoItem, rotaDaBusca } from './inicioCelular.ts'

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
  for (const r of Object.values(ROTA_PCR)) assert.ok(existe(r), r)
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
})

test('Sepse e CAD saíram do topo e estão em Urgências ou Calculadoras nos dois lados (RT, 23/11/2026)', () => {
  for (const cats of [INICIO_ADULTO, INICIO_CRIANCA]) {
    const nomes = cats.filter((c) => c.id === 'urgencias' || c.id === 'calculadoras').flatMap((c) => c.itens.map((i) => i.nome))
    assert.ok(nomes.some((n) => n.startsWith('Sepse')), 'sepse')
    assert.ok(nomes.some((n) => n.startsWith('Cetoacidose')), 'CAD')
  }
  assert.equal(ROTA_PCR.adulto, '/plantonista?guia=parada-adulto')
  assert.equal(ROTA_PCR.crianca, '/plantonista?guia=parada-crianca')
})

test('a bandeirinha favorita a ferramenta com a chave da Central (RT, 23/11/2026)', () => {
  assert.equal(chaveDoItem('/plantonista/escores/heart'), 'escores/heart')
  assert.equal(chaveDoItem('/plantonista?guia=parada-adulto'), 'emergencias/pcr-adulto')
  assert.equal(chaveDoItem('/plantonista?guia=parada-crianca'), 'pediatria/rcp-pediatrica')
  assert.equal(chaveDoItem('/plantonista?todas=1'), null)
  // todo item do início tem chave de uma ferramenta do cadastro
  for (const i of [...INICIO_ADULTO, ...INICIO_CRIANCA].flatMap((c) => c.itens)) {
    const chave = chaveDoItem(i.rota)
    assert.ok(chave, i.nome)
    assert.ok(registro.includes(`t('${chave.split('/')[1]}'`), `${i.nome}: ${chave}`)
  }
})

test('a busca abre a Central completa com o texto', () => {
  assert.equal(rotaDaBusca('  '), ROTA_TODAS_FERRAMENTAS)
  assert.equal(rotaDaBusca(' noradrenalina '), '/plantonista?todas=1&q=noradrenalina')
  assert.equal(rotaDaBusca('K+ & Na'), '/plantonista?todas=1&q=K%2B%20%26%20Na')
})

test('polimento (unslop, RT em 23/11/2026): etiqueta em cada grupo, sem negrito, maiúsculas, setas ou estrelinhas', () => {
  for (const c of [...INICIO_ADULTO, ...INICIO_CRIANCA]) {
    if (c.itens.length) assert.ok(c.sigla.length > 0 && c.sigla.length <= 3, `${c.nome}: ${c.sigla}`)
  }
  const tela = readFileSync('src/components/plantonista/central/InicioCelular.tsx', 'utf8')
  for (const proibido of ['font-bold', 'uppercase', 'ArrowUpRight', 'Sparkles', 'shadow-halo', 'Boa noite']) {
    assert.ok(!tela.includes(proibido), proibido)
  }
  assert.match(tela, /titulo="Central do Médico"/)
})

test('cartões visuais (opção 2, RT em 23/11/2026): vitrine com o objeto do grupo, sem a etiqueta no cartão', () => {
  const tela = readFileSync('src/components/plantonista/central/InicioCelular.tsx', 'utf8')
  const cartao = tela.slice(tela.indexOf('function CartaoCategoria('), tela.indexOf('function PainelCategoria('))
  assert.match(cartao, /<VitrineDoGrupo icone=\{c\.icone\}/)
  assert.ok(!cartao.includes('<Etiqueta'), 'o cartão não leva a etiqueta da sigla')
  const objetos = readFileSync('src/components/plantonista/central/ObjetoDoGrupo.tsx', 'utf8')
  for (const id of ['urgencias', 'doses', 'calculadoras', 'escores', 'intoxicacao']) assert.match(objetos, new RegExp(`${id}: `))
  assert.ok(!/#[0-9a-fA-F]{6}/.test(objetos), 'só tokens, nenhuma cor fixa')
})
