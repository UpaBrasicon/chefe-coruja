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

// M1 da revisão do médico (RT, 24/11/2026): as observações que o médico abriu
// entram na lista única, no grupo "Que abri", e a aba conta os dois grupos.
test('o painel mostra o grupo "Que abri" ao médico e tira o que já está nele', () => {
  assert.match(painel, /const ehMedico = mostraSecao\(papelAtivo\)/)
  // OB2 (RT, 24/11/2026): vencidos primeiro, nos dois grupos
  assert.match(painel, /const minhas = ehMedico \? ordenarObservacao\(semDuplicar\(queAbri\.data \?\? \[\], linhas\.map\(\(l\) => l\.internacao_id\)\), agora\) : \[\]/)
  assert.match(painel, /<Grupo titulo="Que abri" n=\{visMinhas\.length\} \/>/)
  assert.match(painel, /<Grupo titulo="Do meu setor" n=\{vis\.length\} \/>/)
  assert.match(painel, /<LinhaQueAbri key=\{o\.internacao_id\} o=\{o\} agora=\{agora\} unidadeId=\{unidadeId!\} \/>/)
  // o contador da aba soma os dois grupos: não diz 3 e 0 ao mesmo tempo
  assert.match(painel, /const emObservacao = ativas\.length \+ minhas\.length/)
  assert.match(painel, /Em observação <span[^>]*>\{emObservacao\}<\/span>/)
})

test('o grupo lê só observacoes_que_abri', () => {
  assert.match(painel, /supabase\.rpc\('observacoes_que_abri', \{ p_unidade: unidadeId! \}\)/)
  assert.match(painel, /enabled: !!unidadeId && ehMedico/)
  assert.match(painel, /error\?\.code === 'PGRST202'\) return \[\]/)
  assert.match(secao, /Você abriu esta observação pela porta/)
})

// Decisão do RT em 07/11/2026 (B P2-2, migration 20270307000005): além de
// encerrar, quem abriu a observação pede parecer e marca a reavaliação.
// Decisão do RT em 08/11/2026 (migration 20270308000008): quem abriu também
// registra alergia enquanto a observação está aberta.
// M3 da revisão do médico (RT, 24/11/2026): "Definir conduta" (o antigo "Encerrar
// observação") é o botão da linha; "Reavaliar", "Pedir parecer" e "Alergias" vão
// para o menu "…"; a alergia aparece como ficha ao lado do nome.
test('cada linha tem "Definir conduta" e, no menu, "Reavaliar", "Pedir parecer" e "Alergias", com os painéis do box', () => {
  assert.equal((secao.match(/<Button\b/g) ?? []).length, 1)
  const botoes = [...secao.matchAll(/>([^<>]+)<\/Button>/g)].map((m) => m[1].trim())
  assert.deepEqual(botoes, ['Definir conduta'])
  // OO1 (RT, 24/11/2026): as ações abrem numa gaveta lateral, uma por vez
  assert.match(secao, /<Button size="sm" onClick=\{\(\) => alternar\('desfecho'\)\}>/)
  assert.match(secao, /<Gaveta aberta=\{aberto\}/)
  const menu = [...secao.matchAll(/\{ chave: '(\w+)', rotulo: '([^']+)'/g)].map((m) => m[2])
  assert.deepEqual(menu, ['Reavaliar', 'Pedir parecer', 'Alergias'])
  assert.match(secao, /<SeloAlergia pacienteId=\{o\.paciente_id\} \/>/)
  assert.match(secao, /<AlergiasEventos pacienteId=\{o\.paciente_id\} \/>/)
  assert.match(secao, /<PainelDesfecho linha=\{\{ \.\.\.o, nome: nomeExibido\(o\) \}\} unidadeId=\{unidadeId\} acao=\{acao\} fechar=\{fechar\} erro=\{erro\} \/>/)
  assert.match(secao, /<PainelReavaliar linha=\{o\} acao=\{acao\} fechar=\{fechar\} erro=\{erro\} \/>/)
  assert.match(secao, /<AbaParecer pacienteId=\{o\.paciente_id\} internacaoId=\{o\.internacao_id\} \/>/)
  // nada de atender, reavaliado, protocolo, passagem, prancheta, prescrever, evoluir ou acuidade
  for (const proibido of ['observacao_atender', 'observacao_reavaliado', 'Protocolo', 'PainelPassar',
    'Prancheta', 'LeitoAberto', 'prescrever', 'registrar_evolucao', 'Acuidade', 'CartaoObservacao']) {
    assert.ok(!codigo.includes(proibido), `a seção não deve ter ${proibido}`)
  }
  // o desfecho só precisa da internação e do paciente; a reavaliação, só da internação
  assert.match(paineis, /linha: Pick<LinhaObservacao, 'internacao_id' \| 'paciente_id'> & \{ nome\?: string \| null; data_nascimento\?: string \| null \}\n\s*unidadeId: string/)
  assert.match(paineis, /export function PainelReavaliar\(\{ linha, acao, fechar, erro \}: \{ linha: Pick<LinhaObservacao, 'internacao_id'>;/)
})

test('a RPC devolve só os campos do cartão, com segundo fator e pela regra do autor', () => {
  assert.match(migration, /RETURNS TABLE\(internacao_id uuid, paciente_id uuid, nome text, nome_social text, data_nascimento date,\s*setor_nome text, box text, entrada timestamptz, prazo timestamptz\)/)
  assert.match(migration, /PERFORM private\.exigir_segundo_fator\(\);/)
  assert.match(migration, /AND private\.abriu_a_observacao\(i\)/)
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.observacoes_que_abri\(uuid\) FROM PUBLIC, anon;/)
})
