// node --experimental-strip-types --test src/lib/bpaResumo.test.ts
// Revisão do perfil Faturamento (FT2 a FT4): a frase, o porquê do Fechar e o
// "Para corrigir" por causa. Pacientes de mentira (Paciente A, B…).
import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Conferencia, LinhaConferencia } from './bpa.ts'
import {
  csvParaRecepcao, efeitoNaTela, frasePanorama, gruposParaCorrigir, htmlParaRecepcao, motivoFecharDesligado, pacientesComFalta, partesDoBloqueio, plural,
} from './bpaResumo.ts'

let seq = 0
function linha(o: Partial<LinhaConferencia> & { paciente_id: string }): LinhaConferencia {
  seq += 1
  return {
    origem: 'atendimento', origem_id: `o${seq}`, episodio_id: null, paciente: `Paciente ${o.paciente_id.toUpperCase()}`, profissional: 'Profissional X',
    em: `2026-10-0${(seq % 9) + 1}T12:00:00Z`, procedimento: '0301060096', quantidade: 1, criticas: [], avisos: [], destino: 'bpa_i', motivo_c: null, ...o,
  }
}
const k = (codigo: string) => ({ codigo, texto: codigo })
const conf = (linhas: LinhaConferencia[], extra: Partial<Conferencia> = {}) => ({
  total: linhas.length, prontas: 0, com_critica: 0, com_aviso: 0, bpa_i: 0, bpa_c: 0, linhas, ...extra,
})

test('plural certo', () => {
  assert.equal(plural(1, 'linha', 'linhas'), '1 linha')
  assert.equal(plural(0, 'aviso', 'avisos'), '0 avisos')
  assert.equal(plural(27, 'linha', 'linhas'), '27 linhas')
})

test('FT4: a frase do exemplo do RT (25 no consolidado por dado do paciente; 2 fora por CBO)', () => {
  const consolidado = Array.from({ length: 25 }, (_, i) => linha({
    paciente_id: `p${i}`, destino: 'bpa_c', criticas: [k('raca')], avisos: [k('endereco')], motivo_c: 'Não fecha no BPA-I (Raça/cor ausente.)',
  }))
  const fora = [linha({ paciente_id: 'q1', destino: 'fora', criticas: [k('cbo')] }), linha({ paciente_id: 'q2', destino: 'fora', criticas: [k('cbo_nao_aceito')] })]
  const c = conf([...consolidado, ...fora], { prontas: 25, bpa_c: 25, bpa_i: 0, com_critica: 2 })
  assert.equal(frasePanorama(c), '27 linhas: 25 vão no consolidado por falta de dado do paciente; 2 ficam fora por CBO.')
})

test('FT4: BPA-I com campo vazio, motivo do SIGTAP e singular', () => {
  const c = conf([
    linha({ paciente_id: 'a', destino: 'bpa_c', motivo_c: 'O SIGTAP só aceita este procedimento em BPA consolidado.' }),
    linha({ paciente_id: 'b', destino: 'fora', criticas: [k('sem_codigo')] }),
  ], { total: 4, prontas: 3, bpa_i: 2, bpa_c: 1, com_aviso: 1, com_critica: 1 })
  assert.equal(frasePanorama(c), '4 linhas: 2 vão no BPA-I (1 com campo vazio); 1 vai no consolidado porque o SIGTAP só aceita o procedimento assim; 1 fica fora por código SIGTAP.')
})

test('FT4: sem linha, e servidor antigo sem BPA-C', () => {
  assert.equal(frasePanorama(conf([])), 'Nenhuma linha nesta competência.')
  assert.equal(frasePanorama({ total: 3, prontas: 3, com_critica: 0, com_aviso: 0, linhas: [] }), '3 linhas: 3 vão no arquivo.')
})

test('FT4: lista cortada em 500 não some com a contagem', () => {
  const c = conf([linha({ paciente_id: 'a', destino: 'bpa_c', criticas: [k('raca')], motivo_c: 'Não fecha no BPA-I (x)' })], { total: 600, bpa_c: 600, prontas: 600 })
  assert.equal(frasePanorama(c), '600 linhas: 1 vai no consolidado por falta de dado do paciente; 599 vão no consolidado.')
})

