// node --experimental-strip-types --test src/lib/prontuarioLinhaTempo.test.ts
// Prontuário completo (achado guardado, item 6; decisão do RT em 06/11/2026:
// A em P1 a P7, direção A): agrupamento por atendimento e por aferição.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  agruparAfericoes, anoCarregado, juntarPaginas, montarLinhaTempo, principais, resumoInternacao, rotuloLeito, textoItemPrescricao,
  type InternacaoBruta, type ObservacaoBruta, type PaginaProntuario, type RegistroBruto,
} from './prontuarioLinhaTempo.ts'

const vazio = (): PaginaProntuario => ({
  resumo: { atendimentos: 0, internacoes: 0, ultimo_em: null, anos: [] },
  mais: false, proximo_antes: null,
  atendimentos: [], internacoes: [], classificacoes: [], registros: [], exames: [],
  documentos: [], prescricoes: [], observacoes: [], nomes: {}, resultados: {},
})

const atendimento = (id: string, chegada_em: string, extra: Partial<PaginaProntuario['atendimentos'][number]> = {}) => ({
  id, paciente_id: 'pac', unidade_id: 'upa', setor_id: 'ps', etapa: 'encerrado', queixa: 'dor torácica',
  chegada_em, encerrado_em: chegada_em, desfecho: 'alta', desfecho_em: chegada_em, cor_atual: null,
  medico_id: 'med', cid_aps: null, cid_desfecho: null, ...extra,
})

const obs = (id: string, conceito: string, aferido_em: string, valor_num: number | null, extra: Partial<ObservacaoBruta> = {}): ObservacaoBruta => ({
  id, episodio_id: 'ep1', internacao_id: null, aferido_em, conceito, unidade_padrao: null, valor_num, valor_texto: null, unidade: null, ...extra,
})

test('atendimentos do mais recente para o mais antigo, com unidade, setor e médico pelos nomes', () => {
  const p = vazio()
  p.atendimentos = [
    atendimento('ep-velho', '2025-03-10T12:00:00Z'),
    atendimento('ep-novo', '2026-11-06T10:52:00Z', { etapa: 'observacao', encerrado_em: null, desfecho: 'observacao' }),
    atendimento('ep-meio', '2026-08-14T22:10:00Z'),
  ]
  p.nomes = { upa: 'UPA Centro', ps: 'Pronto-Socorro', med: 'Médico Teste' }
  const { grupos } = montarLinhaTempo(p)
  assert.deepEqual(grupos.map((g) => g.chave), ['ep-novo', 'ep-meio', 'ep-velho'])
  assert.equal(grupos[0].unidade, 'UPA Centro')
  assert.equal(grupos[0].setor, 'Pronto-Socorro')
  assert.equal(grupos[0].medico, 'Médico Teste')
  assert.equal(grupos[0].situacao.emCurso, true)
  assert.equal(grupos[1].situacao.emCurso, false)
  assert.equal(grupos[1].situacao.rotulo, 'Alta')
  // data no fuso de Brasília: 22:10 UTC de 14/08 ainda é 14/08 em Brasília
  assert.equal(grupos[1].dia, '2026-08-14')
  assert.equal(grupos[2].ano, 2025)
})

test('reclassificação: a primeira cor e as reclassificações em ordem, sem trocar a cor da enfermagem', () => {
  const p = vazio()
  p.atendimentos = [atendimento('ep1', '2026-11-06T10:52:00Z', { cor_atual: 'laranja' })]
  p.classificacoes = [
    { id: 'c3', episodio_id: 'ep1', cor: 'vermelho', reclassificacao: true, criado_em: '2026-11-06T13:00:00Z', discriminador: null, fluxograma_nome: null },
    { id: 'c1', episodio_id: 'ep1', cor: 'amarelo', reclassificacao: false, criado_em: '2026-11-06T10:58:00Z', discriminador: 'Dor moderada', fluxograma_nome: 'Dor torácica' },
    { id: 'c2', episodio_id: 'ep1', cor: 'laranja', reclassificacao: true, criado_em: '2026-11-06T11:40:00Z', discriminador: null, fluxograma_nome: null },
  ]
  const [g] = montarLinhaTempo(p).grupos
  assert.equal(g.classificacao?.cor, 'amarelo')
  assert.deepEqual(g.reclassificacoes.map((c) => c.cor), ['laranja', 'vermelho'])
})

