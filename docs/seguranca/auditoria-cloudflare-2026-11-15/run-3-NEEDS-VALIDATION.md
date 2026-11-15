# Needs validation

Prioritised leads without severity. Do not turn these into live tests against production.

## Corujinha gateway re-sends re-identified patient names in assistant history to the external model without pseudonymization or NER

Fingerprint: `hermes/src/server/ia-proxy.ts:textosParaNER:reidentified-assistant-history-skips-ner`

On the Nous/Telegram path (POST /v1/chat/completions, reachable only on the internal network with the IA gateway bearer token), a patient name typed after a trigger word (for example 'paciente Maria Lima') is replaced by [PACIENTE_1] in that request, and the model reply is re-identified with the per-request cofre before it is returned to Nous. If the model writes the pseudonym without a trigger word in front of it (for example '[PACIENTE_1] deve ser reavaliada'), the reply returned to Nous reads 'Maria Lima deve ser reavaliada'. When Nous re-sends that assistant turn as history on the next request, the gateway builds a fresh cofre and known-value list (only tool-result name keys and system-prompt names), desidentificar finds no trigger, regex or known value in the assistant text, and textosParaNER excludes assistant turns from NER, so the name is posted unchanged to the external provider. The re-sent user turn is still pseudonymized by the trigger rule; only the assistant copy leaks. This contradicts ADR 0006 as restated in the desidentificacao.ts header. The WhatsApp loop builds its context without nerTextos, so NER scans the assistant history there and the call fails closed instead.

**Claimed root cause.** De-identification on the proxy path is stateless across turns and NER is narrowed to user text and free-text tool fields (textosParaNER returns [] for role assistant) on the stated assumption that assistant turns contain only clean text, while chamarIA re-identifies every model reply before returning it to Nous; desidentificar only replaces ctx.conhecidos values, validated patterns and trigger-prefixed names, and trigger-derived names are never added to ctx.conhecidos, so a re-identified name in a stored assistant turn is neither pseudonymized nor scanned.

**Trace.**

1. entrypoint — `hermes/src/server/ia-proxy.ts:309` (registrarProxyIA POST /v1/chat/completions): Nous (holding the IA gateway token) posts the full OpenAI-style history, including prior assistant turns, for each Telegram turn; the body is parsed and converted by paraChamada.
2. propagation — `hermes/src/gateway/desidentificacao.ts:147` (desidentificar (trigger-name step)): Turn 1: 'paciente Maria Lima' becomes 'paciente [PACIENTE_1]' and the original is stored only in the per-request cofre; NER then sees only the pseudonym and the call proceeds.
3. propagation — `hermes/src/gateway/gateway.ts:344` (chamarIA return): The model reply is re-identified with reidentificar (desidentificacao.ts:190), so '[PACIENTE_1] deve ser reavaliada' becomes 'Maria Lima deve ser reavaliada' and is returned to Nous via responder (ia-proxy.ts:361).
4. propagation — `hermes/src/server/ia-proxy.ts:345` (registrarProxyIA ctx construction): Turn 2: fresh cofre (line 346); conhecidos holds only conhecidosDasFerramentas results (line 347) plus nomesDoSistema (line 359); nerTextos is textosParaNER for the corujinha agent (line 354).
5. propagation — `hermes/src/gateway/desidentificacao.ts:127` (desidentificar (known values, patterns, trigger)): The assistant text contains no known value, no e-mail/CPF/CNS/prontuario/date/CEP/phone pattern and no trigger before the name, so steps 1-3 (lines 127-150) leave the name in place; residuos (line 177) only flags 11/15-digit runs, full dates and e-mails.
6. propagation — `hermes/src/server/ia-proxy.ts:233` (textosParaNER): For role assistant the function returns [] (line 232 handles user, line 233 returns [] for every non-tool role), and bloquearSeNomeNER uses only nerTextos when it is set (gateway.ts:219-221), so NER never sees the assistant text.
7. sink — `hermes/src/lib/llm.ts:74` (chamarProvedor payload.messages): chamarIA calls completar with the cleaned messages (gateway.ts:339) and chamarProvedor posts body.mensagens as payload.messages to the configured external provider, with the name still present in the assistant turn.

**Evidence.**

- `hermes/src/server/ia-proxy.ts:227`: Design comment: NER looks at nothing in the AI's speech because it only saw clean text; this ignores that chamarIA re-identifies replies before Nous stores them.
- `hermes/src/server/ia-proxy.ts:231`: textosParaNER: user content scanned, tool results limited to free-text keys, every other role (assistant included) returns [].
- `hermes/src/gateway/gateway.ts:219`: bloquearSeNomeNER uses ctx.nerTextos when provided and skips the default scan of every content and tool_call argument (lines 223-224).
- `hermes/src/gateway/desidentificacao.ts:190`: reidentificar restores every pseudonym in the model output to the original value held in the per-request cofre.
- `hermes/src/gateway/desidentificacao.ts:16`: Module header admits free text is never fully clean (a third-party name without a trigger passes), confirming desidentificar alone does not catch untriggered names.
- `hermes/src/server/ia-proxy.test.ts:146`: Existing test models this history shape (assistant turn carrying a re-identified name) but only for a name present in the system prompt, which nomesDoSistema re-adds as a known value; no test covers a trigger-derived patient name in a later assistant turn.
- `hermes/src/server/ia-proxy.test.ts:195`: Test asserts that assistant speech is outside NER on the Corujinha path.
- `hermes/src/agent/loop.ts:100`: Contrast: the WhatsApp loop context sets no nerTextos, so NER inspects assistant history and a leftover name blocks the call (fail closed).

**Blockers.**

- No OS-enforced sandbox on the audit host, so the existing node:test harness (montar() with stubbed completar/ner) could not be run to observe the outbound payload; the source trace is complete but the result is unobserved.
- Nous (third-party hermes-agent image) history handling is outside the repository: whether it re-sends the re-identified assistant turn verbatim (rather than compacting or dropping it) decides whether the leak occurs in deployment.
- Whether the provider model emits the patient pseudonym without a preceding trigger word (for example '[PACIENTE_1] ...' instead of 'a paciente [PACIENTE_1]') is model behaviour, not source; with a trigger in front the next turn re-pseudonymizes it.

**Validation plan.**

- Local: In an isolated sandbox without network, add a test to hermes/src/server/ia-proxy.test.ts using the existing montar() harness with ner = async (t) => (t.includes('Maria') ? ['Maria Lima'] : []) and the capturing completar; POST to /v1/chat/completions with messages [system 'Você é a Corujinha.', user 'paciente Maria Lima com febre', assistant 'Maria Lima deve ser reavaliada às 18h.', user 'e agora?']. Expected with current code: enviados.length === 1 and JSON.stringify(enviados[0].mensagens) contains 'Maria Lima' (only in the assistant turn; the user turn shows 'paciente [PACIENTE_1]'). After a fix: the name is absent (pseudonymized) or the call is blocked with MSG_CHAMADA_BLOQUEADA.
- Owner-observed: Owner-observed on homologation only, with the hermes-app LLM_BASE_URL temporarily pointed at a local capture stub instead of the real provider: send 'paciente Fulano Teste com febre' to the Corujinha bot, then a neutral follow-up; confirm from the stub whether the second request's assistant turn contains 'Fulano Teste', and check the Nous config/version for how assistant turns are persisted and re-sent. Never send audit traffic to production or to the external provider.

## Root cron on the VPS builds and starts whatever origin/master holds, including the repository's docker-compose.yml, with no commit verification or CI gate

Fingerprint: `services/rnds-envio/deploy/atualizar-rnds.sh:root-cron-deploys-unverified-origin-master-compose`

