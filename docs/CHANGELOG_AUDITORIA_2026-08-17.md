# CHANGELOG — Auditoria de Segurança 2026-08-17

Correções de auditoria de segurança aplicadas ao Chefe Coruja, em 6 itens.

---

| # | Arquivo(s) alterado(s) | Problema | Correção |
|---|---|---|---|
| 1 | `tsconfig.app.json` | `baseUrl` deprecado no TS 5.5+ (TS5101) quebrava o build | Removida a opção `baseUrl`; `paths: { "@/*": ["./src/*"] }` mantido (funciona sem baseUrl desde o TS 5.5) |
| 2 | `supabase/functions/notify-email/index.ts` | Edge Function aceitava POST de qualquer origem e interpolava campos do payload direto no HTML do e-mail (forjamento de e-mails + injeção de HTML) | (a) Verificação de origem: `Authorization: Bearer <WEBHOOK_SECRET>`; 401 se ausente/diferente; **fail closed** (500) se `WEBHOOK_SECRET` não configurado; (b) `escapeHtml()` aplicado em toda variável externa dos templates (record/old_record/queries/formatarData); (c) comentário no topo documentando o header do Database Webhook |
| 3 | `supabase/migrations/20260817000001_fix_security_definer_search_path.sql` (nova) | Auditoria de `SECURITY DEFINER` vs `SET search_path` | Verificado: as 86 funções reais já tinham `SET search_path`. Migration nova reafirma explicitamente (`ALTER FUNCTION ... SET search_path`) nas 8 funções indicadas (idempotente, defensivo). Contagem final grep por linha: **98 vs 98, diferença 0** |
| 4 | `src/pages/plantao/shared/rascunho.ts`, `src/pages/plantao/internacao/rascunho.ts`, `src/pages/plantao/atendimento/*.tsx` (Receituario, Atestado, Encaminhamento, PedidoExames), `src/contexts/AuthContext.tsx` | Rascunhos clínicos com dados de paciente persistiam indefinidamente no navegador (computador compartilhado de UPA) | (a) TTL de 12h: envelope `{ v: 1, salvoEm, dados }`; rascunho expirado ou formato antigo é removido; (b) `limparTodosRascunhos()` chamada no `signOut` (antes de `supabase.auth.signOut()`); (c) `limpar()` após emissão bem-sucedida nos 4 fluxos de atendimento |
| 5 | `src/lib/utils.ts`, `src/pages/plantao/internacao/ExportarTab.tsx` | HTML injetado via `innerHTML` para captura do PDF incluía campos livres sem escape (notadamente `c.valor` do AIH) | `escapeHtml()` criado em `src/lib/utils.ts` (cobre `& < > " '`); substituído o `esc` local parcial; aplicado em todo campo de texto livre interpolado, incluindo o valor do AIH e o catálogo de prescrição |
| 6 | — | Verificação final | `npm run typecheck` → 0 erros; `npm run lint` → sem erros novos (1 warning pré-existente no `PrescricaoTab.tsx`); `npm run build` → sucesso (exit 0) |

---

## Notas e decisões

- **Item 2 — Ação manual no Supabase (obrigatória):** criar o secret `WEBHOOK_SECRET`
  (Edge Functions → Secrets, ex.: `openssl rand -hex 32`) e editar o Database Webhook
  que chama a `notify-email` adicionando o header `Authorization: Bearer <mesmo valor>`.
  Sem isso, a função recusa (401) e os e-mails param de sair — **fail closed, comportamento correto**.
- **Item 3 — Ação manual:** após revisar o diff, rodar `supabase db push` para aplicar a
  migration nova.
- **Item 2/3 — Ferramenta `deno` indisponível** na máquina: a verificação da Edge Function
  foi feita por leitura cuidadosa (aceite alternativo previsto na tarefa). A migration foi
  validada por contagem `grep` por linha (98 vs 98, diferença 0).
- **Item 4 — Migração de dados:** rascunhos antigos (sem envelope) são tratados como
  expirados e removidos na primeira leitura — nenhuma migração de usuário necessária.
- **Escopo:** nenhuma refatoração fora de escopo (Escala.tsx intacto); sem upgrade de
  dependências; sem mudanças de comportamento visível ao usuário (exceto a esperada: rascunho
  expira em 12h e é limpo no logout/após emissão).

## Arquivos incluídos no diff

- `tsconfig.app.json`
- `supabase/functions/notify-email/index.ts`
- `supabase/migrations/20260817000001_fix_security_definer_search_path.sql` (novo)
- `src/pages/plantao/shared/rascunho.ts`
- `src/pages/plantao/internacao/rascunho.ts`
- `src/pages/plantao/atendimento/ReceituarioMedico.tsx`
- `src/pages/plantao/atendimento/AtestadoMedico.tsx`
- `src/pages/plantao/atendimento/Encaminhamento.tsx`
- `src/pages/plantao/atendimento/PedidoExames.tsx`
- `src/contexts/AuthContext.tsx`
- `src/lib/utils.ts`
- `src/pages/plantao/internacao/ExportarTab.tsx`
- `eslint.config.js` (exclusão da pasta `landing`/`landing/.next` do lint da raiz)
