// SH1 (revisão do perfil Enfermeiro, RT 24/11/2026)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { avisoDoPerfil, perfisDoAviso, separarPorPerfil } from './avisosPerfil.ts'

test('o prazo da regulação é do médico, não da enfermagem; a chegada regulada é dos dois', () => {
  assert.equal(avisoDoPerfil('reg_prazo_evolucao_123', 'enfermeiro'), false)
  assert.equal(avisoDoPerfil('reg_prazo_evolucao_123', 'plantonista'), true)
  assert.equal(avisoDoPerfil('reg_saiu', 'enfermeiro'), true)
  assert.equal(avisoDoPerfil('reg_saiu', 'tecnico_enfermagem'), true)
})

test('prescrição vencida e leito liberado são da enfermagem; escala e mensagem são de todos', () => {
  assert.equal(avisoDoPerfil('presc_vencida_9', 'enfermeiro'), true)
  assert.equal(avisoDoPerfil('leito_liberado', 'tecnico_enfermagem'), true)
  assert.equal(perfisDoAviso('solic_troca_1'), null)
  assert.equal(avisoDoPerfil('chat_42', 'farmaceutico'), true)
  assert.equal(avisoDoPerfil('noite_inicio', 'enfermeiro'), false)
})

test('sem perfil escolhido tudo é do perfil; a separação mantém a ordem', () => {
  assert.equal(avisoDoPerfil('reg_prazo_1', null), true)
  const lista = [{ tipo: 'reg_prazo_1' }, { tipo: 'presc_vencida_2' }, { tipo: 'reg_evolucao_3' }, { tipo: 'vaga_4' }]
  const { doPerfil, outros } = separarPorPerfil(lista, 'enfermeiro')
  assert.deepEqual(doPerfil.map((x) => x.tipo), ['presc_vencida_2', 'vaga_4'])
  assert.deepEqual(outros.map((x) => x.tipo), ['reg_prazo_1', 'reg_evolucao_3'])
})

test('E1: o número de não lidos (tela e menu) conta só os avisos do perfil em uso', () => {
  // a lista simples (master) ou a agrupada (homologação): o número vem do que é do perfil
  assert.match(readFileSync('src/pages/Notificacoes.tsx', 'utf8'), /separarPorPerfil\((todos|grupos), papelAtivo\)\.doPerfil/)
  assert.ok(readFileSync('src/components/casca/useNotasNav.ts', 'utf8').includes('separarPorPerfil(avisos.data ?? [], papel).doPerfil'))
})

test('TE-a: no Técnico a classificação do dia aparece sem o botão das escalas', () => {
  const agora = readFileSync('src/components/enfermagem/AbaAgora.tsx', 'utf8')
  assert.ok(agora.includes("de hoje pendente{souEnfermeiro ? '.' : ' (enfermeiro)'}"))
  assert.ok(agora.includes("{souEnfermeiro && <Button size=\"sm\" variant=\"outline\" onClick={() => onIr('esc')}>"))
})

