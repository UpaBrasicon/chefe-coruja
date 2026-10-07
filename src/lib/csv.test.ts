// node --experimental-strip-types --test src/lib/csv.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { campoCsv, gerarCsv, nomeArquivoCsv } from './csv.ts'

test('csv: BOM, separador ";", CRLF e decimal com vírgula', () => {
  const s = gerarCsv(['Setor', 'Taxa (%)'], [['Clínica Médica', 12.5], ['Observação', 0]])
  assert.equal(s.charCodeAt(0), 0xfeff)
  assert.equal(s.slice(1), 'Setor;Taxa (%)\r\nClínica Médica;12,5\r\nObservação;0\r\n')
})

test('csv: aspas quando o campo tem ";", aspas ou quebra de linha', () => {
  assert.equal(campoCsv('a;b'), '"a;b"')
  assert.equal(campoCsv('diz "oi"'), '"diz ""oi"""')
  assert.equal(campoCsv('linha 1\nlinha 2'), '"linha 1\nlinha 2"')
  assert.equal(campoCsv(null), '')
  assert.equal(campoCsv(undefined), '')
  assert.equal(campoCsv(true), 'sim')
})

test('csv: texto que vira fórmula no Excel ganha apóstrofo; número negativo não', () => {
  assert.equal(campoCsv('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`)
  assert.equal(campoCsv('+55 62'), "'+55 62")
  assert.equal(campoCsv('-1+1'), "'-1+1")
  assert.equal(campoCsv('@SUM(A1)'), "'@SUM(A1)")
  assert.equal(campoCsv(-3.5), '-3,5')
  assert.equal(campoCsv(1234567), '1234567')
})

test('csv: contexto (filtros) antes da tabela, separado por linha em branco', () => {
  const s = gerarCsv(['A'], [[1]], { contexto: [['Unidade', 'UPA Centro'], ['Período', 'últimos 7 dias']] })
  assert.equal(s.slice(1), 'Unidade;UPA Centro\r\nPeríodo;últimos 7 dias\r\n\r\nA\r\n1\r\n')
})

test('csv: nome de arquivo sem acento nem espaço', () => {
  assert.equal(nomeArquivoCsv('Censo por setor — UPA Homologação', '2026-10-07'), 'censo_por_setor_upa_homologacao_2026-10-07.csv')
})
