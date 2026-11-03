import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { CLASSIFICACAO_CAB28, ordemFilaUbs, SAIDAS_AZUL } from '../domain/aps.ts'

// 5A, tarefa 2, parte 2.4 (decisões E1 a E4 e opção C do RT, 02/11/2026):
// escuta inicial da UBS com a classificação da demanda espontânea do CAB 28.
const migration = readFileSync('supabase/migrations/20270213000001_escuta_inicial_ubs.sql', 'utf8').replace(/\r/g, '')
const escuta = readFileSync('src/pages/enfermagem/triagem/EscutaInicial.tsx', 'utf8')
const triagem = readFileSync('src/pages/enfermagem/Triagem.tsx', 'utf8')
const espera = readFileSync('src/pages/enfermagem/triagem/Espera.tsx', 'utf8')
const atend = readFileSync('src/pages/plantao/porta/AbaAtendimento.tsx', 'utf8')

test('as cores e as saídas da tela são as do banco (CAB 28, sem laranja)', () => {
  assert.deepEqual(CLASSIFICACAO_CAB28.map((c) => c.cor), ['vermelho', 'amarelo', 'verde', 'azul'])
  assert.match(migration, /p_cor NOT IN \('vermelho', 'amarelo', 'verde', 'azul'\)/)
  assert.deepEqual(SAIDAS_AZUL.map((s) => s.valor), ['orientacao', 'agendamento'])
  assert.match(migration, /saida_escuta IN \('orientacao', 'agendamento', 'consulta'\)/)
  // só o azul não é agudo, e só ele encerra na escuta
  assert.deepEqual(CLASSIFICACAO_CAB28.filter((c) => !c.aguda).map((c) => c.cor), ['azul'])
})

test('fila do médico na UBS: imediato, prioritário, depois prioridade legal e chegada', () => {
  const ep = (id: string, cor: string | null, chegada: string, prio: string[] = []) =>
    ({ id, cor_atual: cor, chegada_em: `2026-11-02T${chegada}:00Z`, prioridades_legais: prio })
  const fila = [
    ep('verde-cedo', 'verde', '08:00'),
    ep('sem-escuta-idoso', null, '08:30', ['idoso_80']),
    ep('amarelo', 'amarelo', '09:00'),
    ep('vermelho', 'vermelho', '09:30'),
    ep('sem-escuta', null, '07:50'),
  ].sort(ordemFilaUbs)
  assert.deepEqual(fila.map((e) => e.id), ['vermelho', 'amarelo', 'sem-escuta-idoso', 'sem-escuta', 'verde-cedo'])
})

test('a tela registra pela RPC do CAB 28, sem pré-selecionar cor', () => {
  assert.match(escuta, /supabase\.rpc\('registrar_escuta_aps'/)
  assert.match(escuta, /p_saida: cor === 'azul' \? saidaAzul! : 'consulta'/)
  assert.match(escuta, /React\.useState<CorCab28 \| null>\(null\)/)
  assert.match(escuta, /<CamposVitais publico=\{publico\} opcionais/)
})

test('na UBS a página da triagem é a escuta: sem alvo, sem reclassificar, sem a folha da porta', () => {
  assert.match(triagem, /\{ubs\s+\? <EscutaInicial /)
  assert.match(triagem, /const acima = ubs \? 0 :/)
  assert.match(triagem, /\{!ubs && \(\s*<Button[^>]*\s*onClick=\{\(\) => void imprimirRelatorio/)
  assert.match(espera, /const acima = !ubs && /)
  assert.match(espera, /\{!ubs && \(\s*<Button size="sm" variant="outline" onClick=\{\(\) => onReclassificar\(e\)\}>/)
  // o médico vê a escuta na janela
  assert.match(atend, /\{ubs && triagem && \(/)
})