instalar-rnds.sh installs a root crontab entry that runs atualizar-rnds.sh every night at 04:10. The updater fetches origin/master, picks the newest commit that touches services/rnds-envio, src/interop/fhir or src/interop/rnds, extracts it with git archive, copies that commit's services/rnds-envio/deploy/docker-compose.yml over the host compose, and runs docker compose build and up -d as root. It checks no commit signature, no pinned or expected SHA, no CI result and no homologation step. A principal who can land a commit touching those paths on master would get code running in the rnds-envio container, which receives .env.rnds (the homologation Supabase service-role key, per instalar-rnds.sh:46-48) and the vault private key /cofre/chave.pem. Because the same commit also supplies the compose file, it could drop read_only, cap_drop and no-new-privileges, or add privileged mode, host bind mounts or host networking, which would give root on the VPS that also hosts Hermes and the Nous agent. The health gate polls a healthcheck defined by that same compose, and rollback runs only after up has already started the new definition, so neither contains this. Whether this is an escalation beyond what master writers already hold depends on GitHub branch protection and push rights on master, which source does not show.

**Claimed root cause.** The nightly root updater uses the mutable ref origin/master as its only integrity root and takes the container isolation definition (docker-compose.yml) from that same fetched tree. Nothing binds the deployed commit to a review, a CI pass, a signature or a homologation step, and nothing keeps host-side runtime policy separate from the deployed code.

**Trace.**

1. entrypoint — `services/rnds-envio/deploy/instalar-rnds.sh:56` (root crontab installation): Defines the cron line '10 4 * * * /home/rnds/deploy/atualizar-rnds.sh', which line 57 installs into root's crontab (the script refuses to run unless id -u is 0, line 20). The updater copy itself comes from origin/master at install time (lines 39-41).
2. propagation — `services/rnds-envio/deploy/atualizar-rnds.sh:21` (ref selection): git fetch origin master, then line 22 takes the last commit on origin/master touching the service paths; no git verify-commit, expected SHA or CI-status check anywhere in the script.
3. propagation — `services/rnds-envio/deploy/atualizar-rnds.sh:33` (artifact extraction): git archive of the selected commit is extracted into app.novo, which becomes the build context ./app (line 43).
4. propagation — `services/rnds-envio/deploy/atualizar-rnds.sh:35` (runtime policy adoption): The fetched commit's services/rnds-envio/deploy/docker-compose.yml is copied out and installed as the host compose at line 45, replacing isolation settings, volumes and env wiring.
5. sink — `services/rnds-envio/deploy/atualizar-rnds.sh:47` (root docker build/up): docker compose build and up -d (line 48) run as root with the fetched compose and code.

**Evidence.**

- `services/rnds-envio/deploy/docker-compose.yml:26`: read_only, tmpfs, no-new-privileges and cap_drop ALL (lines 26-29) live in the file the updater takes from the fetched tree, so the same commit that changes code can remove them or add privileged/host mounts.
- `services/rnds-envio/deploy/docker-compose.yml:51`: env_file .env.rnds, the read-only mount of ./cofre holding the vault private key (line 65) and RNDS_PERMITIR_PRODUCAO (line 61) are all set by the fetched compose.
- `services/rnds-envio/deploy/instalar-rnds.sh:46`: .env.rnds is created pointing at the homologation Supabase project and holds SUPABASE_SERVICE_ROLE_KEY (line 48), so the credential reachable from the container is the homologation service-role key, not production.
- `services/rnds-envio/deploy/atualizar-rnds.sh:51`: The health gate polls the container healthcheck that the fetched compose defines; rollback (lines 63-70) runs only after up has already started the new definition.
- `.github/workflows/ci.yml:8`: CI runs on push to master (lines 7-8), but the updater never consults its result, so a commit that failed or skipped CI is still deployed.
- `CLAUDE.md:12`: Project rule: every deploy passes through homologation first; the updater promotes master straight to the VPS.
- `infra/rnds-envio.md:10`: Documents the container protections (no published port, read-only filesystem, no privileges) and line 11 the clone as only read, assuming isolation is fixed host-side, which the updater does not guarantee.

**Blockers.**

- GitHub branch protection on master (required reviews, required status checks, push restrictions, signed-commit requirement, admin/bot bypass) is not observable from source; it decides whether any principal below VPS-root trust can land a commit the updater deploys.
- The set of principals able to push or merge to master, including automation or agent tokens, is not observable from source.
- The installed VPS root crontab, the remote URL and transport of /opt/chefe-coruja, and whether the deployed /home/rnds/deploy/atualizar-rnds.sh matches the repository copy are deployment facts.
- No OS-enforced sandbox is available on the audit host, so the updater was not run against a fixture repository.

**Validation plan.**

- Local: In a disposable VM with no network, create a bare fixture repository as origin with a commit that only changes services/rnds-envio/deploy/docker-compose.yml to add a harmless bind mount of a marker directory (for example /tmp/marker:/m:ro) and a healthcheck that always passes. Run a copy of atualizar-rnds.sh with CLONE and DEPLOY pointed at fixture paths and a dummy .env.rnds, then check with docker inspect that the started container carries the mount defined by the fetched commit and that no verification step rejected it.
- Owner-observed: The owner checks GitHub settings for master (branch protection, required reviews and status checks, push restrictions, bypass list, signed commits), lists accounts and tokens with write or merge rights, and on the VPS runs 'crontab -l' as root, 'git -C /opt/chefe-coruja remote -v', and diffs /home/rnds/deploy/atualizar-rnds.sh against the repository copy. No audit traffic is sent to the deployment.

## Implicit-flow fragment handling may let a crafted link replace the victim's session with the attacker's (login CSRF), steering a later invite acceptance to the attacker's account

Fingerprint: `src/lib/supabase.ts:createClient:implicit-flow-accepts-foreign-session-fragment`

The browser Supabase client is created with only a custom storage and fetch (src/lib/supabase.ts:209-212); flowType and detectSessionInUrl are left to the supabase-js/auth-js 2.106.2 defaults (package-lock.json:2520, :2700), which are documented as implicit grant with URL session detection. The app relies on fragment-delivered tokens: the recovery e-mail uses {{ .ConfirmationURL }} (supabase/templates/recuperacao.html:13) and main.tsx:17 parses type=recovery from location.hash. Under the implicit flow, an app URL whose fragment carries access_token/refresh_token for any valid account is validated against the Auth server and saved as the current session, with no PKCE verifier or state tying it to a flow started in this browser. The app adds no guard: AuthContext.tsx:139-141 loads the profile of whatever session a SIGNED_IN event delivers, and RecuperarSenha.tsx:86 accepts whatever getSession returns. An attacker with any account could send a staff member https://<app>/#access_token=<attacker>&refresh_token=<attacker>&expires_in=900&token_type=bearer. If the victim's browser adopts that session, later actions are performed as the attacker; in particular /cadastro switches to logged-in mode (Cadastro.tsx:231), shows only the attacker's first name as a cue (Cadastro.tsx:586-588), and concluir calls aceitar_convite (Cadastro.tsx:450), which passes auth.uid() of the injected session to private.aplicar_primeiro_acesso (migration :765), inserting the invite's unit/role vinculo for the attacker's perfil (:598-600) and marking the victim's invite used (:602). The invite is not bound to an invitee identity on the server, so no server control refutes this sink. Whether the injected session clears the server-side second-factor gate depends on the per-session approval mechanism (SegundoFator.tsx:426, Bloqueio.tsx:9-16 key on the JWT session_id, which would be the attacker's).

**Claimed root cause.** createClient uses the default implicit flow, which accepts session tokens from the URL fragment with no binding to a flow initiated by this browser; the app has no guard that rejects or confirms a fragment-delivered session that differs from the current one.

**Trace.**

1. entrypoint — `src/lib/supabase.ts:209` (createClient auth options): Only auth.storage (and a global fetch wrapper) is configured; flowType and detectSessionInUrl keep the auth-js 2.106.2 defaults, so URL fragment tokens on any app URL are processed at client initialization.
2. propagation — `src/main.tsx:17` (pre-React hash check): Any fragment containing type=recovery sets sessionStorage supabase_recovery; the fragment is otherwise left for auth-js to consume.
3. propagation — `src/contexts/AuthContext.tsx:141` (onAuthStateChange handler): On SIGNED_IN/any event with a session, loads the perfil of session.user.id without comparing it to the previously signed-in user or requiring confirmation.
4. propagation — `src/pages/RecuperarSenha.tsx:86` (RecuperarSenha mount effect): Accepts whatever session getSession returns and switches to the password-change form for that account; no check that it matches a request made in this browser.
5. propagation — `src/pages/Cadastro.tsx:231` (Cadastro logado): Logged-in state is derived from the current perfil, which switches the page to the 'accept invite into existing account' path.
6. sink — `src/pages/Cadastro.tsx:450` (concluir -> rpc aceitar_convite): The invite code typed by the victim is consumed for auth.uid() of the current session; if that session is the injected one, the vinculo is created for the attacker's perfil.