test('sem classificação gravada, vale a cor do atendimento; sem nenhuma, fica sem cor', () => {
  const p = vazio()
  p.atendimentos = [atendimento('ep1', '2026-11-06T10:52:00Z', { cor_atual: 'verde' }), atendimento('ep2', '2026-11-05T10:52:00Z')]
  const [a, b] = montarLinhaTempo(p).grupos
  assert.equal(a.classificacao?.cor, 'verde')
  assert.equal(b.classificacao, null)
})

test('registros do atendimento do mais novo ao mais antigo (como os sinais vitais), só a última versão de cada documento, internação pelo episódio', () => {
  const p = vazio()
  p.atendimentos = [atendimento('ep1', '2026-11-06T10:00:00Z')]
  p.internacoes = [{ id: 'int1', episodio_id: 'ep1', status: 'em_observacao', tipo_internacao: 'observacao', unidade_id: 'upa',
    setor_id: 'obs', leito_id: 'l4', data_admissao: '2026-11-06T12:00:00Z', internado_em: null, data_alta: null,
    cid_principal: 'J18.9', cid_alta: null, motivo_alta: null }]
  p.registros = [{ id: 'r1', episodio_id: 'ep1', criado_em: '2026-11-06T11:15:00Z', subjetivo: 'dispneia há 3 dias', objetivo: null,
    avaliacao: null, cid: 'J18.9', plano: null, autor_id: 'med' }]
  p.documentos = [
    { id: 'd1v1', documento_raiz_id: 'd1', versao: 1, tipo_documento: 'evolucao', conteudo: 'v1', estado: 'retificado', created_at: '2026-11-06T13:00:00Z', episodio_id: null, internacao_id: 'int1', autor_id: 'med' },
    { id: 'd1v2', documento_raiz_id: 'd1', versao: 2, tipo_documento: 'evolucao', conteudo: 'v2', estado: 'assinado', created_at: '2026-11-06T13:30:00Z', episodio_id: null, internacao_id: 'int1', autor_id: 'med' },
  ]
  p.prescricoes = [{ id: 'p1', episodio_id: 'ep1', internacao_id: null, status: 'ativa', created_at: '2026-11-06T11:30:00Z',
    assinada_em: null, medico_id: 'med', itens: [{ id: 'i1', descricao: 'Dipirona', dose: '1 g', posologia: '6/6h', via: 'EV', suspenso_em: null }] }]
  p.exames = [{ id: 'x1', episodio_id: null, internacao_id: 'int1', exame: 'Hemograma', situacao: 'resultado', urgencia: 'rotina',
    resultado: null, pedido_em: '2026-11-06T12:30:00Z', resolvido_em: '2026-11-06T14:00:00Z', pedido_por: 'med' }]
  p.resultados = { x1: { versao: 1, texto: 'Hb 12', liberado_em: '2026-11-06T14:00:00Z', itens: [] } }
  p.nomes = { obs: 'Observação', l4: 'Leito 4', med: 'Médico Teste' }
  const [g] = montarLinhaTempo(p).grupos
  assert.deepEqual(g.registros.map((r) => r.id), ['d1v2', 'x1', 'int1', 'p1', 'r1'])
  assert.equal(g.internacoes[0].setor, 'Observação')
  assert.equal(g.internacoes[0].leito, 'Leito 4')
  // a porta encerrou, mas a observação segue: o atendimento está em curso
  assert.equal(g.situacao.emCurso, true)
  const exame = g.registros.find((r) => r.tipo === 'exame')
  assert.equal(exame?.tipo === 'exame' && exame.resultado?.texto, 'Hb 12')
  assert.equal(g.cid, 'J18.9')
})

