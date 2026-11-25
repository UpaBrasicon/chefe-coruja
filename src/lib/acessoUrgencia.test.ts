// node --experimental-strip-types --test src/lib/acessoUrgencia.test.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { letrasDaJustificativa, MIN_LETRAS_URGENCIA, podeAbrirUrgencia } from './acessoUrgencia.ts'

// Ajustes da revisão, item 6 (RT, 24/11/2026): quebra de vidro no prontuário

test('justificativa: contam só as letras, com acento', () => {
  assert.equal(letrasDaJustificativa('Ação é ótima 12 !!'), 10)
  assert.equal(letrasDaJustificativa('   '), 0)
  assert.ok(letrasDaJustificativa('urgente agora 123') < MIN_LETRAS_URGENCIA)
  assert.ok(letrasDaJustificativa('Paciente voltou em parada, preciso das alergias') >= MIN_LETRAS_URGENCIA)
})

test('só o médico abre a urgência', () => {
  assert.ok(podeAbrirUrgencia('plantonista'))
  assert.ok(podeAbrirUrgencia('telemedicina'))
  for (const p of ['enfermeiro', 'gestor', 'farmaceutico', 'recepcao', null]) assert.ok(!podeAbrirUrgencia(p), String(p))
})

test('a tela do pedido usa a RPC da urgência e o selo conhece o status', () => {
  const tela = readFileSync('src/pages/prontuario/PedidosProntuario.tsx', 'utf8')
  assert.match(tela, /rpc\('abrir_acesso_urgencia'/)
  assert.match(tela, /podeAbrirUrgencia\(papelAtivo\)/)
  const selo = readFileSync('src/components/prontuario/StatusPedido.tsx', 'utf8')
  assert.match(selo, /'urgencia'/)
})