test('FT2: por que o Fechar está desligado', () => {
  assert.equal(motivoFecharDesligado({ bloqueios: 1, prontas: 10, processamentoValido: true }), 'Resolva o passo acima para fechar.')
  assert.equal(motivoFecharDesligado({ bloqueios: 2, prontas: 10, processamentoValido: true }), 'Resolva os passos acima para fechar.')
  assert.equal(motivoFecharDesligado({ bloqueios: 0, prontas: 0, processamentoValido: true }), 'Nenhuma linha pronta para o arquivo nesta competência.')
  assert.equal(motivoFecharDesligado({ bloqueios: 0, prontas: 3, processamentoValido: false }), 'Escreva a competência de processamento como MM/AAAA.')
  assert.equal(motivoFecharDesligado({ bloqueios: 0, prontas: 3, processamentoValido: true }), null)
})

test('FT2: o bloqueio vira título e detalhe', () => {
  assert.deepEqual(partesDoBloqueio({ texto: 'Cabeçalho incompleto: órgão de origem, sigla.' }), { titulo: 'Cabeçalho incompleto', detalhe: 'Órgão de origem, sigla.' })
  assert.deepEqual(partesDoBloqueio({ texto: 'Competência no futuro.' }), { titulo: 'Competência no futuro', detalhe: null })
})

test('FT3: causas por peso, pacientes sem repetição e o que falta junto', () => {
  const ls = [
    linha({ paciente_id: 'a', destino: 'bpa_c', criticas: [k('raca')], avisos: [k('endereco')], em: '2026-10-05T12:00:00Z' }),
    linha({ paciente_id: 'a', destino: 'bpa_c', criticas: [k('raca')], em: '2026-10-02T12:00:00Z' }),
    linha({ paciente_id: 'b', destino: 'bpa_i', avisos: [k('nacionalidade')] }),
    linha({ paciente_id: 'c', destino: 'fora', criticas: [k('cbo')] }),
  ]
  const g = gruposParaCorrigir(ls)
  assert.deepEqual(g.map((x) => x.codigo), ['cbo', 'raca', 'endereco', 'nacionalidade'])
  const raca = g.find((x) => x.codigo === 'raca')!
  assert.equal(raca.quem, 'paciente')
  assert.equal(raca.pacientes.length, 1)
  assert.deepEqual(raca.pacientes[0].falta, ['raca', 'endereco'])
  assert.deepEqual(raca.pacientes[0].atendimentos, ['2026-10-02T12:00:00Z', '2026-10-05T12:00:00Z'])
  assert.equal(g.find((x) => x.codigo === 'cbo')!.pacientes.length, 0)
  assert.equal(efeitoNaTela(raca.efeito), '2 vão no consolidado')
  assert.equal(efeitoNaTela({ fora: 1, bpa_c: 0, vazio: 2 }), '1 fica fora · 2 vão com o campo vazio')
  assert.deepEqual(pacientesComFalta(ls).map((p) => p.paciente_id), ['a', 'b'])
})

test('FT3: CSV e folha da recepção, com o texto escapado', () => {
  const ps = pacientesComFalta([linha({ paciente_id: 'a', paciente: 'Paciente <A>', avisos: [k('endereco'), k('documento')], em: '2026-10-05T12:00:00Z' })])
  const cab = { unidade: 'UPA Teste', competencia: '10/2026', geradoEm: '2026-11-24T21:00:00Z' }
  const csv = csvParaRecepcao(ps, cab)
  assert.ok(csv.includes('Paciente;O que falta;Atendido em'))
  assert.ok(csv.includes('Paciente <A>;CNS ou CPF, endereço;05/10'))
  const html = htmlParaRecepcao(ps, cab)
  assert.ok(html.includes('Paciente &lt;A&gt;'))
  assert.ok(!html.includes('<A>'))
  assert.ok(html.includes('1 paciente'))
})
