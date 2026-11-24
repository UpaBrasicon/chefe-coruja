// TR1–TR3 (revisão do perfil Enfermeiro, RT 24/11/2026)
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { notaIdosoVisivel, passosTriagem } from './triagemPassos.ts'

test('TR1: passos na ordem do protocolo, com a prioridade por último e a gestação antes dela', () => {
  assert.deepEqual(passosTriagem(false).map((p) => `${p.n} ${p.titulo}`),
    ['1 Queixa e contexto', '2 Fluxograma', '3 Discriminador', '4 Sinais vitais', '5 Prioridade'])
  assert.deepEqual(passosTriagem(true).map((p) => p.id),
    ['queixa', 'fluxograma', 'discriminador', 'vitais', 'gestacao', 'prioridade'])
})

test('TR2: a nota do idoso só a partir de 65 anos (idade desconhecida mantém a nota)', () => {
  assert.equal(notaIdosoVisivel(64), false)
  assert.equal(notaIdosoVisivel(65), true)
  assert.equal(notaIdosoVisivel(90), true)
  assert.equal(notaIdosoVisivel(3), false)
  assert.equal(notaIdosoVisivel(null), true)
})

test('TR1: a tela não pré-seleciona a cor e chama o mesmo RPC; gestação dentro do formulário', () => {
  const tela = readFileSync('src/pages/enfermagem/triagem/Classificar.tsx', 'utf8')
  assert.match(tela, /React\.useState<CorRisco \| null>\(r\?\.cor \?\? null\)/)
  assert.match(tela, /supabase\.rpc\('classificar_risco'/)
  const iGest = tela.indexOf("passo('gestacao')")
  const iPrio = tela.indexOf("<Passo passo={passo('prioridade')}")
  const iReg = tela.indexOf('Registrar classificação')
  assert.ok(iGest > 0 && iGest < iPrio && iPrio < iReg)
  assert.match(tela, /mostrarNotaIdoso && \(/)
})
