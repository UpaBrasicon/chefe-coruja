# Homologação

Fase 0, tarefa 2 do `BACKLOG.md`. Ambiente separado da produção, onde toda migration e todo deploy passam antes de chegar à produção.

## O que é

| Peça | Produção | Homologação |
|---|---|---|
| Banco (Supabase) | `saqjrjtrkzkswsxxvdxn` | `kswurfyxxvfydpjfrivy` (`chefe-coruja-homolog`, criado em 05/10/2026, São Paulo) |
| Site | `www.chefecoruja.com.br` (Vercel, branch `master`, escopo Production) | `homolog.chefecoruja.com.br` (mesmo projeto Vercel, branch `homolog`, escopo Preview) |
| Deploys de preview de qualquer branch | — | apontam para o banco de homologação (escopo Preview) |
| Dados | fictícios | fictícios (`supabase/homolog/seed-homolog.sql`), sem usuário criado por seed |
| IA (Hermes, biblioteca) | ligada | **desligada** no início (segredos `BIBLIOTECA_*` não configurados) |

## O que cobre

- Banco, Auth, Edge Functions e site próprios: produção e homologação não compartilham banco nem chaves.
- **CSP por ambiente:** o cabeçalho do `vercel.json` libera só `*.supabase.co` (https e wss); no build, o plugin `cspDoAmbiente` (`vite.config.ts`) injeta uma meta CSP com o host exato do `VITE_SUPABASE_URL` do ambiente. O navegador aplica as duas (interseção): cada site só conversa com o próprio banco. Build no Vercel sem `VITE_SUPABASE_URL` falha.
- **Trava de alvo do banco:** `scripts/ambiente/supabase-alvo.mjs` confere o projeto ligado no CLI antes de escrever. `npm run homolog:push | homolog:reset | homolog:functions` só rodam com homologação ligada; `npm run producao:push -- --confirmo-producao` só com produção ligada e confirmação explícita; reset em produção é recusado sempre. Teste: `scripts/ambiente/supabase-alvo.test.mjs` (CI).

## O que não cobre

- Não protege quem roda `npx supabase db push` direto, sem o script (o script é a porta recomendada; o hábito é a outra metade).
- Dados de terminologia (CID-10, SIGTAP, CBO, CMED, LOINC) e protocolos não vêm das migrations: são carregados à parte (passos 4 e 5 abaixo).
- Web push não funciona em homologação enquanto `VITE_VAPID_PUBLIC_KEY` não for configurado no escopo Preview (opcional).
- Sem IA em homologação até decisão em contrário.

## Chaves envolvidas (só nomes; valores ficam nos painéis)

- Vercel, escopo Preview: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable de homologação).
- Supabase de homologação → Edge Functions → Secrets: `APP_ORIGIN` (= `https://homolog.chefecoruja.com.br`), `CC_PUBLISHABLE_KEY`, `CC_SECRET_KEY` (chaves novas do projeto de homologação), `RESEND_API_KEY`, `EMAIL_FROM`. Não configurar `BIBLIOTECA_URL`/`BIBLIOTECA_API_KEY`.
- CLI (terminal de quem opera): senha do banco de homologação no `supabase link`; `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` de homologação só na sessão do terminal que roda os importadores de terminologia (nunca em arquivo versionado).

## Como montar (ordem)

1. **Ligar o CLI à homologação** — `npx supabase link --project-ref kswurfyxxvfydpjfrivy` (pede a senha do banco; se não souber, Settings → Database → Reset database password no painel de homologação). Conferir: `npm run db:alvo` → `homolog`.
2. **Aplicar as migrations** — `npm run homolog:push` (projeto novo, vazio; `npm run homolog:reset` fica para quando for preciso zerar a homologação de novo).
3. **Edge Functions** — `npm run homolog:functions`; depois configurar os segredos listados acima no painel de homologação.
4. **Protocolo e SIGTAP×CID** — no SQL Editor de homologação (URL com `kswurfyxxvfydpjfrivy`): rodar `supabase/dados/protocolo_aparecida_2025.sql` e `supabase/dados/sigtap_cid.sql`.
5. **Terminologia** — no terminal, com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` de homologação definidos só na sessão: `node scripts/terminologia/importar-cid10.ts`, `importar-sigtap.ts`, `importar-cbo.ts`, `importar-cmed.ts`, `importar-loinc.ts`.
6. **Seed fictício** — SQL Editor: `supabase/homolog/seed-homolog.sql`.
7. **Auth** — Authentication → URL Configuration: Site URL `https://homolog.chefecoruja.com.br`; Redirect URLs `https://homolog.chefecoruja.com.br/**`.
8. **Primeiro super admin** — Authentication → Users → Add user (e-mail + senha própria, diferente da produção, "Auto Confirm"); depois `supabase/homolog/promover-super-admin.sql` com o e-mail trocado.
9. **Vercel** — Settings → Environment Variables: trocar os valores do escopo **Preview** de `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para os de homologação. Settings → Domains → Add `homolog.chefecoruja.com.br` → Git Branch `homolog`.
10. **DNS (Registro.br)** — zona de `chefecoruja.com.br`: CNAME `homolog` → o destino que o Vercel mostrar (normalmente `cname.vercel-dns.com`).
11. **Branch `homolog`** — criado a partir do `master` depois do merge deste PR; o fluxo passa a ser branch da tarefa → PR → `homolog` (valida) → `master`.

## Como verificar (evidência)

- `homolog.chefecoruja.com.br` abre e entra com o super admin de homologação.
- No DevTools (Network), todas as chamadas vão para `kswurfyxxvfydpjfrivy.supabase.co`; o `index.html` de homologação traz a meta CSP com esse host, e o de produção, com `saqjrjtrkzkswsxxvdxn`.
- `npm run homolog:push` com produção ligada é recusado (saída "RECUSADO").

## Como reverter

- Site: remover o domínio `homolog` no Vercel e o CNAME no Registro.br; voltar os valores do escopo Preview (não recomendado: previews voltariam a usar a produção).
- CSP: reverter o commit da tarefa (o `vercel.json` volta a ter o host fixo de produção e o plugin sai do `vite.config.ts`).
- Banco: o projeto de homologação pode ser zerado de novo a qualquer momento (`npm run homolog:reset`); não há dado a preservar nele.
