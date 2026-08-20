# Fechamento da varredura Strix — VULN-0001 e VULN-0002 corrigidas

> Run: `chefe-coruja_e27a` · Modelo: Anthropic `claude-sonnet-4-6` · Custo: US$ 9,02 · Tokens: 18,2M
> Data da correção: 2026-08-20

## Resumo

A varredura Strix (AI pentesting, modo CLI) encontrou **2 achados HIGH** no repositório
`chefe-coruja` (Supabase + React/TS). Ambos foram corrigidos, aplicados e verificados.

| ID | Título | CWE | CVSS | Status |
|---|---|---|---|---|
| vuln-0001 | Storage RLS do bucket `atendimento` sem escopo por tenant (cross-tenant PHI) | CWE-862 | 7.1 | ✅ Corrigida |
| vuln-0002 | XSS armazenado nos 8 fluxos de impressão (`document.write`) | CWE-79 | 8.7 | ✅ Corrigida |

## Evidências de verificação

- **vuln-0001** — migration `20260817000013_fix_atendimento_bucket_rls.sql` aplicada via
  `supabase db push` no projeto remoto `saqjrjtrkzkswsxxvdxn`. Dump do schema `storage` confirma as
  4 policies (`upload`, `read`, `update`, `delete`) com `regexp_match(name, '^([^/]+)/')::uuid IN
  (SELECT private.unidades_gestor_plantonista())` + `private.eh_super_admin()`. Frontend já grava em
  `{unidadeId}/...` (`DadosPaciente.tsx`, `Escala.tsx`) — sem mudança de app necessária.
- **vuln-0002** — `escapeHtml()` aplicado nos 8 componentes; `tsc -b --noEmit` limpo, `eslint .`
  sem erros, `vite build` OK, 43/43 testes passando.

## Artefatos

- Findings originais: `strix_runs/chefe-coruja_e27a/` (SARIF, relatório, run.json)
- Cópias em `docs/seguranca/`: `strix-findings.sarif`, `strix-relatorio-completo.md`,
  `strix-vuln-0001-atendimento-bucket.md`, `strix-vuln-0002-xss-impressao.md`
- Correções: `supabase/migrations/20260817000013_fix_atendimento_bucket_rls.sql` + 8 componentes em `src/pages/`

## Recomendações de hardening (não bloqueantes)

1. **Rotacionar chaves Anthropic** usadas na varredura (coladas no chat e salvas em
   `~/.strix/cli-config.json` — manter fora de qualquer commit).
2. **CSP estrita** (defense-in-depth para XSS residual via inline script) — sugerida pelo Strix.
3. Re-rodar o Strix em run futura para confirmar fechamento automatizado (custo ~US$ 9 por run).
4. `storage.objects` ainda permite `SELECT`/`INSERT` a `service_role` (bypass RLS) — esperado para
   import scripts; nenhuma chave de service_role no repositório.