test('situação: internação em curso manda sobre o encerramento da porta; alta da internação dá o desfecho', () => {
  const p = vazio()
  const int = { id: 'int1', episodio_id: 'ep1', status: 'internado', tipo_internacao: 'urgencia', unidade_id: 'upa', setor_id: 's', leito_id: null,
    data_admissao: '2026-11-06T12:00:00Z', internado_em: null, data_alta: null, cid_principal: 'I10', cid_alta: null, motivo_alta: null }
  p.atendimentos = [atendimento('ep1', '2026-11-06T10:00:00Z', { desfecho: 'internacao' })]
  p.internacoes = [int]
  assert.equal(montarLinhaTempo(p).grupos[0].situacao.emCurso, true)
  p.internacoes = [{ ...int, status: 'alta_melhorada', data_alta: '2026-11-08T12:00:00Z', cid_alta: 'I11' }]
  const g = montarLinhaTempo(p).grupos[0]
  assert.equal(g.situacao.emCurso, false)
  assert.equal(g.situacao.rotulo, 'Alta')
  assert.equal(g.cid, 'I11')
})

test('registro sem episódio vai para "Sem atendimento ligado", no fim', () => {
  const p = vazio()
  p.atendimentos = [atendimento('ep1', '2026-11-06T10:00:00Z')]
  p.documentos = [{ id: 'd1', documento_raiz_id: 'd1', versao: 1, tipo_documento: 'atestado', conteudo: 'texto', estado: 'assinado',
    created_at: '2024-01-02T10:00:00Z', episodio_id: null, internacao_id: null, autor_id: null }]
  p.observacoes = [obs('o1', 'peso', '2024-01-02T10:00:00Z', 70, { episodio_id: null })]
  const { grupos } = montarLinhaTempo(p)
  assert.deepEqual(grupos.map((g) => g.tipo), ['atendimento', 'sem_atendimento'])
  assert.equal(grupos[1].titulo, 'Sem atendimento ligado')
  assert.equal(grupos[1].registros.length, 1)
  assert.equal(grupos[1].afericoes.length, 1)
})

test('registro de atendimento que não veio na lista fica num grupo próprio, sem se misturar', () => {
  const p = vazio()
  p.atendimentos = [atendimento('ep1', '2026-11-06T10:00:00Z')]
  p.documentos = [{ id: 'd1', documento_raiz_id: 'd1', versao: 1, tipo_documento: 'evolucao', conteudo: 'texto', estado: 'assinado',
    created_at: '2025-01-02T10:00:00Z', episodio_id: 'ep-fora', internacao_id: null, autor_id: null }]
  const { grupos } = montarLinhaTempo(p)
  assert.deepEqual(grupos.map((g) => g.tipo), ['atendimento', 'fora_da_lista'])
  assert.equal(grupos[0].registros.length, 0)
})

test('cadastro unificado: atendimentos dos dois cadastros juntos, cada registro no seu atendimento', () => {
  const pagina1 = vazio()
  pagina1.atendimentos = [atendimento('ep-a', '2026-11-06T10:00:00Z', { paciente_id: 'cadastro-principal' })]
  pagina1.documentos = [{ id: 'd-a', documento_raiz_id: 'd-a', versao: 1, tipo_documento: 'evolucao', conteudo: 'a', estado: 'assinado',
    created_at: '2026-11-06T11:00:00Z', episodio_id: 'ep-a', internacao_id: null, autor_id: null }]
  pagina1.mais = true
  pagina1.proximo_antes = '2026-11-06T10:00:00Z'
  const pagina2 = vazio()
  pagina2.atendimentos = [atendimento('ep-b', '2025-05-01T10:00:00Z', { paciente_id: 'cadastro-absorvido' })]
  pagina2.documentos = [{ id: 'd-b', documento_raiz_id: 'd-b', versao: 1, tipo_documento: 'evolucao', conteudo: 'b', estado: 'assinado',
    created_at: '2025-05-01T11:00:00Z', episodio_id: 'ep-b', internacao_id: null, autor_id: null }]
  const dados = juntarPaginas([pagina1, pagina2])
  assert.equal(dados.mais, false)
  const { grupos } = montarLinhaTempo(dados)
  assert.deepEqual(grupos.map((g) => g.chave), ['ep-a', 'ep-b'])
  assert.deepEqual(grupos.map((g) => g.registros.map((r) => r.id)), [['d-a'], ['d-b']])
})

