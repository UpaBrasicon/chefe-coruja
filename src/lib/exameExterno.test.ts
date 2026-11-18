// Percurso da UBS, U12 (parte 1): exame feito fora, trazido em papel.
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('U12: a lista de exames feitos fora é a mesma do banco', async () => {
  const { EXAMES_EXTERNOS } = await import('../domain/examesExternos.ts')
  const sql = readFileSync('supabase/migrations/20270415000017_ubs_u12_exame_externo.sql', 'utf8').replace(/\r/g, '')
  const corpo = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION private.ubs_exames_externos()'), sql.indexOf(') AS t(codigo, nome, tipo)'))
  for (const x of EXAMES_EXTERNOS) assert.ok(corpo.includes(`('${x.codigo}', '${x.nome}', '${x.tipo}')`), `${x.codigo} diferente do banco`)
  assert.equal((corpo.match(/\('0\d{9}',/g) ?? []).length, EXAMES_EXTERNOS.length)
})

test('U12: o valor do exame feito fora segue o formato do banco', async () => {
  const { valorExterno } = await import('../domain/examesExternos.ts')
  assert.deepEqual(valorExterno('percentual', '7,2'), { ok: true, valor: '7,2' })
  assert.equal(valorExterno('percentual', '40').ok, false)
  assert.deepEqual(valorExterno('vdrl', '1:8'), { ok: true, valor: '1:8' })
  assert.equal(valorExterno('vdrl', '1:3').ok, false)
  assert.deepEqual(valorExterno('reagente', 'Reagente'), { ok: true, valor: 'reagente' })
  const janela = readFileSync('src/pages/plantao/porta/JanelaAtendimento.tsx', 'utf8')
  assert.match(janela, /\{ubs && <div className="mt-4"><ExameExterno pacienteId=\{ep\.paciente_id\} \/><\/div>\}/)
})
