// Percurso da UBS, U6 (P1 = A): exames que o enfermeiro pede na consulta de
// enfermagem. A lista da tela é a do banco, e a aba mostra só a lista.
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('U6: a lista de exames do enfermeiro na tela é a mesma do banco', async () => {
  const { EXAMES_ENFERMAGEM_UBS, LINHAS_CUIDADO, examesDaLinha } = await import('../domain/examesEnfermagemUbs.ts')
  const sql = readFileSync('supabase/migrations/20270415000010_ubs_exames_enfermeiro.sql', 'utf8').replace(/\r/g, '')
  for (const x of EXAMES_ENFERMAGEM_UBS) {
    const linha = sql.split('\n').find((l) => l.includes(`('${x.codigo}',`))
    assert.ok(linha, `${x.codigo} fora do banco`)
    assert.ok(linha!.includes(`'${x.nome}'`), `${x.codigo}: nome diferente do banco`)
    assert.ok(linha!.includes(`ARRAY[${x.linhas.map((l) => `'${l}'`).join(', ')}]`), `${x.codigo}: linha de cuidado diferente do banco`)
    assert.match(x.codigo, /^0202\d{6}$/, `${x.codigo}: só laboratório (02.02)`)
  }
  assert.equal((sql.match(/\('0\d{9}',/g) ?? []).length, EXAMES_ENFERMAGEM_UBS.length, 'o banco tem exame que a tela não tem')
  assert.equal(new Set(EXAMES_ENFERMAGEM_UBS.map((x) => x.codigo)).size, EXAMES_ENFERMAGEM_UBS.length, 'código repetido')
  for (const l of LINHAS_CUIDADO) assert.ok(examesDaLinha(l.id).length > 0, `${l.rotulo} sem exame`)
})

test('U6: na consulta de enfermagem a aba Exames mostra só a lista do protocolo', () => {
  const janela = readFileSync('src/pages/plantao/porta/JanelaAtendimento.tsx', 'utf8')
  assert.match(janela, /protocoloEnfermagem=\{consultaEnfermagem\}/)
  const aba = readFileSync('src/pages/plantao/porta/AbaExames.tsx', 'utf8')
  assert.match(aba, /\{protocoloEnfermagem && \(/)
  assert.match(aba, /\{!protocoloEnfermagem && <div className="flex flex-wrap gap-1\.5 px-4 py-3">/)
  assert.match(aba, /\{!protocoloEnfermagem && <div className="flex flex-col gap-2 border-t border-trilha px-4 py-3">/)
  assert.match(aba, /onClick=\{\(\) => void pedir\(\[\{ procedimento: x\.codigo \}\]\)\}/)
})
