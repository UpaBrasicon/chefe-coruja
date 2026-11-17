import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// 5A, tarefa 2, parte 2.2 (D3 e D7 do RT em 02/11/2026): na UBS a recepção
// abre a ficha no consultório com o tipo de atendimento, e a fila do médico
// não tem cor nem alvo.
const recepcao = readFileSync('src/pages/recepcao/Recepcao.tsx', 'utf8')
const fila = readFileSync('src/pages/plantao/porta/FilaPS.tsx', 'utf8')

test('a recepção da UBS abre a ficha no consultório, com o tipo de atendimento', () => {
  assert.match(recepcao, /\.eq\('tipo', ubs \? 'consultorio' : 'emergencia'\)/)
  assert.match(recepcao, /tipo_atendimento: tipoAps/)
  assert.match(recepcao, /if \(ubs && !tipoAps\) return setErroLocal\('Escolha o tipo de atendimento\.'\)/)
  assert.match(recepcao, /TIPOS_ATENDIMENTO_APS\.map/)
})

test('na UBS a recepção não mostra painel; a fila da enfermagem é a escuta, e o consultório ordena por prioridade e chegada', () => {
  assert.match(recepcao, /const abas = ubs \? ABAS_UBS : ABAS/)
  const abasUbs = recepcao.match(/const ABAS_UBS[\s\S]*?\n\]/)![0]
  assert.doesNotMatch(abasUbs, /ABAS\[3\]/)
  // percurso da UBS (R9, 17/11/2026): a "triagem" vira a fila da enfermagem
  assert.match(abasUbs, /\{ \.\.\.ABAS\[1\], rotulo: 'Fila da enfermagem'/)
  // parte 2.4: a cor da escuta ordena; quem aguarda a escuta fica na fila da enfermagem
  assert.match(recepcao, /const todos = \(fila\.data \?\? \[\]\)\.filter\(\(e\) => e\.etapa !== 'triagem'\)/)
  assert.match(recepcao, /return \[\.\.\.todos\.filter\(\(e\) => !e\.atendimento_iniciado_em\)\.sort\(ordemFilaUbs\)/)
})

test('a fila do médico na UBS não tem cor nem alvo e mostra a conduta nas saídas', () => {
  assert.match(fila, /\.sort\(ubs \? ordemFilaUbs : ordemMedica\)/)
  assert.match(fila, /\{!ubs && <Cabeca col="cor"/)
  assert.match(fila, /const acimaDoAlvo = ubs \? 0 :/)
  assert.match(fila, /if \(!ubs\) q = q\.not\('desfecho', 'is', null\)/)
  assert.match(fila, /rotuloCondutaAps\(conduta\[0\]\)/)
})
