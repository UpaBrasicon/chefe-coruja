# Needs validation

Prioritised leads without severity. Do not turn these into live tests against production.

## Password-only session can enroll its own TOTP factor through GoTrue and satisfy the server-side 2FA gate

Fingerprint: `segundo_fator_valido/totp-enroll-at-aal1-bypasses-email-otp`

When configuracao_plataforma.exigir_segundo_fator is true, private.segundo_fator_ok() delegates to private.segundo_fator_valido(), whose last definition (20261022000001:69-75; no later redefinition in supabase/migrations) accepts either a JWT with aal='aal2' and a TOTP amr entry under 24 h, or a segundo_fator_sessao_ok row for the current session (email OTP). Email OTP is the default factor and the authenticator app is labelled optional, so most accounts have no verified TOTP factor. A holder of only the password signs in (aal1) and calls the GoTrue MFA endpoints directly: enroll a TOTP factor, then challenge and verify it with a code from an authenticator they control. If the deployed GoTrue accepts first-factor enrollment at aal1 when the user has no verified factor, the refreshed JWT is aal2 with amr totp, segundo_fator_valido() returns true, and the pre-request hook portao_requisicao, the restrictive table policies and the storage policy all pass without the email code. No source-visible control binds TOTP enrollment to prior second-factor assurance: the auth.mfa_factors trigger is AFTER-only and only logs 'totp_ativado', the mfa_verification_attempt hook only counts failures and returns 'continue' for a valid code, no custom_access_token or other Auth hook is configured (config.toml:305-318), and the pre-request hook only sees PostgREST requests. Accounts reset by zerar_segundo_fator (all factors deleted) are in the same no-verified-factor state.

**Claimed root cause.** private.segundo_fator_valido() treats any aal2 JWT with a recent TOTP amr entry as proof of the second factor, without requiring that the TOTP factor was enrolled from a session that had already passed the account owner's email OTP; no database or hook control ties TOTP enrollment or its first verification to a prior segundo_fator_sessao_ok row.

**Trace.**

1. entrypoint — `src/components/seguranca/SegundoFator.tsx:87` (CadastroSegundoFator.iniciar): TOTP enrollment is a direct GoTrue call (supabase.auth.mfa.enroll), followed by supabase.auth.mfa.challengeAndVerify at :101. The same GoTrue /factors calls can be sent by any client holding an aal1 password-only session, outside the UI.
2. propagation — `supabase/migrations/20261003000005_entrada.sql:65` (public.hook_segundo_fator_tentativa): MFA verification-attempt hook (registered at supabase/config.toml:316-318) returns decision 'continue' for any valid code (:65-67); it only counts failures and never checks factor age or prior email-OTP assurance.
3. propagation — `supabase/migrations/20260926000009_fase1_segundo_fator.sql:38` (private.ultima_verificacao_totp): Reads the latest TOTP timestamp from the JWT amr claim that GoTrue issues after the verify.
4. propagation — `supabase/migrations/20261022000001_segundo_fator_email.sql:72` (private.segundo_fator_valido): Last definition: true for aal2 with a TOTP verification under 24 h, OR an email-verified session; no condition on how or when the TOTP factor was enrolled.
5. sink — `supabase/migrations/20261023000001_segundo_fator_servidor.sql:120` (public.portao_requisicao): segundo_fator_ok() (20260926000009:53-59, which calls segundo_fator_valido when the switch is on) is true, so the pre-request hook returns early; the restrictive storage policy at :150-153 uses the same predicate.

**Evidence.**

- `src/components/seguranca/SegundoFator.tsx:595`: Email code is the default second factor with nothing to configure, so most accounts have no verified TOTP factor.
- `src/components/seguranca/SegundoFator.tsx:604`: The authenticator app is labelled 'Opcional' when no factor exists.
- `supabase/config.toml:335`: TOTP enroll_enabled = true (verify_enabled = true at :336) in the checked-in Auth config; deployed Auth settings are not in source.
- `supabase/config.toml:310`: custom_access_token hook is commented out; the only active Auth hook is mfa_verification_attempt (:316-318), so nothing rewrites aal/amr or gates enrollment.
- `supabase/migrations/20260926000009_fase1_segundo_fator.sql:56`: segundo_fator_ok() enforces segundo_fator_valido() only when exigir_segundo_fator is true; the seeded default is false (:31-33).
- `supabase/migrations/20261023000001_segundo_fator_servidor.sql:88`: The only trigger on auth.mfa_factors is AFTER INSERT/UPDATE OF status/DELETE and only records a 'totp_ativado' event; it cannot block enrollment.
- `supabase/migrations/20261023000001_segundo_fator_servidor.sql:123`: The pre-request hook decides from PostgREST request.path and request.method only, so GoTrue /auth/v1/factors calls never reach it.
- `supabase/migrations/20261023000001_segundo_fator_servidor.sql:315`: zerar_segundo_fator deletes all auth.mfa_factors rows of the user, leaving a reset account with no verified factor.
- `supabase/migrations/20261022000002_fix_2fa_email_hermes_grants.sql:5`: The project's own threat model targets an attacker holding only the stolen password (reason solicitar_codigo_2fa was moved to service_role).

**Blockers.**

- No OS-enforced sandbox on the audit host, so no local Supabase stack (GoTrue + PostgREST) could be run to observe whether an aal1 session with no verified factor can enroll and verify a TOTP factor and then pass portao_requisicao.
- The deployed GoTrue version and its enrollment rule are not in source; the claimed path needs GoTrue to allow first-factor TOTP enrollment from an aal1 session when the user has no verified factor.
- Deployed Auth settings (TOTP enroll/verify enabled) and the deployed value of configuracao_plataforma.exigir_segundo_fator are not visible in source; with the switch off the gate is not enforced at all and this path has no effect.

**Validation plan.**

