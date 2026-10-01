# Cutover Hermes V1 — tirar o `service_role` do agente

Companheiro da migration `supabase/migrations/20261020000001_hermes_least_privilege.sql`
(roles + RPCs já criados, aditivos). Este guia é o **cutover no VPS**, feito e
testado por você. Enquanto não executado, nada muda — o Hermes segue no
`service_role` e as RPCs novas ficam ociosas.

Objetivo: o runtime do Hermes deixa de usar `service_role` (bypassa RLS) e passa
a usar dois principais sem bypass: **`hermes_user`** (caminho de request, só
EXECUTE em RPCs scoped) e **`hermes_job`** (crons, grants mínimos).

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
O Hermes usa `@supabase/supabase-js` (fala com o PostgREST). O papel vem do
claim `role` do JWT. Gere **dois** JWTs assinados com o **JWT secret** do projeto
(Supabase → Settings → API → JWT Secret), claim `role`:
```json
{ "role": "hermes_user", "iss": "hermes", "iat": <now>, "exp": <longo> }
{ "role": "hermes_job",  "iss": "hermes", "iat": <now>, "exp": <longo> }
```
(Sem `sub` — o perfil do profissional vai em `p_perfil` nas RPCs, não no JWT.)
Guarde-os no `.env.prod` do VPS como `HERMES_USER_KEY` e `HERMES_JOB_KEY`.
**Nunca** no git (o `.dockerignore` já bloqueia `.env*`).

> Alternativa sem JWT custom: conexão Postgres direta (pooler) com um login role
> `hermes_user`/`hermes_job` + senha, trocando supabase-js por `postgres.js` no
> cliente. Mais limpo a longo prazo, porém reescreve o cliente — opcional.

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
