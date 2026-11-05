import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Pendência da 5A, tarefa 7 (RT, 05/11/2026): incluir paciente direto do painel
// do hiperdia, pela mesma RPC da consulta.
test('o painel do hiperdia inclui paciente pela busca do cadastro e por programa_incluir', () => {
  const dlg = readFileSync('src/components/hiperdia/IncluirNoHiperdia.tsx', 'utf8')
  assert.match(dlg, /rpc\('buscar_pacientes', \{ p_unidade: unidadeId, p_termo: t \}\)/)
  assert.match(dlg, /rpc\('programa_incluir', \{ p_paciente: paciente!\.id, p_programa: programa \}\)/)
  assert.match(dlg, /queryKey: \['hiperdia'\]/)
})

test('só o médico e o enfermeiro veem "Incluir paciente" (a RPC recusa os outros)', () => {
  const pag = readFileSync('src/pages/hiperdia/Hiperdia.tsx', 'utf8')
  assert.match(pag, /podeIncluir = papeisDaUnidade\.includes\('plantonista'\) \|\| papeisDaUnidade\.includes\('enfermeiro'\)/)
  assert.match(pag, /acoes=\{podeIncluir && unidadeId && !painel\.error \? <IncluirNoHiperdia /)
})
