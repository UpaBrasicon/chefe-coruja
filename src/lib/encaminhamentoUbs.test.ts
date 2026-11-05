import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { DESFECHO_RETORNO, destinosDoEnvio, etapasDoEnvio, linkRegulacaoDaConsulta, pedeBuscaAtiva, regulacaoDaFolha, SITUACAO_ENVIO, type EnvioUpa } from '../domain/encaminhamento.ts'
import { linkMarcarNaAgenda } from '../domain/agenda.ts'
import { itensDeNavegacao } from '../components/casca/navegacao.ts'

// 5A, tarefa 5 (decisões H1 a H5 e opção C da tela "Encaminhados", RT em
// 03/11/2026): envio da UBS à UPA, rastreio em etapas e regulação a partir da
// consulta. As situações repetem as do banco.
const migration = readFileSync('supabase/migrations/20270216000001_encaminhamento_upa.sql', 'utf8').replace(/\r/g, '')
const fmt = (iso: string) => iso.slice(11, 16)

const envio = (situacao: EnvioUpa['situacao'], extra: Partial<EnvioUpa> = {}): EnvioUpa => ({
  id: 'e1', numero: 7, situacao, motivo: 'Dor torácica típica', unidade_origem_id: 'u1', unidade_origem: 'UBS Centro',
  unidade_destino_id: 'u2', unidade_destino: 'UPA Norte', episodio_origem_id: 'ep1', paciente_id: 'p1', enviado_por: 'Dra. A',
  enviado_em: '2026-11-03T10:00:00Z', prazo_em: '2026-11-03T22:00:00Z', chegada_por: null, chegada_em: null, episodio_destino_id: null,
  observacao_chegada: null, cancelado_em: null, motivo_cancelamento: null,
  resumo: { paciente: { nome: 'Ana', nome_social: null, data_nascimento: null, sexo: null, cns: null, cpf: null, nome_mae: null },
    queixa: null, tipo_atendimento: null, prioridades_legais: null, cor_escuta: null, soap: null, sinais: null, sinais_em: null },
  ...extra,
})

test('as situações do envio são as do banco', () => {
  assert.match(migration, new RegExp(`situacao IN \\(${Object.keys(SITUACAO_ENVIO).map((s) => `'${s}'`).join(', ')}\\)`))
})

test('etapas do rastreio: enviado, aguardando, chegou / não chegou / cancelado', () => {
  assert.deepEqual(etapasDoEnvio(envio('enviado'), fmt).map((e) => e.estado), ['feita', 'atual', 'falta'])
  assert.match(etapasDoEnvio(envio('enviado'), fmt)[1].detalhe, /prazo até 22:00/)
  const chegou = etapasDoEnvio(envio('chegou', { chegada_em: '2026-11-03T11:30:00Z', chegada_por: 'Recepção B' }), fmt)
  assert.deepEqual(chegou.map((e) => e.estado), ['feita', 'feita', 'feita'])
  assert.match(chegou[2].detalhe, /11:30 · Recepção B/)
  const nao = etapasDoEnvio(envio('nao_chegou', { observacao_chegada: 'Sem registro de chegada em 12 horas' }), fmt)
  assert.deepEqual(nao.map((e) => e.estado), ['feita', 'feita', 'falhou'])
  assert.equal(nao[2].titulo, 'Não chegou à UPA Norte')
  const cancelado = etapasDoEnvio(envio('cancelado', { cancelado_em: '2026-11-03T10:05:00Z', motivo_cancelamento: 'Família levou' }), fmt)
  assert.deepEqual(cancelado.map((e) => e.estado), ['feita', 'falhou'])
})

test('H2: a regulação abre com paciente, tipo, CID e quadro da consulta', () => {
  assert.equal(linkRegulacaoDaConsulta({ paciente: 'p1', tipo: 'consulta' }), '/regulacao?paciente=p1&tipo=consulta')
  assert.equal(linkRegulacaoDaConsulta({ paciente: 'p1', tipo: 'leito', cid: 'I20.0', quadro: 'Dor & falta de ar', hipotese: null }),
    '/regulacao?paciente=p1&tipo=leito&cid=I20.0&quadro=Dor+%26+falta+de+ar')
  const reg = readFileSync('src/pages/regulacao/Regulacao.tsx', 'utf8')
  assert.match(reg, /const \[busca\] = useSearchParams\(\)/)
  assert.match(reg, /<NovaSolicitacao key=\{inicial\?\.paciente\.id \?\? 'nova'\}[^>]*inicial=\{inicial\} \/>/)
})

