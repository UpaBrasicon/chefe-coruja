# Cutover Hermes V1 — tirar o `service_role` do agente

Companheiro da migration `supabase/migrations/20261020000001_hermes_least_privilege.sql`
(roles + RPCs já criados, aditivos). Este guia é o **cutover no VPS**, feito e
testado por você. Enquanto não executado, nada muda — o Hermes segue no
`service_role` e as RPCs novas ficam ociosas.

Objetivo: o runtime do Hermes deixa de usar `service_role` (bypassa RLS) e passa
a usar dois principais sem bypass: **`hermes_user`** (caminho de request, só
EXECUTE em RPCs scoped) e **`hermes_job`** (crons, grants mínimos).

---

## DESFECHO (02/10/2026): caminho B aprovado e implementado — runbook do VPS

O dono do produto aprovou em 02/10/2026 tirar o runtime do Hermes da
`service_role`. O que estava escrito em 01/10 (abaixo) fica como histórico: o
caminho B saiu do papel.

**O que entrou no código (sem efeito até você setar as URLs no VPS):**
- Migration `supabase/migrations/20261022000007_hermes_login_roles_pg.sql`:
  papéis LOGIN `hermes_app_user` (herda `hermes_user`) e `hermes_app_job`
  (herda `hermes_job`), **sem senha**, NOSUPERUSER/NOBYPASSRLS, limite de
  conexões (10/6) e `statement_timeout` (15 s/120 s). Re-grant idempotente do
  EXECUTE das RPCs (a revisão `20261022000002` só tirou de PUBLIC/anon/
  authenticated; os grants a `hermes_user`/`hermes_job` continuavam).
  **Correção encontrada:** `hermes_job` tinha GRANT de tabela mas nenhuma
  política de RLS — sem BYPASSRLS, os crons leriam tudo vazio e todo INSERT
  falharia. A migration cria políticas `TO hermes_job` espelhando exatamente os
  grants que já existiam (+ SELECT/UPDATE no `cerbero_url_cache` para o upsert).
  `hermes_user` continua com **zero** grant de tabela.
- `hermes/src/lib/pg.ts` + `lib/supabase.ts`: `supabaseUser`/`supabaseJob` são
  agora objetos **só com `.rpc()`** (allowlist por caminho, argumentos nomeados
  parametrizados, JSON no formato do PostgREST). `lib/db-job.ts`: as consultas
  de tabela dos crons em postgres.js. Sem `HERMES_PG_*_URL` → cai na
  service_role com aviso alto no log. Com `HERMES_SEM_SERVICE_ROLE=1` → o
  processo **não sobe** sem as duas URLs e o cliente service_role lança se tocado.
- Guarda de CI `hermes/src/lib/supabase-rpc-only.test.ts` reescrita em AST
  (pega alias, re-export, `import()`/`require`, `createClient`, chave em string).
- Testes: `supabase/tests/hermes_login_roles_pg.sql` e
  `hermes/src/lib/pg.integration.test.ts` (banco local).

### Runbook (você executa; nada disso foi feito pelo agente)

**(a) Aplicar a migration** (aditiva; não muda nada até as URLs existirem):
```bash
npx supabase db push --linked
```
Confira no SQL editor: `select rolname, rolcanlogin, rolsuper, rolbypassrls, rolconnlimit from pg_roles where rolname like 'hermes_app%';`
→ 2 linhas, `rolsuper`/`rolbypassrls` = false.

**(b) Definir as senhas** — gere NO VPS (nunca cole no chat, nunca no git):
```bash
openssl rand -hex 24   # senha do hermes_app_user
openssl rand -hex 24   # senha do hermes_app_job
```
No **SQL editor** do Supabase (projeto `saqjrjtrkzkswsxxvdxn`), cole cada senha
no lugar do marcador e rode:
```sql
ALTER ROLE hermes_app_user WITH PASSWORD 'COLE_A_SENHA_DO_USER';
ALTER ROLE hermes_app_job  WITH PASSWORD 'COLE_A_SENHA_DO_JOB';
```
(Hex não precisa de escape na URL. O SQL editor não guarda a senha no
histórico de migrations; mesmo assim, limpe a aba depois.)

