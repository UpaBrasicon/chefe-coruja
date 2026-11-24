// node --experimental-strip-types --test src/lib/regulamentacaoCentrais.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  capacidadesParaEnvio, codigoDe, filtrarOpcoes, opcoesDaCategoria, prazoEmMinutos, prazoLegivel, prazoParaTela, resumoCapacidades,
} from './regulamentacaoCentrais.ts'

test('regulamentação: código sem acento, no formato do banco', () => {
  assert.equal(codigoDe('Ortopedia e traumatologia'), 'ortopedia_e_traumatologia')
  assert.equal(codigoDe('Cateterismo cardíaco (hemodinâmica)'), 'cateterismo_cardiaco_hemodinamica')
  assert.equal(codigoDe('  Raio-X '), 'raio_x')
  for (const o of [...opcoesDaCategoria('exame', []), ...opcoesDaCategoria('especialidade', ['Cirurgia geral', 'Clínica médica'])]) {
    assert.match(o.codigo, /^[a-z0-9_]{2,60}$/)
  }
  assert.ok(opcoesDaCategoria('leito', []).some((o) => o.codigo === 'uti_adulto' && o.nome === 'UTI adulto'))
})

test('regulamentação: busca sem acento', () => {
  const opcoes = opcoesDaCategoria('exame', [])
  assert.deepEqual(filtrarOpcoes(opcoes, 'ressonancia').map((o) => o.codigo), ['ressonancia_magnetica'])
  assert.deepEqual(filtrarOpcoes(opcoes, 'TOMO').map((o) => o.nome), ['Tomografia'])
  assert.equal(filtrarOpcoes(opcoes, '', 3).length, 3)
})

test('regulamentação: prazo em minutos e na tela', () => {
  assert.deepEqual(prazoEmMinutos('2', 'd'), { minutos: 2880, erro: null })
  assert.deepEqual(prazoEmMinutos('1,5', 'h'), { minutos: 90, erro: null })
  assert.deepEqual(prazoEmMinutos('', 'h'), { minutos: null, erro: null })
  assert.equal(prazoEmMinutos('0', 'h').erro, 'Use um número maior que zero.')
  assert.equal(prazoEmMinutos('400', 'd').erro, 'De 1 minuto a 365 dias.')
  assert.deepEqual(prazoParaTela(2880), { valor: '2', unidade: 'd' })
  assert.deepEqual(prazoParaTela(120), { valor: '2', unidade: 'h' })
  assert.deepEqual(prazoParaTela(90), { valor: '90', unidade: 'min' })
  assert.equal(prazoLegivel(1440), '1 dia')
  assert.equal(prazoLegivel(360), '6 h')
  assert.equal(prazoLegivel(null), 'sem prazo')
})

test('regulamentação: lista do que a unidade tem', () => {
  const lista = capacidadesParaEnvio([
    { categoria: 'leito', codigo: 'uti_adulto', nome: 'UTI adulto', quantidade: 10.7, observacao: ' ' },
    { categoria: 'leito', codigo: 'uti_adulto', nome: 'UTI adulto', quantidade: 3, observacao: null },
    { categoria: 'exame', codigo: 'tomografia', nome: ' Tomografia ', quantidade: 4, observacao: 'só de dia' },
  ])
  assert.deepEqual(lista, [
    { categoria: 'leito', codigo: 'uti_adulto', nome: 'UTI adulto', quantidade: 10, observacao: null },
    { categoria: 'exame', codigo: 'tomografia', nome: 'Tomografia', quantidade: null, observacao: 'só de dia' },
  ])
  assert.equal(resumoCapacidades(lista), '1 tipo de leito (10 leitos) · 1 exame · 0 especialidades')
  assert.equal(resumoCapacidades([]), 'nada informado')
})
