// Gera o SQL da PARTE C (índices) com dedup — lê checagens.json.
const fs = require('fs')
const path = require('path')
const c = JSON.parse(fs.readFileSync(path.join(__dirname, 'checagens.json'), 'utf8'))

const tenant = c.C1_gerador_tenant.map((l) => l.ddl)
const fk = c.C1_gerador_fk.map((l) => l.ddl)

// dedup por nome (mesma coluna nos dois geradores)
const vistos = new Set()
const unicos = []
for (const d of [...tenant, ...fk]) {
  const m = d.match(/create index if not exists ([a-z0-9_]+) on/)
  if (m && !vistos.has(m[1])) {
    vistos.add(m[1])
    unicos.push(d)
  }
}

const linhas = [
  '-- =====================================================================',
  '-- CORREÇÕES DA AUDITORIA — PARTE C (Índices, Blocos 8 e 9) — 22/08/2026',
  '-- Gerado a partir do banco real (checagens.json). Sem CONCURRENTLY: a',
  '-- migration da CLI roda em transação e com 121 MB o lock é de ms.',
  '-- =====================================================================',
  '',
]
for (const d of unicos.sort()) linhas.push(d + '')
linhas.push('')
linhas.push('-- Compostos para as tabelas quentes (C2)')
linhas.push('create index if not exists idx_internacoes_org_status on public.internacoes (organizacao_id, status);')
linhas.push('create index if not exists idx_documentos_clinicos_unidade_criado on public.documentos_clinicos (unidade_id, created_at desc);')
linhas.push('create index if not exists idx_log_acesso_prontuario_unidade_data on public.log_acesso_prontuario (unidade_id, created_at desc);')
linhas.push('create index if not exists idx_censo_ocupacao_org_data on public.censo_ocupacao (organizacao_id, created_at desc);')
linhas.push('create index if not exists idx_eventos_adt_unidade_data on public.eventos_adt (unidade_id, created_at desc);')
linhas.push('create index if not exists idx_notificacoes_plantonista_unidade on public.notificacoes_plantonista (unidade_id, created_at desc);')
linhas.push('create index if not exists idx_interop_outbox_pendentes on public.interop_outbox (created_at) where status in (\'pending\',\'pendente\',\'erro\',\'failed\');')
linhas.push('')
linhas.push('-- Estatísticas atualizadas')
linhas.push('analyze;')
linhas.push('')

fs.writeFileSync(path.join(__dirname, 'parte-c-gerado.sql'), linhas.join('\n'), 'utf8')
console.log(`Gerado parte-c-gerado.sql com ${unicos.length} índices únicos (tenant+FK dedup) + 7 compostos`)