**(c) Connection string do pooler** — Supavisor, **modo session, porta 5432**.
Para papel custom o usuário é `PAPEL.PROJECT-REF`:
```
postgresql://hermes_app_user.saqjrjtrkzkswsxxvdxn:SENHA@aws-N-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require
postgresql://hermes_app_job.saqjrjtrkzkswsxxvdxn:SENHA@aws-N-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require
```
O `N` (`aws-0`, `aws-1`…) é o índice do cluster do pooler e **não dá para
deduzir pela região** (doc do Supabase, "Connecting to Postgres"). Copie o host
exato em: Dashboard → botão **Connect** (topo do projeto) → **Session pooler**
→ troque só o usuário `postgres.saqjrjtrkzkswsxxvdxn` por
`hermes_app_user.saqjrjtrkzkswsxxvdxn` (e `_job`). O pooler é IPv4.
Teste rápido no VPS (antes do .env): 
`psql "postgresql://hermes_app_user.saqjrjtrkzkswsxxvdxn:SENHA@HOST:5432/postgres?sslmode=require" -c "select current_user"`
→ `hermes_app_user`. E `-c "select 1 from public.perfis"` → **permission denied** (é o esperado).

**(d) Linhas no `/home/hermes/deploy/.env.prod`** (mantenha a
`SUPABASE_SERVICE_ROLE_KEY` por enquanto — é o fallback):
```
HERMES_PG_USER_URL=postgresql://hermes_app_user.saqjrjtrkzkswsxxvdxn:SENHA_USER@HOST:5432/postgres?sslmode=require
HERMES_PG_JOB_URL=postgresql://hermes_app_job.saqjrjtrkzkswsxxvdxn:SENHA_JOB@HOST:5432/postgres?sslmode=require
```

**(e) Rebuild do hermes-app** — o código novo traz a dependência `postgres`,
então envie também `package.json` e `package-lock.json`:
```bash
scp -r package.json package-lock.json tsconfig.json src/ hermes@IP_DA_VPS:/home/hermes/deploy/
ssh hermes@IP_DA_VPS
cd /home/hermes/deploy
docker compose -f docker-compose.prod.yml up -d --build app
docker compose -f docker-compose.prod.yml logs --tail=80 app
```
No log **não** pode aparecer o bloco `!!! ... usando a SERVICE_ROLE`. Se
aparecer, uma das URLs não chegou ao container.

**(f) Validação** (com a service_role ainda no .env, como rede):
- [ ] `docker exec hermes-app node -e "fetch('http://127.0.0.1:3000/health').then(r=>r.json()).then(console.log)"` → `status: 'ok'`, `supabase: 'connected'`.
- [ ] No SQL editor: `select usename, application_name, count(*) from pg_stat_activity where usename like 'hermes_app%' group by 1,2;` → conexões `hermes-user` / `hermes-job`.
- [ ] Mensagem real de um profissional pelo canal: identidade resolvida, dashboard da **própria** unidade responde.
- [ ] Profissional sem vínculo pedindo outra unidade → resposta negada (no log: `42501 Acesso negado`).
- [ ] Recepção/plantonista pedindo incidentes/quarentena → negado.
- [ ] Rodar os crons uma vez (ou esperar o ciclo): cerbero, argos, vigias, sentinela, relatório — log sem `permission denied` nem `row-level security`.
- [ ] `/skill/vincular` com código válido vincula o canal.

**(g) Desligar a service_role** (só depois de (f) inteiro verde):
1. No `.env.prod`: adicione `HERMES_SEM_SERVICE_ROLE=1` e **apague** a linha
   `SUPABASE_SERVICE_ROLE_KEY=...`.
2. `docker compose -f docker-compose.prod.yml up -d app` (sem build; só env).
3. Repetir (f). O processo se recusa a subir se faltar uma URL (mensagem
   `[env] Configuração inválida`) — é o comportamento desejado.
4. Opcional e recomendado: rotacionar a `service_role` (secret key) no
   dashboard, já que ela morou no VPS. Antes, confira que nada mais no VPS a usa
   (`grep -r SERVICE_ROLE /home/hermes`, inclusive `deploy/validar-fluxo200.sh`
   e o ambiente do Nous).

