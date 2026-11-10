// node --experimental-strip-types --test src/domain/controlados.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  avisoForaDaReceita, controleDoCatalogo, controleDoItem, destinoDoItem, nomeComparavel, RECEITA_DA_LISTA, ROTULO_RECEITA, rotuloSelo,
  separarReceita, substanciaNoNome, type SubstanciaControlada,
} from './controlados.ts'

// recorte da tabela da migration 20270324000001 (RDC 1.036/2026)
const tabela: SubstanciaControlada[] = [
  { substancia: 'Morfina', chave: 'morfina', grafias: [], lista: 'A1', item: 65, receita: 'notificacao_a', adendo: null },
  { substancia: 'Fentanila', chave: 'fentanila', grafias: ['fentanil'], lista: 'A1', item: 42, receita: 'notificacao_a', adendo: null },
  { substancia: 'Codeína', chave: 'codeina', grafias: [], lista: 'A2', item: 2, receita: 'controle_especial', adendo: 'Adendo 2 da lista A2' },
  { substancia: 'Tramadol', chave: 'tramadol', grafias: [], lista: 'A2', item: 13, receita: 'controle_especial', adendo: 'Adendo 3 da lista A2' },
  { substancia: 'Midazolam', chave: 'midazolam', grafias: [], lista: 'B1', item: 64, receita: 'notificacao_b', adendo: null },
  { substancia: 'Cetamina', chave: 'cetamina', grafias: [], lista: 'B1', item: 17, receita: 'so_estabelecimento', adendo: 'Adendo 14 da lista B1' },
  { substancia: 'Haloperidol', chave: 'haloperidol', grafias: [], lista: 'C1', item: 83, receita: 'controle_especial', adendo: null },
  { substancia: 'Ácido valpróico', chave: 'acido valproico', grafias: [], lista: 'C1', item: 2, receita: 'controle_especial', adendo: null },
  { substancia: 'Valproato sódico', chave: 'valproato sodico', grafias: ['valproato de sodio'], lista: 'C1', item: 205, receita: 'controle_especial', adendo: null },
]

test('receita que a lista exige para casa (Portaria 344)', () => {
  assert.equal(RECEITA_DA_LISTA.A1, 'notificacao_a')
  assert.equal(RECEITA_DA_LISTA.A3, 'notificacao_a')
  assert.equal(RECEITA_DA_LISTA.B1, 'notificacao_b')
  assert.equal(RECEITA_DA_LISTA.B2, 'notificacao_b2')
  assert.equal(RECEITA_DA_LISTA.C1, 'controle_especial')
  assert.equal(RECEITA_DA_LISTA.C5, 'controle_especial')
  assert.equal(ROTULO_RECEITA.notificacao_a, 'Notificação de Receita A (amarela)')
  assert.equal(ROTULO_RECEITA.notificacao_b, 'Notificação de Receita B (azul)')
  assert.equal(ROTULO_RECEITA.controle_especial, 'Receita de Controle Especial (branca, 2 vias)')
})

test('selo: "Controlado · B1"', () => {
  assert.equal(rotuloSelo('B1'), 'Controlado · B1')
  assert.equal(rotuloSelo('C1'), 'Controlado · C1')
})

test('catálogo: colunas controlado_* viram o controle; sem lista, nulo', () => {
  assert.deepEqual(controleDoCatalogo({ controlado_lista: 'C1', controlado_substancia: 'Haloperidol', controlado_receita: 'controle_especial' }),
    { lista: 'C1', substancia: 'Haloperidol', receita: 'controle_especial' })
  assert.deepEqual(controleDoCatalogo({ lista: 'B1', substancia: 'Midazolam', receita: 'notificacao_b' }),
    { lista: 'B1', substancia: 'Midazolam', receita: 'notificacao_b' })
  // receita desconhecida: a da lista
  assert.equal(controleDoCatalogo({ controlado_lista: 'A1', controlado_receita: 'qualquer' })?.receita, 'notificacao_a')
  assert.equal(controleDoCatalogo({ controlado_lista: null }), null)
  assert.equal(controleDoCatalogo({ controlado_lista: 'Z9' }), null)
  assert.equal(controleDoCatalogo(null), null)
})

test('nome comparável: o mesmo do banco', () => {
  assert.equal(nomeComparavel('  Cloridrato de TRAMADOL 50mg '), 'cloridrato de tramadol 50mg')
  assert.equal(nomeComparavel('Ácido valpróico (Depakene®)'), 'acido valproico depakene')
  assert.equal(nomeComparavel(null), '')
})

test('nome escrito: casa a palavra inteira, sal e éster incluídos', () => {
  assert.equal(substanciaNoNome('Haloperidol 5 mg comprimido', tabela)?.lista, 'C1')
  assert.equal(substanciaNoNome('Decanoato de haloperidol', tabela)?.substancia, 'Haloperidol')
  assert.equal(substanciaNoNome('Cloridrato de tramadol 50 mg', tabela)?.substancia, 'Tramadol')
  assert.equal(substanciaNoNome('Citrato de fentanil', tabela)?.substancia, 'Fentanila')
  assert.equal(substanciaNoNome('Valproato de sódio 250 mg', tabela)?.item, 205)
  assert.equal(substanciaNoNome('Ácido valpróico 250 mg', tabela)?.item, 2)
  // parte de outra palavra não casa
  assert.equal(substanciaNoNome('Hidromorfona', tabela), null)
  assert.equal(substanciaNoNome('Divalproato de sódio', tabela), null)
  assert.equal(substanciaNoNome('Dipirona 500 mg', tabela), null)
  assert.equal(substanciaNoNome('', tabela), null)
})

