# Propostas de remediação — achados estruturais do red-team (01/10/2026)

Companheiro de `red-team-2026-10-01.md`. Cobre os achados que **não** foram
corrigidos na leva de 01/10 por serem arquiteturais, grandes ou bloqueados —
com o caminho concreto, o esforço e o risco de cada um.

Corrigidos e no ar nessa data: V2, V3, V4, V6, V11 (notify-email), V15 (banco e
edge). Commitados aguardando pipeline própria: V7, V12 (landing), V11 (Hermes/VPS).

---

## V1 — Hermes autentica no Supabase com `service_role` (Alta, estrutural)

**Hoje:** `hermes/src/lib/supabase.ts:13` cria o cliente com
`SUPABASE_SERVICE_ROLE_KEY`, que **bypassa toda a RLS**. A autorização por
unidade/papel é reimplementada em código (`hermes/src/server/skill-api.ts`).
Não há backstop no banco: um bug no filtro em código = vazamento cross-tenant
silencioso, sem a rede de proteção da RLS.

**Proposta (reduzir o alcance da chave):**
1. Criar um conjunto de RPCs `SECURITY DEFINER` no schema `public`, uma por
   operação que o agente precisa (ex.: `hermes_resumo_unidade(p_unidade)`,
   `hermes_buscar_paciente(...)`), cada uma recebendo o `perfil_id` do usuário
   do WhatsApp **resolvido pelo próprio banco** a partir do vínculo — nunca
   confiando num id vindo do agente.
2. As RPCs aplicam `papel_na_unidade`/`eh_super_admin` internamente (mesmo
   padrão das ~180 RPCs clínicas), e são `GRANT` apenas a um papel dedicado
   (ex.: `hermes_worker`), não a `service_role` cru.
3. O Hermes passa a usar a chave desse papel restrito (ou um JWT de serviço
   com `role=hermes_worker`), com `GRANT EXECUTE` só nas RPCs acima. Sem acesso
   direto a tabela.

**Efeito:** o banco volta a ser o backstop; um bug no código do agente não
vaza mais dados de outro tenant porque a RPC recusa no servidor.
**Esforço:** alto (inventariar todo acesso a tabela que o Hermes faz hoje e
trocar por RPC). Já previsto em `PREFLIGHT-HERMES.md:79`.
**Risco da migração:** médio — fazer por etapas, uma tool de cada vez, com
teste de autorização por escopo no CI antes de revogar o `service_role`.

**STATUS (01/10/2026): camada DB construída e testada.** Migration
`supabase/migrations/20261020000001_hermes_least_privilege.sql` cria os roles
`hermes_user`/`hermes_job` + 20 RPCs SECURITY DEFINER scoped por `p_perfil` +
grants (aditivo, não muda nada até o cutover). Testes em
`supabase/tests/porte_redteam_v1_hermes.sql` (69/69 na suíte). O **cutover no
VPS** (reescrever `.from()`→`.rpc()` no Hermes, emitir JWTs
`hermes_user`/`hermes_job`, remover o `service_role`) está passo-a-passo em
`docs/seguranca/cutover-hermes-v1.md` — feito e testado por você.

---

## V5 — Desidentificação por regex antes do LLM offshore (Média, LGPD)

**Hoje:** `hermes/src/gateway/desidentificacao.ts` tira identificadores por
regex e **falha fechada** se sobrar resíduo, mas `residuos()` (`:181-191`) só
barra sequências de 11/15 dígitos, datas completas e e-mail. Nome próprio em
minúsculas e em prosa ("a paciente ana do leito 3") passa (`:20-22`) e pode
chegar ao DeepSeek/Kimi (fora do Brasil).

**Propostas (uma ou combinação):**
1. **NER de nomes PT-BR** antes do egress: rodar um reconhecedor de entidades
   (nome de pessoa) local no VPS (modelo pequeno, ex. spaCy/stanza PT ou um
   classificador leve) e mascarar os spans de pessoa. Mantém o fail-closed.
