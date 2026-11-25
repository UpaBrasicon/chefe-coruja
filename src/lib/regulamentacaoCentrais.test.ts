// node --experimental-strip-types --test src/lib/regulamentacaoCentrais.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  capacidadeCombina, capacidadesParaEnvio, categoriaDoPedido, codigoDe, filtrarOpcoes, opcoesDaCategoria, ordenarParaPedido,
  prazoEmMinutos, prazoLegivel, prazoParaTela, resumoCapacidades, resumoPrazosTipo, type UnidadeRegulada,
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

test('regulamentação: prazos por tipo em uma linha', () => {
  assert.equal(resumoPrazosTipo({ exame: 10080, leito: 120 }), 'Internação (leito) 2 h · Exame 7 dias')
  assert.equal(resumoPrazosTipo({}), '')
  assert.equal(resumoPrazosTipo(null), '')
})

test('regulamentação: o que a unidade regulada tem para o pedido', () => {
  const uti = { categoria: 'leito', codigo: 'uti_adulto', nome: 'UTI adulto', quantidade: 10, observacao: null } as const
  const cardio = { categoria: 'especialidade', codigo: 'cardiologia', nome: 'Cardiologia', quantidade: null, observacao: null } as const
  const tomo = { categoria: 'exame', codigo: 'tomografia', nome: 'Tomografia', quantidade: null, observacao: null } as const
  assert.equal(categoriaDoPedido('transferencia'), 'leito')
  assert.equal(categoriaDoPedido('consulta'), 'especialidade')
  assert.equal(capacidadeCombina(uti, { tipo: 'leito', tipo_leito: 'uti_adulto' }), true)
  assert.equal(capacidadeCombina(uti, { tipo: 'transferencia', tipo_leito: 'uti_adulto' }), true)
  assert.equal(capacidadeCombina(uti, { tipo: 'leito', tipo_leito: 'clinico' }), false)
  assert.equal(capacidadeCombina(uti, { tipo: 'leito' }), false)
  assert.equal(capacidadeCombina(cardio, { tipo: 'consulta', especialidade: 'cardiologia pediátrica' }), true)
  assert.equal(capacidadeCombina(cardio, { tipo: 'consulta', especialidade: '' }), false)
  assert.equal(capacidadeCombina(cardio, { tipo: 'leito', tipo_leito: 'uti_adulto' }), false)
  assert.equal(capacidadeCombina(tomo, { tipo: 'exame' }), false)
  const u = (nome: string, capacidades: UnidadeRegulada['capacidades']): UnidadeRegulada =>
    ({ id: nome, nome, tipo: 'hospital', vinculada: true, capacidades, atualizado_em: null })
  const lista = [u('Álvaro', [cardio]), u('Hospital Sul', [uti]), u('Beta', [])]
  assert.deepEqual(ordenarParaPedido(lista, { tipo: 'leito', tipo_leito: 'uti_adulto' }).map((x) => x.nome), ['Hospital Sul', 'Álvaro', 'Beta'])
  assert.deepEqual(ordenarParaPedido(lista, null).map((x) => x.nome), ['Álvaro', 'Beta', 'Hospital Sul'])
})
