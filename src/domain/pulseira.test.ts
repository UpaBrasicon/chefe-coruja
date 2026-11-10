// node --experimental-strip-types --test src/domain/pulseira.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  cabecalhoRn, dataPulseira, erroMotivo, idadeEstimadaTexto, montarPulseira, resumirSinais, SINAIS_PULSEIRA_MAX,
  type DadosPulseira,
} from './pulseira.ts'

const base: DadosPulseira = {
  nome: 'Maria Aparecida dos Santos', nome_social: null, data_nascimento: '1980-05-04', idade_estimada_meses: null,
  prontuario: '2026.000123', nome_mae: null, sexo: 'F', raca_cor: 'parda', identidade_desconhecida: false,
  sinais_identificacao: null, rn: false, rn_ordem: null,
}
const textos = (d: DadosPulseira) => montarPulseira(d).linhas.map((l) => l.texto)

test('data em DD/MM/AAAA; inválida não vira data', () => {
  assert.equal(dataPulseira('1980-05-04'), '04/05/1980')
  assert.equal(dataPulseira('2026-11-10T03:00:00+00:00'), '10/11/2026')
  assert.equal(dataPulseira(null), '')
  assert.equal(dataPulseira(''), '')
  assert.equal(dataPulseira('04/05/1980'), '')
  assert.equal(dataPulseira('1980-13-04'), '')
})

test('adulto: nome completo, nascimento e prontuário, sem sexo nem raça', () => {
  const p = montarPulseira(base)
  assert.equal(p.formato, 'comum')
  assert.deepEqual(p.linhas, [
    { texto: 'Maria Aparecida dos Santos', destaque: true },
    { texto: 'Nasc. 04/05/1980 · Pront. 2026.000123' },
  ])
})

test('nome social numa linha abaixo, sem tirar o nome civil', () => {
  assert.deepEqual(textos({ ...base, nome_social: '  Alex  ' }), [
    'Maria Aparecida dos Santos', 'Nome social: Alex', 'Nasc. 04/05/1980 · Pront. 2026.000123',
  ])
  // igual ao civil: não repete
  assert.deepEqual(textos({ ...base, nome_social: 'Maria Aparecida dos Santos' }), [
    'Maria Aparecida dos Santos', 'Nasc. 04/05/1980 · Pront. 2026.000123',
  ])
})

test('mãe por último, quando cadastrada', () => {
  assert.deepEqual(textos({ ...base, nome_social: 'Alex', nome_mae: 'Joana dos Santos' }), [
    'Maria Aparecida dos Santos', 'Nome social: Alex', 'Nasc. 04/05/1980 · Pront. 2026.000123', 'Mãe: Joana dos Santos',
  ])
  assert.deepEqual(textos({ ...base, nome_mae: '   ' }), ['Maria Aparecida dos Santos', 'Nasc. 04/05/1980 · Pront. 2026.000123'])
})

test('sem nascimento, nada inventado', () => {
  assert.deepEqual(textos({ ...base, data_nascimento: null }), ['Maria Aparecida dos Santos', 'Pront. 2026.000123'])
  assert.deepEqual(textos({ ...base, data_nascimento: null, prontuario: null }), ['Maria Aparecida dos Santos'])
  assert.ok(!textos({ ...base, data_nascimento: null }).join(' ').includes('Nasc.'))
})

test('nascimento estimado sai como idade estimada, nunca como data', () => {
  assert.deepEqual(textos({ ...base, data_nascimento: null, idade_estimada_meses: 480 }), [
    'Maria Aparecida dos Santos', 'Idade estimada: 40 anos · Pront. 2026.000123',
  ])
})

test('idade estimada em texto', () => {
  assert.equal(idadeEstimadaTexto(480), 'Idade estimada: 40 anos')
  assert.equal(idadeEstimadaTexto(24), 'Idade estimada: 2 anos')
  assert.equal(idadeEstimadaTexto(18), 'Idade estimada: 1 ano')
  assert.equal(idadeEstimadaTexto(6), 'Idade estimada: 6 meses')
  assert.equal(idadeEstimadaTexto(1), 'Idade estimada: 1 mês')
  assert.equal(idadeEstimadaTexto(0), 'Idade estimada: menos de 1 mês')
  assert.equal(idadeEstimadaTexto(null), '')
  assert.equal(idadeEstimadaTexto(-3), '')
})

const ni: DadosPulseira = {
  ...base, nome: 'Não identificado 2026.000123', data_nascimento: null, idade_estimada_meses: 480, sexo: 'M', raca_cor: 'preta',
  identidade_desconhecida: true, sinais_identificacao: 'SAMU, ocorrência 123', nome_mae: null,
}