2. **Allowlist em vez de denylist:** em vez de tentar remover PII, enviar ao
   LLM só campos estruturados conhecidos (idade, sexo, exames, CID) e **nunca**
   texto livre de prontuário. Corta a classe inteira do problema.
3. **LLM on-shore/on-prem para dado clínico:** rodar o modelo clínico em
   infraestrutura no Brasil (ou no próprio VPS) e reservar o offshore só para
   conteúdo sem PII (ex. busca em diretriz pública). Elimina a transferência
   internacional de dado de paciente.

**Recomendação:** (2) como barreira dura imediata + (1) como defesa em
profundidade; (3) como alvo de médio prazo para o motor clínico.
**Esforço:** (2) médio, (1) médio-alto, (3) alto.
**Risco residual:** aceitar e documentar que texto livre nunca é 100% limpável
por regra — por isso a allowlist é a barreira real.

**STATUS (01/10/2026): serviço NER construído (opção 1), pendente deploy+wiring no VPS.**
- `biblioteca/app/pii.py`: passo de NER (spaCy PT, `pt_core_news_sm`) que mascara
  nomes próprios em prosa, além da regex. **Fail-safe**: sem o modelo (ou
  `NER_DESLIGADO=1`), cai só na regex — nada quebra. Já entra no caminho RAG
  (a `biblioteca` chama `pseudonimizar` antes do DeepSeek).
- `biblioteca/app/main.py`: rota `POST /v1/deid` (auth Bearer `BIBLIOTECA_API_KEY`)
  → `{ texto (mascarado), found (nomes) }`. `found` não-vazio = o chamador deve
  **falhar fechado**.
- `requirements.txt`: `spacy==3.7.*` (modelo baixado à parte).

**Cutover no VPS (seu):**
1. Na `biblioteca`: `pip install -r requirements.txt` + `python -m spacy download pt_core_news_sm` + rebuild/restart. (RAG já ganha NER.)
2. **Wiring dos gateways** (fecha o chat do Hermes também), controlado por env `DEID_URL` (= `{BIBLIOTECA_URL}/v1/deid`):
   - `supabase/functions/clinical-search/index.ts`: **NÃO NECESSÁRIO (01/10/2026)** — a `biblioteca` já mascara a query na entrada (`main.py:199` `q = expandir_siglas(pseudonimizar(r.q))`, NER incluso) antes de qualquer uso, e `embed()` é Ollama **local** (não offshore). Logo o LLM offshore e o embedding só veem texto já mascarado; o edge já barra resíduo de regex com 422 (`:107-113`). Wiring de `/v1/deid` no edge seria redundante (round-trip + deploy sem ganho). Reabrir só se a biblioteca deixar de mascarar na entrada.
   - `hermes/src/gateway/gateway.ts`: **JÁ IMPLEMENTADO** (commit 35717ea) — `chamarIA` chama `/v1/deid` após a limpeza regex e antes do egress; `found` não-vazio → `ChamadaBloqueada` (fail-closed). Opt-in por `DEID_URL`; serviço fora → degrada.
   - Sem `DEID_URL` = comportamento atual (aditivo, não quebra).
3. Testar: "A paciente Maria Silva ..." → `/v1/deid` retorna `found:["Maria Silva"]` → gateway bloqueia. (Confirmado em 01/10: NER no ar, `ner_ativo:true`, mascara nome com caixa; minúscula-sem-contexto = residual do modelo.)

**STATUS (01/10/2026): biblioteca com NER no ar no VPS (RAG protegido); wiring do Hermes no código.** Falta no VPS: setar `DEID_URL` no `.env.prod` do Hermes + rebuild.

**STATUS (01/10/2026 — FECHADO): wiring do Hermes LIVE no VPS.** `hermes-app` e
`biblioteca-api` compartilham a rede `deploy_default` → `DEID_URL=http://biblioteca-api:8710/v1/deid`
+ `BIBLIOTECA_API_KEY` (mesma chave da biblioteca) gravados no `.env.prod` do
Hermes, container recriado. Teste ponta a ponta do container do Hermes:
`200 {"texto":"Paciente [PESSOA]","found":["Maria Silva"],"ner_ativo":true}` →
`chamarIA` agora falha fechado em nome residual antes do egress offshore.
Health `ok`. Degrada se a biblioteca cair (não derruba conversa).
Opção 2 (allowlist, barreira dura) segue como alvo de médio prazo.

