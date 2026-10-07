# Release e rollback — runbook (Fase 0, item 14)

**Quem decide:** o responsável técnico (RT) aprova cada ida à produção ("ok produção …") e cada rollback. Quem opera executa e registra. Em incidente com o RT fora do ar, o operador **pode** fazer o rollback do frontend (passo B1) e avisa em seguida — voltar é sempre mais seguro que ficar quebrado.

## A. Promover (homologação → produção)

1. Tarefa em branch própria; mudança de banco **só aditiva** (*expand*) — o CI reprova migration destrutiva sem `-- contract: … (expand em <versão>)`.
2. `git push origin <branch>:refs/heads/homolog` → Vercel publica `homolog.chefecoruja.com.br`; `npm run homolog:push` (banco) e `npm run homolog:functions` (funções, saem com `x-cc-versao`).
3. Teste na homologação + CI verde (lint, **typecheck**, build, testes, banco, expand/contract).
4. PR → merge no `master` → a Vercel publica a produção sozinha.
5. Banco/funções na produção, com o "ok" do RT: `npx supabase link --project-ref saqjrjtrkzkswsxxvdxn`, `npm run producao:push -- --confirmo-producao` e/ou `node scripts/ambiente/supabase-alvo.mjs functions producao --confirmo-producao` (recusa código não commitado), religar à homologação (`--project-ref kswurfyxxvfydpjfrivy`).
6. Conferir: site abre, login, `x-cc-versao` das funções, Sentry sem erro novo.

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