**(h) Rollback** (qualquer etapa):
- Antes de (g): apague (ou comente) as duas linhas `HERMES_PG_*_URL` do
  `.env.prod` → `docker compose -f docker-compose.prod.yml up -d app`. Volta ao
  fallback service_role, sem rebuild.
- Depois de (g): devolva `SUPABASE_SERVICE_ROLE_KEY=...` ao `.env.prod`,
  remova `HERMES_SEM_SERVICE_ROLE=1` (ou ponha `0`) e suba de novo.
- Bloquear os papéis sem apagar nada: `ALTER ROLE hermes_app_user NOLOGIN;`
  `ALTER ROLE hermes_app_job NOLOGIN;` (reabrir com `LOGIN`). A migration é
  aditiva; não há DDL a desfazer para o rollback do runtime.

---

> **DESFECHO (01/10/2026): swap NÃO executado — V1 fechado por guarda em CI.**
> O self-mint (caminho A) foi testado em prod e rejeitado (PostgREST em JWKS
> assimétrica; signing key = ECC P-256; ver §1). O caminho B (Postgres direto +
> postgres.js) foi avaliado e **descartado por custo/benefício**: o caminho de
> request (`supabaseUser`) já é **só `.rpc()`** em funções SECURITY DEFINER
> scoped (cross-tenant barrado no SQL), então o swap seria só defesa em
> profundidade — não justifica adicionar dependência de pooler/role custom em
> produção. No lugar, entrou a guarda `hermes/src/lib/supabase-rpc-only.test.ts`
> (CI): falha se um `.from()` cru entrar no caminho de request ou se o cliente
> service_role for importado lá. Mesma proteção, zero risco de runtime.
> Reabrir o caminho B só se o caminho de request precisar de acesso cru a tabela.
>
> **STATUS (histórico): a REESCRITA DO CÓDIGO já está feita e commitada**
> (17 arquivos em `hermes/src`: 2 clientes em `lib/supabase.ts`, identidade,
> sessão, tools, pipeline, skill-api migrados para `.rpc()`, crons em
> `supabaseJob`). `cd hermes && npx tsc --noEmit` → PASS. Fallback: sem
> `HERMES_USER_KEY`/`HERMES_JOB_KEY`, os clientes caem na service key — então
> **nada muda até você setar as chaves no VPS**. O `export supabase`
> (service_role) foi mantido (passo §5 — remover — é seu, após testar).
> Grant de `confirmar_vinculo_hermes` a `hermes_user` adicionado
> (migration `20261020000002`).
>
> **Deltas intencionais** (as RPCs têm shape enxuto; confirme que os consumidores aceitam):
> `consultaAguia.censo` devolve a última linha (antes até 6); `alertas` sem LIMIT 25
> e sem `limite_outlier`; `indicadores` sem `unidade_id`/`unidade_nome`;
> `consultaInfra.integridade` sem `por_severidade`; `getIncidentes` só
> `aberto`/`em_analise`. Nenhum quebra tipo.
>
> **Log de tentativa cross-tenant** foi de `cerbero_incidentes` para
> `hermes_audit_log` (via `hermes_audit_registrar`), porque `hermes_user` não
> tem grant de tabela. Se o Gavião precisar enxergar essas tentativas, criar
> uma RPC de incidente própria para `hermes_user`.
>
> Resta no VPS: §1 (emitir JWTs) + §2 (chaves no `.env.prod`) + §7 (testar) + §5 (remover service_role).

---

## 0. Pré-check (já feito nesta migration)
- Roles `hermes_user` / `hermes_job` criados (NOLOGIN), concedidos ao `authenticator`.
- `hermes_user`: **zero** grant de tabela; só EXECUTE nas 23 RPCs listadas.
- `hermes_job`: SELECT/INSERT mínimos + EXECUTE nas RPCs de verificação.
- Testado: `supabase/tests/porte_redteam_v1_hermes.sql` (membro lê, não-membro
  e não-super são negados, `hermes_user` sem grant de tabela).

Aplicar em produção: `supabase db push --linked` (aditivo, seguro).

---

## 1. Emitir os JWTs dos dois papéis

### Mecanismo — CAMINHO A TESTADO E REJEITADO EM PROD (01/10/2026)
Mesmo com o **JWT secret HS256 presente no dashboard** (coexistindo com Signing
Keys assimétricas), o self-mint HS256 **não funciona** neste projeto. Teste real
no VPS (token HS256 mintado com o secret do dashboard, chamada ao PostgREST):

