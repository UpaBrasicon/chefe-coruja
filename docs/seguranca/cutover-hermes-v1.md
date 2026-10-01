# Cutover Hermes V1 — tirar o `service_role` do agente

Companheiro da migration `supabase/migrations/20261020000001_hermes_least_privilege.sql`
(roles + RPCs já criados, aditivos). Este guia é o **cutover no VPS**, feito e
testado por você. Enquanto não executado, nada muda — o Hermes segue no
`service_role` e as RPCs novas ficam ociosas.

Objetivo: o runtime do Hermes deixa de usar `service_role` (bypassa RLS) e passa
a usar dois principais sem bypass: **`hermes_user`** (caminho de request, só
EXECUTE em RPCs scoped) e **`hermes_job`** (crons, grants mínimos).

---

> **STATUS (01/10/2026): a REESCRITA DO CÓDIGO já está feita e commitada**
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

### Mecanismo — decisão binária no dia (chaves legadas desativadas)
O Hermes usa `@supabase/supabase-js` (fala com o PostgREST); o papel vem do
claim `role` do JWT, que o PostgREST verifica contra o segredo configurado.
Este projeto **desativou as API keys legadas** (anon/service_role). Isso NÃO
desativa por si o **JWT secret** HS256. Checar uma vez no dashboard
(**Settings → API → JWT Settings**) e escolher:

- **Caminho A — JWT secret HS256 ainda presente/ativo (provável).** Self-mint
  dos dois tokens. Use o script pronto (zero dependência, HS256 via
  `node:crypto`):
  ```bash
  cd hermes
  SUPABASE_JWT_SECRET='<JWT secret do dashboard>' node scripts/mint-hermes-jwt.mjs
  ```
  Ele imprime `HERMES_USER_KEY=...` e `HERMES_JOB_KEY=...` (claim `role`
  correta, `iss: supabase`, `exp` 10 anos, sem `sub`). Nunca passe o secret em
  argumento (fica no histórico) — só pela env. Siga para §2.

- **Caminho B — projeto migrou para JWT Signing Keys assimétricas (sem secret
  HS256 de verificação).** Não dá para self-mint com segredo compartilhado.
  Use conexão Postgres direta (pooler) com login roles:
  ```sql
  -- migration nova (aditiva): dar LOGIN e senha a papéis que herdam os grants
  CREATE ROLE hermes_app_user LOGIN PASSWORD '<forte>' IN ROLE hermes_user;
  CREATE ROLE hermes_app_job  LOGIN PASSWORD '<forte>' IN ROLE hermes_job;
  ```
  e trocar `@supabase/supabase-js` por `postgres.js` nos 2 clientes de
  `lib/supabase.ts` (as RPCs viram `SELECT * FROM public.hermes_*(...)`). Mais
  trabalho; só se A não existir.

(Sem `sub` nos tokens — o perfil do profissional vai em `p_perfil` nas RPCs,
não no JWT.) Guarde as chaves no `.env.prod` do VPS como `HERMES_USER_KEY` e
`HERMES_JOB_KEY`. **Nunca** no git (o `.dockerignore` já bloqueia `.env*`).
Revogar antes do prazo = rotacionar o JWT secret (invalida todos) ou REVOKE nos
papéis.

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
