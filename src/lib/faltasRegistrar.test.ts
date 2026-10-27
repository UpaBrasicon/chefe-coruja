import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Ponto 3 das telas do farmacêutico (RT, 27/10/2026): "Quem cadastra o que está
// em falta?". A farmácia registra na própria aba Faltas, com qualquer saldo; a
// enfermagem não ganha botão (decisão do RT).
const tela = readFileSync('src/pages/farmacia/Farmacia.tsx', 'utf8')

test('a aba Faltas tem Registrar falta, também quando não há falta', () => {
  const faltas = tela.slice(tela.indexOf('function Faltas('), tela.indexOf('function RegistrarFalta('))
  assert.match(faltas, /Registrar falta/)
  const vazio = faltas.slice(faltas.indexOf('if (abertas.data?.length === 0 && lista.data?.length === 0)'))
  assert.match(vazio.slice(0, 300), /\{registrar\}/)
})

test('registrar falta usa a mesma sinalizar_falta, com observação', () => {
  const ficha = tela.slice(tela.indexOf('function RegistrarFalta('), tela.indexOf('function ListaFaltas('))
  assert.match(ficha, /sinalizar_falta', \{ p_unidade: unidade, p_medicamento: escolhido!\.medicamento_id, p_observacao:/)
  assert.match(ficha, /farmacia_estoque/)
})