test('aferição: uma linha por horário, colunas fixas, valores crus; a mais recente primeiro', () => {
  const linhas = agruparAfericoes([
    obs('a1', 'pressao-arterial-sistolica', '2026-11-06T10:58:00Z', 142),
    obs('a2', 'pressao-arterial-diastolica', '2026-11-06T10:58:00Z', 90),
    obs('a3', 'frequencia-cardiaca', '2026-11-06T10:58:00Z', 112),
    obs('a4', 'temperatura', '2026-11-06T10:58:00Z', 38.6),
    obs('a5', 'saturacao-o2', '2026-11-06T10:58:00Z', 89),
    obs('a6', 'escala-dor', '2026-11-06T10:58:00Z', 5),
    obs('a7', 'glicemia-capilar', '2026-11-06T10:58:00Z', 210),
    obs('a8', 'frequencia-respiratoria', '2026-11-06T10:58:00Z', 26),
    obs('a9', 'peso', '2026-11-06T10:58:00Z', 70.5, { unidade_padrao: 'kg' }),
    obs('b1', 'frequencia-cardiaca', '2026-11-06T13:00:00Z', 96),
  ])
  assert.equal(linhas.length, 2)
  assert.equal(linhas[0].em, '2026-11-06T13:00:00Z')
  assert.deepEqual(linhas[1], {
    em: '2026-11-06T10:58:00Z', pa: '142/90', fc: '112', fr: '26', temp: '38,6', spo2: '89', glicemia: '210', dor: '5',
    outras: [{ nome: 'peso', valor: '70,5 kg' }],
  })
})

test('aferição incompleta: o que não foi medido fica vazio, a PA pela metade mostra o traço', () => {
  const [l] = agruparAfericoes([
    obs('a1', 'pressao-arterial-sistolica', '2026-11-06T10:58:00Z', 128),
    obs('a2', 'temperatura', '2026-11-06T10:58:00Z', null, { valor_texto: 'afebril' }),
  ])
  assert.equal(l.pa, '128/—')
  assert.equal(l.temp, 'afebril')
  assert.equal(l.fc, null)
  assert.equal(l.dor, null)
  assert.deepEqual(l.outras, [])
})

test('observação da internação entra no atendimento pela internação', () => {
  const p = vazio()
  p.atendimentos = [atendimento('ep1', '2026-11-06T10:00:00Z')]
  p.internacoes = [{ id: 'int1', episodio_id: 'ep1', status: 'em_observacao', tipo_internacao: 'observacao', unidade_id: 'upa', setor_id: null,
    leito_id: null, data_admissao: '2026-11-06T12:00:00Z', internado_em: null, data_alta: null, cid_principal: null, cid_alta: null, motivo_alta: null }]
  p.observacoes = [obs('o1', 'frequencia-cardiaca', '2026-11-06T14:00:00Z', 80, { episodio_id: null, internacao_id: 'int1' })]
  const [g] = montarLinhaTempo(p).grupos
  assert.equal(g.afericoes.length, 1)
})