1. JWT custom como `apikey` → Kong: `401 {"message":"Invalid API key"}`. Kong só
   aceita `apikey` conhecida (sb_secret/sb_publishable), não JWT custom.
2. `apikey: <sb_secret>` + `Authorization: Bearer <JWT HS256 custom>` → PostgREST:
   `401 PGRST301 "No suitable key was found to decode the JWT / wrong key type"`.
   **PostgREST verifica só com as signing keys assimétricas (JWKS)** — rejeita
   HS256. O secret HS256 do dashboard é legado e NÃO é usado na verificação.

Self-sign assimétrico também é inviável: a chave privada da signing key fica na
Supabase (não exportável). **Portanto, o único caminho é o B (Postgres direto).**

> O script `hermes/scripts/mint-hermes-jwt.mjs` (caminho A) fica no repo só como
> referência; **não serve neste projeto** enquanto o PostgREST estiver em JWKS
> assimétrica.

### Caminho B — Postgres direto com login roles (ÚNICO viável aqui)
Bypassa PostgREST/Kong/JWT. Conecta ao Postgres (pooler Supavisor, porta 5432
session mode, ou direct 5432) como papéis LOGIN que herdam os grants mínimos:
```sql
-- migration nova (aditiva): login roles que herdam hermes_user / hermes_job
CREATE ROLE hermes_app_user LOGIN PASSWORD '<forte>' IN ROLE hermes_user;
CREATE ROLE hermes_app_job  LOGIN PASSWORD '<forte>' IN ROLE hermes_job;
```
Conexão: usuário `hermes_app_user.<project-ref>` (formato Supavisor) + senha, na
connection string do pooler. Guardar `HERMES_PG_USER_URL` / `HERMES_PG_JOB_URL`
no `.env.prod` (nunca no git).

**Mudança de código (lib/supabase.ts):** trocar os 2 clientes de menor privilégio
por `postgres.js`. Como o cutover já roteou o caminho de request **só por
`.rpc()`**, o menor esforço é um **shim** que expõe `.rpc(nome, params)` e por
baixo faz `sql\`select * from public.${nome}(${...})\``, mantendo os call sites.
Os crons (`supabaseJob`) usam `.from()` cru → esses viram query `postgres.js` de
verdade (poucos call sites: healthcheck `unidades`, jobs cerbero/argos/vigias).
Depois: testar §7, remover service_role (§5).

Esforço: 1 migration + reescrever `lib/supabase.ts` + ~poucos call sites de
`.from()` dos crons. Agendar sessão de dev (não dá em console ao vivo).

## 2. Dois clientes no Hermes
`hermes/src/lib/supabase.ts`: além do cliente atual, criar **dois** clientes
(`supabaseUser` com `HERMES_USER_KEY`, `supabaseJob` com `HERMES_JOB_KEY`).
Request path importa `supabaseUser`; crons importam `supabaseJob`. Remover o
cliente `service_role` ao final (passo 5).

## 3. Reescrever o caminho de request (`.from()` → `.rpc()`), por arquivo
Cada chamada abaixo troca a leitura/escrita direta pela RPC equivalente (todas
recebem `p_perfil` = o perfil já resolvido pelo `wa_id`):

**`agent/identidade.ts`**
- `:154` + `:170` (match por telefone + **scan da tabela perfis inteira**) → `rpc('hermes_identidade_por_telefone', { p_e164 })`. Elimina o scan cross-tenant.
- `:202` (hermes_identidades join) → `rpc('hermes_identidade_por_canal', { p_canal, p_identificador })`.
- `:75`/`:93` (super_admins/vinculos do próprio perfil) → já vêm no retorno das RPCs acima (`is_super_admin`, `vinculos`).

