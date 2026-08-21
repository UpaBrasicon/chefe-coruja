// ─────────────────────────────────────────────────────────────────────────────
// HERMES — scripts/seed-telefones.ts
// Popula perfis.telefone (E.164) nos usuários de TESTE — pré-requisito da
// resolução de identidade do Hermes (bloqueio apontado no PREFLIGHT-HERMES.md).
//
// Uso:
//   $env:SUPABASE_URL=... $env:SUPABASE_SERVICE_ROLE_KEY=... \
//   node --env-file=../.env --import tsx scripts/seed-telefones.ts \
//     <perfil_id> <telefone E.164> [<perfil_id> <telefone> ...]
//
// Ex.:
//   node --env-file=.env --import tsx scripts/seed-telefones.ts \
//     da6c5d33-a123-4960-a494-a00c883906a1 +5511999990001 \
//     df02d652-070f-4e2d-be82-18e432f128f7 +5511999990002
//
// ⚠️ Roda com service_role (bypassa RLS) — use apenas em ambiente de TESTE
// (org "Rede Saúde Teste") e apenas com números REAIS de WhatsApp.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import { env } from '../src/config/env.js'
import { normalizarE164BR } from '../src/lib/telefone.js'

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.length % 2 !== 0) {
    console.error('Uso: seed-telefones.ts <perfil_id> <telefone> [<perfil_id> <telefone> ...]')
    process.exit(1)
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const pares: { perfilId: string; telefone: string }[] = []
  for (let i = 0; i < args.length; i += 2) {
    const perfilId = args[i]!
    const telefone = normalizarE164BR(args[i + 1]!)
    if (!telefone) {
      console.error(`✗ telefone inválido para ${perfilId}: "${args[i + 1]}" (esperado E.164 BR)`)
      process.exit(1)
    }
    pares.push({ perfilId, telefone })
  }

  for (const p of pares) {
    const { data: perfil, error: errBusca } = await supabase
      .from('perfis')
      .select('id, nome_completo, telefone')
      .eq('id', p.perfilId)
      .maybeSingle()

    if (errBusca || !perfil) {
      console.error(`✗ perfil não encontrado: ${p.perfilId} (${errBusca?.message ?? 'não existe'})`)
      process.exit(1)
    }

    const { error } = await supabase
      .from('perfis')
      .update({ telefone: p.telefone })
      .eq('id', p.perfilId)

    if (error) {
      console.error(`✗ falha ao atualizar ${perfil.nome_completo}: ${error.message}`)
      process.exit(1)
    }
    console.log(`✓ ${perfil.nome_completo} (${p.perfilId}) → telefone ${p.telefone}`)
  }

  console.log('\nSeed concluído. Teste com npm run test:llm e o fluxo do WhatsApp.')
}

main().catch((err) => {
  console.error('falha:', (err as Error).message)
  process.exit(1)
})