**Nota de rede (`DEID_URL`):** os dois stacks docker são separados — Hermes em `/home/hermes/deploy`, biblioteca em `/srv/biblioteca` (publica `127.0.0.1:8710`). O container do Hermes não alcança `biblioteca-api` pelo nome. Opções: (a) `DEID_URL=http://<ip-do-bridge-docker-do-host>:8710/v1/deid` (ex. `172.17.0.1`), (b) colocar o Hermes e a biblioteca na mesma rede docker externa e usar `http://biblioteca-api:8710/v1/deid`, ou (c) via o domínio público da biblioteca se houver. `BIBLIOTECA_API_KEY` também precisa estar no `.env.prod` do Hermes.

Enquanto o modelo não é instalado no VPS, tudo segue como hoje (fail-safe). *(Modelo já instalado em 01/10.)*

---

## V8 — `notify-email` (Média) — RESOLVIDO por REMOÇÃO (01/10/2026)

A função era legado do app de escala: referenciava `trocas`, `profissionais`,
`plantoes`, `desistencias` — tabelas que **não existem** no schema atual
(`docs/AUDITORIA-PRE-FASE1.md:112`), então retornava 500 (dormente). 2 dos 4
eventos não existem mais; os que restam já são cobertos **in-app**
(`notificacoes_plantonista` + trigger `private.notificar_vaga` +
polling de `trocas_plantao` no frontend). Canal atual = in-app/push, não e-mail.

Era uma edge function com `service_role` (`chaveSecreta()`) = superfície de
ataque viva por zero benefício. **Resolução:** removida — `supabase/functions/
notify-email/` apagada do repo + função deployada deletada do projeto
(`supabase functions delete notify-email`). Fecha V8 (e o throttle fica
sem objeto). E-mail transacional, se desejado no futuro, é feature nova de
produto (eventos nas tabelas canônicas + recipient por `perfis.email` + throttle).

**Pendência do usuário:** se havia um Database Webhook no painel apontando
para `notify-email`, remover (a função não existe mais).

---

## Menores (registro)

- **V10** — `biblioteca` confia em `tenant_id` do corpo (`biblioteca/app/main.py:46`).
  **Já mitigado na prática:** o único chamador (`clinical-search`) valida o
  `unidade_id` (UUID + vínculo ativo ou super) antes de enviar `tenant_id`
  (`supabase/functions/clinical-search/index.ts:86,91-96,123`). Caller não passa
  tenant arbitrário. Fecho definitivo (chave por tenant / claim assinado na
  biblioteca) é arquitetural e roda no VPS — pendência de infra.
- **V13** — **CORRIGIDO** (01/10): ingestão do webhook descarta mensagem com
  `timestamp` > 12h (`hermes/src/server.ts`), fechando replay pós-dedup.
  Deploy no VPS pendente.
- **V14** — `xlsx@0.18.5` (CVE-2023-30533/2024-22363) só em
  `scripts/terminologia/importar-cmed.ts` (devDependency, não vai ao bundle).
  Atualizar SheetJS via cdn.sheetjs.com quando tocar o script.
- **V16** — `NEXT_PUBLIC_MAPS_KEY` exposta ao cliente: **FECHADO (01/10/2026)**
  removendo a key. `landing/components/Location.tsx` usa o embed keyless
  (`maps.google.com/maps?...output=embed`) — sem API key, zero exposição de
  billing. Removida do `.env.local.example` e do README. (Dispensa restrição no
  Google Console; o usuário pode remover a key da Vercel/GCP.)
- **V9** — oráculo de schema do PostgREST: aceito (sem dado de linha; correção
  no PostgREST gerenciado é mais arriscada que o achado).