test('"Encaminhados" só aparece na UBS, para quem envia e acompanha', () => {
  for (const papel of ['recepcao', 'enfermeiro', 'plantonista', 'gestor'] as const) {
    assert.ok(itensDeNavegacao(papel, false, false, 'ubs').some((i) => i.to === '/encaminhados'), `${papel} sem Encaminhados na UBS`)
    assert.ok(!itensDeNavegacao(papel, false, false, 'upa').some((i) => i.to === '/encaminhados'), `${papel} vê Encaminhados na UPA`)
  }
  assert.ok(!itensDeNavegacao('farmaceutico', false, false, 'ubs').some((i) => i.to === '/encaminhados'))
  const app = readFileSync('src/App.tsx', 'utf8')
  assert.match(app, /papeis=\{\['recepcao', 'enfermeiro', 'plantonista', 'gestor'\]\} \/>\}>\s*<Route path="\/encaminhados"/)
})

test('H1/H3: a conduta, a escuta vermelha, a recepção da UPA e a janela levam ao envio', () => {
  const conduta = readFileSync('src/pages/plantao/porta/AbaConduta.tsx', 'utf8')
  assert.match(conduta, /const urgencia = condutas\.includes\('encaminhamento_urgencia'\)/)
  assert.match(conduta, /\{urgencia && unidadeAtiva && \(/)
  assert.match(conduta, /linkRegulacaoDaConsulta\(\{ paciente: pacienteId, tipo: regulacao/)
  const escuta = readFileSync('src/pages/enfermagem/triagem/EscutaInicial.tsx', 'utf8')
  assert.match(escuta, /\{cor === 'vermelho' && unidadeAtiva && \(/)
  const recepcao = readFileSync('src/pages/recepcao/Recepcao.tsx', 'utf8')
  assert.match(recepcao, /\{!ubs && <VindoDaUbs /)
  const janela = readFileSync('src/pages/plantao/porta/JanelaAtendimento.tsx', 'utf8')
  assert.match(janela, /<EnviosDoPaciente pacienteId=\{ep\.paciente_id\} \/>/)
  const notif = readFileSync('src/pages/Notificacoes.tsx', 'utf8')
  assert.match(notif, /if \(tipo\.startsWith\('ubs_upa_'\)\) return 'Encaminhamento'/)
  assert.match(migration, /p_tipo \|\| '_' \|\| x\.numero/)
})

test('H4: a folha SMS003a leva o número e o destino da regulação em andamento da unidade', () => {
  const r = (numero: number, status: string, criada_em: string, outra_unidade = false, destino: string | null = 'Hospital Teste') =>
    ({ numero, status, criada_em, outra_unidade, destino })
  assert.equal(regulacaoDaFolha([]), null)
  assert.equal(regulacaoDaFolha([r(1, 'rascunho', '2026-11-03'), r(2, 'realizada', '2026-11-02'), r(3, 'cancelada', '2026-11-01')]), null)
  assert.equal(regulacaoDaFolha([r(4, 'autorizada', '2026-11-03', true)]), null)
  assert.deepEqual(regulacaoDaFolha([r(5, 'enviada', '2026-11-01'), r(6, 'autorizada', '2026-11-03', false, null), r(7, 'negada', '2026-11-04')]),
    { numero: '6', destino: '', status: 'autorizada' })
  const folha = readFileSync('src/components/encaminhamento/EncaminhamentoSms003a.tsx', 'utf8').replace(/\r/g, '')
  // o que se digita vale por cima; a sugestão não entra no rascunho (TEXTOS lê só o formulário)
  assert.match(folha, /const numReg = f\.numReg\.trim\(\) \|\| daRegulacao\?\.numero \|\| ''/)
  assert.match(folha, /const destino = f\.destino\.trim\(\) \|\| daRegulacao\?\.destino \|\| ''/)
  assert.match(folha, / {6}destino,\n {6}destinoNaRede,\n {6}numReg,\n/)
})

// ── tarefa 6: retorno à UBS (decisões I1 a I5, RT em 03/11/2026) ────────────
const migRetorno = readFileSync('supabase/migrations/20270217000001_contrarreferencia_ubs.sql', 'utf8').replace(/\r/g, '')

test('I5: todo fim de atendimento que gera retorno tem rótulo; evasão e alta a pedido pedem busca ativa', () => {
  const porta = migRetorno.match(/coalesce\(NEW\.desfecho, ''\) IN \(([^)]*)\)/)![1].match(/'([a-z_]+)'/g)!.map((s) => s.slice(1, -1))
  const internacao = migRetorno.match(/altas text\[\] := ARRAY\[([^\]]*)\]/)![1].match(/'([a-z_]+)'/g)!.map((s) => s.slice(1, -1))
  assert.deepEqual(porta, ['alta', 'alta_apos_medicacao', 'alta_a_pedido', 'transferencia', 'evasao', 'obito'])
  for (const d of [...porta, ...internacao]) assert.ok(DESFECHO_RETORNO[d], `${d} sem rótulo`)
  assert.ok(pedeBuscaAtiva('evasao') && pedeBuscaAtiva('alta_a_pedido') && pedeBuscaAtiva('alta_evasao'))
  assert.ok(!pedeBuscaAtiva('alta') && !pedeBuscaAtiva('obito'))
})

test('I4: "Agendar retorno" marca pelo paciente da UBS, sem episódio de origem', () => {
  assert.equal(linkMarcarNaAgenda('p9', null, 'consulta_programada'), '/agenda-consultas?paciente=p9&consulta=consulta_programada')
  const retornos = readFileSync('src/pages/encaminhados/Retornos.tsx', 'utf8')
  assert.match(retornos, /linkMarcarNaAgenda\(r\.paciente_ubs_id, null, 'consulta_programada'\)/)
  assert.match(retornos, /rpc\('contrarreferencia_abrir', \{ p_id: r\.id \}\)/)
  const pagina = readFileSync('src/pages/encaminhados/Encaminhados.tsx', 'utf8')
  assert.match(pagina, /busca\.get\('aba'\) === 'retornos'/)
  const janela = readFileSync('src/pages/plantao/porta/JanelaAtendimento.tsx', 'utf8')
  assert.match(janela, /<RetornosDoPaciente pacienteId=\{ep\.paciente_id\} \/>/)
  const notif = readFileSync('src/pages/Notificacoes.tsx', 'utf8')
  assert.match(notif, /if \(tipo\.startsWith\('ubs_retorno_'\)\) return 'Retorno'/)
  assert.match(notif, /to: '\/encaminhados\?aba=retornos'/)
  assert.match(migRetorno, /'ubs_retorno_' \|\| x\.numero/)
})

test('I3: a orientação à UBS sai do desfecho da porta e da alta da internação, na chave que o banco lê', () => {
  assert.match(migRetorno, /d ->> 'orientacao_ubs'/)
  const desfecho = readFileSync('src/pages/plantao/porta/AbaDesfecho.tsx', 'utf8')
  assert.match(desfecho, /if \(d !== 'obito' && orientacaoUbs\.trim\(\)\) det\.orientacao_ubs = orientacaoUbs\.trim\(\)/)
  const alta = readFileSync('src/components/internacao/caderno/Alta.tsx', 'utf8')
  assert.match(alta, /if \(tipo !== 'obito' && orientacaoUbs\.trim\(\)\) detalhes\.orientacao_ubs = orientacaoUbs\.trim\(\)/)
})

test('Enviar à UPA: só UPA e hospital da rede, sem a própria unidade (pendência da 5A)', () => {
  const rede = [
    { id: 'h', nome: 'Hospital', tipo: 'hospital' },
    { id: 'eu', nome: 'UBS daqui', tipo: 'ubs' },
    { id: 'v', nome: 'UBS vizinha', tipo: 'ubs' },
    { id: 'u', nome: 'UPA', tipo: 'upa' },
    { id: 'c', nome: 'Clínica', tipo: 'clinica' },
  ]
  assert.deepEqual(destinosDoEnvio(rede, 'eu').map((u) => u.id), ['h', 'u'])
  // banco sem o tipo: não esconde nada (o servidor recusa o que não for UPA ou hospital)
  assert.deepEqual(destinosDoEnvio([{ id: 'v', nome: 'UBS vizinha' }, { id: 'eu', nome: 'UBS daqui' }], 'eu').map((u) => u.id), ['v'])
})
