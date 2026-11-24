// Pedido 7: anotações pessoais do médico (AN1 a AN4 = A do RT, 23/11/2026).
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('avisa quando o texto parece ter dado de paciente (AN1 = A)', async () => {
  const { pareceDadoDePaciente } = await import('../domain/anotacoes.ts')
  assert.deepEqual(pareceDadoDePaciente('Ligar para o laboratório às 15h', 2026), [])
  assert.deepEqual(pareceDadoDePaciente('Pedir troca do dia 30/11/2026', 2026), [], 'data deste ano não é nascimento')
  assert.deepEqual(pareceDadoDePaciente('João, CPF 123.456.789-09', 2026), ['CPF'])
  assert.deepEqual(pareceDadoDePaciente('cpf 12345678909', 2026), ['CPF'])
  assert.deepEqual(pareceDadoDePaciente('CNS 898 0012 3456 7890', 2026), ['Cartão SUS'])
  assert.deepEqual(pareceDadoDePaciente('nasc. 04/04/1970', 2026), ['data de nascimento'])
  assert.deepEqual(pareceDadoDePaciente('ramal 4567', 2026), [])
})

test('apaga em 30 dias contados da última mudança e ordena fixadas primeiro', async () => {
  const { diasParaApagar, ordenarAnotacoes } = await import('../domain/anotacoes.ts')
  const agora = Date.parse('2026-11-23T12:00:00Z')
  assert.equal(diasParaApagar('2026-11-23T10:00:00Z', agora), 30)
  assert.equal(diasParaApagar('2026-11-03T10:00:00Z', agora), 10)
  assert.equal(diasParaApagar('2026-10-01T10:00:00Z', agora), 0)
  const n = (id: string, feita: boolean, fixada: boolean, alterada_em: string) => ({ id, texto: id, feita, fixada, criada_em: alterada_em, alterada_em })
  const ordem = ordenarAnotacoes([
    n('velha', false, false, '2026-11-20T00:00:00Z'),
    n('feita', true, false, '2026-11-23T00:00:00Z'),
    n('fixa', false, true, '2026-11-01T00:00:00Z'),
    n('nova', false, false, '2026-11-22T00:00:00Z'),
  ]).map((x) => x.id)
  assert.deepEqual(ordem, ['fixa', 'nova', 'velha', 'feita'])
})

test('o banco guarda 30 dias, até 1.000 letras, e a tela usa os mesmos números', () => {
  const sql = readFileSync('supabase/migrations/20270419000003_anotacoes_medico.sql', 'utf8')
  assert.match(sql, /interval '30 days'/)
  assert.match(sql, /BETWEEN 1 AND 1000/)
  assert.match(sql, /USING \(perfil_id = private\.meu_perfil_id\(\)\)/, 'só o dono lê')
  const dominio = readFileSync('src/domain/anotacoes.ts', 'utf8')
  assert.match(dominio, /LIMITE_TEXTO = 1000/)
  assert.match(dominio, /DIAS_GUARDA = 30/)
  assert.match(readFileSync('src/components/plantonista/central/InicioCelular.tsx', 'utf8'), /<MinhasAnotacoes \/>/)
})
