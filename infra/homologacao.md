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
- Supabase de homologação → Edge Functions → Secrets: `APP_ORIGIN` (= `https://homolog.chefecoruja.com.br`), `RESEND_API_KEY`, `EMAIL_FROM`. **Não** configurar `CC_PUBLISHABLE_KEY`/`CC_SECRET_KEY`: as functions usam primeiro as chaves que a plataforma injeta (`SUPABASE_PUBLISHABLE_KEYS`/`SUPABASE_SECRET_KEYS`, ver `supabase/functions/_shared/chaves.ts`); chave manual desatualizada já quebrou o 2FA em 02/10/2026. Também não configurar `BIBLIOTECA_URL`/`BIBLIOTECA_API_KEY` (sem IA).
- CLI (terminal de quem opera): senha do banco de homologação no `supabase link`; `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` de homologação só na sessão do terminal que roda os importadores de terminologia (nunca em arquivo versionado).

## Como montar (ordem)

1. **Ligar o CLI à homologação** — `npx supabase link --project-ref kswurfyxxvfydpjfrivy` (pede a senha do banco; se não souber, Settings → Database → Reset database password no painel de homologação). Conferir: `npm run db:alvo` → `homolog`.
2. **Aplicar as migrations** — `npm run homolog:push` (projeto novo, vazio; `npm run homolog:reset` fica para quando for preciso zerar a homologação de novo).
3. **Edge Functions** — `npm run homolog:functions`; depois configurar os segredos listados acima no painel de homologação.
4. **Dados de referência e seed** — `npm run homolog:copiar -- 1` até `-- 6` (protocolo, SIGTAP×CID em 4 partes, UPA de homologação): cada comando copia o SQL; no SQL Editor de homologação (URL com `kswurfyxxvfydpjfrivy`): Ctrl+A, Delete, Ctrl+V, Run. O seed liga a UPA ao protocolo de classificação.
5. **Data API** — Project Settings → Data API → Exposed schemas: incluir `terminologia` (o app e os importadores leem o CID-10 por ele).
6. **Terminologia** — PowerShell, variáveis só na sessão: `$env:SUPABASE_URL` (homologação) e `$env:SUPABASE_SERVICE_ROLE_KEY` (chave secreta `sb_secret_` da homologação); rodar `node scripts/terminologia/importar-cid10.ts`, `importar-sigtap.ts`, `importar-cbo.ts`, `importar-cmed.ts`, `importar-loinc.ts`; fechar a janela no fim.
7. **Auth** — Authentication → URL Configuration: Site URL `https://homolog.chefecoruja.com.br`; Redirect URLs `https://homolog.chefecoruja.com.br/**`. Authentication → SMTP: Resend (`smtp.resend.com`, 465, usuário `resend`, senha = chave Resend de homologação, remetente `nao-responda@chefecoruja.com.br`) — sem isso o "Esqueci a senha" não chega.
8. **Usuário de teste** — o "Add user" do painel é barrado pela regra de cadastro só por convite (ver defeito em `produto/docs/fase0/DIAGNOSTICO-FASE0.md`). Com o Docker Desktop aberto: `npm run homolog:usuario -- e-mail` (pede a senha oculta, calcula o bcrypt no Postgres local, copia um SQL só com o hash) → SQL Editor → Run. Depois `npm run homolog:copiar -- 8 e-mail` → Run: todos os papéis na UPA Homologação + escala no Pronto Socorro por 8 dias.
9. **Vercel** — Settings → Environment Variables, escopo **Preview**: `VITE_SUPABASE_URL` = `https://kswurfyxxvfydpjfrivy.supabase.co` (atenção: `.co`, não `.com`) e `VITE_SUPABASE_ANON_KEY` = publishable (`sb_publishable_`) **da homologação** (a de produção é recusada: "Invalid API key"). Settings → Domains → Add `homolog.chefecoruja.com.br` → Preview, Git Branch `homolog`.
10. **DNS (Registro.br)** — zona de `chefecoruja.com.br`: CNAME `homolog` → o destino que o Vercel mostrar.
11. **Deploy** — o domínio só responde depois de um deploy do branch `homolog` feito após ligar o domínio (antes: `DEPLOYMENT_NOT_FOUND`). Disparar empurrando o branch (`git push origin <tarefa>:homolog`); no painel do Vercel o deploy do topo costuma ser o de Production — o de homologação é o Preview do branch `homolog`.

### Problemas encontrados na montagem (05/10/2026)

| Sintoma | Causa | Solução |
|---|---|---|
| "Sem conexão com o servidor" | `VITE_SUPABASE_URL` com `.com` | corrigir para `.co` e novo deploy |
| "Não foi possível entrar agora" / `Invalid API key` | chave publishable de produção no escopo Preview | trocar pela da homologação e novo deploy |
| "E-mail ou senha não conferem" com o banco certo | usuário inexistente (Add user barrado; SQL não rodado) | `npm run homolog:usuario` e conferir `auth.users` |
| "Aguardando liberação" com vínculos gravados | dados antigos guardados no navegador | F12 → Aplicação → Armazenamento → Limpar dados do site; entrar de novo |
| Avisos `manifest-src` bloqueado | deploy protegido redireciona o manifesto | `crossorigin="use-credentials"` no `index.html` |
| Site pede login do Vercel | proteção de deploy do Vercel (Preview) | esperado: só quem é do time Vercel abre a homologação |

## Como verificar (evidência)

- `homolog.chefecoruja.com.br` abre e entra com o super admin de homologação.
- No DevTools (Network), todas as chamadas vão para `kswurfyxxvfydpjfrivy.supabase.co`; o `index.html` de homologação traz a meta CSP com esse host, e o de produção, com `saqjrjtrkzkswsxxvdxn`.
- `npm run homolog:push` com produção ligada é recusado (saída "RECUSADO").

## Como reverter

- Site: remover o domínio `homolog` no Vercel e o CNAME no Registro.br; voltar os valores do escopo Preview (não recomendado: previews voltariam a usar a produção).
- CSP: reverter o commit da tarefa (o `vercel.json` volta a ter o host fixo de produção e o plugin sai do `vite.config.ts`).
- Banco: o projeto de homologação pode ser zerado de novo a qualquer momento (`npm run homolog:reset`); não há dado a preservar nele.
