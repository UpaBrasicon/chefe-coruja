// ============================================================================
// GUARD (red-team V1 — defesa em profundidade): o caminho de request NÃO pode
// tocar tabela direto.
// ----------------------------------------------------------------------------
// Contexto: o Hermes roda no `service_role` (bypassa RLS) através de RPCs
// SECURITY DEFINER scoped que validam o escopo por `p_perfil` no próprio SQL —
// então cross-tenant já está barrado no banco. O swap para o papel de menor
// privilégio (`hermes_user`) foi inviabilizado pelo PostgREST em JWKS
// assimétrica (ver docs/seguranca/cutover-hermes-v1.md §1). Na ausência do
// swap, esta guarda preserva a MESMA proteção por código:
//
//   1. `supabaseUser` (cliente do caminho de input não-confiável) só pode ser
//      usado com `.rpc(...)`. Qualquer `.from(...)` / `.storage` / etc. nele
//      abriria acesso cru a tabela no path não-confiável — proibido.
//   2. Os arquivos puros do caminho de request não importam o cliente
//      service_role (`supabase`) — só `supabaseUser`.
//
// Se um dev futuro adicionar um `.from()` cru no caminho de request, este teste
// quebra no CI antes de chegar em produção.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

// Arquivos puros do caminho de request (input não-confiável do WhatsApp/skill).
// pipeline.ts fica de fora da checagem #2 porque legitimamente usa supabaseJob
// (firewall de conteúdo) — mas ainda cai na checagem #1 (supabaseUser.rpc-only).
const ARQUIVOS_REQUEST = [
  'agent/identidade.ts',
  'agent/sessao.ts',
  'agent/tools.ts',
  'server/skill-api.ts',
]

function listarTs(dir: string): string[] {
  const out: string[] = []
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome)
    if (statSync(p).isDirectory()) out.push(...listarTs(p))
    else if (nome.endsWith('.ts') && !nome.endsWith('.test.ts')) out.push(p)
  }
  return out
}

test('supabaseUser só é usado com .rpc() (nunca .from/.storage)', () => {
  const violacoes: string[] = []
  for (const arquivo of listarTs(SRC)) {
    const texto = readFileSync(arquivo, 'utf8')
    for (const m of texto.matchAll(/supabaseUser\s*\.\s*(\w+)/g)) {
      if (m[1] !== 'rpc') violacoes.push(`${arquivo}: supabaseUser.${m[1]}(...)`)
    }
  }
  assert.deepEqual(
    violacoes,
    [],
    `supabaseUser (caminho de request) só pode chamar .rpc(). Acesso cru a tabela proibido:\n${violacoes.join('\n')}`,
  )
})

test('arquivos do caminho de request não importam o cliente service_role', () => {
  const violacoes: string[] = []
  for (const rel of ARQUIVOS_REQUEST) {
    const texto = readFileSync(join(SRC, rel), 'utf8')
    // Ignora linhas de import (o path '../lib/supabase.js' contém "supabase").
    const corpo = texto
      .split('\n')
      .filter((l) => !/^\s*import\b/.test(l))
      .join('\n')
    // Uso do cliente service_role: identificador `supabase` exato (não
    // supabaseUser/supabaseJob, não o path .js) seguido de `.metodo`.
    if (/\bsupabase(?![A-Za-z0-9_])\s*\./.test(corpo)) violacoes.push(rel)
  }
  assert.deepEqual(
    violacoes,
    [],
    `Caminho de request não pode usar o cliente service_role (supabase). Use supabaseUser.rpc():\n${violacoes.join('\n')}`,
  )
})
