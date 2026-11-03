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

test('na UBS a recepção não mostra triagem nem painel e ordena por prioridade e chegada', () => {
  assert.match(recepcao, /const abas = ubs \? ABAS_UBS : ABAS/)
  assert.doesNotMatch(recepcao.match(/const ABAS_UBS[\s\S]*?\n\]/)![0], /ABAS\[1\]|ABAS\[3\]/)
  assert.match(recepcao, /if \(ubs\) return \[\.\.\.lista\.filter\(\(e\) => !e\.atendimento_iniciado_em\)\.sort\(ordemTriagem\)/)
})

test('a fila do médico na UBS não tem cor nem alvo e mostra a conduta nas saídas', () => {
  assert.match(fila, /\.sort\(ubs \? ordemTriagem : ordemMedica\)/)
  assert.match(fila, /\{!ubs && <Cabeca col="cor"/)
  assert.match(fila, /const acimaDoAlvo = ubs \? 0 :/)
  assert.match(fila, /if \(!ubs\) q = q\.not\('desfecho', 'is', null\)/)
  assert.match(fila, /rotuloCondutaAps\(conduta\[0\]\)/)
})
