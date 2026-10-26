# Release e rollback — runbook (Fase 0, item 14)

**Quem decide:** o responsável técnico (RT) aprova cada ida à produção ("ok produção …") e cada rollback. Quem opera executa e registra. Em incidente com o RT fora do ar, o operador **pode** fazer o rollback do frontend (passo B1) e avisa em seguida — voltar é sempre mais seguro que ficar quebrado.

## A. Promover (homologação → produção)

1. Tarefa em branch própria; mudança de banco **só aditiva** (*expand*) — o CI reprova migration destrutiva sem `-- contract: … (expand em <versão>)`.
2. `git push origin <branch>:refs/heads/homolog` → Vercel publica `homolog.chefecoruja.com.br`; `npm run homolog:push` (banco) e `npm run homolog:functions` (funções, saem com `x-cc-versao`).
3. Teste na homologação + CI verde (lint, **typecheck**, build, testes, banco, expand/contract).
4. PR → merge no `master` → a Vercel publica a produção sozinha.
5. Banco/funções na produção, com o "ok" do RT: `npx supabase link --project-ref saqjrjtrkzkswsxxvdxn`, `npm run producao:push -- --confirmo-producao` e/ou `node scripts/ambiente/supabase-alvo.mjs functions producao --confirmo-producao` (recusa código não commitado), religar à homologação (`--project-ref kswurfyxxvfydpjfrivy`).
6. Conferir: site abre, login, `x-cc-versao` das funções, Sentry sem erro novo.

**Quais branches a Vercel publica (desde 11/10/2026).** O plano gratuito
permite 100 deploys por dia. Em 10/10/2026 o limite estourou com os envios de
branch, e a homologação e a produção ficaram sem deploy por 24 horas. Desde
então:

- **App** (`vercel.json`): publica só `master` (produção) e `homolog`.
- **Landing** (`landing/vercel.json`): publica só `master`.

As demais branches (`fase*/`, `docs/`, `revisao/`, `infra/`, `fix/`, `feat/`,
`chore/`, `legacy/`, `porte-*`) não geram deploy. Quem cria uma branch com
outro prefixo deve acrescentá-lo às duas listas (`git.deploymentEnabled`).

## B. Reverter

| O que | Como | Tempo |
|---|---|---|
| **B1. Frontend (produção)** | Vercel → Deployments → a última produção boa → **⋯ → Instant Rollback** (ou *Promote to Production*). Não espera build: troca o apontamento. Depois, corrigir no git (revert do PR) para o próximo deploy não trazer o defeito de volta | segundos |
| B1'. Frontend (homologação) | `git push` de um commit com a árvore da versão boa para `homolog` — **árvore exata**: `git checkout <bom> -- .` + `git rm` dos arquivos que não existiam no `<bom>` (ver evidência: só o checkout deixou arquivos novos e o build falhou) | ~1 min (build de 55 s) |
| **B2. Edge Functions** | `git checkout <commit bom>` → publicar de novo (passo A5). O commit publicado aparece em `x-cc-versao` (`curl -sI -X OPTIONS https://<ref>.supabase.co/functions/v1/folha`) | ~1 min |
| **B3. Banco** | **não há "desfazer" de migration.** Como toda migration é *expand* (aditiva), a versão anterior do app continua funcionando com o banco novo — volta-se o frontend/funções (B1/B2) e o banco fica. Migration com defeito: nova migration corrigindo (forward fix). Perda de dado: restaurar a guarda (`infra/guarda/README.md`) — com PITR, quando estiver ligado | — |

Se o build de um deploy **falhar**, a Vercel mantém no ar a versão anterior — o site não cai; o deploy com erro só não entra.

## Evidência do teste (homologação, 06–07/10/2026)

| Passo | Resultado |
|---|---|
| Versão das funções | `npm run homolog:functions` publicou `077a980`; `OPTIONS` em `folha`, `clinical-search` e `enviar-codigo-2fa` → `x-cc-versao: 077a980@2026-10-07T00:50Z`; `versao.ts` devolvido ao original depois do deploy |
| Rollback 1ª tentativa (só `git checkout 6f4aa92 -- .`) | **build falhou** (arquivos do Sentry ficaram sem a biblioteca); a homologação **seguiu no ar** com a versão anterior — lição incorporada em B1' |
| Rollback com a árvore exata de `6f4aa92` (push 00:53:57 UTC) | Ready em **55 s**; `?forcar-erro-sentry` abriu a página normal (versão sem o teste do Sentry) — **rollback comprovado** |
| Volta à versão atual (push 00:56:18 UTC) | Ready em **51 s**; `?forcar-erro-sentry` voltou a mostrar "Algo quebrou nesta tela" — **volta comprovada** |
| Typecheck bloqueante | passo `Typecheck` próprio no CI (antes já rodava dentro do build) |
| Expand/contract | `migrations-destrutivas.mjs` no CI (3 testes); nenhuma migration destrutiva desde `20261025000002` |

## Job do banco no CI: imagem do Postgres no cache do Actions (26/10/2026)

- **O que cobre:** o job `banco` restaura `supabase/postgres:17.6.1.131` do cache do GitHub Actions (chave
  `supabase-postgres-17.6.1.131`, arquivo `docker save`). Sem cache, tenta Docker Hub, depois
  `public.ecr.aws`, depois `ghcr.io` (duas vezes cada, 20 s entre elas), dá à imagem o nome
  `ghcr.io/supabase/postgres:17.6.1.131` que o CLI procura e grava no cache. O CLI acha a imagem já presente
  e não a pede ao ghcr.io. É a mesma imagem nos três registros (digest
  `sha256:42088c86593e0d4f47b2b2bd3c964cee31a1bbc8e560619fd3e84e5fdd973f6d`, conferido em 26/10/2026).
- **Por quê:** em 26/10/2026 os registros públicos barraram os runners do GitHub, que dividem endereços:
  o ghcr.io recusou a imagem do Postgres com `toomanyrequests` em todas as tentativas (PRs #239, #240 e
  #241), com e sem login e com pausas de até 90 s; o ECR público recusou com `Data limit exceeded`. Com o
  cache, depois da primeira vez o job não depende de nenhum registro para essa imagem.
- **Também no passo:** o `supabase start` ainda tenta até 4 vezes (pausas de 30, 60 e 90 s) para as outras
  imagens, que seguem no ghcr.io; e a exclusão usa os nomes do CLI 2.102 (`mailpit`, `logflare`,
  `postgres-meta`; os antigos `inbucket`, `analytics` e `meta` eram ignorados e baixavam três imagens à toa).
- **O que não cobre:** o cache de um PR só vale para ele e para o master depois do merge na primeira rodada
  do master que conseguir baixar; até lá, cada ramo depende de algum registro servir uma vez. O cache sai
  se ficar 7 dias sem uso. A tag é a do CLI 2.102.0, fixado no workflow: ao atualizar o CLI, atualizar a tag
  e a chave do cache.
- **Chaves envolvidas:** nenhuma (registros públicos sem login; o cache usa o token do próprio Actions).
- **Como reverter:** apagar os passos "Restaurar…", "Obter…" e "Guardar a imagem do Postgres…" e voltar o
  "Subir Supabase local" a uma linha só, `supabase start -x …`, em `.github/workflows/ci.yml` (PR próprio).
