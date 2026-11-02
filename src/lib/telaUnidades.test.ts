import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// 5A, tarefa 1 (D2 do RT em 02/11/2026; tela na opção A): a aba Unidades da
// Rede cria e edita a unidade numa janela, só pelas RPCs do administrador.
const janela = readFileSync('src/pages/admin/JanelaUnidade.tsx', 'utf8')
const rede = readFileSync('src/pages/admin/RedeCompleta.tsx', 'utf8')

test('a janela cria e edita pelas RPCs, sem escrita direta na tabela', () => {
  assert.match(janela, /rpc\('admin_criar_unidade'/)
  assert.match(janela, /rpc\('admin_editar_unidade'/)
  assert.doesNotMatch(janela, /from\('unidades'\)\s*\.(insert|update|upsert)/)
})

test('a Rede tem o botão Nova unidade, a edição pelo nome e as inativas', () => {
  assert.match(rede, />Nova unidade</)
  assert.match(rede, /onEditar\(u\.unidade_id\)/)
  assert.match(rede, /Unidades inativas/)
  assert.match(rede, /<JanelaUnidade /)
})

test('o CNES só entra no cadastro; depois é do gestor', () => {
  assert.match(janela, /p_cnes:/)
  assert.doesNotMatch(janela, /definir_cnes_unidade'/)
})
