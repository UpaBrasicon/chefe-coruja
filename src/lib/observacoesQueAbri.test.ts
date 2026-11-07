// node --experimental-strip-types --test src/lib/observacoesQueAbri.test.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { mostraSecao, nomeExibido, semDuplicar } from './observacoesQueAbri.ts'

// Decisão do RT em 06/11/2026 ("Sim, mostrar"): o médico da porta vê as
// observações que abriu, só para encerrá-las (migration 20270305000002).
const ler = (f: string) => readFileSync(f, 'utf8').replace(/\r/g, '')
const secao = ler('src/components/observacao/ObservacoesQueAbri.tsx')
// o código sem os comentários (o cabeçalho cita o que a seção não faz)
const codigo = secao.split('\n').filter((l) => !/^\s*(\/\/|\{\/\*)/.test(l)).join('\n')
const painel = ler('src/components/observacao/PainelObservacao.tsx')
const paineis = ler('src/components/observacao/PaineisCartao.tsx')
const migration = ler('supabase/migrations/20270305000002_observacoes_que_abri.sql')

test('sem cartão duplicado: o que já está no painel normal sai da seção', () => {
  const minhas = [{ internacao_id: 'a' }, { internacao_id: 'b' }, { internacao_id: 'c' }]
  assert.deepEqual(semDuplicar(minhas, ['b']).map((o) => o.internacao_id), ['a', 'c'])
  assert.deepEqual(semDuplicar(minhas, []).map((o) => o.internacao_id), ['a', 'b', 'c'])
  assert.deepEqual(semDuplicar(minhas, ['a', 'b', 'c']), [])
})

test('nome social na frente; seção só do médico', () => {
  assert.equal(nomeExibido({ nome: 'Maria Silva', nome_social: null }), 'Maria Silva')
  assert.equal(nomeExibido({ nome: 'João Silva', nome_social: 'Joana' }), 'Joana (João Silva)')
  assert.equal(mostraSecao('plantonista'), true)
  for (const p of ['gestor', 'admin', 'enfermeiro', 'tecnico_enfermagem', 'recepcao', null, undefined]) assert.equal(mostraSecao(p), false)
})

test('o painel mostra a seção ao médico e passa o que já está nele', () => {
  assert.match(painel, /mostraSecao\(papelAtivo\) && \(\s*<ObservacoesQueAbri unidadeId=\{unidadeId\} agora=\{agora\} noPainel=\{linhas\.map\(\(l\) => l\.internacao_id\)\} \/>/)
})

test('a seção lê só observacoes_que_abri e tira os repetidos', () => {
  assert.match(secao, /supabase\.rpc\('observacoes_que_abri', \{ p_unidade: unidadeId \}\)/)
  assert.match(secao, /const minhas = semDuplicar\(lista\.data \?\? \[\], noPainel\)/)
  assert.match(secao, /error\?\.code === 'PGRST202'\) return \[\]/)
  assert.match(secao, /Observações que você abriu/)
})

test('cada cartão tem só "Encerrar observação", que abre o painel de desfecho do box', () => {
  assert.equal((secao.match(/<Button\b/g) ?? []).length, 1)
  const botoes = [...secao.matchAll(/>([^<>]+)<\/Button>/g)].map((m) => m[1].trim())
  assert.deepEqual(botoes, ['Encerrar observação'])
  assert.match(secao, /<PainelDesfecho linha=\{o\} unidadeId=\{unidadeId\} acao=\{acao\} fechar=\{fechar\} erro=\{erro\} \/>/)
  // nada de atender, reavaliar, protocolo, passagem, prancheta, prescrever, evoluir, alergia ou acuidade
  for (const proibido of ['observacao_atender', 'observacao_reavaliar', 'observacao_reavaliado', 'Protocolo', 'PainelPassar',
    'Prancheta', 'LeitoAberto', 'prescrever', 'registrar_evolucao', 'SeloAlergia', 'Acuidade', 'CartaoObservacao']) {
    assert.ok(!codigo.includes(proibido), `a seção não deve ter ${proibido}`)
  }
  // o desfecho só precisa da internação e do paciente
  assert.match(paineis, /linha: Pick<LinhaObservacao, 'internacao_id' \| 'paciente_id'>; unidadeId: string/)
})

test('a RPC devolve só os campos do cartão, com segundo fator e pela regra do autor', () => {
  assert.match(migration, /RETURNS TABLE\(internacao_id uuid, paciente_id uuid, nome text, nome_social text, data_nascimento date,\s*setor_nome text, box text, entrada timestamptz, prazo timestamptz\)/)
  assert.match(migration, /PERFORM private\.exigir_segundo_fator\(\);/)
  assert.match(migration, /AND private\.abriu_a_observacao\(i\)/)
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.observacoes_que_abri\(uuid\) FROM PUBLIC, anon;/)
})
