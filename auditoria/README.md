# Auditoria Supabase — 22/08/2026

Resultados e correções da auditoria de segurança/performance do projeto
`chefe-coruja` (`saqjrjtrkzkswsxxvdxn` — sa-east-1).

## Como rodar

Os blocos SQL (`bloco01.sql` … `bloco14.sql`) são o relatório original.
Para executar contra o banco real via Management API:

```bash
node auditoria/rodar-auditoria.cjs <SUPABASE_ACCESS_TOKEN> [ref]
node auditoria/rodar-checagens.cjs <SUPABASE_ACCESS_TOKEN> [ref]
node auditoria/verificar-final.cjs <SUPABASE_ACCESS_TOKEN> [ref]
```

(Os arquivos `*.json` são snapshots dos resultados em 22/08.)

## O que foi corrigido (migrations aplicadas)

| Migration | Conteúdo |
|---|---|
| `20260823000002_auditoria_partes_ab.sql` | Partes A+B: revoke TRUNCATE/TRIGGER/REFERENCES, STABLE nos helpers (já estavam), índice `perfis(id)`, comentários documentais (Blocos 2, 6, B2, B4), `auth.uid()` → `(select auth.uid())` nas 3 policies de perfis, revoke ALL de anon |
| `20260823000003_auditoria_parte_c_indices.sql` | Partes C: 72 índices únicos (19 tenant + 65 FK, dedup) + 7 compostos para tabelas quentes + `analyze` |

## Verificação final (pós-correção)

| Item | Antes | Depois |
|---|---|---|
| Tabelas sem RLS | 0 | 0 ✅ |
| Policies `true` | 2 (medicamentos — intencional) | 2 (documentado) |
| `auth.uid()` solto | 3 | **0** ✅ |
| SECURITY DEFINER sem search_path | 0 | 0 ✅ |
| Views definer | 2 (LGPD intencional) | 2 (documentado) |
| FKs sem índice | 65 | **0** ✅ |
| TRUNCATE em anon/authenticated | presente | **0** ✅ |
| Grants de anon | 61 tabelas | **nenhum** ✅ |

## Decisões registradas (verificadas no banco/código antes)

- **A2 (STABLE)**: os 8 helpers de RLS JÁ eram STABLE. As 14 funções VOLATILE
  restantes são de escrita — não podem virar STABLE (bug).
- **A3**: `perfis` não tem `user_id` — a coluna de auth é `id` (PK, já indexada).
  Criado `idx_perfis_id` idempotente como salvaguarda.
- **B1**: o predicado real de `perfis` usa `id = auth.uid()` (não `user_id`).
- **B2**: medicamentos são `to authenticated` APENAS (não vazou para anon) —
  catálogo de leitura para logados é intencional.
- **B4**: nenhuma tabela homônima tem 0 linhas → SEM DROP automático.
  `escala_plantao` (699) e `medicamento` (200) são canônicas; `escala_plantoes`
  (15) e `medicamentos` (71) são resíduos documentados, aguardando decisão.
- **B5**: `supabase_realtime` publica só `chat_mensagens` +
  `conversa_participantes` (o que o frontend assina) — correto, nada a fazer.

## Pendências resolvidas em 23/08

1. **DROP das tabelas resíduo** (migration `20260823000004_drop_tabelas_residuo.sql`):
   - `escala_plantoes` (15 linhas, legado Fase 2) — **DROP**. O hook
     `useEscalaSetores` (5 telas clínicas) lia a tabela legada — **bug
     latente** corrigido para usar o RPC `setores_na_escala_agora`
     (lê da canônica `escala_plantao`). 0 referências vivas verificadas.
   - `medicamentos` (71 linhas, legado Fase 2) — **DROP**. A FK
     `prescricao_itens.medicamento_id` apontava para a LEGADA (errada —
     a tela grava IDs da canônica `medicamento`); reatada para a canônica
     antes do DROP (3 linhas com NULL, sem dados a migrar).
2. **`pg_timezone_names`** (123 chamadas / 640ms média) — **não é bug do
   app**: é o PostgREST traduzindo timezones em filtros de timestamp
   (comportamento padrão). ~15 chamadas/dia, impacto mínimo. Mitigação
   futura opcional: evitar timestamps com fuso em filtros.

## Pendências que exigem decisão do usuário (restantes)

Nenhuma em aberto da auditoria. Próximas melhorias sugeridas: revisar
`pg_timezone_names` se o volume de chamadas crescer; considerar grants
explícitos mínimos no `public` (defense in depth já aplicado para anon).
