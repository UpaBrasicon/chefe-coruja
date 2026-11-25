// node --experimental-strip-types --test src/lib/folhaPrescricao.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ehAtalhoPrescrever, etiquetaTipo, etiquetaValidade, faixaVencidos, indiceNovaLinha, linhaPosologia, numeroLinha, seloAlergiaFolha,
  teclasDoAtalho, textoItensVigentes, ultimaAtualizacao,
} from './folhaPrescricao.ts'

const agora = Date.parse('2026-11-24T12:00:00Z')
const h = (n: number) => new Date(agora + n * 3600_000).toISOString()

test('numeração da folha: dieta 01, itens a partir de 02, linha nova em seguida; editando, ED', () => {
  assert.equal(numeroLinha(1), '01')
  assert.equal(numeroLinha(12), '12')
  assert.equal(indiceNovaLinha(0, false), '02')
  assert.equal(indiceNovaLinha(3, false), '05')
  assert.equal(indiceNovaLinha(3, true), 'ED')
})

test('itens vigentes e última atualização', () => {
  assert.equal(textoItensVigentes(1), '1 item vigente')
  assert.equal(textoItensVigentes(0), '0 itens vigentes')
  assert.equal(textoItensVigentes(4), '4 itens vigentes')
  assert.equal(ultimaAtualizacao([]), null)
  assert.equal(ultimaAtualizacao([{ criado_em: h(-5) }, { criado_em: h(-1) }, { criado_em: h(-3) }]), h(-1))
})

test('segunda linha: o que o médico escreveu, como está, sem cálculo', () => {
  const med = { tipo: 'medicamento', dose: '1 g', via: 'EV', posologia: '6/6h', se_necessario: true, peso_kg: 70 }
  assert.equal(linhaPosologia(med), '1 g · EV · 6/6h · se necessário · peso ref. 70 kg')
  assert.equal(linhaPosologia({ ...med, se_necessario: false, peso_kg: null }), '1 g · EV · 6/6h')
  assert.equal(linhaPosologia({ ...med, dose: null, peso_kg: null, se_necessario: false }), 'EV · 6/6h')
  // cuidado e contenção não têm dose nem peso de referência
  assert.equal(linhaPosologia({ tipo: 'cuidado', dose: null, via: null, posologia: null, se_necessario: false, peso_kg: 70 }), '')
  assert.equal(linhaPosologia({ tipo: 'cuidado', dose: null, via: null, posologia: null, se_necessario: true, peso_kg: null }), 'se necessário')
})

test('etiquetas: tipo e validade em caixa normal', () => {
  assert.equal(etiquetaTipo('medicamento'), null)
  assert.equal(etiquetaTipo('cuidado'), 'Cuidado')
  assert.equal(etiquetaTipo('contencao'), 'Contenção')
  assert.equal(etiquetaValidade({ valida_ate: h(-1) }, agora)?.texto, 'Vencido')
  assert.equal(etiquetaValidade({ valida_ate: h(-1) }, agora)?.tom, 'critico')
  assert.match(etiquetaValidade({ valida_ate: h(1) }, agora)?.texto ?? '', /^Vence em /)
  assert.equal(etiquetaValidade({ valida_ate: h(10) }, agora), null)
  // "Agora" não vence
  assert.equal(etiquetaValidade({ valida_ate: null }, agora), null)
  // o servidor manda: vencido pelo servidor é vencido
  assert.equal(etiquetaValidade({ valida_ate: h(10), validade: 'vencido' }, agora)?.texto, 'Vencido')
})

test('faixa de vencidos: só com o que renovar, e sempre item a item', () => {
  assert.equal(faixaVencidos(0, 0), null)
  assert.equal(faixaVencidos(1, 0)?.texto, '1 item vencido (> 24 h) — a enfermagem não administra itens vencidos')
  assert.equal(faixaVencidos(2, 1)?.texto, '2 itens vencidos (> 24 h) — a enfermagem não administra itens vencidos')
  assert.equal(faixaVencidos(2, 1)?.tom, 'critico')
  assert.equal(faixaVencidos(0, 1)?.tom, 'atencao')
  assert.match(faixaVencidos(0, 2)?.texto ?? '', /^2 itens vencem em até 2 h/)
})

test('selo de alergia em três tons; lista vazia não é "nega"', () => {
  assert.deepEqual(seloAlergiaFolha('tem', ['Dipirona', 'Látex']), { texto: 'Dipirona, Látex', tom: 'critico' })
  assert.deepEqual(seloAlergiaFolha('nega', []), { texto: 'Nega alergias', tom: 'seguro' })
  assert.equal(seloAlergiaFolha('nao_registrada', []).tom, 'atencao')
  assert.equal(seloAlergiaFolha('desconhece', []).tom, 'atencao')
  // sem leitura não se afirma nada
  assert.deepEqual(seloAlergiaFolha(undefined, []), { texto: 'Não verificada', tom: 'atencao' })
})

test('atalho: Ctrl+Enter ou ⌘+Enter; Enter sozinho não prescreve', () => {
  assert.equal(ehAtalhoPrescrever({ key: 'Enter', ctrlKey: true, metaKey: false }), true)
  assert.equal(ehAtalhoPrescrever({ key: 'Enter', ctrlKey: false, metaKey: true }), true)
  assert.equal(ehAtalhoPrescrever({ key: 'Enter', ctrlKey: false, metaKey: false }), false)
  assert.equal(ehAtalhoPrescrever({ key: 'a', ctrlKey: true, metaKey: false }), false)
  assert.deepEqual(teclasDoAtalho(true), ['⌘', 'Enter'])
  assert.deepEqual(teclasDoAtalho(false), ['Ctrl', 'Enter'])
})