- Local: In a sandboxed, network-isolated local Supabase stack with this repo's migrations and supabase/config.toml: set configuracao_plataforma.exigir_segundo_fator=true; create a dummy user with only a password and no MFA factor; sign in (aal1); confirm rpc('segundo_fator_status') reports the factor as not valid and a POST to a non-allowlisted RPC fails with SEGUNDO_FATOR. Then call auth.mfa.enroll({factorType:'totp'}) and auth.mfa.challengeAndVerify with a code computed from the returned secret, refresh the session, and repeat both calls without requesting any email code. Confirmed if the enrollment is accepted, the JWT shows aal2 with amr totp, segundo_fator_status reports valid and the RPC succeeds.
- Owner-observed: Owner, in the homologation project only (never production): note the Auth > MFA TOTP enroll/verify setting, the GoTrue version, and the value of exigir_segundo_fator. With a dummy homologation account that has no authenticator, sign in with the password only and, before entering the email code, attempt to enroll and verify a TOTP factor through the Auth API; record whether enrollment is accepted and whether the app then opens past the 2FA gate.

## Server-ended session leaves the previous user's draft key, queue key, encrypted PHI caches and query cache in the tab, and the next login in that tab reuses that draft key

Fingerprint: `src/contexts/AuthContext.tsx:SIGNED_OUT-partial-local-cleanup`

A session can end without the user pressing 'Sair' in the tab: a password change runs signOut({scope:'global'}) (RecuperarSenha.tsx:147), an administrator or 2FA reset deletes the session, or the refresh token is revoked. When the stale tab next refreshes its token and the refresh is rejected, supabase-js is expected to remove the token and emit SIGNED_OUT. The app's SIGNED_OUT branch (AuthContext.tsx:142-149) only resets cargaPerfil, calls limparCompartilhadas and sets perfil to null. It does not run the cleanup that signOut (171-191), encerrarLocal (56-67) and the no-session branch on mount (125-134) run. RequireAuth then navigates to /login inside the SPA, with no reload, and AppShell unmounts, so the 30-minute idle sign-out (useBloqueioOcioso, which does run the full cleanup) stops too. What stays in the tab until it is reloaded or closed: the previous user's AES draft key in memory and as base64 in sessionStorage 'cc-chave-rascunho' (cofreLocal.ts:44-45), the per-person queue key as base64 in 'cc-chave-fila' (fila.ts:72-73), encrypted drafts under 'cc:rascunho:*' (rascunho.ts:89), the encrypted offline profile and query snapshot, and the in-memory react-query cache. The module header says the drafts become unreadable once the session ends (cofreLocal.ts:9-10), and the migration header says the server key is deleted when the session ends (chave_rascunho migration, line 8). The browser copy outlives both. Someone who uses that tab next, on a shared UPA computer, can read both keys in devtools and decrypt the drafts and the IndexedDB queue entries. If that person logs in in the same tab, useChaveRascunho returns early because a key is already in memory (useChaveRascunho.ts:18), so their new drafts are encrypted with the previous user's key. The query cache, which was never cleared, may also serve the previous session's data for queries whose keys do not include the user. Limits seen in source: draft storage keys include perfilId (rascunho.ts:62), so the new user's screens do not show the old drafts directly. A reload with no session clears everything (AuthContext.tsx:125-134). The idle sign-out clears everything if it fires before the refresh fails.

**Claimed root cause.** AuthContext runs the full local cleanup (drafts, local session, query snapshot, draft and queue keys, queryClient) only on explicit sign-out paths (signOut, BroadcastChannel 'sair', the 12 h expiry via encerrarLocal) and on mount when there is no session. The onAuthStateChange SIGNED_OUT branch, which also fires when the server ends the session, does only a partial cleanup. useChaveRascunho also treats any key already in memory as belonging to the current session.

**Trace.**

1. entrypoint — `src/pages/RecuperarSenha.tsx:147` (gravarSenha): After a successful password change the app calls supabase.auth.signOut({ scope: 'global' }), which revokes every other session of the account, including a tab left open on a shared computer. Server-side session deletion (2FA reset, admin) is an equivalent trigger. The stale tab only notices at its next token refresh.
2. propagation — `src/contexts/AuthContext.tsx:142` (onAuthStateChange SIGNED_OUT branch): When session is null and the event is SIGNED_OUT, lines 145-148 only reset cargaPerfil, call limparCompartilhadas, setPerfil(null) and setLoading(false). They do not call limparTodosRascunhos, apagarSessaoLocal, apagarConsultas, definirChave(null), definirChaveFila(null) or queryClient.clear.
3. propagation — `src/routes/RequireAuth.tsx:32` (RequireAuth): With perfil null the router navigates to /login inside the SPA (no reload). AppShell unmounts, so the idle sign-out that would have run the full cleanup stops (useBloqueioOcioso is active only while perfil is set, AppShell.tsx:333).
4. propagation — `src/lib/cofreLocal.ts:45` (definirChave): The previous session's draft key stays in the module variable and as base64 in sessionStorage 'cc-chave-rascunho'. Only definirChave(null) removes it (line 39).
5. propagation — `src/lib/offline/fila.ts:73` (definirChaveFila): The per-person queue key stays in memory and as base64 in sessionStorage 'cc-chave-fila'. Only definirChaveFila(null) removes it (line 67). It decrypts that person's IndexedDB queue entries.
6. propagation — `src/lib/rascunho.ts:89` (salvarEnvelope): The previous user's clinical drafts stay in localStorage under 'cc:rascunho:*', encrypted with the key that is still readable in the tab.
7. sink — `src/hooks/useChaveRascunho.ts:18` (useChaveRascunho effect): When the next person logs in in the same tab, 'if (temChave()) return' skips the chave_rascunho RPC. The new session keeps using the previous session's draft key, and the earlier residue is never cleared.

**Evidence.**

