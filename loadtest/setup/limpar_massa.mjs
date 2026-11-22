// Limpeza da massa LOADTEST. Roda na máquina do Ricardo, com service_role.
// Dry-run por padrão (só conta). Para apagar de verdade: node setup/limpar_massa.mjs --apply
//
// 🛑 Antes de --apply: mostrar o plano ao Ricardo e esperar OK (R8).
// Nunca desligar gatilhos de imutabilidade para limpar (R5/seção 9): o que for
// "só inserção" (prontuário, auditoria, prescrição) FICA; a organização é
// marcada ativo=false. O conjunto exato de tabelas apagáveis vem do
// levantamento P8 (gatilhos que bloqueiam DELETE) — TODO preencher.
import { createClient } from '@supabase/supabase-js'
import { carregarEnv, ORG_LOADTEST } from './_lib.mjs'

const env = carregarEnv()
const APLICAR = process.argv.includes('--apply')
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// TODO: completar com o schema real. Ordem de filhos → pais; só tabelas que
// NÃO são imutáveis (ver P8). As imutáveis ficam; a org vai a ativo=false.
const APAGAVEIS = [
  // 'chat_mensagens', 'conversa_participantes', 'leitos', 'setores', 'unidades', ...
]

async function contar(tabela) {
  const { count, error } = await admin
    .from(tabela)
    .select('*', { count: 'exact', head: true })
    .eq('organizacao_id', ORG_LOADTEST) // TODO: confirmar a coluna de org de cada tabela
  if (error) return `erro: ${error.message}`
  return count
}

for (const t of APAGAVEIS) console.log(`${t}: ${await contar(t)}`)

if (!APLICAR) {
  console.log('\nDry-run. Reveja o plano com o Ricardo e rode com --apply para apagar.')
  process.exit(0)
}

// 1. Apagar linhas das tabelas apagáveis (filhas → pais)
for (const t of APAGAVEIS) {
  const { error } = await admin.from(t).delete().eq('organizacao_id', ORG_LOADTEST)
  console.log(`${t}: ${error ? 'ERRO ' + error.message : 'apagado'}`)
}
// 2. Marcar a org inativa (as imutáveis ficam)
await admin.from('organizacoes').update({ ativo: false }).eq('id', ORG_LOADTEST)
// 3. Remover/bloquear usuários carga-*
const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 })
for (const u of lista?.users ?? []) {
  if (u.user_metadata?.loadtest) await admin.auth.admin.deleteUser(u.id)
}
console.log('limpeza aplicada (o que era imutável ficou).')
