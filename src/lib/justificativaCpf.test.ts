// Percurso da UBS, U15, vacina, PR 2: motivo do cidadão sem CPF.
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('U15 PR 2: a lista da tela é a mesma da migration (LEDI APS 8.7.0)', async () => {
  const { JUSTIFICATIVAS_SEM_CPF } = await import('../domain/justificativaCpf.ts')
  const sql = readFileSync('supabase/migrations/20270415000026_ubs_u15_cpf_justificativa.sql', 'utf8')
  const doBanco = [...sql.matchAll(/^ {2}\((\d+), '([^']+)'\)/gm)].map((m) => ({ codigo: Number(m[1]), rotulo: m[2] }))
  assert.equal(doBanco.length, 12)
  assert.deepEqual(JUSTIFICATIVAS_SEM_CPF, doBanco)
})

test('U15 PR 2: o motivo só é pedido sem CPF válido e sem motivo no cadastro', async () => {
  const { pedeMotivoSemCpf } = await import('../domain/justificativaCpf.ts')
  assert.equal(pedeMotivoSemCpf('', false, null), true)
  assert.equal(pedeMotivoSemCpf('529.982.247-25', false, null), false)
  assert.equal(pedeMotivoSemCpf('5299', false, null), true)
  assert.equal(pedeMotivoSemCpf('', true, null), false)
  assert.equal(pedeMotivoSemCpf('', false, 8), false)
})

test('U15 PR 2: a recepção da UBS pede o motivo e manda cpf_justificativa', () => {
  const pagina = readFileSync('src/pages/recepcao/Recepcao.tsx', 'utf8')
  assert.match(pagina, /const pedeMotivo = ubs && modo !== 'nenhum' && /)
  assert.match(pagina, /if \(pedeMotivo && !motivoCpf\) return setErroLocal\('Na UBS, informe o CPF ou o motivo de não ter CPF\.'\)/)
  assert.match(pagina, /cpf_justificativa: motivoCpf/)
})