test('nome com duas substâncias: a lista mais restrita', () => {
  assert.equal(substanciaNoNome('Paracetamol + codeína + morfina', tabela)?.substancia, 'Morfina')
  assert.equal(substanciaNoNome('Haloperidol e midazolam', tabela)?.lista, 'B1')
})

test('destino na receita para casa', () => {
  const halo = controleDoCatalogo({ controlado_lista: 'C1', controlado_substancia: 'Haloperidol', controlado_receita: 'controle_especial' })
  const mid = controleDoCatalogo({ controlado_lista: 'B1', controlado_substancia: 'Midazolam', controlado_receita: 'notificacao_b' })
  const mor = controleDoCatalogo({ controlado_lista: 'A1', controlado_substancia: 'Morfina', controlado_receita: 'notificacao_a' })
  const cet = controleDoCatalogo({ controlado_lista: 'B1', controlado_substancia: 'Cetamina', controlado_receita: 'so_estabelecimento' })
  const tra = controleDoCatalogo({ controlado_lista: 'A2', controlado_substancia: 'Tramadol', controlado_receita: 'controle_especial' })
  assert.deepEqual(destinoDoItem(halo), { tipo: 'controle_especial', controle: halo })
  assert.deepEqual(destinoDoItem(tra), { tipo: 'controle_especial', controle: tra })   // adendo 3 da A2
  assert.equal(destinoDoItem(mid).tipo, 'fora')
  assert.equal(destinoDoItem(mor).tipo, 'fora')
  assert.equal(destinoDoItem(cet).tipo, 'fora')
  // a marca à mão não tira o controle conhecido da Notificação
  assert.equal(destinoDoItem(mid, true).tipo, 'fora')
  // sem controle conhecido: a marca à mão decide
  assert.deepEqual(destinoDoItem(null), { tipo: 'comum' })
  assert.deepEqual(destinoDoItem(null, true), { tipo: 'controle_especial', controle: null })
})

test('aviso do item que não sai na receita', () => {
  assert.equal(avisoForaDaReceita({ lista: 'B1', substancia: 'Midazolam', receita: 'notificacao_b' }),
    'Midazolam (lista B1): exige Notificação de Receita B (azul), o talão numerado da vigilância sanitária. Não sai nesta receita: remova o item e use o talão.')
  assert.equal(avisoForaDaReceita({ lista: 'A1', substancia: null, receita: 'notificacao_a' }),
    'Lista A1: exige Notificação de Receita A (amarela), o talão numerado da vigilância sanitária. Não sai nesta receita: remova o item e use o talão.')
  assert.equal(avisoForaDaReceita({ lista: 'B1', substancia: 'Cetamina', receita: 'so_estabelecimento' }),
    'Cetamina (lista B1): uso só no estabelecimento de saúde (Portaria 344). Não sai na receita para casa.')
})

test('separar a receita: comum, controle especial e fora', () => {
  const itens = [
    { nome: 'Dipirona 500 mg', mao: false },
    { nome: 'Haloperidol 5 mg', mao: false },
    { nome: 'Diazepam 10 mg (fora da tabela)', mao: false },
    { nome: 'Midazolam 15 mg', mao: false },
    { nome: 'Amitriptilina 25 mg', mao: true },
  ]
  const destino = (i: (typeof itens)[number]) => {
    const s = substanciaNoNome(i.nome, tabela)
    return destinoDoItem(s ? { lista: s.lista, substancia: s.substancia, receita: s.receita } : null, i.mao)
  }
  const r = separarReceita(itens, destino)
  assert.deepEqual(r.comuns.map((i) => i.nome), ['Dipirona 500 mg', 'Diazepam 10 mg (fora da tabela)'])
  assert.deepEqual(r.controleEspecial.map((i) => i.nome), ['Haloperidol 5 mg', 'Amitriptilina 25 mg'])
  assert.deepEqual(r.fora.map((f) => f.item.nome), ['Midazolam 15 mg'])
  assert.match(r.fora[0].aviso, /Notificação de Receita B \(azul\)/)
})

test('controle do item: o cadastro pelo id; senão, a tabela pelo nome', () => {
  const catalogo = new Map([['id-halo', { lista: 'C1' as const, substancia: 'Haloperidol', receita: 'controle_especial' as const }]])
  assert.equal(controleDoItem('qualquer nome', 'id-halo', catalogo, tabela)?.lista, 'C1')
  // item do cadastro sem marca, mas o nome casa: a tabela vale
  assert.equal(controleDoItem('Midazolam 15 mg', 'id-sem-marca', catalogo, tabela)?.lista, 'B1')
  // escrito à mão: a tabela, com o adendo
  assert.deepEqual(controleDoItem('Tramadol 50 mg cápsula', null, catalogo, tabela),
    { lista: 'A2', substancia: 'Tramadol', receita: 'controle_especial', adendo: 'Adendo 3 da lista A2' })
  assert.equal(controleDoItem('Dipirona', null, catalogo, tabela), null)
  // tabela ainda não carregada: só o cadastro
  assert.equal(controleDoItem('Midazolam', null, catalogo, undefined), null)
})