- `src/contexts/AuthContext.tsx:56`: encerrarLocal shows the intended full cleanup (limparTodosRascunhos, apagarSessaoLocal, apagarConsultas, definirChave(null), definirChaveFila(null), queryClient.clear) with the LGPD comment about shared UPA computers (line 57).
- `src/contexts/AuthContext.tsx:145`: The SIGNED_OUT branch body has only the cargaPerfil reset, limparCompartilhadas, setPerfil(null) and setLoading(false).
- `src/contexts/AuthContext.tsx:128`: Mitigating control: on mount with no session (not a network failure), the same storage cleanup runs, so a reload of the tab removes the residue. The exposure lasts from SIGNED_OUT until the tab is reloaded or closed.
- `src/components/casca/useBloqueioOcioso.ts:38`: Mitigating control: 30 minutes without input calls onEncerrar, which is AppShell sair -> signOut with full cleanup. The effect only runs while perfil is set (AppShell.tsx:333), so it cannot run after SIGNED_OUT clears perfil.
- `src/lib/cofreLocal.ts:9`: Design invariant in the module header: without the key (another person on the computer after logout, or after the session expires), the draft is unreadable.
- `supabase/migrations/20261026000001_chave_rascunho.sql:8`: The server trigger deletes the per-session key when the session ends (logout, expiry, 2FA reset) so leftover drafts become unreadable. The browser copy left by the SIGNED_OUT path defeats this.
- `src/hooks/useChaveRascunho.ts:18`: Early return on temChave(): a key left from a previous session in the same tab is never replaced by the new session's key.
- `src/lib/rascunho.ts:62`: Draft storage keys include perfilId, so the next user's screens do not load the previous user's drafts directly. Disclosure needs reading storage (devtools) and decrypting with the leftover key.
- `src/App.tsx:124`: A single module-level QueryClient lives for the whole app lifetime. Only signOut and encerrarLocal clear it.

**Blockers.**

- Whether the deployed supabase-js (^2.106.2) emits SIGNED_OUT and removes the stored session, without reloading the page, when the stale tab's token refresh is rejected after a global sign-out or server-side session deletion is library runtime behavior. node_modules is not present and the behavior is not visible in src.
- No OS-enforced sandbox is available on the audit host, so the SPA cannot be run locally to observe sessionStorage and localStorage after a server-ended session.

**Validation plan.**

- Local: On a local Supabase stack with two dummy staff accounts A and B and non-sensitive fixture patients: log in as A in tab T, pass 2FA, type a clinical draft and, if possible, queue one offline item, then keep interacting so the 30-minute idle sign-out does not fire. From a second browser, change A's password through /recuperar-senha (global sign-out), or delete A's auth.sessions row. Wait for T's next token refresh (shorten JWT expiry in the local config to a few minutes) and for T to land on /login without a reload. Record whether sessionStorage in T still holds 'cc-chave-rascunho' and 'cc-chave-fila', and localStorage still holds 'cc:rascunho:*', and whether a draft decrypts with the leftover key using the cofreLocal format (ccr1: nonce|ciphertext|tag, AES-256-GCM). Then log in as B in T and check that no chave_rascunho RPC is sent and that B's new draft is encrypted with A's leftover key. Stop at that observation. Regression test: SIGNED_OUT with a null session should run the same storage, key and queryClient cleanup as encerrarLocal (without calling signOut again), and useChaveRascunho should re-fetch when the session_id changes.
- Owner-observed: On homologation only, with dummy accounts: the owner leaves a logged-in tab open, revokes that session from another device (password change or session deletion), waits for the tab to return to /login, and checks in devtools whether 'cc-chave-rascunho', 'cc-chave-fila' and 'cc:rascunho:*' are still present in that tab.

## Offline replay trusts client-asserted sem_conexao/ultimo_contato and authorizes by the patient's current sector at a client-chosen past time, so backdated chart writes bypass the online current-shift and role checks

Fingerprint: `src/lib/offline/sincronizar.ts:sincronizar_registros:client-asserted-sem_conexao-ultimo_contato`

public.sincronizar_registros (called from src/lib/offline/sincronizar.ts) is the write door for observations and episode documents that may be created offline. Any authenticated, second-factor-verified caller can send items with sem_conexao=true and any ultimo_contato within 2 h before hora; the server checks these values only against each other and against now(), never against a server-recorded contact, so the online rule that hora must be current (SYNC_HORA) is skipped at will. Items with now()-hora <= 24 h are inserted directly with aferido_em/emitido_em = client hora. Authorization becomes private.podia_atuar_no_paciente_em(patient, client hora). ADR 0009 intentionally allows post-shift sync of facts that happened during a shift, and an offline claim cannot be verified in general, so that part alone is design. The source-visible gaps beyond the design are: (1) the pacientes.setor_id branch compares the patient's CURRENT sector with the caller's escala_plantao at the past moment, with no bound on when the patient entered the sector, unlike the internacoes branch which migration 20261119000001 bounded to admissions open at that moment; so a staff member whose shift in sector S ended within the last 24 h can write backdated vitals/documents for a patient who reached S after the shift; (2) the sync path checks only escala_plantao rows (plus gestor/super admin), not the unit role or the current care relation that the online observacao_insert policy requires (plantonista + paciente_em_cuidado_no_plantao); (3) no active-vinculo check, so a removed member keeps this write path if their past escala rows stay ativo and their session/2FA remain valid (not established in source). Writes are attributed to the caller's login and flagged sem_conexao=true, which limits concealment but not chart integrity.

**Claimed root cause.** sincronizar_registros accepts the client's claim of being offline (sem_conexao, ultimo_contato) without server-side evidence of the last contact, uses the client-chosen time both as clinical time and as the authorization moment, and private.podia_atuar_no_paciente_em authorizes through the patient's current pacientes.setor_id without binding the patient's location (or the caller's role/vinculo) to that moment.

**Trace.**

1. entrypoint — `src/lib/offline/sincronizar.ts:21` (enviar): The SPA calls supabase.rpc('sincronizar_registros', { p_itens }); any authenticated user can call the same RPC directly with arbitrary id, tipo, hora, sem_conexao, ultimo_contato and dados.
2. propagation — `src/lib/offline/sincronizar.ts:56` (gravarRegistros): sem_conexao: true and ultimo_contato come only from the browser (localStorage clock context); nothing server-side corresponds to them.
3. propagation — `supabase/migrations/20260926000014_fase1_revisao_registro_tardio.sql:173` (public.sincronizar_registros): With v_sem the only checks are ultimo_contato not null, not after now() and not after hora+1 min (174), and hora-ultimo_contato <= 2 h (177); the SYNC_HORA rule (180-181) applies only when sem_conexao is false; line 187 routes to review only when now()-hora > 24 h.
4. propagation — `supabase/migrations/20261119000001_desfecho_encerra_cuidado.sql:177` (private.podia_atuar_no_paciente_em): Latest definition: pa.setor_id (current sector) IN setores_em_plantao_em(p_momento) authorizes with no time bound, while the internacoes branch (178-182) requires the admission to be open at p_momento.
5. propagation — `supabase/migrations/20260926000013_fase1_sincronizacao.sql:39` (private.setores_em_plantao_em): Reads public.escala_plantao for meu_perfil_id() at p_momento (ativo, inicio <= p_momento < end + 15 min); no join to vinculos or role.
6. sink — `supabase/migrations/20260926000014_fase1_revisao_registro_tardio.sql:116` (private.sincronizar_observacao): inserir_observacao_sincronizada (SECURITY DEFINER, latest definition at 20261121000001_prescricao_idade_peso.sql:176) inserts into public.observacao with aferido_em = client hora; documents go through gravar_documento_episodio with emitido_em = client hora (20260927000009_fase2_documentos_episodio.sql:181).

