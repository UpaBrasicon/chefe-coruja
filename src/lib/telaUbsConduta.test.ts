import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// 5A, tarefa 2, parte 2.3 (D7 do RT e opção C da aba Conduta, 02/11/2026): a
// janela da consulta da UBS não tem cor, reavaliação, reclassificação nem o
// Desfecho da porta; encerra pela aba Conduta (registrar_conduta_aps).
const janela = readFileSync('src/pages/plantao/porta/JanelaAtendimento.tsx', 'utf8')
const conduta = readFileSync('src/pages/plantao/porta/AbaConduta.tsx', 'utf8')
const atend = readFileSync('src/pages/plantao/porta/AbaAtendimento.tsx', 'utf8')
const sms = readFileSync('src/components/encaminhamento/EncaminhamentoSms003a.tsx', 'utf8')

test('a janela da UBS troca o Desfecho pela Conduta e tira cor, reavaliação e procedimentos', () => {
  assert.match(janela, /const ubs = !!ep\.tipo_atendimento_aps/)
  assert.match(janela, /ubs \? !\['reav', 'proc', 'fim'\]\.includes\(a\.k\) : a\.k !== 'conduta'/)
  assert.match(janela, /const ultimaCor = ubs \? null :/)
  assert.match(janela, /onClassificacao=\{ubs \? undefined :/)
  assert.match(janela, /<AbaConduta /)
  // o rodapé da UBS não tem "Aguardar reavaliação"
  assert.match(janela, /\{ubs\s+(\/\/[^\n]*\s+)?\? aba !== 'conduta' && <Button[^\n]*setAba\('conduta'\)[^\n]*Encerrar consulta/)
})

test('a aba Atendimento da UBS não mostra a classificação nem reclassifica', () => {
  assert.match(atend, /\{!ubs && \(\s*<section id=\{`triagem-/)
  assert.match(atend, /\{!ubs && <Reclassificar /)
})

test('a Conduta segue a ficha do e-SUS APS e encerra por registrar_conduta_aps', () => {
  assert.match(conduta, /TIPOS_ATENDIMENTO_APS\.map/)
  assert.match(conduta, /PROBLEMAS_APS/)
  assert.match(conduta, /useTerminologia\('cid10'/)
  assert.match(conduta, /CONDUTAS_APS\.filter\(\(c\) => c\.grupo === g\)/)
  assert.match(conduta, /supabase\.rpc\('registrar_conduta_aps'/)
  // o rascunho do SOAP vira registro antes, como no Desfecho
  assert.ok(conduta.indexOf("rpc('registrar_soap'") < conduta.indexOf("rpc('registrar_conduta_aps'"))
  // a única saída pelo desfecho da porta é a evasão
  assert.match(conduta, /p_desfecho: 'evasao'/)
  assert.doesNotMatch(conduta, /p_desfecho: '(?!evasao)/)
})

test('o SMS003a da UBS não mostra o lembrete da regulação do internado', () => {
  assert.match(sms, /avisoRegulacao = !!pacienteFixo/)
  assert.match(sms, /\{pacienteFixo && avisoRegulacao && \(/)
})
