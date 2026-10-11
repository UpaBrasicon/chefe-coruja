// node --experimental-strip-types --test src/lib/exportacao.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CONJUNTOS, dataParaCsv, erroPeriodo, montarArquivo, nomeArquivo, type Contexto } from './exportacao.ts'

const ctx: Contexto = {
  unidade: 'UPA Centro', conjunto: 'atendimentos', desde: '2026-10-01', ate: '2026-10-07', mascarado: true,
  geradoEm: '2026-10-10T12:00:00Z', fuso: 'America/Sao_Paulo',
}
const atendimento = {
  id: 'e1', paciente: { id: 'p1', nome: 'M. S. S.', cns: '***********7290' }, setor: 'PS', chegada_em: '2026-10-02T10:00:00Z',
  situacao: 'encerrado', classificacao: { cor: 'amarelo', classificada_em: '2026-10-02T10:05:00Z' },
  atendimento_medico_em: null, cid_principal: 'J18.9', desfecho: 'alta', desfecho_em: '2026-10-02T13:00:00Z',
}

test('exportação: CSV achata o paciente e a classificação, com contexto', () => {
  const s = montarArquivo('csv', ctx, [atendimento])
  assert.equal(s.charCodeAt(0), 0xfeff)
  const linhas = s.slice(1).split('\r\n')
  assert.equal(linhas[0], 'Unidade;UPA Centro')
  assert.ok(linhas.includes('Dados do paciente;mascarados'))
  const cab = linhas.indexOf(CONJUNTOS.atendimentos.colunas.map(([r]) => r).join(';'))
  assert.ok(cab > 0)
  // datas no horário de Brasília, no formato do Excel pt-BR
  assert.equal(linhas[cab + 1], 'e1;p1;M. S. S.;***********7290;PS;02/10/2026 07:00:00;encerrado;amarelo;02/10/2026 07:05:00;;J18.9;alta;02/10/2026 10:00:00')
  assert.ok(linhas.includes('Gerado em;10/10/2026 09:00:00'))
  assert.ok(linhas.includes('Fuso das datas;America/Sao_Paulo'))
})

test('exportação: JSON guarda as linhas como vieram da API', () => {
  const j = JSON.parse(montarArquivo('json', ctx, [atendimento]))
  assert.equal(j.linhas, 1)
  assert.deepEqual(j.periodo, { desde: '2026-10-01', ate: '2026-10-07' })
  assert.deepEqual(j.dados[0], atendimento)
  assert.equal(j.mascarado, true)
})

test('exportação: leitos sem período; número fica número', () => {
  const c: Contexto = { ...ctx, conjunto: 'internacoes', mascarado: false }
  const s = montarArquivo('csv', c, [{ id: 'i1', paciente: { id: 'p1', nome: 'Maria' }, permanencia_dias: 2.5 }])
  assert.ok(s.includes('Dados do paciente;completos'))
  assert.ok(s.includes(';2,5;'))
  const l = JSON.parse(montarArquivo('json', { ...ctx, conjunto: 'leitos', desde: null, ate: null }, []))
  assert.equal(l.periodo, null)
})

test('exportação: nome do arquivo sem acento e com "completo" quando sem máscara', () => {
  assert.equal(nomeArquivo('csv', ctx), 'atendimentos_upa_centro_2026_10_01_a_2026_10_07.csv')
  assert.equal(nomeArquivo('json', { ...ctx, unidade: 'Hospital São José', mascarado: false }),
    'atendimentos_hospital_sao_jose_2026_10_01_a_2026_10_07_completo.json')
  assert.equal(nomeArquivo('csv', { ...ctx, conjunto: 'leitos', desde: null, ate: null }), 'leitos_upa_centro_2026_10_10.csv')
})

test('exportação: período de até 12 meses', () => {
  assert.equal(erroPeriodo('2026-01-01', '2026-12-31'), null)
  assert.equal(erroPeriodo('2026-01-01', '2027-01-01'), 'O período vai até 12 meses.')
  assert.equal(erroPeriodo('2026-10-07', '2026-10-01'), 'O fim vem antes do início.')
  assert.equal(erroPeriodo('', '2026-10-01'), 'Informe o início e o fim.')
})

test('exportação: datas do CSV — data simples, ano mascarado e texto comum', () => {
  assert.equal(dataParaCsv('1980-04-12', 'America/Sao_Paulo'), '12/04/1980')
  assert.equal(dataParaCsv('1980', 'America/Sao_Paulo'), '1980')
  assert.equal(dataParaCsv('2026-10-07T17:33:53.482296+00:00', 'America/Sao_Paulo'), '07/10/2026 14:33:53')
  assert.equal(dataParaCsv('J18.9', 'America/Sao_Paulo'), 'J18.9')
  assert.equal(dataParaCsv(2.5, 'America/Sao_Paulo'), 2.5)
})