**Evidence.**

- `supabase/migrations/20260926000014_fase1_revisao_registro_tardio.sql:181`: Stated invariant 'SYNC_HORA: registro com conexão precisa ter a hora atual' is enforced only when the client sends sem_conexao=false.
- `supabase/migrations/20260926000013_fase1_sincronizacao.sql:182`: contexto_sem_conexao() returns server time and shift end but records nothing, so a claimed ultimo_contato cannot be checked later.
- `supabase/migrations/20260926000013_fase1_sincronizacao.sql:7`: Design comment (ADR 0009): access is checked at the time of the fact and post-shift sync is intended; this calibrates the finding to the unbounded current-sector branch and missing role/vinculo checks rather than post-shift sync itself.
- `supabase/migrations/20261119000001_desfecho_encerra_cuidado.sql:167`: Comment states the intent that the internação must be open at the time of the fact; the pacientes.setor_id branch at line 177 was left without that bound.
- `supabase/migrations/20261119000001_desfecho_encerra_cuidado.sql:1067`: Online observacao_insert policy requires gestor/super admin or plantonista + paciente_em_cuidado_no_plantao; the SECURITY DEFINER sync path requires neither the role nor current care.
- `supabase/migrations/20260927000009_fase2_documentos_episodio.sql:171`: sincronizar_documento uses the same podia_atuar_no_paciente_em(v_paciente, p_hora) gate.
- `supabase/migrations/20260815000002_fase1_funcoes.sql:9`: private.meu_perfil_id() only maps auth.uid() to perfis.id; no active vinculo or profile check.
- `supabase/migrations/20260817000008_observacao.sql:165`: The only BEFORE INSERT trigger on observacao (validar_observacao) checks concept/value coherence, not authorization.

**Blockers.**

- No OS-enforced sandbox on the audit host, so a crafted sincronizar_registros batch could not be replayed against a local database to observe a 'gravado' row.
- Whether the deployed public.sincronizar_registros (patched in place via pg_get_functiondef/replace in 20260927000009) and private.podia_atuar_no_paciente_em match the migration chain is not observable from source.
- For the removed-member variant only: whether vinculo removal leaves escala_plantao rows ativo and the session/second factor usable is not established in source (no migration found that deactivates escala rows on vinculo removal, but app/admin flows were not traced).

**Validation plan.**

- Local: On a local Supabase built from the migration chain with dummy unit U, sector S, patient P whose pacientes.setor_id = S and with no internacao, created after nurse N's escala_plantao row in S ended (shift ended 3 h ago, row still ativo), sign in as N with 2FA satisfied and call rpc('sincronizar_registros', {p_itens:[{id:<new uuid>, tipo:'observacao', hora:<4 h ago, inside N's shift>, sem_conexao:true, ultimo_contato:<5 h ago>, aparelho_id:'x', dados:{paciente_id:P, conceito_id:<valid numeric concept>, valor_num:120}}]}). Expected if vulnerable: status 'gravado' and a public.observacao row with aferido_em = hora and registrado_por = N, while a direct online insert for P by N is refused by observacao_insert. Repeat with N's vinculo deactivated. Regression after fix: the same call returns 'recusado' with SYNC_FORA_DO_PLANTAO.
- Owner-observed: Owner compares pg_get_functiondef for public.sincronizar_registros(jsonb) and private.podia_atuar_no_paciente_em(uuid,timestamptz) in homologation with the migration text (no audit traffic), and confirms whether vinculo removal deactivates escala_plantao rows.

## Prontuário attachment opens in a window that keeps window.opener (reverse tabnabbing from uploaded active content)

Fingerprint: `src/pages/prontuario/ImpressaoProntuario.tsx:abrirAnexo:opener-retained`

