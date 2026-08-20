// ─────────────────────────────────────────────────────────────────────────────
// Migração dos dados existentes → public.observacao (FASE 2)
//
// ADITIVA: NÃO derruba nem altera tabelas antigas. O corte vem em fase
// posterior, após validação em produção.
//
// Hoje NÃO existe tabela estruturada de sinais vitais/exames no banco: os
// dados clínicos vivem em texto livre (documentos_clinicos.conteudo) e em
// rascunhos de navegador (localStorage, TTL 12h) — nada migrável de forma
// estruturada. Este script faz a contagem de linhas candidatas por fonte
// (dry-run por padrão) e reporta o que seria migrado.
//
// Uso:
//   node scripts/observacao/migrar-observacoes.ts            # dry-run
//   node scripts/observacao/migrar-observacoes.ts --aplicar  # aplica
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'

const APLICAR = process.argv.includes('--aplicar')
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatórias')

const client = createClient(url, key)

async function contar(tabela: string): Promise<number> {
  const { count, error } = await client.from(tabela).select('id', { count: 'exact', head: true })
  if (error) throw new Error(`count ${tabela}: ${error.message}`)
  return count ?? 0
}

/** Fontes estruturadas de sinais vitais/exames. Hoje: nenhuma tabela dedicada. */
const FONTES: { nome: string; tabela: string | null; nota: string }[] = [
  { nome: 'sinais_vitais (tabela dedicada)', tabela: null, nota: 'não existe — dados em texto livre (documentos_clinicos.conteudo)' },
  { nome: 'resultados_exame (tabela dedicada)', tabela: null, nota: 'não existe — dados em texto livre (documentos_clinicos.conteudo)' },
]

async function main() {
  console.log(`MIGRAÇÃO OBSERVACAO — modo: ${APLICAR ? 'APLICAR' : 'DRY-RUN'}`)
  console.log('')

  const antes = await contar('observacao')
  console.log(`observacao ANTES: ${antes} linhas`)

  console.log('')
  console.log('Fontes de dados estruturados:')
  const candidatas = 0
  for (const f of FONTES) {
    console.log(`  - ${f.nome}: ${f.nota}`)
  }
  console.log('')
  console.log('→ Nenhuma tabela antiga estruturada de sinais vitais/exames existe.')
  console.log('  A migração estruturada só fará sentido quando houver fonte (ex.: integração LIS).')
  console.log(`  Linhas candidatas: ${candidatas}`)

  if (APLICAR) {
    // nada a migrar hoje — o relatório de contagem é o entregável
    console.log('  (nada aplicado — sem fontes estruturadas)')
  } else {
    console.log('  (dry-run — use --aplicar quando houver fonte)')
  }

  const depois = await contar('observacao')
  console.log('')
  console.log(`observacao DEPOIS: ${depois} linhas`)
  console.log(`Diferença: ${depois - antes}`)
  console.log('')
  console.log('Tabelas antigas: INTACTAS (nenhum DROP nesta fase).')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
