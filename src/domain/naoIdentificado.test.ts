// node --experimental-strip-types --test src/domain/naoIdentificado.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  ehNaoIdentificado, erroNaoIdentificado, erroNomeIdentificado, lerIdadeEstimada, motivoUnificacao, rotuloCandidato,
  SINAIS_MAX, sinaisDoSelo,
} from './naoIdentificado.ts'

test('a marca: só true conta', () => {
  assert.equal(ehNaoIdentificado({ identidade_desconhecida: true }), true)
  assert.equal(ehNaoIdentificado({ identidade_desconhecida: false }), false)
  assert.equal(ehNaoIdentificado({}), false)
  assert.equal(ehNaoIdentificado(null), false)
  assert.equal(ehNaoIdentificado(undefined), false)
})

test('os sinais do selo ficam numa linha', () => {
  assert.equal(sinaisDoSelo({ sinais_identificacao: '  SAMU, ocorrência 123;\n tatuagem  no braço ' }), 'SAMU, ocorrência 123; tatuagem no braço')
  assert.equal(sinaisDoSelo({ sinais_identificacao: null }), '')
  assert.equal(sinaisDoSelo(null), '')
})

test('idade estimada em anos', () => {
  assert.equal(lerIdadeEstimada(''), null)
  assert.equal(lerIdadeEstimada('  '), null)
  assert.equal(lerIdadeEstimada('40'), 40)
  assert.equal(lerIdadeEstimada('0,5'), 0.5)
  assert.equal(lerIdadeEstimada('130'), 130)
  assert.ok(Number.isNaN(lerIdadeEstimada('131')))
  assert.ok(Number.isNaN(lerIdadeEstimada('-1')))
  assert.ok(Number.isNaN(lerIdadeEstimada('uns 40')))
})

test('a ficha do não identificado pede só a queixa', () => {
  assert.equal(erroNaoIdentificado({ queixa: 'Inconsciente', idade: '', sinais: '' }), null)
  assert.match(erroNaoIdentificado({ queixa: ' a ', idade: '', sinais: '' }) ?? '', /queixa/)
  assert.match(erroNaoIdentificado({ queixa: 'Inconsciente', idade: '200', sinais: '' }) ?? '', /Idade estimada/)
  assert.match(erroNaoIdentificado({ queixa: 'Inconsciente', idade: '', sinais: 'x'.repeat(SINAIS_MAX + 1) }) ?? '', /no máximo 500/)
  assert.equal(erroNaoIdentificado({ queixa: 'Inconsciente', idade: '35', sinais: 'x'.repeat(SINAIS_MAX) }), null)
})

test('o nome que identifica', () => {
  assert.equal(erroNomeIdentificado('João da Silva'), null)
  assert.equal(erroNomeIdentificado('Ana'), null)
  assert.match(erroNomeIdentificado('Jo') ?? '', /3 letras/)
  assert.match(erroNomeIdentificado('J 1 2 3') ?? '', /3 letras/)
  assert.match(erroNomeIdentificado('Não identificado 2026.000123') ?? '', /nome verdadeiro/)
  assert.match(erroNomeIdentificado('NAO IDENTIFICADO') ?? '', /nome verdadeiro/)
})

test('rótulo do candidato e motivo da unificação', () => {
  assert.equal(rotuloCandidato({ data_nascimento: '1980-05-05', prontuario: '2026.000010', nome_mae: ' Rosa ' }),
    'nasc. 05/05/1980 · pront. 2026.000010 · Mãe: Rosa')
  assert.equal(rotuloCandidato({ data_nascimento: null, prontuario: null, nome_mae: null }), '')
  assert.equal(motivoUnificacao('2026.000123'), 'Paciente não identificado (prontuário 2026.000123) reconhecido como este cadastro.')
  assert.ok(motivoUnificacao(null).length >= 10)
})