ImpressaoProntuario.abrirAnexo calls window.open('', '_blank') and then sets janela.location.href to a 120-second signed Supabase Storage URL for an attachment that any staff member who can act on the patient uploaded. The shared helper abrirEmJanela sets janela.opener = null before navigating; this path skips that step, so the opened page keeps a reference to the Chefe Coruja tab. The 'atendimento' bucket has no allowed_mime_types (never added by a later migration), the upload sends the client File.type as contentType, and both the client check erroAnexo and the server RPC registrar_anexo_prontuario accept any image/* type, image/svg+xml included. The RPC also checks only the claimed p_tipo_mime, not the stored object's content type, so a direct storage upload with text/html can be registered as image/png. If Storage serves such an object as an active document (SVG or HTML with script, without a sandbox CSP or forced download), script on the storage origin can set window.opener.location and send the victim's tab to a credential-phishing clone. vercel.json sets no Cross-Origin-Opener-Policy. The attacker must be an authenticated staff member with 2FA who can act on the patient; the victim must click 'Abrir' on that attachment.

**Claimed root cause.** ImpressaoProntuario.abrirAnexo navigates a popup that kept its opener to uploader-controlled cross-origin storage content, missing the janela.opener = null isolation that abrirEmJanela applies; neither the bucket nor registrar_anexo_prontuario restricts the stored content type to inert formats.

**Trace.**

1. entrypoint — `src/pages/prontuario/ImpressaoProntuario.tsx:222` (anexar): Authenticated staff uploads to bucket 'atendimento' with contentType taken from the client File.type, after the client-only check erroAnexo (line 42).
2. propagation — `supabase/migrations/20260815000012_fase2_bucket_atendimento.sql:6` (storage.buckets atendimento): Bucket is created without allowed_mime_types; no later migration updates it, so the server does not restrict the stored content type.
3. propagation — `supabase/migrations/20261005000003_documentos_estados.sql:370` (registrar_anexo_prontuario): Server accepts p_tipo_mime = 'application/pdf' or LIKE 'image/%' (image/svg+xml passes) and never compares it with the stored object's metadata.
4. propagation — `src/pages/prontuario/ImpressaoProntuario.tsx:236` (abrirAnexo): Victim staff clicks 'Abrir' (line 444); window.open('', '_blank') opens a window that keeps window.opener.
5. sink — `src/pages/prontuario/ImpressaoProntuario.tsx:243` (abrirAnexo): janela.location.href = data.signedUrl navigates the opener-holding window to uploader-controlled content on the storage origin, without janela.opener = null.

**Evidence.**

- `src/lib/abrirEmJanela.ts:19`: The sibling helper sets janela.opener = null before navigating to a storage URL (and falls back to 'noopener'); abrirAnexo does not use it.
- `src/pages/prontuario/ImpressaoProntuario.tsx:42`: erroAnexo accepts application/pdf or any image/* type, SVG included; it runs only in the client.
- `supabase/migrations/20261005000003_documentos_estados.sql:376`: The RPC checks only that the object exists in storage, not its stored mimetype, so a direct storage upload with another content type can be registered under an image/* label.
- `supabase/migrations/20261112000001_anexos_regulacao.sql:21`: Comparable bucket for regulation attachments restricts allowed_mime_types to PDF, JPEG and PNG; 'atendimento' lacks this control.
- `vercel.json:25`: App headers set CSP, X-Frame-Options and nosniff but no Cross-Origin-Opener-Policy, so the opener link is not severed by policy.

**Blockers.**

- Whether Supabase Storage serves a signed object whose stored content type is image/svg+xml (or text/html) as an inline, script-executing top-level document, or instead forces a download, rewrites the type, or adds a sandbox CSP, is a provider runtime fact not visible in source and decides whether attacker script ever runs with access to window.opener.
- No OS-enforced sandbox, local Supabase stack or browser is available on the audit host, so the opener navigation could not be observed locally.

**Validation plan.**

- Local: On a local Supabase stack with two dummy staff accounts (2FA satisfied) on the same dummy patient: as user A, upload through ImpressaoProntuario an SVG file of type image/svg+xml containing <script>if(opener){opener.location='http://attacker.test/'}</script> to bucket 'atendimento' (registrar_anexo_prontuario accepts it). As user B, open the patient in /impressao-prontuario and click 'Abrir' on that attachment. Observe whether the signed URL response renders inline as image/svg+xml and whether user B's original tab navigates to attacker.test. Regression test: assert abrirAnexo routes through abrirEmJanela (opener nulled) and that the bucket rejects image/svg+xml and text/html.
- Owner-observed: Owner, in homologação only, uploads a harmless SVG with a visible text marker and no script to the 'atendimento' bucket, creates a signed URL, and records the response headers (Content-Type, Content-Disposition, Content-Security-Policy, X-Content-Type-Options) and whether the browser renders it inline. If it renders inline as image/svg+xml without a sandbox CSP, the opener path is live. Also confirm the bucket's allowed_mime_types is null in storage.buckets.

## Active-content upload (SVG/HTML) to the 'atendimento' bucket opened top-level by the gestor and clinical staff

Fingerprint: `storage/atendimento-bucket-no-mime-allowlist-active-content`

The private 'atendimento' bucket is created without allowed_mime_types or file_size_limit, and no later migration sets them. Any staff member with an active vinculo in a unit may INSERT '<unidade>/justificativas/<file>' (policy atendimento_justificativa_upload); staff who can act on a patient may upload '<unidade>/<paciente>/prontuario/<file>'. The SPA accepts image/* (which includes image/svg+xml), and a direct Storage API call can set any content type. The gestor's 'ver anexo' (Escala.abrirAnexo) and any clinician's prontuario attachment open (ImpressaoProntuario.abrirAnexo) navigate a new top-level window to a signed storage URL created without { download }. If hosted Supabase Storage serves the object inline with its stored type and without a neutralizing CSP, script in an SVG or HTML file runs in the Supabase project origin when the victim clicks. That origin holds no app session token, so the plausible impact is limited to phishing and content spoofing under a trusted domain. In the prontuario path the opened window keeps window.opener, so script could also redirect the original app tab (reverse tabnabbing). The Escala path nulls opener before navigating.

**Claimed root cause.** Type enforcement for files that other users open top-level exists only in the client (accept='image/*,application/pdf', erroAnexo) and in registrar_anexo_prontuario's check of the client-declared p_tipo_mime. The 'atendimento' bucket has no allowed_mime_types, the RPC never compares p_tipo_mime with the stored object's mimetype, and the open paths neither force Content-Disposition: attachment nor (in ImpressaoProntuario) drop window.opener.

**Trace.**

1. entrypoint — `src/components/escala/PedidosEscala.tsx:164` (enviar (justificar_falta)): Staff member uploads the attachment to BUCKET_JUSTIFICATIVA ('atendimento') at caminhoNovoAnexo(unidade, name, uuid) without a contentType option, so the multipart part carries the File's own type. The picker's accept='image/*,application/pdf' (line 241) admits image/svg+xml, and a direct Storage API call can declare any type.
2. propagation — `supabase/migrations/20270208000004_escala_atestado_falta.sql:55` (policy atendimento_justificativa_upload): INSERT allowed for any authenticated user with an active vinculo in the unit named by the first path segment (justificativa_da_minha_unidade, line 32); no content-type condition.
3. propagation — `supabase/migrations/20260815000012_fase2_bucket_atendimento.sql:6` (bucket atendimento): Bucket inserted as (id, name, public=false) with no allowed_mime_types or file_size_limit; no later migration updates this bucket.
4. propagation — `src/components/escala/PedidosEscala.tsx:168` (enviar (justificar_falta)): solicitacoes_escala row stores anexo_url = storage path for the gestor to review.
5. sink — `src/pages/Escala.tsx:520` (abrirAnexo): Gestor clicks 'ver anexo'; createSignedUrl(caminho, 120) without { download }, and abrirEmJanela navigates a new top-level window to the signed URL (src/lib/abrirEmJanela.ts:19-20).

**Evidence.**

- `src/pages/prontuario/ImpressaoProntuario.tsx:42`: erroAnexo accepts any f.type starting with 'image/', including image/svg+xml.
- `src/pages/prontuario/ImpressaoProntuario.tsx:222`: Prontuario attachment uploaded to 'atendimento' with contentType: f.type (client-controlled).
- `supabase/migrations/20261005000003_documentos_estados.sql:370`: registrar_anexo_prontuario checks only the declared p_tipo_mime (application/pdf or LIKE 'image/%'); it checks the object exists (line 376) but never compares its stored mimetype, so SVG passes.
- `src/pages/prontuario/ImpressaoProntuario.tsx:236`: abrirAnexo: window.open('', '_blank') then janela.location.href = signed URL (line 243), with no download disposition and without nulling janela.opener.
- `src/lib/abrirEmJanela.ts:19`: Escala path sets janela.opener = null before navigating, so only the prontuario path allows reverse tabnabbing.
- `supabase/migrations/20261112000001_anexos_regulacao.sql:18`: Sibling bucket regulacao sets allowed_mime_types (pdf/jpeg/png) and a 10 MB limit; farmacia opens with createSignedUrl(..., { download: a.nome }) (src/pages/farmacia/EnviarArquivo.tsx:65). atendimento is the outlier.

**Blockers.**

- Decisive provider/deployment fact not visible in source: whether hosted Supabase Storage, on a signed-URL GET, serves an object stored as image/svg+xml or text/html with that Content-Type inline (no Content-Disposition: attachment, no sandboxing CSP, no rewrite to text/plain), so that embedded script executes.
- The bounded local check (local Supabase stack plus a browser) cannot be run on this audit host because no OS-enforced sandbox is available, and the hosted provider's behavior may differ from the local storage container.

**Validation plan.**

- Local: In a local Supabase stack (supabase start) with these migrations, sign in as a dummy staff user with an active vinculo in a dummy unit, upload the benign file '<svg xmlns="http://www.w3.org/2000/svg"><script>document.title="svg-exec"</script></svg>' to atendimento/<unidade-uuid>/justificativas/<uuid>-x.svg with contentType image/svg+xml, create a 120 s signed URL as a dummy gestor of that unit, open it in a browser and record the Content-Type, Content-Disposition and Content-Security-Policy response headers and whether document.title becomes 'svg-exec'. Repeat with a text/html file containing the same script.
- Owner-observed: Owner, on homologacao only and with dummy accounts: upload the same benign SVG through the normal 'Justificar falta' dialog, open it as a dummy gestor via 'ver anexo', and record the response headers (Content-Type, Content-Disposition, Content-Security-Policy) and whether the script ran. If it ran: set allowed_mime_types = ARRAY['application/pdf','image/jpeg','image/png','image/webp'] on bucket atendimento in an idempotent migration, restrict p_tipo_mime to the same list and compare it with storage.objects.metadata->>'mimetype', open attachments with createSignedUrl(..., { download: nome }), and set janela.opener = null in ImpressaoProntuario.abrirAnexo (or reuse abrirEmJanela).

## Unescaped consent-form model title (termo.modelo.titulo) is written as HTML into the same-origin print window

Fingerprint: `supabase/functions/_shared/folhas.ts:cabecalho:sub-unescaped`

cabecalho() in the shared A4 sheet builder writes its sub argument into the sheet header without esc(), and termo() passes the stored field termo.modelo.titulo as sub. The field comes from documentos_clinicos.conteudo. Any clinician allowed to act on the patient (2FA plus pode_atuar_no_paciente) can store arbitrary JSON for a termo_consentimento document through the generic public.emitir_documento RPC, whose only content check applies to laudo_aih. A unit gestor can also set a model title limited only by length (3-120 characters) that emitir_termo_consentimento copies into the content. The Termos panel lists every ativo or cancelado termo_consentimento document of the patient, whichever path created it, so a colleague who clicks Imprimir gets HTML from the folha edge function (or the identical client fallback) carrying the stored markup. The SPA writes it with document.write into an about:blank window opened by window.open('', '_blank') without noopener, so the window is same-origin and keeps window.opener to the authenticated app tab; the prontuario copy re-inserts the same body through shadowRoot.innerHTML. The deployed CSP in vercel.json (script-src 'self', no 'unsafe-inline') is expected, per a source comment, to be inherited by that window and to block inline script and event handlers; this is not observed. Markup the CSP does not restrict could still act: inline <style> (style-src allows 'unsafe-inline') could hide or alter server-derived safety content such as the allergy banner or CANCELADO mark on the printed sheet, a <meta http-equiv=refresh> could navigate the print window to an external page that, with no Cross-Origin-Opener-Policy, could retarget window.opener (reverse tabnabbing), and img-src https: permits outbound beacons or dangling-markup capture of following sheet text. If the CSP is not inherited in some browser, event-handler markup would run as script on the app origin. None of these browser behaviours was observed in this run.

**Claimed root cause.** cabecalho() (supabase/functions/_shared/folhas.ts:243-246, mirrored at src/lib/folhas.ts:242-245) concatenates sub into HTML raw and relies on each caller to pre-escape; termo() passes pri(t.modelo?.titulo) unescaped (supabase/functions/_shared/folhas.ts:734; src/lib/folhas.ts:733), and that value is stored verbatim by public.emitir_documento for type termo_consentimento from any user allowed to act on the patient, or from a gestor-chosen model title. The print windows are opened without dropping opener.

**Trace.**

1. entrypoint — `supabase/migrations/20261102000002_aih_ciclo.sql:334` (public.emitir_documento(p_paciente, p_tipo, p_conteudo, p_episodio, p_retifica, p_motivo)): Latest definition, granted to authenticated (line 367). Requires 2FA (line 341) and pode_atuar_no_paciente (line 342); only p_tipo = 'laudo_aih' gets content checks (lines 345-350). The client-supplied p_conteudo is stored through private.gravar_documento_episodio (line 359).
2. propagation — `supabase/migrations/20261001000003_fase7_teleinterconsulta.sql:44` (private.gravar_documento_episodio): Latest full definition: the type allow-list (lines 43-45) includes 'termo_consentimento'; the only content check is non-empty (line 48), and p_conteudo is inserted verbatim. Later migrations only patch the type list (e.g. 20261004000002_parecer_medico.sql:55-58) and the table CHECK still allows termo_consentimento (20270329000001_documento_transferencia.sql:92).
3. propagation — `src/components/termo/AbaTermoConsentimento.tsx:479` (TermoItem Imprimir button): Another staff member viewing the patient's Termos panel clicks Imprimir, calling imprimirDocumento(t.id, 'Termo de consentimento').
4. propagation — `src/lib/prontuario.ts:160` (imprimirDocumento): window.open('', '_blank') opens a same-origin about:blank window without noopener; opener is never set to null.
5. propagation — `src/lib/prontuario.ts:149` (folhaDoDocumentoEmitido): Takes the HTML from the folha edge function (lines 142-146) or, on failure, builds it locally with folhaDoRegistro from the folha_documento RPC result, which returns d.conteudo verbatim (20261005000001_folhas.sql:143) to any printer passing pode_atuar_no_paciente (line 121).
6. propagation — `supabase/functions/folha/index.ts:84` (folha edge handler): Returns html(folhaDoRegistro(data)) using the shared builder, which differs from src/lib/folhas.ts only by a header comment.
7. propagation — `src/lib/folhas.ts:733` (termo()): t = d.termo ?? d (line 702) from the stored JSON; the ficha gets sub: pri(t.modelo?.titulo) with no esc(), while body fields in the same function are escaped.
8. propagation — `src/lib/folhas.ts:245` (cabecalho()): `<span>${sub}</span>` is concatenated raw into the sheet header; unit name and unit line on line 244 do go through esc().
9. sink — `src/lib/prontuario.ts:82` (escrever() via imprimirDocumento() line 170): janela.document.write(html) parses the stored markup in the same-origin print window; janela.print() follows after 300 ms (line 172).

**Evidence.**

- `src/lib/folhas.ts:96`: esc() exists and escapes & < > " ' but is not applied to sub in cabecalho().
- `supabase/functions/_shared/folhas.ts:246`: Server copy of cabecalho() emits ${doc} and ${sub} raw, identical to the client copy.
- `supabase/functions/_shared/folhas.ts:734`: Server copy of termo(): sub: pri(t.modelo?.titulo) with no escaping.
- `supabase/migrations/20261004000004_termo_consentimento.sql:146`: salvar_modelo_termo (gestor or super admin, line 143) checks the model title only for length >= 3; the table CHECK (line 30) is length 3-120 with no character restriction.
- `supabase/migrations/20261022000006_decisoes_rt_termo_idade_parecer.sql:163`: emitir_termo_consentimento copies m.titulo into termo.modelo.titulo of the stored content.
- `supabase/migrations/20270203000006_termo_paliativo_pergunta_surpresa.sql:165`: Latest Termos panel listing selects every termo_consentimento document of the patient in estado ativo or cancelado, regardless of which RPC created it.
- `src/lib/prontuario.ts:60`: Code comment asserts the print window inherits the app CSP (script-src 'self') so inline script does not run: the strongest control against script execution, a browser-behaviour claim not observed here.
- `vercel.json:25`: CSP: script-src 'self' https://challenges.cloudflare.com (no 'unsafe-inline'), style-src includes 'unsafe-inline', img-src 'self' data: blob: https:, base-uri and form-action 'self'; no navigate restriction and no Cross-Origin-Opener-Policy header in the file.
- `src/pages/prontuario/ImpressaoProntuario.tsx:338`: Prontuario copy assigns the parsed sheet body (lido.body.innerHTML, line 340) into a shadow root of a window opened with window.open('', '_blank') (line 271): a second sink for the same value.

**Blockers.**

- No OS-enforced sandbox or local browser on the audit host, so the generated sheet was not rendered and no injected element or effect was observed.
- Whether the document.write'd about:blank print window inherits and enforces the deployed CSP in each browser used by the units decides between script execution on the app origin and HTML/CSS-only injection; this is renderer behaviour, not source-visible.
- Whether a parser-inserted <meta http-equiv=refresh> in the written body (and in the shadow-root innerHTML path) navigates the print window before or despite janela.print(), and whether the resulting cross-origin page can set window.opener.location without COOP, must be observed in the target browsers.
- The deployed response headers on the app origins (CSP as in vercel.json, absence of Cross-Origin-Opener-Policy) are configuration outside source and must be observed by the owner.

**Validation plan.**

- Local: In a sandboxed local build (local Supabase stack, no external network, vercel.json headers served) with a dummy unit, a dummy patient and two dummy clinician accounts on shift for that patient's sector: as clinician A call emitir_documento with p_tipo 'termo_consentimento' and p_conteudo {"termo":{"procedimento":"teste","modelo":{"titulo":"<b id='inj'>X</b><style>.alergia{display:none}</style><meta http-equiv='refresh' content='0;url=https://example.invalid/'><img src=x onerror=\"document.title='js'\">"}}}. As clinician B open the patient's Termos panel and click Imprimir; in the print window observe whether #inj exists as an element, whether the .alergia banner is hidden, whether document.title became 'js', whether navigation to example.invalid is attempted (it fails offline), whether window.opener is non-null, and any CSP violation report. Repeat with the folha function disabled (client fallback) and through the prontuario copy. Regression unit test: montarFolha('termo_consentimento', {termo:{modelo:{titulo:'<b>x</b>'}}}, ctx with emissao {modo:'provisoria', em:'2026-01-01'}) must contain '&lt;b&gt;x&lt;/b&gt;' and not '<b>x</b>'.
- Owner-observed: Owner-observed, no audit traffic: on the homologation app origin read the response headers of index.html and confirm Content-Security-Policy matches vercel.json and Cross-Origin-Opener-Policy is absent. In homologation only, with a test patient, emit a termo whose model title is the harmless marker '<u>teste</u>' and print it from a second test account in each supported browser; check whether the header shows underlined text instead of literal angle brackets and whether DevTools reports the inherited CSP for the print window.

## Chat message bodies readable without the second factor via table GET and Realtime

Fingerprint: `supabase/migrations/20260817000002_fase4_chat.sql:chat_msg_select:no-second-factor`

When configuracao_plataforma.exigir_segundo_fator is true, a session holding only the password (no aal2 TOTP within 24 h and no e-mail-approved session) is meant to see no protected data: the UI renders PortaoSegundoFator and the server's pgrst.db_pre_request hook portao_requisicao rejects every RPC outside a short allowlist, including listar_conversas and enviar_mensagem. However portao_requisicao returns early for GET/HEAD/OPTIONS ('leitura de tabela: decide a RLS'), and public.chat_mensagens has only the permissive participant policy chat_msg_select, with no RESTRICTIVE *_segundo_fator policy in any migration. The table is also in the supabase_realtime publication, and Realtime postgres_changes is not a PostgREST request, so the pre-request hook never runs. A password-only session can therefore read the message bodies (up to 4000 chars) of its own conversations by GET /rest/v1/chat_mensagens and receive new ones over Realtime; for a super admin this includes every 'suporte' conversation. Cross-user isolation is not broken (participant RLS still applies); the gap is the missing assurance-level (2FA) check on this table. The shipped client already subscribes to chat-global at AppShell.tsx:240 before the 2FA gate at line 402, but an attacker with the password can query directly regardless. Whether message bodies carry patient data affects impact, not existence.

**Claimed root cause.** The server 2FA model gates RPCs and writes in portao_requisicao and relies on per-table RESTRICTIVE segundo_fator policies for table reads. chat_mensagens (published to supabase_realtime) never received that policy, so its GET and Realtime read paths are weaker than the RPC path to the same message text.

**Trace.**

1. entrypoint — `src/components/AppShell.tsx:240` (AppShell): useChatRealtimeGlobal() is called unconditionally in the shell, before the 2FA gate return at line 402, so a password-only session opens the Realtime subscription; the same table is equally reachable by any authenticated client calling PostgREST or Realtime directly.
2. propagation — `src/hooks/useChat.ts:188` (useChatRealtimeGlobal): Channel chat-global subscribes to postgres_changes INSERT on public.chat_mensagens with no filter; payload.new carries corpo. useMensagens (line 92) reads the same table, including corpo, by PostgREST GET.
3. propagation — `supabase/migrations/20261023000001_segundo_fator_servidor.sql:134` (public.portao_requisicao): For an authenticated session without private.segundo_fator_ok(), non-/rpc requests with method GET/HEAD/OPTIONS return early, leaving the decision to RLS; the hook is installed as pgrst.db_pre_request (line 143) and so does not apply to Realtime.
4. sink — `supabase/migrations/20260817000002_fase4_chat.sql:97` (policy chat_msg_select on public.chat_mensagens): The only SELECT policy checks conversation participation (or super admin for suporte conversations); there is no private.segundo_fator_ok() term and no RESTRICTIVE segundo_fator policy for this table in any migration, so message bodies reach a password-only session.

**Evidence.**

- `supabase/migrations/20260926000009_fase1_segundo_fator.sql:91`: The RESTRICTIVE *_segundo_fator policy loop lists patient tables only; chat_mensagens appears only in fase4_chat.sql, auditoria_partes_ab.sql (comment) and auditoria_parte_c_indices.sql (index), so no later migration adds a 2FA policy or redefines chat_msg_select.
- `supabase/migrations/20260926000009_fase1_segundo_fator.sql:53`: private.segundo_fator_ok() returns true when exigir_segundo_fator is off, otherwise private.segundo_fator_valido() (aal2 TOTP within 24 h or e-mail-approved session, per 20261022000001_segundo_fator_email.sql:69-75).
- `supabase/migrations/20260817000002_fase4_chat.sql:491`: chat_mensagens is added to the supabase_realtime publication; 20260823000002_auditoria_partes_ab.sql:142 records it as still published.
- `supabase/migrations/20261023000001_segundo_fator_servidor.sql:126`: Pre-2FA RPC allowlist excludes listar_conversas/enviar_mensagem, so the RPC path to the same message text is blocked while the table GET and Realtime paths are not.
- `src/components/AppShell.tsx:402`: UI gate returns PortaoSegundoFator only after hooks, including the Realtime subscription at line 240, have run; the UI gate is UX only.
- `supabase/migrations/20260926000009_fase1_segundo_fator.sql:32`: exigir_segundo_fator is seeded false; whether the target environment turned it on is not in source.

**Blockers.**

- No OS-enforced sandbox or local Supabase stack on the audit host: whether PostgREST GET and Realtime postgres_changes actually deliver chat_mensagens rows to a password-only session (RLS evaluation of chat_msg_select under Realtime, table SELECT grant to authenticated) could not be observed.
- Deployed value of configuracao_plataforma.exigir_segundo_fator and the live policy set on public.chat_mensagens are not in source; with the switch off, segundo_fator_ok() is true and no 2FA boundary exists to bypass.

**Validation plan.**

- Local: In a local Supabase with all migrations applied and exigir_segundo_fator set to true: create two dummy staff in one dummy unit, open a direct conversation via abrir_conversa_direta and have user B (after passing 2FA) send one dummy message. Sign in as user A with password only (aal1, no e-mail approval). Expect GET /rest/v1/chat_mensagens?select=corpo to return B's dummy message and a Realtime postgres_changes INSERT subscription on public.chat_mensagens to deliver a new dummy INSERT, while POST /rest/v1/rpc/listar_conversas fails with SEGUNDO_FATOR. Regression: after CREATE POLICY chat_mensagens_segundo_fator ON public.chat_mensagens AS RESTRICTIVE FOR ALL TO authenticated USING (private.segundo_fator_ok()), both reads return nothing for user A.
- Owner-observed: Owner runs read-only in the homologation database: SELECT valor FROM public.configuracao_plataforma WHERE chave='exigir_segundo_fator'; and SELECT polname, polpermissive FROM pg_policy WHERE polrelid='public.chat_mensagens'::regclass; to confirm whether the switch is on and that no restrictive 2FA policy exists on the table.