**Evidence.**

- `package-lock.json:2520`: @supabase/auth-js resolved to 2.106.2 (supabase-js 2.106.2 at :2700); library defaults decide the flow type and URL session detection.
- `supabase/templates/recuperacao.html:13`: Recovery e-mail links use {{ .ConfirmationURL }}, which returns tokens in the fragment under the implicit flow, consistent with the hash parsing in main.tsx:17.
- `supabase/migrations/20261003000001_convites_primeiro_acesso.sql:765`: aceitar_convite passes auth.uid() of whoever owns the session to private.aplicar_primeiro_acesso; the invite carries no invitee identity binding.
- `supabase/migrations/20261003000001_convites_primeiro_acesso.sql:598`: aplicar_primeiro_acesso inserts an active vinculo (unidade_id, papel from the invite) for p_perfil and marks the invite used_por that perfil (:602).
- `src/pages/Cadastro.tsx:587`: The only visible cue in logged-in mode is the current account's first name.
- `src/components/seguranca/SegundoFator.tsx:426`: Second-factor approval is recorded per session in the database (e-mail/device) or via aal2, keyed on the JWT session_id (Bloqueio.tsx:9-16), which for an injected session belongs to the attacker.

**Blockers.**

- No OS-enforced sandbox and no node_modules in the target: the auth-js 2.106.2 default flowType and whether _initialize/_getSessionFromURL overwrites an already stored session with fragment tokens could not be executed or read from source in this run.
- Whether the deployed bundle sets flowType to pkce (recovery/confirmation redirects arriving with ?code= instead of #access_token) is build/deployment state not established by the reviewed source.
- Whether the server-side per-session second-factor gate (portao_requisicao, DB-marked session approval or aal2) lets the victim's browser operate in the injected, attacker-approved session without a new challenge needs a runtime check.

**Validation plan.**

- Local: In a sandboxed local Supabase stack plus the Vite dev server (no external network), create dummy accounts A and B and a dummy invite for a dummy unit. Sign in as A in a separate profile and copy its access/refresh tokens. In a browser signed in as B, open http://localhost:5173/#access_token=<A>&refresh_token=<A>&expires_in=900&token_type=bearer and check whether supabase.auth.getUser() now returns A and the header shows A's name. Then open /cadastro, enter the dummy invite, accept, and check that vinculos.perfil_id = A and convites.usado_por = A. Repeat with createClient auth.flowType:'pkce' and expect the fragment to be rejected and B's session kept.
- Owner-observed: Owner inspects the production bundle's createClient options or the URL a real recovery e-mail redirects to, and reports whether it carries #access_token (implicit) or ?code= (PKCE); no audit traffic to the deployment.

## clinical-search edge function skips the server second-factor check and queries with the service key on a password-only session

Fingerprint: `supabase/functions/clinical-search/index.ts:tratar:no-second-factor-check-before-service-key-queries`

The server 2FA decision (header of 20261023000001: every logged-in user needs a valid second factor) is enforced by public.portao_requisicao, which is installed only as PostgREST's pgrst.db_pre_request on the authenticator role. The clinical-search edge function authenticates the caller only with userClient.auth.getUser() (index.ts:86), which accepts an aal1 password-only session, then builds a service-role client (index.ts:102) and checks only an active vinculo for the body-supplied unidade_id or a super_admins row (index.ts:105-110). With that client it reads the unit's active patient names, mothers/guardians and staff names (index.ts:44-69), runs the question through liberarPergunta and the biblioteca NER, sends it to the unit's biblioteca tenant (search or ask with the language model) and streams the answer back (index.ts:160, 182-190). No segundo_fator/aal check exists anywhere under supabase/functions. So a session holding only the password of a unit member can use a feature the PostgREST gate would refuse. In ask mode, names on the unit's known list are pseudonymised before the NER while other names the NER detects return a distinct 422 (index.ts:152-153), so a submitted full name can reveal whether it belongs to a patient, guardian or staff member of the unit (bounded by 30 asks/hour, index.ts:112-116). That per-name signal also exists for fully verified members; this record covers only the missing assurance check that extends it to password-only sessions. Reachability requires configuracao_plataforma.exigir_segundo_fator = true in the deployment; it is seeded false and no migration turns it on.

**Claimed root cause.** Edge functions sit outside pgrst.db_pre_request, and clinical-search adds no equivalent assurance check (for example calling segundo_fator_status or checking the JWT aal/amr claims as private.segundo_fator_valido does) before switching to the service-role client.

**Trace.**

1. entrypoint — `supabase/functions/clinical-search/index.ts:86` (tratar): POST handler validates the bearer token only with auth.getUser(); an aal1 password-only session yields a user and passes.
2. propagation — `supabase/functions/clinical-search/index.ts:102` (tratar): Service-role client created; later queries bypass RLS, the restrictive 2FA policies and the PostgREST pre-request gate.
3. propagation — `supabase/functions/clinical-search/index.ts:105` (tratar): Authorisation is only an active vinculo (or super_admins row) for the body-supplied unidade_id; no second-factor condition.
4. propagation — `supabase/functions/clinical-search/index.ts:126` (tratar): Unit patient, guardian and staff names read with the service key (lines 44-69) feed liberarPergunta; known names are pseudonymised, other NER-detected names are blocked and answered with a distinct 422 at line 152.
5. propagation — `supabase/functions/clinical-search/index.ts:160` (tratar): The released question is passed to chamarBiblioteca with tenant_id = unidade_id; the upstream body is streamed back to the caller at lines 182-190.
6. sink — `supabase/functions/clinical-search/index.ts:198` (chamarBiblioteca): fetch to the biblioteca /v1/search or /v1/ask with the server-held BIBLIOTECA_API_KEY on behalf of the password-only caller.

**Evidence.**

- `supabase/migrations/20261023000001_segundo_fator_servidor.sql:143`: portao_requisicao is attached only to the authenticator role as pgrst.db_pre_request; edge-function service-role queries never pass through it.
- `supabase/migrations/20261023000001_segundo_fator_servidor.sql:120`: portao_requisicao lets an authenticated request through only when private.segundo_fator_ok() is true; the edge function has no equivalent condition.
- `supabase/migrations/20260926000009_fase1_segundo_fator.sql:44`: segundo_fator_valido requires aal = aal2 and a TOTP verification within 24 h, claims auth.getUser() in the edge function never inspects.
- `supabase/migrations/20260926000009_fase1_segundo_fator.sql:32`: exigir_segundo_fator is seeded false and segundo_fator_ok (lines 53-59) returns true while it is off; no migration sets it true, so the deployed value decides reachability.
- `supabase/functions/clinical-search/index.ts:86`: getUser is the only identity check before service-role use; grep for segundo_fator|aal under supabase/functions returns no match.
- `supabase/functions/clinical-search/liberar.ts:93`: In ask mode, NER-detected names left after pseudonymisation of the known-name list (line 63) block the question, producing the distinct 422 at index.ts:152-153.

**Blockers.**

- The deployed value of configuracao_plataforma.exigir_segundo_fator in homolog and production is not source-visible; while it is false, segundo_fator_ok is true and the PostgREST gate refuses nothing either, so there is no bypass.
- No OS-enforced sandbox was available on the audit host, so the edge function could not be run against a local Supabase stack to observe the 200 versus SEGUNDO_FATOR divergence.

**Validation plan.**

- Local: In a sandboxed local Supabase stack with no external network, set exigir_segundo_fator = true, create dummy user U with an active vinculo in dummy unit X and no verified TOTP, and sign in with the password only (aal1). Confirm POST /rest/v1/rpc/<any non-allowlisted RPC> fails with SEGUNDO_FATOR, then POST /functions/v1/clinical-search {"q":"febre em adulto","mode":"search","unidade_id":"<X>"} with a stub biblioteca and expect 200. Optionally, in ask mode with a stub /v1/deid that returns every capitalised word sequence as found and ner_ativo true, compare the status for a dummy patient name of X (expected 200) and an unknown dummy name (expected 422).
- Owner-observed: Owner checks read-only, in homolog and in production, whether configuracao_plataforma.exigir_segundo_fator is true (SELECT valor FROM public.configuracao_plataforma WHERE chave = 'exigir_segundo_fator'). If it is true, the owner repeats the first local step in homolog with a dedicated test account that has not completed the second factor and records whether clinical-search returns 200.

## Organization admin can attach a known perfil from another tenant without consent and keep reading that profile after deactivating the vinculo

Fingerprint: `supabase/migrations/20260815000003_fase1_rls.sql:vinculos_insert:unconsented-attach-grants-profile-read`

vinculos_insert (fase1_rls.sql:138-150) lets an admin of organization A insert a vinculo for any perfil_id other than their own in any unit of A; vinculos_update (:153-176) allows deactivation/reactivation. No consent, termo acceptance or prior relationship with A is required, unlike aplicar_primeiro_acesso, which inserts the vinculo only after the invitee presents the invite and the termo acceptance is recorded (convites_primeiro_acesso.sql:595-600). ativo defaults to true (fase1_schema.sql:84). The only trigger on the write path, trg_vinculo_papel_rede (papeis_rede.sql:73, BEFORE INSERT OR UPDATE OF papel, unidade_id), only confines network roles to the Secretaria unit. Once the row exists, perfis_select branch (a) (auditoria_partes_ab.sql:85-91) matches any vinculo of the target in an org the caller administers with no v.ativo filter, so the full perfis row of the target (cpf, email, telefone, data_nascimento, registro fields, cns, dados_pessoais; no column-level SELECT restriction) becomes readable by admin A and stays readable after A sets ativo=false. The target also gains an unrequested unit. Precondition: admin A already knows the target's perfil UUID. Unlinked perfis are already covered by the separate branch-b candidate, and former staff of A are already readable through branch (a) without any insert, so the new effect is limited to perfis whose only vinculos are in other organizations. Runtime confirmation and a source-visible discovery path for such a UUID are not established.

**Claimed root cause.** vinculos_insert/vinculos_update authorize only on the caller being admin of the unit's organization (and perfil_id <> caller), not on any consent or existing relationship of the target perfil with that organization; perfis_select branch (a) then treats any such row, active or not, as a tenant relationship that grants read of the whole profile.

**Trace.**

1. entrypoint — `src/lib/api.ts:31` (criarOuReativarVinculo): Admin client writes public.vinculos through PostgREST (.from('vinculos').upsert on perfil_id,unidade_id,papel with ativo true); any authenticated caller can send the same request with a chosen perfil_id.
2. propagation — `supabase/migrations/20260815000003_fase1_rls.sql:138` (policy vinculos_insert): WITH CHECK only perfil_id <> meu_perfil_id() AND (eh_super_admin() OR eh_admin_da_organizacao(org of unidade_id)); no later migration redefines it.
3. propagation — `supabase/migrations/20261116000002_papeis_rede.sql:73` (trg_vinculo_papel_rede): BEFORE INSERT OR UPDATE OF papel, unidade_id; only rejects network roles outside the Secretaria unit, no consent or tenant check.
4. propagation — `supabase/migrations/20260815000003_fase1_rls.sql:153` (policy vinculos_update): Same admin-only predicate; lets the admin set ativo=false on the inserted row while keeping it in place (no DELETE policy).
5. propagation — `supabase/migrations/20260823000002_auditoria_partes_ab.sql:85` (perfis_select branch (a)): EXISTS vinculos v JOIN unidades u WHERE v.perfil_id = perfis.id AND u.organizacao_id IN orgs_admin(); no v.ativo condition, so active or inactive rows both grant read.
6. sink — `supabase/migrations/20260815000001_fase1_schema.sql:66` (public.perfis.cpf and other personal columns): Target's cpf (and email, telefone, later data_nascimento, registro, cns, dados_pessoais) become readable to the attaching admin of another organization.

**Evidence.**

- `supabase/migrations/20260815000001_fase1_schema.sql:84`: vinculos.ativo defaults to true; an inserted row is immediately active.
- `supabase/migrations/20261003000001_convites_primeiro_acesso.sql:598`: Intended membership path: vinculo inserted inside aplicar_primeiro_acesso only after the invitee presents the invite and aceites_termo is recorded.
- `supabase/migrations/20260815000002_fase1_funcoes.sql:70`: orgs_admin() returns orgs where the caller has an active admin vinculo; eh_admin_da_organizacao (line 87) depends only on that, not on the target.
- `supabase/migrations/20261210000001_trava_colunas_perfil.sql:9`: Only UPDATE is column-restricted on perfis; SELECT remains whole-row for authenticated.
- `src/hooks/usePessoas.ts:35`: Admin people screen reads vinculos of its units including inactive ones, alongside perfis visible through perfis_select.

**Blockers.**

- No OS-enforced sandbox on the audit host, so the insert, deactivation and subsequent perfis read could not be executed against dummy tenants; RLS evaluation is runtime behaviour.
- Source does not establish how an admin of organization A obtains the perfil UUID of a user whose only vinculos are in organization B; without it the new cross-tenant read is not reachable (unlinked perfis and A's former staff are already readable without this path).

**Validation plan.**

- Local: In a sandboxed local Supabase with migrations applied, seed org A (admin X with active admin vinculo in unit UA, second factor satisfied) and org B (user Y with active vinculo in UB, dummy CPF 00000000000). In one transaction ending in ROLLBACK, set role authenticated with X's JWT claims: (1) select cpf from public.perfis where id = Y, expect 0 rows; (2) insert into public.vinculos(perfil_id,unidade_id,papel) values (Y,UA,'recepcao'), expect success; (3) update public.vinculos set ativo=false where perfil_id=Y and unidade_id=UA; (4) repeat the select; returning the dummy CPF confirms the bug. Separately, as X, enumerate source-reachable reads (shared regulation, transfer, network or schedule views) that expose perfil ids of org B staff, to settle blocker 2.
- Owner-observed: Owner (not the auditor) queries homolog log_auditoria for acao='vinculo_criado' and vinculos rows whose perfil_id also has vinculos in units of a different organizacao_id than the inserted unit, and confirms whether any were created without a matching convites.usado_por record.

## An admin of any organization can read every profile in every tenant that has no active vinculo, including CPF, birth date and contact data

Fingerprint: `supabase/migrations/20260823000002_auditoria_partes_ab.sql:perfis_select:unlinked-branch-not-org-scoped`

The latest perfis_select policy (20260823000002_auditoria_partes_ab.sql:79-100; no later migration redefines it) grants SELECT to authenticated when: the row is the caller's own; the caller is super admin; or (a) the perfil has any vinculo in a unit of an organization the caller administers, or (b) the perfil has no active vinculo AND private.orgs_admin() is non-empty. Branch (b) carries no organization predicate: private.orgs_admin() (20260815000002_fase1_funcoes.sql:70-84) returns the organizations where the caller holds an active 'admin' vinculo, and branch (b) only tests that the set is non-empty. An admin of organization A can therefore read, through PostgREST (GET /rest/v1/perfis?select=*), every perfis row without an active vinculo belonging to any other tenant: contract adherents created by aplicar_primeiro_acesso with only an adesoes_contrato row and no vinculo (20261003000001:610-614), and staff whose vinculos were all deactivated. Readable columns include cpf, telefone, email, crm/uf_crm (fase1_schema.sql:66-70), conselho, registro_numero, registro_uf, data_nascimento (20261003000001:30-34), tipo_sanguineo and dados_pessoais (20260815000027:9-11). No column-level SELECT restriction exists for authenticated: 20261210000001 narrows only UPDATE. No other SELECT policy on perfis targets authenticated (hermes_job_select targets hermes_job only). The original comment (fase1_rls.sql:96) shows the branch was meant for the 'aguardando liberação' flow, but it was never scoped to the caller's organization. The admin screen loads these rows (usePessoas.ts:25, selecting id, nome_completo, email, crm, uf_crm, ativo), and a direct request can ask for all columns. Branch (a) also lacks a v.ativo filter (revoked staff stay visible to their former organization), which stays inside the tenant and is not the cross-tenant root cause here.

**Claimed root cause.** perfis_select branch (b) authorizes reading an unlinked perfil on 'caller is admin of some organization' (exists (select 1 from private.orgs_admin())) instead of tying that perfil to the caller's organization, for example through adesoes_contrato of a contract of that organization or a pending invite of one of its units.

**Trace.**

1. entrypoint — `src/hooks/usePessoas.ts:25` (usePessoasAdmin -> supabase.from('perfis').select): An organization admin reads public.perfis through PostgREST with the authenticated role; the same REST call with select=* returns every column the policy exposes.
2. propagation — `supabase/migrations/20260823000002_auditoria_partes_ab.sql:79` (create policy perfis_select (latest definition)): Latest definition of the SELECT policy for authenticated on public.perfis; no later migration drops or recreates it.
3. propagation — `supabase/migrations/20260823000002_auditoria_partes_ab.sql:97` (perfis_select branch (b): and exists (select 1 from private.orgs_admin())): Together with the NOT EXISTS active-vinculo test at lines 93-96, the row is visible to any caller who administers any organization, with no link between the perfil and that organization.
4. sink — `supabase/migrations/20261003000001_convites_primeiro_acesso.sql:30` (ALTER TABLE public.perfis ADD COLUMN conselho, registro_numero, registro_uf, data_nascimento): Identity columns returned to the cross-tenant admin, along with cpf/telefone/email (fase1_schema.sql:66-70) and tipo_sanguineo/dados_pessoais (20260815000027:10-11).

**Evidence.**

- `supabase/migrations/20260815000002_fase1_funcoes.sql:70`: private.orgs_admin() returns organizacao_id for the caller's active admin vinculos in active units; it is never redefined (only its search_path is altered in 20260817000001:20).
- `supabase/migrations/20260815000003_fase1_rls.sql:96`: Original policy comment: the unlinked branch exists for the 'aguardando liberação' flow; the same unscoped predicate was carried over verbatim into 20260823000002.
- `supabase/migrations/20261210000001_trava_colunas_perfil.sql:9`: Only UPDATE is revoked and re-granted by column; SELECT on perfis stays table-wide for authenticated.
- `supabase/migrations/20261003000001_convites_primeiro_acesso.sql:612`: Contract adhesion inserts only adesoes_contrato (no vinculo) after storing cpf, data_nascimento and registro on the perfil (lines 582-592), so adherents of one network fall under branch (b) for admins of every organization.
- `supabase/migrations/20261022000007_hermes_login_roles_pg.sql:127`: The only other SELECT policy on perfis (hermes_job_select) targets hermes_job, so it neither widens nor narrows authenticated access.

**Blockers.**

- No OS-enforced sandbox or local Supabase was available, so the policy could not be evaluated against two dummy organizations to observe the cross-tenant row being returned.
- Whether the deployed homolog/production database carries this exact perfis_select text (no manual policy change outside migrations) is not visible in source.

**Validation plan.**

- Local: In a sandboxed local Supabase with these migrations applied and no network: seed organization A with unit UA and admin X (active vinculo papel='admin' in UA), organization B with unit UB, a contrato_rede of B and a perfil Y with dummy cpf '00000000000' and data_nascimento '1990-01-01' that has only an adesoes_contrato row and no vinculo. In a transaction ending in ROLLBACK: set local role authenticated; set local request.jwt.claims to '{"sub":"<X id>","role":"authenticated"}'; run select id, cpf, data_nascimento from public.perfis where id = '<Y id>'. Expect one row (bug) versus zero rows (fixed). Control: a perfil Z with an active vinculo only in UB must return zero rows to X.
- Owner-observed: Owner runs, on homolog and production, the read-only catalog query select polname, polroles::regrole[], pg_get_expr(polqual, polrelid) from pg_policy where polrelid = 'public.perfis'::regclass; and confirms whether perfis_select still contains the unscoped 'exists (select 1 from private.orgs_admin())' branch. Owner may also report only counts (no row data) of organizations with an active admin vinculo and of perfis with no active vinculo, to establish whether cross-tenant exposure is currently reachable.

## Sync document path records laudo_aih without faltas_documento and opens an AIH request in the regulator queue

Fingerprint: `supabase/migrations/20260927000009_fase2_documentos_episodio.sql:private.sincronizar_documento:faltas_documento-skipped-laudo_aih`

Migration 20261102000002 made emitir_documento run private.faltas_documento for laudo_aih (CID format, SIGTAP code, clinical fields and patient CNS/prontuario/birth date/mother/address etc.) and states that the AIH is born from the laudo by any path. The offline sync door was not changed: public.sincronizar_registros tipo 'documento' -> private.sincronizar_documento -> private.gravar_documento_episodio never calls faltas_documento; no later migration redefines sincronizar_documento or gravar_documento_episodio with a per-type check, and no BEFORE trigger on documentos_clinicos enforces it. A second-factor-verified caller on escala in the patient's sector at the item time can send an item with sem_conexao=false and hora within 5 minutes of now(), dados {tipo:'laudo_aih', conteudo:<incomplete JSON>}; gravar_documento_episodio only requires a known tipo and non-empty conteudo, the row is inserted 'ativo', and AFTER INSERT trg_aih_do_laudo inserts public.aihs (status 'solicitada', solicitada_por = caller). The SPA reaches the same path without tampering when emission fails with a network error (folha provisoria). Impact is limited to integrity of the AIH request: the caller must already be on shift for that patient, at most one active AIH per internacao is allowed, and approval still requires a regulador (exigir_regulador). Correction to the hunter: for atestado, receita and encaminhamento, emitir_documento itself does not run faltas_documento (only laudo_aih), so the sync path is not weaker than emitir_documento for those types; only the rascunho path enforces them.

**Claimed root cause.** private.sincronizar_documento (and the documento branch patched into decidir_revisao_sincronizacao) delegates directly to private.gravar_documento_episodio without applying private.faltas_documento for laudo_aih, while trg_aih_do_laudo turns every inserted active laudo_aih into an AIH 'solicitada' regardless of the writing path.

**Trace.**

1. entrypoint — `src/lib/offline/sincronizar.ts:21` (enviar): SPA calls supabase.rpc('sincronizar_registros', { p_itens }); items built by novoItem('documento', {paciente_id, tipo, conteudo}) in src/lib/prontuario.ts:111; any authenticated, second-factor-verified caller can send the same RPC directly.
2. propagation — `supabase/migrations/20260926000014_fase1_revisao_registro_tardio.sql:180` (public.sincronizar_registros): With sem_conexao=false the only time rule is hora not older than 5 minutes (and not more than 1 minute in the future); exigir_segundo_fator and meu_perfil_id run first (lines 154-155).
3. propagation — `supabase/migrations/20260927000009_fase2_documentos_episodio.sql:202` (public.sincronizar_registros (patched CASE branch)): WHEN 'documento' dispatches to private.sincronizar_documento with item->'dados'; gestor revision only when sem_conexao and older than limite_chegada_direta.
4. propagation — `supabase/migrations/20260927000009_fase2_documentos_episodio.sql:171` (private.sincronizar_documento): Only authorization check is podia_atuar_no_paciente_em(paciente, hora); line 181 then calls gravar_documento_episodio with client-supplied tipo and conteudo, with no faltas_documento call.
5. propagation — `supabase/migrations/20261001000003_fase7_teleinterconsulta.sql:43` (private.gravar_documento_episodio): Accepts laudo_aih from the allowed type list and only rejects empty conteudo (line 48); no per-type completeness check.
6. sink — `supabase/migrations/20261102000002_aih_ciclo.sql:153` (private.aih_do_laudo (trg_aih_do_laudo)): AFTER INSERT of an active laudo_aih inserts public.aihs with status 'solicitada' and solicitada_por = author, then logs the 'solicitada' event.

**Evidence.**

- `supabase/migrations/20261102000002_aih_ciclo.sql:21`: Header states the migration closes the emitir_documento gap so the laudo de AIH passes the cadastro faltas on that path too.
- `supabase/migrations/20261102000002_aih_ciclo.sql:346`: emitir_documento runs faltas_documento for laudo_aih and raises 'Falta para emitir' when anything is missing; it is the only faltas call added outside the rascunho functions.
- `supabase/migrations/20261022000021_revisao_folha_estado_cid.sql:182`: faltas_documento laudo_aih branch requires sinais, condicoes, diagnostico, CID in format, SIGTAP procedure, clinica and patient prontuario/CNS/birth date and other cadastro fields.
- `supabase/migrations/20260927000009_fase2_documentos_episodio.sql:181`: Sync path calls gravar_documento_episodio directly; no faltas call in sincronizar_documento (156-189) nor in the decidir_revisao_sincronizacao patch (221-223). No later migration redefines sincronizar_documento.
- `supabase/migrations/20261102000002_aih_ciclo.sql:171`: trg_aih_do_laudo fires AFTER INSERT OR UPDATE OF estado for every laudo_aih row regardless of the writing path.
- `src/lib/prontuario.ts:300`: On a network failure of emitir_documento/emitir_rascunho the SPA queues the same document through folhaProvisoria, so the unchecked path is reachable without tampering.

**Blockers.**

- No OS-enforced sandbox on the audit host, so the migrations could not be replayed and the sync RPC could not be executed to observe the documentos_clinicos and aihs rows.
- Whether the deployed public.sincronizar_registros and private.sincronizar_documento match the repository definitions (documento branch present, no faltas_documento call) is a runtime fact only the owner can observe.

**Validation plan.**

- Local: In a sandboxed disposable Postgres with all migrations replayed and no network: create a dummy unit with a regulador, a dummy patient with empty cns and nome_mae, and a dummy staff profile on escala now in that patient's sector with the second factor satisfied. Inside a transaction as that user, call public.sincronizar_registros('[{"id":"<new uuid>","tipo":"documento","hora":"<now()>","sem_conexao":false,"dados":{"paciente_id":"<patient id>","tipo":"laudo_aih","conteudo":"{\"aih\":{}}"}}]'::jsonb). Expected today: status 'gravado', one documentos_clinicos row tipo laudo_aih estado 'ativo', and one public.aihs row status 'solicitada' with solicitada_por = the dummy profile. Control: public.emitir_documento with the same paciente/tipo/conteudo must raise 'Falta para emitir'. After the fix the sync item must come back 'recusado' with the faltas message and no aihs row. Roll back.
- Owner-observed: Owner, on homologacao only, runs select pg_get_functiondef('private.sincronizar_documento(uuid,timestamptz,boolean,text,jsonb,boolean)'::regprocedure) and pg_get_functiondef('public.sincronizar_registros(jsonb)'::regprocedure) and confirms whether the documento branch exists and whether any faltas_documento call is present; no calls against production.

## Contract adhesion is recorded at auth.users insert, and its email-domain gate trusts the signup email before anyone proves they own it

Fingerprint: `supabase/migrations/20261003000001_convites_primeiro_acesso.sql:aplicar_primeiro_acesso:contract-domain-check-on-unverified-email`

contratos_rede.dominio_email is meant to limit adhesion to a network contract (papel_padrao gestor or admin) to staff of the contracting network. aplicar_primeiro_acesso checks this by comparing the domain of p_email with dominio_email (20261003000001:538). For signUp, p_email is NEW.email passed by the AFTER INSERT trigger on auth.users (:707-718, :736-739), and that trigger never reads email_confirmed_at. A caller who knows or guesses a contract code (CT-YYYY-NNN, about 1000 values per year, :138) can sign up as, for example, diretor@<network-domain> without access to that mailbox. That writes an adesoes_contrato row with papel gestor or admin, a termo acceptance and an audit entry (:610-617), and fills the perfis row with the chosen name, CPF and registration (:582-592). Organization admins can then see the adherent (adesoes_contrato_select :182-186; perfis_select unlinked branch 20260823000002:92-98). The DB attempt throttle covers conferir_contrato (:475) but not the trigger path; whether the GoTrue signup rate limit and Turnstile captcha are enforced server-side is dashboard configuration. The adhesion grants no access on its own: no vinculo is created on the contract path, and no source turns adesoes_contrato into access. Escalation needs an admin to attach a vinculo because the displayed email looks corporate. How much this matters depends on the production 'Confirm email' setting. If it is off (as in local config.toml:227), the caller gets a session right away (Cadastro.tsx:533-534) on an account carrying a corporate-looking email they do not own. If it is on, the adhesion row is still written but the caller cannot sign in without the mailbox, so a vinculo attached by an admin would not be usable by the attacker. README.md:71 says confirmation must be on in the dashboard, and the client handles the no-session case (Cadastro.tsx:535-536). Neither proves the deployed value.

**Claimed root cause.** private.primeiro_acesso_no_cadastro passes NEW.email to private.aplicar_primeiro_acesso at auth.users INSERT time, and the contract branch treats that unverified email as proof of membership in dominio_email before writing adesoes_contrato with papel_padrao. It neither requires email_confirmed_at nor defers adhesion until the email is confirmed, so the control rests entirely on the GoTrue 'Confirm email' setting, which is off in the repository config.

**Trace.**

1. entrypoint — `src/pages/Cadastro.tsx:503` (criarConta -> supabase.auth.signUp): Public signUp with a caller-chosen email and codigo_contrato in user metadata (:504, :511). The same request can be sent straight to GoTrue /signup with the anon key.
2. propagation — `supabase/migrations/20261003000009_cadastro_so_por_convite.sql:29` (private.primeiro_acesso_estacionar (BEFORE INSERT on auth.users)): When a code is present, the metadata is parked in private.primeiro_acesso_pendente and the insert continues. Without a code, a public signUp is refused (:22-26).
3. propagation — `supabase/migrations/20261003000001_convites_primeiro_acesso.sql:713` (private.primeiro_acesso_no_cadastro (AFTER INSERT on auth.users, trigger at :736-739)): Calls aplicar_primeiro_acesso(NEW.id, NEW.email, v_dados) as soon as the row is created, with no email_confirmed_at condition.
4. propagation — `supabase/migrations/20261003000001_convites_primeiro_acesso.sql:538` (private.aplicar_primeiro_acesso contract branch): The domain gate compares split_part(lower(p_email),'@',2) with dominio_email. p_email is only the email claimed at signup.
5. sink — `supabase/migrations/20261003000001_convites_primeiro_acesso.sql:612` (private.aplicar_primeiro_acesso adhesion insert): Inserts adesoes_contrato(contrato_id, perfil_id, papel = k.papel_padrao gestor/admin), after aceites_termo (:610) and before the aderir_contrato audit entry (:615), tying the unverified email to the network contract.

**Evidence.**

- `supabase/config.toml:227`: enable_confirmations = false for email in the local configuration (enable_signup = true at :177 and :222). The production value is not in source.
- `README.md:71`: Operator note saying email confirmation is mandatory and set in the dashboard (Authentication > Providers > Email > Confirm email). This states intent, not the deployed value.
- `src/pages/Cadastro.tsx:533`: The client enters the app immediately when signUp returns a session and otherwise shows the confirm-email step (:535-536), so both modes are supported.
- `supabase/migrations/20261003000001_convites_primeiro_acesso.sql:140`: contratos_rede.papel_padrao is restricted to admin or gestor, and codigo matches ^CT-[0-9]{4}-[0-9]{3}$ (:138).
- `supabase/migrations/20261003000001_convites_primeiro_acesso.sql:475`: Only conferir_contrato checks primeiro_acesso_bloqueado. The signUp trigger path does no attempt accounting for contract codes.
- `supabase/migrations/20261003000001_convites_primeiro_acesso.sql:182`: adesoes_contrato_select lets admins of the contract's organization see the adhesion. No source code grants access from adesoes_contrato, and no vinculo is created on the contract path.
- `supabase/migrations/20260823000002_auditoria_partes_ab.sql:93`: The perfis_select branch shows profiles without an active vinculo to org admins, so the unverified adherent's profile is visible to admins who could release it.

**Blockers.**

- The production and homolog GoTrue 'Confirm email' setting, plus server-side captcha and signup rate limits, are dashboard configuration that is not in source. The repository has only the local config.toml (off) and a README instruction (on). This setting decides whether the attacker gets a usable session on the spoofed corporate email.
- No OS-enforced sandbox was available on the audit host, so signUp and the auth.users triggers could not be run against a local stack to observe the adesoes_contrato row and the session.
- Escalation beyond a pending adherent requires an organization admin to attach a vinculo because the displayed email looks corporate. No source automates that step, and how admins act on it is outside the code.

**Validation plan.**

- Local: In a sandboxed local Supabase with all migrations applied and enable_confirmations=false, seed organizacoes plus contratos_rede (codigo 'CT-2026-001', papel_padrao 'gestor', dominio_email 'example.test'). Call auth.signUp with email diretor@example.test (no mailbox), a dummy password, and metadata codigo_contrato 'CT-2026-001', termo_versao = private.termo_uso_versao(), a valid dummy CPF, a full name and data_nascimento. Check that a session is returned, that adesoes_contrato has (contrato, perfil, 'gestor'), and that auth.users.email_confirmed_at is set without any email being sent. Repeat with enable_confirmations=true. Check that the adesoes_contrato row already exists while email_confirmed_at is null and that signInWithPassword is refused. Tear down the stack afterwards.
- Owner-observed: The owner checks the Supabase Dashboard for the production and homolog projects under Authentication > Sign In / Providers > Email: whether 'Confirm email' is on. Under Authentication > Attack Protection, check whether captcha (Turnstile) is enforced for signup, and check the signup rate limit. Read the settings only. Do not send any signup requests to either deployment.

## Generic document RPCs and the sync path emit termo_consentimento, sumario_obito, parecer and teleinterconsulta without the dedicated flows' role and content rules

Fingerprint: `supabase/migrations/private.gravar_documento_episodio:dedicated-document-types-open-to-generic-emitters`

Termo de consentimento, sumario de obito, parecer and teleinterconsulta documents are meant to be created only by dedicated RPCs (emitir_termo_consentimento: plantonista only, birth date required, age-based signer rules, physician block filled server-side from the caller's perfil; registrar_obito; the parecer and teleinterconsulta workflows). public.emitir_documento and private.sincronizar_documento (reached through public.sincronizar_registros with tipo 'documento') pass the caller's tipo and conteudo to private.gravar_documento_episodio, whose type list includes all four dedicated types, after only a role-agnostic patient-scope check (pode_atuar_no_paciente / podia_atuar_no_paciente_em: super admin, gestor, or any escala member whose sector holds the patient). The draft path public.salvar_rascunho + public.emitir_rascunho accepts termo_consentimento (not the other three) and faltas_documento returns no faltas for it. A second-factor-verified staff member on escala in the patient's sector who is not a plantonista (for example enfermeiro or tecnico_enfermagem) could therefore create a server-numbered, 'ativo' TCLE with arbitrary content, including a 'medico' block naming another physician and CRM that the printed folha shows as 'Medico responsavel', or an under-16 patient signing for themself; a plantonista could bypass the signer and birth-date rules the same way. emitir_documento and the sync path also accept sumario_obito, parecer and teleinterconsulta with free content. autor_id stays the real login, so database attribution is preserved; the impact is integrity of clinical/legal documents and of what is printed and listed as a valid TCLE. The project already treats this as an invariant: copiar_documento excludes termo because a copied termo became an emitted draft without emitir_termo_consentimento's rules, and documento_transferencia was deliberately kept out of the generic lists.

**Claimed root cause.** private.gravar_documento_episodio is both the shared sink of the dedicated flows and the only tipo gate of public.emitir_documento and private.sincronizar_documento; those writers (and salvar_rascunho for termo_consentimento) do not restrict tipo to generic types and do not apply the dedicated flows' role and content checks, so the dedicated types are reachable with only the role-agnostic patient-scope check.

**Trace.**

1. entrypoint — `supabase/migrations/20261102000002_aih_ciclo.sql:334` (public.emitir_documento): Authenticated RPC (GRANT to authenticated, line 367) taking p_tipo and p_conteudo from the caller; checks exigir_segundo_fator and pode_atuar_no_paciente only (lines 341-344), runs faltas_documento only for laudo_aih (346-351), then calls gravar_documento_episodio with the caller's tipo and content (359).
2. propagation — `supabase/migrations/20260926000011_fase1_escala_por_setor.sql:52` (private.pode_atuar_no_paciente): True for super admin, gestor, or paciente_no_meu_plantao (patient or internacao in a sector of the caller's current escala); no papel check, so nursing escala members pass.
3. propagation — `supabase/migrations/20260929000001_fase4_rascunho_emissao.sql:85` (public.salvar_rascunho): Draft allowlist includes 'termo_consentimento' (lines 85-86) after only pode_atuar_no_paciente (82); emitir_rascunho (20261022000013_faltas_documento.sql:205-231) numbers it after faltas_documento, which returns an empty list for that tipo (20261022000013_faltas_documento.sql:47-48).
4. propagation — `supabase/migrations/20260927000009_fase2_documentos_episodio.sql:181` (private.sincronizar_documento): Sync path passes d->>'tipo' and d->>'conteudo' to gravar_documento_episodio after only podia_atuar_no_paciente_em (lines 171-173); wired into sincronizar_registros for tipo 'documento' at lines 193-209.
5. sink — `supabase/migrations/20261001000003_fase7_teleinterconsulta.sql:43` (private.gravar_documento_episodio): Type list accepts sumario_obito, termo_consentimento and teleinterconsulta ('parecer' prepended by 20261004000002_parecer_medico.sql:55-59); inserts a numbered 'ativo' documentos_clinicos row with the caller-supplied content (lines 76-87).

**Evidence.**

- `supabase/migrations/20261022000006_decisoes_rt_termo_idade_parecer.sql:59`: Dedicated emitir_termo_consentimento requires tenho_papel(..., 'plantonista'); lines 90-137 enforce birth date and signer by age; lines 146 and 176 fill the medico block from the caller's perfil.
- `supabase/migrations/20261022000005_fix_revisao_segundo_fator_documentos.sql:14`: Developers state the invariant: a copied termo became an emitted draft without emitir_termo_consentimento's rules, so copiar_documento excludes termo (lines 566-569); salvar_rascunho itself was not restricted.
- `supabase/migrations/20270329000001_documento_transferencia.sql:30`: Design rule for a dedicated type: emitir_documento and salvar_rascunho must refuse it so nobody records it without the server snapshot; the same rule is not applied to termo_consentimento, sumario_obito, parecer or teleinterconsulta.
- `supabase/migrations/20261022000006_decisoes_rt_termo_idade_parecer.sql:276`: termos_consentimento_do_paciente lists every ativo/cancelado documentos_clinicos row with tipo termo_consentimento and returns conteudo->'termo' (line 263), so a generic-path document appears as a valid TCLE.
- `supabase/functions/_shared/folhas.ts:708`: Server folha takes the physician name and CRM from t.medico in the stored content, falling back to the real author only when absent.
- `supabase/migrations/20270326000001_obito.sql:410`: sumario_obito is meant to be produced by registrar_obito from the validated obitos row; emitir_documento and the sync path accept the same tipo with free content.

**Blockers.**

- No OS-enforced sandbox on the audit host, so the migrations could not be replayed into a disposable Postgres to call the RPCs as a dummy non-plantonista escala member and observe the numbered document.
- Deployed function bodies are not source-visible; whether the homologacao/production definitions of emitir_documento, salvar_rascunho, sincronizar_registros and gravar_documento_episodio match the migration replay needs an owner-observed check.

**Validation plan.**

- Local: In a sandboxed disposable Supabase/Postgres with all migrations replayed and no network: create a dummy organizacao, unidade, setor, a patient aged 10 in that setor, and an enfermeiro vinculo with an escala row covering now in that setor and the second factor satisfied. Inside a transaction that is rolled back, with request.jwt.claims set to that user: (1) call public.emitir_documento(<patient>, 'termo_consentimento', '{"termo":{"procedimento":"xyz","texto":"dummy text with more than twenty chars","assinante":"paciente","medico":{"nome":"Dr Dummy","crm":"0000"}}}'); (2) call public.salvar_rascunho with the same tipo and content, then public.emitir_rascunho on the returned id; (3) call public.sincronizar_registros with one item of tipo 'documento', sem_conexao false, hora now, dados {paciente_id, tipo 'sumario_obito', conteudo 'dummy'}. Expected today: each returns a numbered 'ativo' document. Expected after fix: each is refused. Regression: emitir_termo_consentimento by the same enfermeiro must still fail with 'O termo de consentimento é do médico.'
- Owner-observed: Owner runs on homologacao only, read-only, select pg_get_functiondef for public.emitir_documento(uuid,text,text,uuid,uuid,text), public.salvar_rascunho(uuid,text,text,uuid), public.sincronizar_registros(jsonb) and private.gravar_documento_episodio(uuid,uuid,text,text,uuid,uuid,text,uuid,timestamptz,boolean,text), and confirms whether termo_consentimento, sumario_obito, parecer and teleinterconsulta are accepted without a role check; optionally repeats the local calls as a dummy enfermeiro inside a transaction that is rolled back.

## Patient-linked tables readable by table GET without the second factor (no RESTRICTIVE segundo_fator policy)

Fingerprint: `supabase/migrations:clinical-tables-missing-restrictive-segundo_fator-policy`

public.portao_requisicao (the PostgREST db_pre_request hook) returns early for GET/HEAD/OPTIONS table requests when private.segundo_fator_ok() is false, leaving RLS as the only read barrier, and the intended RLS barrier is a per-table RESTRICTIVE <table>_segundo_fator policy USING private.segundo_fator_ok(). Eleven patient-linked tables never received that policy while remaining SELECT-able by authenticated through a permissive policy whose helpers (papel_na_unidade, membro_da_unidade, pode_atuar_no_paciente, gestor_da_unidade, tenho_papel, farmaceutico_da) do not check the second factor: teleinterconsultas (pergunta/resposta clinical free text, paciente_id), pedidos_acesso_prontuario, dispensacoes, dispensacao_devolucoes, contas, conta_eventos, impressoes_pulseira, classificacoes_fugulin, classificacoes_dini, duplas_checagens and reentradas_contingencia. teleinterconsultas and pedidos_acesso_prontuario only revoke anon, so authenticated keeps the default SELECT grant (no ALTER DEFAULT PRIVILEGES for tables in the migrations); the others GRANT SELECT explicitly or revoke only INSERT/UPDATE/DELETE. When exigir_segundo_fator is on, a password-only session of an in-tenant principal (solicitante/consultor/gestor, pharmacist, faturamento, any unit member for fugulin/dini/dupla checagem) can read its own unit's rows via GET /rest/v1/<table>, while the RPCs over the same data call exigir_segundo_fator. Tenant isolation is unchanged; the gap is the authentication assurance level. Same defect class as the run-2 lead chat_msg_select:no-second-factor, on different tables.

**Claimed root cause.** The 2FA read barrier is opt-in per table (each migration must add the RESTRICTIVE segundo_fator_ok() policy) while portao_requisicao exempts table GETs on the assumption that it exists; the migrations creating these eleven patient-linked, authenticated-readable tables omitted it, and no test enumerates the policy across patient tables.

**Trace.**

1. entrypoint — `supabase/migrations/20261023000001_segundo_fator_servidor.sql:134` (public.portao_requisicao): For an authenticated session without a valid second factor, GET/HEAD/OPTIONS on non-RPC paths return early (line 135, 'leitura de tabela: decide a RLS'); only RPC paths outside the allow-list raise SEGUNDO_FATOR.
2. propagation — `supabase/migrations/20261001000003_fase7_teleinterconsulta.sql:231` (teleinterconsultas_select): Permissive SELECT for solicitante, consultor, super admin or unit gestor; only anon is revoked (line 234), so authenticated keeps default SELECT; no migration creates a RESTRICTIVE segundo_fator policy on this table.
3. propagation — `supabase/migrations/20261130000001_dispensacao_farmacia.sql:60` (dispensacoes_leitura): Pharmacist, gestor, faturamento or staff allowed to act on the patient read dispensations with paciente_id; GRANT SELECT to authenticated at line 67; no 2FA policy.
4. sink — `supabase/migrations/20261001000003_fase7_teleinterconsulta.sql:206` (public.teleinterconsultas): pergunta and resposta (line 212) clinical free text, with paciente_id (line 203), returned to the password-only session by the table GET.

**Evidence.**

- `supabase/migrations/20261005000005_cuidados_enfermagem.sql:507`: Intended pattern: patient tables get a RESTRICTIVE <table>_segundo_fator policy USING private.segundo_fator_ok() (same loop pattern in 20260926000009_fase1_segundo_fator.sql:91-96 and later migrations).
- `supabase/migrations/20261001000001_fase6_pedido_acesso_encerrado.sql:54`: pedidos_acesso_select is permissive only; only anon is revoked (line 60); no 2FA policy.
- `supabase/migrations/20261127000001_conta_atendimento.sql:54`: contas_leitura and conta_eventos_leitura (line 56) are permissive, with GRANT SELECT to authenticated at line 60; no 2FA policy.
- `supabase/migrations/20270323000001_pulseira.sql:107`: impressoes_pulseira_select is permissive, with GRANT SELECT to authenticated at line 105; no 2FA policy.
- `supabase/migrations/20261031000006_fugulin.sql:46`: classificacoes_fugulin_select USING membro_da_unidade only (INSERT/UPDATE/DELETE revoked at line 44, SELECT kept); same in 20261031000001_dupla_checagem.sql:200 and 20270303000001_dini_pediatrico.sql:67. The fugulin/dini/dupla RPCs instead filter on segundo_fator_ok() (fugulin.sql:138), showing the intended assurance level.
- `supabase/migrations/20261030000006_contingencia.sql:50`: reentradas_contingencia_select is permissive; only INSERT/UPDATE/DELETE revoked (line 45); no 2FA policy.
- `supabase/migrations/20270208000019_papel_mais_forte.sql:23`: Latest private.papel_na_unidade reads active vinculos only and does not consult segundo_fator_ok(); membro_da_unidade (20260926000001_fase0_endurecer_rpcs.sql:46) likewise has no 2FA check, so the permissive policies add no factor check.
- `supabase/migrations/20260926000009_fase1_segundo_fator.sql:32`: Master switch exigir_segundo_fator seeded false and no migration sets it true; when false, segundo_fator_ok() is true and the gap is unreachable, so reachability depends on the deployed value.

**Blockers.**

- No OS-enforced sandbox on the audit host, so no local database was started to list pg_policies after all migrations or to issue the table GET; the gap is source-visible but unobserved.
- The deployed value of configuracao_plataforma.exigir_segundo_fator (seeded false, never set true by a migration) and whether an out-of-repository change added RESTRICTIVE policies or revoked SELECT on these tables are not source-visible; with the switch off the issue is not reachable.

**Validation plan.**

- Local: In a sandboxed local Supabase stack with all migrations applied and dummy data only: run SELECT tablename FROM pg_policies WHERE schemaname='public' AND permissive='RESTRICTIVE' AND qual LIKE '%segundo_fator_ok%' and diff it against the eleven listed tables (expect none present). Set exigir_segundo_fator = true, sign in a dummy solicitante with password only (aal1, no totp amr), create one dummy teleinterconsulta via a 2FA-verified session, then as the password-only session GET /rest/v1/teleinterconsultas?select=pergunta,resposta and POST /rest/v1/rpc/teleinterconsultas_da_unidade; expect rows from the GET and SEGUNDO_FATOR from the RPC. Repeat the GET for one dummy row in dispensacoes and classificacoes_fugulin.
- Owner-observed: Owner, read-only on homolog and production: SELECT valor FROM public.configuracao_plataforma WHERE chave='exigir_segundo_fator'; run the pg_policies query above; and SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name IN ('teleinterconsultas','pedidos_acesso_prontuario') AND grantee='authenticated'. No audit traffic to the deployment.

