import { test } from 'node:test'
import assert from 'node:assert/strict'

import { cnsValido, cpfValido, criarCofre, desidentificar, nomesEmResultado, reidentificar, residuos } from './desidentificacao.js'

// CPF e CNS abaixo são números VÁLIDOS pelo algoritmo, gerados para teste —
// não pertencem a ninguém.
const CPF = '529.982.247-25'
const CNS = '898 0012 3456 7018'

test('validadores: CPF e CNS válidos e inválidos', () => {
  assert.equal(cpfValido(CPF), true)
  assert.equal(cpfValido('529.982.247-24'), false)
  assert.equal(cpfValido('111.111.111-11'), false)
  assert.equal(cnsValido(CNS), true)
  assert.equal(cnsValido('898 0012 3456 7019'), false)
})

test('CPF com dígito certo sai; número de 11 dígitos inválido fica e bloqueia', () => {
  const cofre = criarCofre()
  const { texto } = desidentificar(`CPF ${CPF}`, cofre)
  assert.match(texto, /\[CPF_1\]/)
  assert.doesNotMatch(texto, /529/)

  const falso = desidentificar('código 12345678901 do lote', criarCofre())
  assert.equal(residuos(falso.texto).length, 1, 'onze dígitos que não são CPF ainda bloqueiam o envio')
})

test('nome depois de gatilho vira [PACIENTE_n]; o mesmo nome, o mesmo pseudônimo', () => {
  const cofre = criarCofre()
  const { texto, contagem } = desidentificar('Paciente João da Silva no leito 12A. Reavaliar o sr. João da Silva às 18h.', cofre)
  assert.equal(texto, 'Paciente [PACIENTE_1] no leito 12A. Reavaliar o sr. [PACIENTE_1] às 18h.')
  assert.equal(contagem.PACIENTE, 2)
})

test('nomes conhecidos saem mesmo sem gatilho, do mais longo para o mais curto', () => {
  const cofre = criarCofre()
  const { texto } = desidentificar('Oi, aqui é Ana Paula Souza. Ana passou o plantão.', cofre, [
    { valor: 'Ana', categoria: 'PESSOA' },
    { valor: 'Ana Paula Souza', categoria: 'PESSOA' },
  ])
  assert.equal(texto, 'Oi, aqui é [PESSOA_1]. [PESSOA_2] passou o plantão.')
})

test('telefone, e-mail, CEP, data e prontuário saem; dose e leito ficam', () => {
  const cofre = criarCofre()
  const entrada = 'Ligar (62) 99876-5432 ou ana@exemplo.com. CEP 74000-000, nasc. 12/03/1951, pront. 2026.000123. Dipirona 500 mg no 12A.'
  const { texto } = desidentificar(entrada, cofre)
  for (const t of ['[TELEFONE_1]', '[EMAIL_1]', '[CEP_1]', '[DATA_1]', '[PRONTUARIO_1]']) assert.ok(texto.includes(t), t)
  assert.ok(texto.includes('Dipirona 500 mg no 12A'), 'dose e leito não são identificadores')
  assert.deepEqual(residuos(texto), [])
})

test('CNS válido sai', () => {
  const { texto } = desidentificar(`CNS ${CNS}`, criarCofre())
  assert.match(texto, /\[CNS_1\]/)
  assert.doesNotMatch(texto, /7018/)
})

test('reidentificar devolve os originais e descarta pseudônimo inventado pelo modelo', () => {
  const cofre = criarCofre()
  const { texto } = desidentificar('Paciente Maria Lima, CPF ' + CPF, cofre)
  const respostaDoModelo = `Anotei: ${texto.match(/\[PACIENTE_1\]/)![0]} e [PACIENTE_9].`
  assert.equal(reidentificar(respostaDoModelo, cofre), 'Anotei: Maria Lima e .')
})

test('resíduo: data completa escapada bloqueia; texto limpo passa', () => {
  assert.equal(residuos('internado desde 01/02/2026').length, 1)
  assert.deepEqual(residuos('internado desde [DATA_1], leito 12A'), [])
})

test('nomes em resultado de ferramenta: chaves de nome, em qualquer profundidade', () => {
  const achados = nomesEmResultado({ data: '26/09/2026', plantoes: [{ turno: 'manha', profissional: 'Ana Souza' }, { profissional: '?' }], medico: 'Rui Lima' })
  assert.deepEqual(achados.map((a) => a.valor).sort(), ['Ana Souza', 'Rui Lima'])
})