**`server/skill-api.ts`**
- `:130` → `rpc('hermes_unidade_nomes', { p_perfil, p_unidade })`
- `:163` → `rpc('hermes_unidade_setores', ...)`
- `:171` → `rpc('hermes_unidade_censo', ...)`
- `:180` → `rpc('hermes_unidade_indicadores', ...)`
- `:189` → `rpc('hermes_unidade_profissionais', ...)`
- `:202` → `rpc('hermes_unidade_resumo', ...)`
- `:226` → `rpc('hermes_unidade_internacoes_por_status', ...)` (remove a paginação de 1000 no cliente)
- `:249` → `rpc('hermes_alertas_escala', { p_perfil, p_unidade, p_status })`
- `:262` → `rpc('hermes_relatorio_semanal_ultimo', { p_perfil })`
- `:276` + `:391-392` → `rpc('hermes_incidentes_abertos', ...)` / `rpc('hermes_integridade_resumo', { p_perfil })`
- `:289` → `rpc('hermes_quarentena_pendente', { p_perfil })`
- `:322` → `rpc('hermes_minhas_notificacoes', { p_perfil, p_unidade, p_dias })`
- `:504` (incidente de tentativa cross-tenant) → `rpc('hermes_quarentenar_conteudo', ...)` ou `hermes_audit_registrar`
- `:361`/`:375`/`:460`/`:572` já são `.rpc()` — só re-grant (feito) + `hermes_plantoes_do_perfil` passa a validar o p_perfil internamente (ver §6).

**`agent/tools.ts`** (Cérbero via agente, super admin)
- `:58` → `rpc('hermes_quarentena_pendente', { p_perfil })`
- `:74` → `rpc('hermes_incidentes_abertos', ...)`
- `:100` (update liberado) → `rpc('hermes_liberar_quarentena', { p_perfil, p_id })`
- `:144` (audit) → `rpc('hermes_audit_registrar', ...)`

**`agent/sessao.ts`**
- `:23` → `rpc('hermes_sessao_carregar', { p_perfil, p_phone })`
- `:60` → `rpc('hermes_sessao_salvar', { p_perfil, p_phone, p_messages })`

**`agent/pipeline.ts`**
- `:62` → `rpc('hermes_audit_registrar', ...)`
- `:167`/`:181`/`:207`/`:211` (firewall de conteúdo) → `rpc('hermes_quarentenar_conteudo', ...)`

## 4. Crons → `supabaseJob`
Trocar o import do cliente nos jobs (`jobs/*.ts`, `agent/sentinela.ts`) para
`supabaseJob`. Eles mantêm os `.from()` diretos (leitura ampla legítima), mas
agora sob `hermes_job` (grants mínimos da migration), **não** service_role.
`server.ts:145` (healthcheck) e `gateway.ts:68` (log) cabem nos grants de
`hermes_job`.

## 5. Remover o service_role do runtime
Depois que §2-4 estiverem **testados** (ver §7): apagar `HERMES_SERVICE_KEY`/
`SUPABASE_SERVICE_ROLE_KEY` do `.env.prod`, remover o cliente service_role de
`lib/supabase.ts`, rebuild. A partir daí, bug no filtro em código não alcança
outro tenant — o banco recusa (role sem grant).

## 6. Endurecer RPCs já existentes (opcional, barato)
`hermes_plantoes_do_perfil(p_perfil,...)` e `hermes_plantao_do_dia` hoje confiam
no `p_perfil`/`p_unidade` passados. Como `hermes_user` só os chama com valores
resolvidos no servidor, é aceitável; para defesa em profundidade, adicionar
assert interno (perfil tem vínculo na unidade) como nas RPCs novas.

## 7. Checklist de teste (no VPS, antes de remover o service_role)
- [ ] `/health` → `{"status":"ok","redis":"connected","supabase":"connected"}` com os novos clientes.
- [ ] Consulta de um profissional real via wa_id: dashboards da **própria** unidade retornam dados.
- [ ] Tentar `p_unidade` de **outra** unidade (forçando no código de teste) → `42501 Acesso negado`.
- [ ] recepcao/plantonista comum chamando RPC de segurança (incidentes/quarentena/relatório) → negado.
- [ ] Crons (cerbero/argos/vigias/sentinela) rodam sob `hermes_job` sem erro de permissão.
- [ ] Só então remover o service_role (§5) e rebuild.

## Resultado
`hermes_user` só executa as 23 RPCs scoped; `hermes_job` tem grants mínimos;
`service_role` sai do runtime. A RLS volta a ser a rede de proteção: um bug no
Hermes (ou prompt-injection) não vaza outro tenant porque o papel do banco não
tem como ler a tabela.
