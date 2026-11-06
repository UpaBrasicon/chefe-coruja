// node --experimental-strip-types --test src/lib/exportacoesAntigas.test.ts
//
// Achado guardado de 07/10/2026 ("Exportações antigas sem proteção"), feito em
// 05/11/2026 por decisão do RT: a escala e a auditoria de transferências montavam
// o CSV à mão. Texto com ";" desalinhava a planilha, texto começando com "=" virava
// fórmula, e a exportação de transferências levava nome de paciente sem auditoria.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { csvEscala, csvTransferencias } from './exportacoesAntigas.ts'

const linhasDe = (s: string) => s.slice(1).split('\r\n')

test('escala: contexto, cabeçalho e campos protegidos', () => {
  const s = csvEscala('UPA Centro', '11/2026', [
    { setor: 'Sala; vermelha', data: '2026-11-05', turno: 'Manhã', plantonista: '=HYPERLINK("x")', quinzenal: true },
    { setor: 'Consultório', data: '2026-11-06', turno: 'Noite', plantonista: null, quinzenal: false },
  ])
  assert.equal(s.charCodeAt(0), 0xfeff)
  const l = linhasDe(s)
  assert.deepEqual(l.slice(0, 3), ['Unidade;UPA Centro', 'Mês;11/2026', ''])
  assert.equal(l[3], 'Setor;Data;Turno;Plantonista;Quinzenal')
  assert.equal(l[4], `"Sala; vermelha";2026-11-05;Manhã;"'=HYPERLINK(""x"")";sim`)
  assert.equal(l[5], 'Consultório;2026-11-06;Noite;;não')
})

test('transferências: motivo com quebra de linha e fórmula não escapam', () => {
  const s = csvTransferencias('UPA Centro', '05/11/2026 21:30', [
    { paciente: 'Paciente Teste', data: '05/11/2026', motivo: '+vaga\nna UTI' },
  ])
  const t = s.slice(1)
  assert.ok(t.startsWith('Unidade;UPA Centro\r\nGerado em;05/11/2026 21:30\r\n\r\nPaciente;Data;Motivo\r\n'))
  assert.ok(t.includes(`Paciente Teste;05/11/2026;"'+vaga\nna UTI"\r\n`))
})

test('as duas telas usam a lib e a de transferências audita antes de baixar', () => {
  const escala = readFileSync('src/pages/Escala.tsx', 'utf8')
  const internacao = readFileSync('src/pages/InternacaoPainel.tsx', 'utf8')
  for (const fonte of [escala, internacao]) {
    assert.doesNotMatch(fonte, /text\/csv/)
    assert.match(fonte, /baixarCsv\(/)
  }
  const auditoria = internacao.indexOf("rpc('registrar_auditoria'")
  assert.ok(auditoria > 0, 'a exportação de transferências registra auditoria')
  assert.ok(auditoria < internacao.indexOf('baixarCsv('), 'auditoria antes do download')
})