// Ajuste do polish (RT, 06/11/2026): o atendimento aberto mostra o último de cada tipo.
const soap = (id: string, criado_em: string, extra: Partial<RegistroBruto> = {}): RegistroBruto => ({
  id, episodio_id: 'ep1', criado_em, subjetivo: 's', objetivo: null, avaliacao: null, cid: null, plano: null, autor_id: null, ...extra,
})
const doc = (id: string, tipo_documento: string, created_at: string) => ({
  id, documento_raiz_id: id, versao: 1, tipo_documento, conteudo: 'texto', estado: 'assinado', created_at, episodio_id: 'ep1', internacao_id: null, autor_id: null,
})
const prescricao = (id: string, created_at: string) => ({
  id, episodio_id: 'ep1', internacao_id: null, status: 'ativa', created_at, assinada_em: null, medico_id: null, itens: [],
})
const exame = (id: string, pedido_em: string, extra: Partial<PaginaProntuario['exames'][number]> = {}) => ({
  id, episodio_id: 'ep1', internacao_id: null, exame: 'Exame ' + id, situacao: 'pedido', urgencia: 'rotina', resultado: null,
  pedido_em, resolvido_em: null, pedido_por: null, ...extra,
})
const internacao = (extra: Partial<InternacaoBruta> = {}): InternacaoBruta => ({
  id: 'int1', episodio_id: 'ep1', status: 'em_observacao', tipo_internacao: 'observacao', unidade_id: 'upa', setor_id: null, leito_id: null,
  data_admissao: '2026-11-06T12:00:00Z', internado_em: null, data_alta: null, cid_principal: null, cid_alta: null, motivo_alta: null, ...extra,
})

test('aberto mostra o último de cada tipo: SOAP, evolução, prescrição vigente, exames com resultado e internação', () => {
  const p = vazio()
  p.atendimentos = [atendimento('ep1', '2026-11-06T10:00:00Z')]
  p.registros = [soap('r-velho', '2026-11-06T10:15:00Z'), soap('r-novo', '2026-11-06T16:00:00Z')]
  p.documentos = [doc('ev-velha', 'evolucao', '2026-11-06T13:00:00Z'), doc('ev-nova', 'evolucao', '2026-11-06T18:00:00Z'),
    doc('atestado', 'atestado', '2026-11-06T18:30:00Z')]
  p.prescricoes = [prescricao('p-velha', '2026-11-06T10:30:00Z'), prescricao('p-vigente', '2026-11-06T15:00:00Z')]
  p.exames = [
    exame('x-liberado', '2026-11-06T10:40:00Z', { situacao: 'resultado' }),
    exame('x-texto', '2026-11-06T11:00:00Z', { situacao: 'resultado', resultado: 'Raio X sem consolidação' }),
    exame('x-pedido', '2026-11-06T11:10:00Z'),
  ]
  p.resultados = { 'x-liberado': { versao: 1, texto: 'Hb 12', liberado_em: '2026-11-06T12:00:00Z', itens: [] } }
  p.internacoes = [internacao()]
  const [g] = montarLinhaTempo(p).grupos
  const { mostrados, escondidos, tipos } = principais(g.registros)
  // do mais novo ao mais antigo, como os sinais vitais
  assert.deepEqual(mostrados.map((r) => r.id), ['ev-nova', 'r-novo', 'p-vigente', 'int1', 'x-texto', 'x-liberado'])
  assert.equal(escondidos, 5)
  assert.deepEqual(tipos, ['documentos', 'evolução', 'exames', 'prescrições', 'registros do atendimento'])
})

test('exame ainda sem resultado e documento que não é evolução vão para o "+N registros"', () => {
  const p = vazio()
  p.atendimentos = [atendimento('ep1', '2026-11-06T10:00:00Z')]
  p.registros = [soap('r1', '2026-11-06T11:15:00Z')]
  p.prescricoes = [prescricao('p1', '2026-11-06T11:30:00Z')]
  p.exames = [exame('x1', '2026-11-06T11:40:00Z')]
  p.documentos = [doc('d1', 'sumario_alta', '2026-11-06T12:00:00Z')]
  const [g] = montarLinhaTempo(p).grupos
  const { mostrados, escondidos, tipos } = principais(g.registros)
  assert.deepEqual(mostrados.map((r) => r.id), ['p1', 'r1'])
  assert.equal(escondidos, 2)
  assert.deepEqual(tipos, ['documentos', 'exames'])
})

test('sem nenhum dos principais, mostra os três mais recentes', () => {
  const p = vazio()
  p.atendimentos = [atendimento('ep1', '2026-11-06T10:00:00Z')]
  p.exames = ['x1', 'x2', 'x3', 'x4'].map((id, i) => exame(id, `2026-11-06T1${i}:00:00Z`))
  const { mostrados, escondidos } = principais(montarLinhaTempo(p).grupos[0].registros)
  assert.deepEqual(mostrados.map((r) => r.id), ['x4', 'x3', 'x2'])
  assert.equal(escondidos, 1)
})