test('não identificado: nome provisório, prontuário, idade estimada, sexo aparente, raça/cor e sinais', () => {
  const p = montarPulseira(ni)
  assert.equal(p.formato, 'comum')
  assert.deepEqual(p.linhas, [
    { texto: 'Não identificado 2026.000123', destaque: true },
    { texto: 'Pront. 2026.000123 · Idade estimada: 40 anos' },
    { texto: 'Sexo aparente: masculino · Raça/cor: preta' },
    { texto: 'Sinais: SAMU, ocorrência 123' },
  ])
})

test('não identificado sem idade, sexo, raça ou sinais: só nome e prontuário', () => {
  assert.deepEqual(textos({ ...ni, idade_estimada_meses: null, sexo: null, raca_cor: null, sinais_identificacao: null }), [
    'Não identificado 2026.000123', 'Pront. 2026.000123',
  ])
  // "sem informação" não vai para a pulseira
  assert.deepEqual(textos({ ...ni, sexo: null, raca_cor: 'sem_informacao', sinais_identificacao: '' }), [
    'Não identificado 2026.000123', 'Pront. 2026.000123 · Idade estimada: 40 anos',
  ])
  assert.deepEqual(textos({ ...ni, sexo: 'F', raca_cor: null, sinais_identificacao: null }), [
    'Não identificado 2026.000123', 'Pront. 2026.000123 · Idade estimada: 40 anos', 'Sexo aparente: feminino',
  ])
})

test('sinais longos são resumidos no fim de uma palavra', () => {
  const longo = 'SAMU, ocorrência 123; tatuagem de âncora no braço direito, cicatriz no queixo, camiseta azul, tênis branco e boné vermelho'
  const r = resumirSinais(longo)
  assert.ok(r.length <= SINAIS_PULSEIRA_MAX, r)
  assert.ok(r.endsWith('…'))
  assert.ok(longo.startsWith(r.slice(0, -1)))
  assert.ok(!/[\s,;]…$/.test(r))
  assert.equal(resumirSinais('  curto \n  texto '), 'curto texto')
  assert.equal(resumirSinais(null), '')
  // uma palavra só, sem espaço: corta no limite
  assert.equal(resumirSinais('x'.repeat(100), 10), `${'x'.repeat(9)}…`)
  const linhas = textos({ ...ni, sinais_identificacao: longo })
  assert.equal(linhas.at(-1), `Sinais: ${r}`)
})

test('cabeçalho do RN com a ordem dos gêmeos', () => {
  assert.equal(cabecalhoRn('Rosa Maria', null), 'RN de Rosa Maria')
  assert.equal(cabecalhoRn('Rosa Maria', 2), 'RN 2 de Rosa Maria')
  assert.equal(cabecalhoRn(null, 1), 'RN 1 de mãe sem nome no cadastro')
})

const rn: DadosPulseira = {
  ...base, nome: 'RN 2 de Rosa Maria', nome_social: null, data_nascimento: '2026-11-09', prontuario: '2026.000200',
  nome_mae: 'Rosa Maria', sexo: 'F', raca_cor: null, rn: true, rn_ordem: 2,
}

test('RN: mãe com a ordem do gêmeo, prontuário, nascimento e sexo, em tamanho de RN', () => {
  const p = montarPulseira(rn)
  assert.equal(p.formato, 'rn')
  assert.deepEqual(p.linhas, [
    { texto: 'RN 2 de Rosa Maria', destaque: true },
    { texto: 'Pront. 2026.000200' },
    { texto: 'Nasc. 09/11/2026 · Sexo: feminino' },
  ])
})

test('RN: mãe com nome atualizado e RN que já ganhou nome', () => {
  assert.deepEqual(textos({ ...rn, nome_mae: 'Rosa Maria Souza' }), ['RN 2 de Rosa Maria Souza', 'Pront. 2026.000200', 'Nasc. 09/11/2026 · Sexo: feminino'])
  assert.deepEqual(textos({ ...rn, nome: 'Ana Clara', rn_ordem: null, sexo: null }), [
    'RN de Rosa Maria', 'Ana Clara', 'Pront. 2026.000200', 'Nasc. 09/11/2026',
  ])
})

test('nenhuma linha traz leito, setor ou alergia', () => {
  const tudo = [base, ni, rn].flatMap(textos).join(' ').toLowerCase()
  for (const proibido of ['leito', 'setor', 'alergia', 'risco']) assert.ok(!tudo.includes(proibido), proibido)
})

test('motivo da reimpressão', () => {
  assert.match(erroMotivo('', '') ?? '', /Escolha o motivo/)
  assert.match(erroMotivo('perdeu', '') ?? '', /um dos motivos/)
  assert.equal(erroMotivo('caiu', ''), null)
  assert.equal(erroMotivo('paciente_identificado', ''), null)
  assert.match(erroMotivo('outro', ' a ') ?? '', /ao menos 3 letras/)
  assert.match(erroMotivo('outro', 'x'.repeat(201)) ?? '', /no máximo 200/)
  assert.equal(erroMotivo('outro', 'Rasgou no banho'), null)
})
