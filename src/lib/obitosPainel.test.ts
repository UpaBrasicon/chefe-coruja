// node --experimental-strip-types --test src/lib/obitosPainel.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CABECALHO_CSV_OBITOS, ENCAMINHAMENTOS, FONTE_OBITOS, ORIGENS, TIPOS, fracaoObitos, linhasCsvObitos, percentualObitos,
  rotuloEncaminhamento, rotuloTipo, type IndicadorObitos,
} from './obitosPainel.ts'

const exemplo: IndicadorObitos = {
  de: '2026-11-01', ate: '2026-11-07', setor_id: null,
  total: 6, registro_anterior: 2,
  por_origem: { porta: 3, observacao: 1, internacao: 2 },
  por_tipo: { natural_assistida: 3, natural_sem_assistencia_ou_a_esclarecer: 0, violenta_ou_suspeita: 1, registro_anterior: 2 },
  por_encaminhamento: { unidade: 3, svo: 0, causa_desconhecida: 0, iml: 1, registro_anterior: 2 },
  por_faixa: { adulto: 5, pediatrico: 1, sem_data_nascimento: 0 },
  por_tempo: { menos_de_24h: 5, de_24h_ou_mais: 1, sem_chegada: 0 },
  por_setor: [{ setor_id: 'a', setor: 'Sala vermelha', obitos: 3 }, { setor_id: 'b', setor: 'Clínica Médica', obitos: 2 }],
  por_dia: [{ dia: '2026-11-03', obitos: 6 }],
  saidas: { porta: 4, observacao: 1, internacao: 2, total: 7 },
  obitos_sobre_saidas: { numerador: 6, denominador: 7, percentual: 85.7 },
  setores: [],
  casos: [{ nome: 'Fulano', hora_obito: '2026-11-03T10:00:00Z', chegada_em: null, origem: 'porta', setor: null, tipo_morte: null,
    encaminhamento: null, registro_anterior: true, faixa: 'adulto', tempo: 'sem_chegada' }],
}

test('percentual com uma casa e vírgula; sem saída, traço', () => {
  assert.equal(percentualObitos(6, 7), '85,7%')
  assert.equal(percentualObitos(2, 2), '100%')
  assert.equal(percentualObitos(0, 5), '0%')
  assert.equal(percentualObitos(0, 0), '—')
})

test('numerador e denominador por extenso', () => {
  assert.equal(fracaoObitos(6, 7), '6 óbitos de 7 saídas')
  assert.equal(fracaoObitos(1, 1), '1 óbito de 1 saída')
})

test('as chaves batem com as do banco (indicador_obitos)', () => {
  assert.deepEqual(ORIGENS.map((o) => o.valor), ['porta', 'observacao', 'internacao'])
  assert.deepEqual(TIPOS.map((o) => o.valor), ['natural_assistida', 'natural_sem_assistencia_ou_a_esclarecer', 'violenta_ou_suspeita', 'registro_anterior'])
  assert.deepEqual(ENCAMINHAMENTOS.map((o) => o.valor).sort(), ['causa_desconhecida', 'iml', 'registro_anterior', 'svo', 'unidade'])
  assert.equal(rotuloTipo(null, true), 'Registro anterior')
  assert.equal(rotuloEncaminhamento('iml'), 'IML')
  assert.equal(rotuloTipo('violenta_ou_suspeita'), 'Violenta ou suspeita')
})

test('CSV: só números, sem nome de paciente', () => {
  const linhas = linhasCsvObitos(exemplo)
  assert.equal(CABECALHO_CSV_OBITOS.length, 3)
  assert.ok(linhas.every((l) => l.length === 3))
  assert.deepEqual(linhas[0], ['Total', 'Óbitos no período', 6])
  assert.deepEqual(linhas.find((l) => l[0] === 'Óbitos sobre saídas' && l[1] === 'Denominador (saídas)'), ['Óbitos sobre saídas', 'Denominador (saídas)', 7])
  assert.deepEqual(linhas.find((l) => l[0] === 'Óbitos sobre saídas' && l[1] === 'Percentual (%)'), ['Óbitos sobre saídas', 'Percentual (%)', 85.7])
  assert.deepEqual(linhas.find((l) => l[0] === 'Setor do óbito' && l[1] === 'Clínica Médica'), ['Setor do óbito', 'Clínica Médica', 2])
  assert.deepEqual(linhas.find((l) => l[0] === 'Dia do plantão'), ['Dia do plantão', '03/11/2026', 6])
  assert.deepEqual(linhas.filter((l) => l[0] === 'Saídas').map((l) => l[2]), [4, 1, 2])
  assert.ok(!JSON.stringify(linhas).includes('Fulano'))
})

test('a fonte cita a portaria e diz que a UPA não é hospital', () => {
  assert.match(FONTE_OBITOS, /Portaria SAS\/MS nº 312\/2002/)
  assert.match(FONTE_OBITOS, /UPA não é hospital/)
  assert.ok(!FONTE_OBITOS.includes('—'))
})
