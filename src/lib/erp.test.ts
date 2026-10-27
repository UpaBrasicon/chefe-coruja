// node --experimental-strip-types --test src/lib/erp.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { competenciaDaVersao, contarSituacoes, csvContas, csvPlantoes, horas, nomeArquivoErp, plantoesSemPresenca, porProfissional, situacaoErp,
  type LinhaPlantao, type VersaoConta, type VersaoPlantoes } from './erp.ts'

const ret = { erp_id: 'NF-1', recebida_em: '2026-10-26T14:00:00-03:00', valor_lancado: 13, em: '2026-10-26T14:00:00-03:00' }
const conta = (o: Partial<VersaoConta> = {}): VersaoConta => ({
  id: 'v1', conta_id: 'c1', numero: 'A-2026.000412', tipo: 'ambulatorial', pagador: 'sus', unidade: { id: 'u', nome: 'UPA', cnes: '1' },
  prontuario: 'P-1', conta_origem: null, atendimento_inicio: null, atendimento_fim: null, fechada_em: null, faturada_em: '2026-10-26T14:02:00-03:00',
  versao: 1, situacao: 'vigente', total: 13.74, total_referencia: 24.24,
  itens: [
    { origem: 'atendimento', procedimento: '0301060029', nome: 'ATENDIMENTO', quantidade: 1, realizado_em: null, competencia: '202609', valor_unitario: 11, valor_total: 11, faturavel: true },
    { origem: 'registro', procedimento: '0204030153', nome: 'RX; TORAX', quantidade: 1, realizado_em: null, competencia: '202609', valor_unitario: 10.5, valor_total: 10.5, faturavel: false },
  ],
  medicamentos: [{ medicamento: 'Dipirona', unidade_consumo: 'ampola', dispensado: 2, devolvido: 1, liquido: 1, administrado: 1, fora_da_conta: false }],
  glosas: [], gerada_em: '', substituida_em: null, alterada_em: '', conciliacao: 'pendente', retorno: null, ...o,
})

test('situação para quem confere', () => {
  assert.equal(situacaoErp(conta()), 'aguardando')
  assert.equal(situacaoErp(conta({ conciliacao: 'divergente', retorno: ret })), 'divergente')
  assert.equal(situacaoErp(conta({ conciliacao: 'conciliada', retorno: ret })), 'conciliada')
  assert.equal(situacaoErp(conta({ situacao: 'substituida', conciliacao: 'conciliada', retorno: ret })), 'estornar')
  assert.equal(situacaoErp(conta({ situacao: 'substituida', conciliacao: 'pendente' })), 'substituida')
  assert.equal(situacaoErp(conta({ situacao: 'substituida', conciliacao: 'estornada', retorno: ret })), 'estornada')
  assert.deepEqual(contarSituacoes([conta(), conta(), conta({ conciliacao: 'divergente', retorno: ret })]), { aguardando: 2, divergente: 1 })
})

test('competência da versão', () => {
  assert.equal(competenciaDaVersao(conta()), '09/2026')
  assert.equal(competenciaDaVersao(conta({ itens: [] })), '10/2026')
})

const linha = (o: Partial<LinhaPlantao> & { pid?: string; nome?: string } = {}): LinhaPlantao => ({
  plantao_id: 'p', data: '2026-09-04', turno: 'manha', setor: { id: 's', nome: 'PS' }, inicio: '2026-09-04T10:00:00Z', duracao_min: 360,
  fracionado: false, checkin_em: '2026-09-04T10:00:00Z', checkout_em: '2026-09-04T16:00:00Z', checkout_automatico: false,
  minutos_presentes: 360, situacao: 'realizado', tipo_falta: null, valor_referencia: 900, valor: 900, ...o,
  profissional: { id: o.pid ?? 'a', nome: o.nome ?? 'Ana', cpf: '52998224725', conselho: 'CRM', registro: '123', registro_uf: 'SP', cbo: '225125' },
})

test('plantões por profissional', () => {
  const r = porProfissional([
    linha(), linha({ checkout_em: null, minutos_presentes: null }),
    linha({ situacao: 'falta_justificada', checkin_em: null, minutos_presentes: null, valor: 0, tipo_falta: 'atestado_medico' }),
    linha({ pid: 'b', nome: 'Bruno', situacao: 'sem_presenca', checkin_em: null, minutos_presentes: null, valor: 0 }),
    linha({ pid: 'b', nome: 'Bruno', valor_referencia: null, valor: null }),
  ])
  assert.deepEqual(r.map((p) => [p.nome, p.plantoes, p.realizados, p.faltas, p.semPresenca, p.semCheckout, p.minutos, p.valor, p.semValor]), [
    ['Ana', 3, 2, 1, 0, 1, 360, 1800, 0],
    ['Bruno', 2, 1, 0, 1, 0, 360, 0, 1],
  ])
  assert.equal(r[0].conselho, 'CRM 123/SP')
  assert.equal(horas(342 * 60), '342 h')
  assert.equal(horas(90), '1 h 30 min')
  assert.equal(plantoesSemPresenca(1), '1 plantão sem presença vai')
  assert.equal(plantoesSemPresenca(2), '2 plantões sem presença vão')
})

test('arquivo CSV: uma linha por procedimento e por medicamento; plantões com o profissional', () => {
  const c = csvContas([conta({ conciliacao: 'divergente', retorno: ret })], 'UPA Teste', '27/10/2026')
  const l = c.replace(/^\uFEFF/, '').split('\r\n')
  assert.equal(l[0], 'Unidade;UPA Teste')
  assert.ok(l[4].startsWith('conta;tipo;prontuario;versao'))
  assert.equal(l.filter((x) => x.startsWith('A-2026.000412;')).length, 3)
  assert.ok(l.some((x) => x.includes(';procedimento;202609;0204030153;"RX; TORAX";1;10,5;10,5;não')))
  assert.ok(l.some((x) => x.includes(';medicamento;;;Dipirona;1;;;sim')))
  const v: VersaoPlantoes = { id: 'x', unidade: { id: 'u', nome: 'UPA', cnes: '1' }, competencia: '202609', versao: 1, situacao: 'vigente',
    plantoes: [linha()], totais: { plantoes: 1, realizados: 1, faltas_justificadas: 0, sem_presenca: 0, realizados_sem_valor: 0, sem_checkout: 0 },
    total: 900, gerada_em: '', substituida_em: null, alterada_em: '', conciliacao: 'pendente', retorno: null }
  const p = csvPlantoes([v], 'UPA', '27/10/2026').split('\r\n')
  assert.ok(p.some((x) => x.startsWith('202609;1;vigente;pendente;Ana;52998224725;CRM;123;SP;225125;04/09/2026;manha;PS;')))
  assert.equal(nomeArquivoErp('plantoes', 'json', '2026-10-27', '202609'), 'erp_plantoes_202609_2026-10-27.json')
})
