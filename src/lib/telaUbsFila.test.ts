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

test('U2 do percurso da UBS: as filas mostram a espera pelo formatarDuracao, nunca minutos crus', () => {
  assert.match(recepcao, /\{formatarDuracao\(espera\)\}/)
  assert.doesNotMatch(recepcao, /\{espera\} min/)
  const fila = readFileSync('src/pages/enfermagem/triagem/Fila.tsx', 'utf8')
  assert.match(fila, /\{esperaTexto\(e\.chegada_em\)\}/)
  const espera = readFileSync('src/pages/enfermagem/triagem/Espera.tsx', 'utf8')
  assert.match(espera, /\{formatarDuracao\(desde\)\}/)
})

test('U8 do percurso da UBS: escuta com DUM, azul abre a agenda e a recepção avisa quando não há enfermeiro', () => {
  const escuta = readFileSync('src/pages/enfermagem/triagem/EscutaInicial.tsx', 'utf8')
  assert.match(escuta, /p_dum: pedeDum && dum \? dum : undefined/)
  assert.match(escuta, /const pedeDum = !\/\^m\/i\.test\(ep\.paciente\?\.sexo \?\? ''\)/)
  assert.match(escuta, /if \(cor === 'azul' && saidaAzul === 'agendamento'\) \{\s*navigate\(linkMarcarNaAgenda\(ep\.paciente_id, ep\.id\)\)/)
  assert.doesNotMatch(escuta, /EnviarUpa|Ambulance/)
  assert.match(recepcao, /const semEnfermeiro = ubs && tipoAps === 'escuta_inicial' && r\.etapa === 'atendimento'/)
})

test('U10 do percurso da UBS: o CID do SOAP conta como problema avaliado na conduta', () => {
  const conduta = readFileSync('src/pages/plantao/porta/AbaConduta.tsx', 'utf8')
  assert.match(conduta, /\{ ok: problemas\.length > 0 \|\| !!cidSoap, texto: 'Ao menos um problema ou condição avaliada' \}/)
  assert.match(conduta, /o CID do registro do atendimento, já conta como problema avaliado/)
})

test('U6, PR 3 do percurso da UBS: a janela da consulta de enfermagem tem só as abas do enfermeiro', () => {
  const janela = readFileSync('src/pages/plantao/porta/JanelaAtendimento.tsx', 'utf8')
  assert.match(janela, /const consultaEnfermagem = !!ep\.tipo_atendimento_aps && papelAtivo === 'enfermeiro'/)
  assert.match(janela, /consultaEnfermagem \? \['atend', 'alg', 'aval', 'proc', 'conduta'\]\.includes\(a\.k\)/)
  const conduta = readFileSync('src/pages/plantao/porta/AbaConduta.tsx', 'utf8')
  assert.match(conduta, /\{urgencia && unidadeAtiva && !enfermagem && \(/)
  assert.match(conduta, /\{regulacao && !enfermagem && \(/)
})