test('CID do último SOAP é o mais recente, com a lista do mais novo ao mais antigo', () => {
  const p = vazio()
  p.atendimentos = [atendimento('ep1', '2026-11-06T10:00:00Z')]
  p.registros = [soap('r1', '2026-11-06T11:00:00Z', { cid: 'R50.9' }), soap('r2', '2026-11-06T15:00:00Z', { cid: 'J18.9' })]
  assert.equal(montarLinhaTempo(p).grupos[0].cid, 'J18.9')
})

test('leito: não repete a palavra quando o nome já começa por "Leito"', () => {
  assert.equal(rotuloLeito('Leito 4'), 'Leito 4')
  assert.equal(rotuloLeito('leito 12A'), 'leito 12A')
  assert.equal(rotuloLeito('12A'), 'leito 12A')
  assert.equal(rotuloLeito(null), null)
})

test('item da prescrição: a dose não se repete quando a descrição já a traz', () => {
  const item = { id: 'i1', descricao: 'Ceftriaxona 1 g', dose: '1 g', posologia: '24/24h', via: 'IV', suspenso_em: null }
  assert.equal(textoItemPrescricao(item), 'Ceftriaxona 1 g · IV · 24/24h')
  assert.equal(textoItemPrescricao({ ...item, descricao: 'Ceftriaxona  1G' }), 'Ceftriaxona  1G · IV · 24/24h')
  assert.equal(textoItemPrescricao({ ...item, descricao: 'Oxigênio por cateter nasal', dose: '2 L/min', via: 'inalatória', posologia: 'contínuo' }),
    'Oxigênio por cateter nasal · dose 2 L/min · inalatória · contínuo')
  assert.equal(textoItemPrescricao({ ...item, descricao: 'Dipirona', dose: null, via: null, posologia: null }), 'Dipirona')
})

test('resumo do atendimento fechado: internação e observação com os dias, pela data de Brasília', () => {
  assert.equal(resumoInternacao([]), null)
  const int = internacao({ status: 'alta', tipo_internacao: 'clinica', data_admissao: '2025-12-12T21:00:00Z', data_alta: '2025-12-18T14:00:00Z' })
  assert.equal(resumoInternacao([int]), 'internação · 6 dias')
  assert.equal(resumoInternacao([{ ...int, data_alta: '2025-12-13T14:00:00Z' }]), 'internação · 1 dia')
  // 23h de Brasília do dia 12 até 01h do dia 13: mudou o dia
  assert.equal(resumoInternacao([{ ...int, tipo_internacao: 'observacao', data_admissao: '2025-12-13T02:00:00Z', data_alta: '2025-12-13T04:00:00Z' }]),
    'observação · 1 dia')
  assert.equal(resumoInternacao([{ ...int, tipo_internacao: 'observacao', data_admissao: '2025-12-13T12:00:00Z', data_alta: '2025-12-13T18:00:00Z' }]),
    'observação · menos de 1 dia')
  // da primeira entrada à última alta
  assert.equal(resumoInternacao([
    { ...int, tipo_internacao: 'observacao', data_admissao: '2025-12-10T12:00:00Z', data_alta: '2025-12-11T12:00:00Z' },
    { ...int, id: 'int2' },
  ]), 'internação · 8 dias')
  // sem alta gravada não se contam dias
  assert.equal(resumoInternacao([{ ...int, data_alta: null }]), 'internação')
})

test('navegação por ano: o ano está inteiro quando já veio um atendimento de ano anterior ou não há mais', () => {
  const chegadas = ['2026-11-06T10:00:00Z', '2026-02-20T10:00:00Z']
  assert.equal(anoCarregado(chegadas, 2026, true), false)
  assert.equal(anoCarregado([...chegadas, '2025-12-12T10:00:00Z'], 2026, true), true)
  assert.equal(anoCarregado(chegadas, 2026, false), true)
  assert.equal(anoCarregado(chegadas, 2025, true), false)
})
