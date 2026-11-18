// Percurso da UBS, U6 (P1 = A): exames que o enfermeiro pede na consulta de
// enfermagem. A lista da tela é a do banco, e a aba mostra só a lista.
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('U6: a lista de exames do enfermeiro na tela é a mesma do banco', async () => {
  const { EXAMES_ENFERMAGEM_UBS, LINHAS_CUIDADO, examesDaLinha } = await import('../domain/examesEnfermagemUbs.ts')
  // a lista vigente é a da 20270415000011 (acrescenta a linha da parceria)
  const migration = readFileSync('supabase/migrations/20270415000011_ubs_pre_natal_parceiro.sql', 'utf8').replace(/\r/g, '')
  const sql = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION private.ubs_exames_enfermagem()'), migration.indexOf(') AS t(codigo, nome, linhas)'))
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

test('U6, E3: a ficha do pré-natal do parceiro pede só os exames da parceria, e a recepção pede a gestante', async () => {
  const { linhasDaFicha, examesDaLinha } = await import('../domain/examesEnfermagemUbs.ts')
  assert.deepEqual(linhasDaFicha('pre_natal_parceiro').map((l) => l.id), ['parceria'])
  assert.deepEqual(linhasDaFicha('consulta_programada').map((l) => l.id), ['pre_natal', 'hiperdia'])
  const parceria = examesDaLinha('parceria').map((x) => x.codigo)
  for (const c of ['0202031624', '0202031527', '0202031462', '0202031497']) assert.ok(parceria.includes(c), `${c} fora da parceria`)
  assert.ok(!parceria.includes('0202031519'), 'HIV de gestante não é da parceria')
  const janela = readFileSync('src/pages/plantao/porta/JanelaAtendimento.tsx', 'utf8')
  assert.match(janela, /tipoAtendimento=\{ep\.tipo_atendimento_aps\}/)
  const recepcao = readFileSync('src/pages/recepcao/Recepcao.tsx', 'utf8')
  assert.match(recepcao, /tipoAps === 'pre_natal_parceiro' && gestante \? \{ gestante_id: gestante\.id \}/)
  assert.match(recepcao, /Escolha a gestante do pré-natal do parceiro\./)
  const conduta = readFileSync('src/pages/plantao/porta/AbaConduta.tsx', 'utf8')
  assert.match(conduta, /tipoInicial === 'pre_natal_parceiro' \? \[\{ ciap: 'A29'/)
})

test('U6, E3: o pré-natal resume a parceria sem resultado de exame', async () => {
  const { resumoParceria } = await import('../domain/preNatal.ts')
  assert.equal(resumoParceria(null), 'Pré-natal do parceiro: ainda não veio')
  assert.equal(resumoParceria({ paciente_id: 'x', nome: 'Parceiro Um', consultas: 1, testes_rapidos: 2,
    exames: [{ nome: 'Hemograma completo', situacao: 'resultado' }, { nome: 'Sífilis (VDRL) em parceria de gestante', situacao: 'pedido' }] }),
    'Parceria: Parceiro Um · 1 consulta · exames 1/2 com resultado · 2 testes rápidos')
})
