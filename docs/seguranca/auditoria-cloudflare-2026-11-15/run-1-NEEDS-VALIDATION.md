# Needs validation

Prioritised leads without severity. Do not turn these into live tests against production.

## Password-only session can enroll its own TOTP factor through GoTrue and satisfy the server-side 2FA gate

Fingerprint: `segundo_fator_valido/totp-enroll-at-aal1-bypasses-email-otp`

When configuracao_plataforma.exigir_segundo_fator is true, private.segundo_fator_ok() delegates to private.segundo_fator_valido(), whose last definition accepts either a JWT with aal='aal2' and a TOTP amr entry under 24 h, or a segundo_fator_sessao_ok row for the session (email OTP). Email OTP is the default factor and the authenticator app is optional, so most accounts have no verified TOTP factor. A holder of only the password signs in (aal1) and calls the GoTrue MFA endpoints directly: enroll a TOTP factor, challenge and verify it with a code from an authenticator they control. If GoTrue accepts first-factor enrollment at aal1 (its usual rule when the user has no verified factor), the refreshed JWT is aal2 with amr totp, segundo_fator_valido() returns true, and the pre-request hook, the restrictive policies and the storage policy all pass without the email code. Nothing in the database binds TOTP enrollment to prior second-factor assurance: the auth.mfa_factors trigger only logs a 'totp_ativado' event, the mfa_verification_attempt hook only counts failures, and the pre-request hook only sees PostgREST requests. Accounts reset by zerar_segundo_fator (all factors deleted) are in the same state.

**Claimed root cause.** private.segundo_fator_valido() treats any aal2 JWT with a recent TOTP amr entry as proof of the second factor, without requiring that the TOTP factor was enrolled from a session that had already passed the account owner's email OTP; no database or hook control ties TOTP enrollment or its first verification to a prior segundo_fator_sessao_ok row.

**Trace.**

1. entrypoint — `src/components/seguranca/SegundoFator.tsx:87` (CadastroSegundoFator.iniciar): TOTP enrollment is a direct GoTrue call (supabase.auth.mfa.enroll), followed by supabase.auth.mfa.challengeAndVerify at :101. The same GoTrue /factors calls can be sent by any client holding an aal1 password-only session, outside the UI.
2. propagation — `supabase/migrations/20261003000005_entrada.sql:65` (public.hook_segundo_fator_tentativa): MFA verification-attempt hook (registered at supabase/config.toml:316-318) returns decision 'continue' for any valid code; it only counts failures and never checks factor age or prior email-OTP assurance.
3. propagation — `supabase/migrations/20260926000009_fase1_segundo_fator.sql:38` (private.ultima_verificacao_totp): Reads the latest TOTP timestamp from the JWT amr claim that GoTrue issues after the verify.
4. propagation — `supabase/migrations/20261022000001_segundo_fator_email.sql:72` (private.segundo_fator_valido): Last definition: true for aal2 with a TOTP verification under 24 h, OR an email-verified session; no condition on how or when the TOTP factor was enrolled.
5. sink — `supabase/migrations/20261023000001_segundo_fator_servidor.sql:120` (public.portao_requisicao): segundo_fator_ok() (20260926000009:53-59, which calls segundo_fator_valido when the switch is on) is true, so the pre-request hook returns early; the restrictive storage policy at :150-153 uses the same predicate.

**Evidence.**

- `src/components/seguranca/SegundoFator.tsx:595`: Email code is the default second factor with nothing to configure, so most accounts have no verified TOTP factor.
- `src/components/seguranca/SegundoFator.tsx:604`: The authenticator app is labelled 'Opcional' when no factor exists.
- `supabase/config.toml:335`: TOTP enroll_enabled = true in the checked-in Auth config; deployed Auth settings are not in source.
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

## Unescaped consent-form model title (termo modelo.titulo) is injected as HTML into printed documents, in the folha edge function and the SPA fallback

Fingerprint: `supabase/functions/_shared/folhas.ts:cabecalho:sub-unescaped`

cabecalho() in the shared folha builder writes its sub argument into the page header without escaping. termo() passes the stored field termo.modelo.titulo as sub, unescaped. A clinician who can act on the patient can store arbitrary JSON content for a termo_consentimento document through the generic public.emitir_documento RPC, which accepts any allow-listed type and content without the rules of emitir_termo_consentimento. A unit gestor can also set the title (3-120 characters, no character restriction) through salvar_modelo_termo, and emitir_termo_consentimento copies it into the document content. When another user prints that termo (the 'Imprimir' button in the Termos panel, which lists every termo_consentimento document of the patient, or the prontuario copy), the edge function folha, or the identical client fallback, returns HTML containing the stored markup. The SPA writes it with document.write into a same-origin about:blank window opened without noopener, so window.opener points to the authenticated app tab. The app CSP (script-src 'self', no 'unsafe-inline') is expected to be inherited by that window and to block inline script; this is source-asserted by a code comment, not observed. Markup the CSP does not restrict may still act: a <meta http-equiv=refresh> could navigate the print window to an external page that, without COOP, can retarget window.opener (reverse tabnabbing toward a fake login), inline <style> can hide or rewrite server-derived safety elements of the printed sheet (allergy banner, CANCELADO mark, footer), and https image beacons can load. None of these browser behaviors was observed in this run.

**Claimed root cause.** cabecalho() (supabase/functions/_shared/folhas.ts:243-247, mirrored in src/lib/folhas.ts) concatenates its sub parameter into HTML raw and relies on each caller to pre-escape. termo() passes pri(t.modelo?.titulo) unescaped (supabase/functions/_shared/folhas.ts:734; src/lib/folhas.ts:733), and that value comes from documentos_clinicos.conteudo, which public.emitir_documento stores verbatim for type termo_consentimento from any user allowed to act on the patient.

**Trace.**

1. entrypoint — `supabase/migrations/20261102000002_aih_ciclo.sql:334` (public.emitir_documento(p_paciente, p_tipo, p_conteudo, p_episodio, p_retifica, p_motivo)): Latest definition of the RPC, granted to authenticated (line 367). It requires 2FA (line 341) and pode_atuar_no_paciente (line 342); only laudo_aih gets content checks (lines 345-350). Client-supplied p_conteudo is stored through private.gravar_documento_episodio (line 359).
2. propagation — `supabase/migrations/20261001000003_fase7_teleinterconsulta.sql:43` (private.gravar_documento_episodio): Latest definition. The type allow-list (lines 43-45) includes 'termo_consentimento'; the only content check is non-empty (line 48), and p_conteudo is inserted verbatim (line 82). Alternative writer: salvar_modelo_termo stores a gestor-chosen title limited only by length (20261004000004_termo_consentimento.sql:30,146), and the latest emitir_termo_consentimento copies it into the content (20261022000006_decisoes_rt_termo_idade_parecer.sql:163).
3. propagation — `supabase/migrations/20261005000001_folhas.sql:143` (public.folha_documento): Returns d.conteudo verbatim to the author or to any printer who passes pode_atuar_no_paciente (line 121), for emitted documents (ativo, retificado, assinado, cancelado).
4. propagation — `supabase/functions/folha/index.ts:84` (folha edge handler): Returns html(folhaDoRegistro(data)) built from the folha_documento result. src/lib/prontuario.ts:146-149 calls the same builder client-side when the function fails.
5. propagation — `supabase/functions/_shared/folhas.ts:734` (termo()): lerConteudo JSON-parses the content (1263-1269), montarFolha routes termo_consentimento to termo() (975), t = d.termo ?? d (703), and the ficha gets sub: pri(t.modelo?.titulo) with no esc(), unlike every body field in the same function.
6. propagation — `supabase/functions/_shared/folhas.ts:246` (cabecalho()): `<span>${sub}</span>` is inserted raw into the thead of each ficha (called from pagina() at line 358).
7. sink — `src/lib/prontuario.ts:82` (escrever() via imprimirDocumento()): janela.document.write(html) into the window from window.open('', '_blank') (line 160), opened without noopener so the opener is retained. Reached from the 'Imprimir' button in AbaTermoConsentimento.tsx:479. In the prontuario copy, ImpressaoProntuario.tsx:338-340 assigns the parsed body HTML via innerHTML into a shadow root of a window opened the same way (line 271).

**Evidence.**

- `supabase/functions/_shared/folhas.ts:246`: cabecalho emits ${doc} and ${sub} raw, while the unit name and unit line in the same function go through esc().
- `supabase/functions/_shared/folhas.ts:734`: termo(): sub: pri(t.modelo?.titulo) with no escaping; receita (line 400) and pedidoExames (line 610) pre-escape their stored sub values with esc().
- `src/lib/folhas.ts:733`: The client copy has the same unescaped sub and is the fallback builder in folhaDoDocumentoEmitido.
- `supabase/migrations/20261102000002_aih_ciclo.sql:342`: The only guards before storing arbitrary content are 2FA and pode_atuar_no_paciente; nothing excludes termo_consentimento from the generic path (only copiar_documento excludes termos, per 20261022000005_fix_revisao_segundo_fator_documentos.sql:14-16).
- `supabase/migrations/20261004000004_termo_consentimento.sql:30`: termos_modelos.titulo CHECK is only length 3-120 after trim, with no character restriction.
- `supabase/migrations/20261022000006_decisoes_rt_termo_idade_parecer.sql:276`: The termos panel query lists every ativo or cancelado termo_consentimento document of the patient, whichever path created it, so colleagues see and print it.
- `src/lib/prontuario.ts:160`: window.open('', '_blank') without noopener: the print window keeps window.opener to the authenticated SPA tab; janela.print() follows after 300 ms (line 172).
- `src/lib/prontuario.ts:60`: Code comment states the print window inherits the app CSP (script-src 'self') so inline script does not run. This is the strongest source-visible control against script execution, and it is a claim about browser behavior, not an observation.
- `vercel.json:25`: CSP allows style-src 'unsafe-inline' and img-src https:, restricts form-action and base-uri to 'self', and has no navigation restriction. No Cross-Origin-Opener-Policy header is configured.

**Blockers.**

- No OS-enforced sandbox or local browser on the audit host, so the generated HTML was not rendered and no injected element was observed.
- Decisive browser behavior is not source-visible: (a) whether the about:blank print window inherits and enforces the deployed CSP after document.open/write; (b) whether a parser-inserted <meta http-equiv=refresh> in the written body navigates the print window to an external https URL before or despite janela.print(); (c) whether the navigated cross-origin page can then set window.opener.location without COOP; (d) whether a meta refresh inside the shadow-root innerHTML path (ImpressaoProntuario) is processed at all.
- The deployed response headers on the app origins (CSP as in vercel.json, absence of COOP) are configuration outside source and must be observed by the owner.

**Validation plan.**

- Local: In a sandboxed local build (local Supabase stack, no external network) with a dummy unit, a dummy patient and two dummy clinician accounts on shift for that patient's sector, have clinician A call emitir_documento with p_tipo 'termo_consentimento' and p_conteudo set to the JSON {"termo":{"procedimento":"teste","modelo":{"titulo":"<b id='inj'>X</b><style>.alergia{display:none}</style><meta http-equiv='refresh' content='0;url=https://example.invalid/'>"}}}. As clinician B, open the patient's Termos panel and click Imprimir. In the print window, observe whether #inj exists as an element, whether the .alergia banner is hidden, whether a navigation to example.invalid is attempted (it fails with no network), and whether any CSP violation is reported. Repeat through the prontuario copy (ImpressaoProntuario). Also add a unit test: montarFolha('termo_consentimento', {termo:{modelo:{titulo:'<b>x</b>'}}}, a context with emissao {modo:'provisoria', em:'2026-01-01'}) must not contain the literal '<b>x</b>'.
- Owner-observed: Owner-observed, without audit traffic: on the homologation app origin, read the response headers of index.html and confirm Content-Security-Policy matches vercel.json and Cross-Origin-Opener-Policy is absent. In homologation only, with a test patient, emit a termo whose title is the harmless marker '<u>teste</u>' and print it; check whether the header shows underlined text instead of literal angle brackets.

## Integrator API key IP allowlist decided by the leftmost X-Forwarded-For entry when the edge secret is absent

Fingerprint: `supabase/functions/api/contrato.ts:ipDeOrigem:leftmost-x-forwarded-for`

The api Edge Function computes the client IP that api_v1, api_v1_leitura, api_v1_fhir and api_v1_financeiro compare against api_chaves.ips. ipDeOrigem uses X-Coruja-IP-Cliente only when X-Coruja-Borda equals API_BORDA_SEGREDO; otherwise it returns the leftmost X-Forwarded-For entry. The Cloudflare Worker that supplies the edge proof forwards only GET, so the POST integrations (FHIR Specimen/ImagingStudy/DiagnosticReport for LIS/RIS, ERP financeiro retorno) are documented against the direct Supabase origin, and GET routes are also reachable there. If the Supabase edge gateway preserves a client-sent X-Forwarded-For value as the leftmost hop (appending its own observed address), a holder of a leaked integrator key can send X-Forwarded-For: <an allowlisted IP> from any network and pass the per-key IP allowlist, then read or write within that key's existing unit and resource scope (patient/encounter/bed/billing reads, lab/imaging result posts, ERP reconciliations); api_acessos.ip would record the forged address. Key hash, revocation, expiry, per-key rate limit, resource and unit scope checks are unaffected, so the impact is loss of the IP-list defence-in-depth for a stolen key, not access without a key. If the gateway overwrites the header, the path is safe.

**Claimed root cause.** supabase/functions/api/contrato.ts:156-160 (ipDeOrigem) trusts the leftmost X-Forwarded-For entry as the client address whenever the edge-secret header is absent, instead of failing closed for keys with an IP list or using only a hop appended by the trusted platform proxy; the direct-origin route is a documented, supported path for POST integrations.

**Trace.**

1. entrypoint — `supabase/functions/api/index.ts:153` (portaFhir (same call at index.ts:62 for the GET port and index.ts:89 for portaFinanceiro)): Bearer-key request reaching the function directly on the Supabase origin; ip is computed from request headers with the optional API_BORDA_SEGREDO.
2. propagation — `supabase/functions/api/contrato.ts:157` (ipDeOrigem): Without an x-coruja-borda header equal to the edge secret, the edge-proven X-Coruja-IP-Cliente branch is skipped.
3. propagation — `supabase/functions/api/contrato.ts:159` (ipDeOrigem): Returns xff.split(',')[0].trim(): the leftmost X-Forwarded-For entry, caller-controlled if the platform appends rather than replaces.
4. propagation — `supabase/functions/api/index.ts:194` (portaFhir): The chosen IP is passed as p_ip to api_v1_fhir via the service-role client (same for api_v1/api_v1_leitura at index.ts:66-67 and api_v1_financeiro at index.ts:102-103).
5. sink — `supabase/migrations/20261211000001_api_imagem.sql:188` (public.api_v1_fhir): IP allowlist decision cardinality(c.ips) > 0 AND NOT EXISTS (v_ip <<= i) uses the caller-influenced value; identical checks at 20261104000002_api_integradores.sql:292 (api_v1), 20270120000001_erp_contas.sql:244 (api_v1_financeiro), 20270201000003_api_prescricao_regulacao.sql:104 (api_v1_leitura). These are the only definitions of the four functions.

**Evidence.**

- `supabase/functions/api/contrato.ts:154`: Design comment: without the edge proof, the first X-Forwarded-For IP is used.
- `supabase/functions/api/contrato.test.ts:48`: Unit test asserts that for 'x-forwarded-for: 9.9.9.9, 8.8.8.8' with no edge proof the leftmost 9.9.9.9 is the client IP, so the selection logic needs no further local check.
- `infra/cloudflare/api-worker.js:18`: The Worker rejects every non-GET method with 405, so POST integrations cannot use the edge-proven path.
- `docs/api/README.md:84`: LIS simulator/integration documented against https://<projeto>.supabase.co/functions/v1/api/v1 (direct origin).
- `infra/erp-financeiro.md:34`: ERP routes, including POST .../retorno, documented with base https://<projeto>.supabase.co/functions/v1/api/v1.
- `docs/api/implantacao.md:45`: Deployment doc reasons only about the IP 'that Supabase receives' (Cloudflare's) and does not consider a client-supplied leftmost X-Forwarded-For on direct calls.
- `supabase/functions/pedir-demonstracao/regras.ts:58`: Same leftmost-XFF assumption elsewhere, commented as filled by the Supabase edge; confirms the decisive question is platform header behaviour, not code.
- `supabase/migrations/20261104000002_api_integradores.sql:33`: api_chaves.ips cidr[] is the per-key IP allowlist this value is compared against.

**Blockers.**

- Whether the Supabase Edge Functions gateway in front of the Deno runtime preserves a client-supplied X-Forwarded-For value as the leftmost entry or overwrites the header with the observed peer address is deployment behaviour not visible in the repository, and it alone decides exploitability.

**Validation plan.**

- Owner-observed: Owner-observed on homologation only, never production: using an existing cc_test_ key with an empty ips list, send one GET https://<homolog-ref>.supabase.co/functions/v1/api/v1/unidades directly to the origin with header 'X-Forwarded-For: 192.0.2.10' from the owner's own machine, then read api_acessos.ip for that requisicao id. If it is 192.0.2.10 (or 192.0.2.10 is the first hop), the gateway preserves the client value and the allowlist is bypassable; if it is the owner's real egress or a Cloudflare address, the platform overwrites the header and the candidate should be rejected. Optional confirmation: a cc_test_ key whose ips is only 192.0.2.10/32 returning 200 instead of 403 'IP de origem não liberado' for the same request. Fix direction: in ipDeOrigem return null (fail closed) when the edge proof is absent, or use only a hop the platform is documented to append, and route POST integrations through the Worker with the edge secret.

## Unit-wide UPDATE policy on the 'atendimento' bucket lets a gestor/plantonista with the record open overwrite or move registered prontuario attachments, bypassing the 20-year retention guard

Fingerprint: `supabase/migrations/20260817000013_fix_atendimento_bucket_rls.sql:atendimento_update:unit-wide-overwrite-move-bypasses-guarda`

The 20-year retention migration states that prontuario attachments in bucket 'atendimento' may only be deleted by the super admin, and narrows atendimento_delete accordingly. It leaves the permissive atendimento_update policy from 20260817000013 untouched; no later migration drops or narrows it. That policy lets any user with an active gestor or plantonista vinculo in the unit named in the first path segment UPDATE any object under that unit, with no restriction on subfolder, owner, or new name. The only extra restriction on '<unit>/<patient>/prontuario/' objects is the RESTRICTIVE FOR SELECT policy atendimento_prontuario_sigilo, which requires a record-open log entry from the last 12 hours (private.prontuario_aberto). Opening the record (abrir_prontuario -> gravar_acesso) itself requires pode_atuar_no_paciente or a break-glass/teleinterconsulta grant and is logged. So the lower-trust actor is an insider of the unit (gestor or plantonista) who can legitimately open patient P's record. Within that window, Storage API upsert (x-upsert: true) or move on an existing attachment path would be authorized by atendimento_update plus the satisfied SELECT policy. An upsert replaces the bytes of an attachment already registered in anexos_prontuario. That table is append/cancel-only, but it stores only path, name, declared MIME and size, with no content hash, so the swap is not detectable from the clinical record. Only storage.objects metadata (updated_at, version, owner) would change, and the previous version is discarded. A move out of '<unit>/<patient>/prontuario/' leaves anexos_prontuario.caminho dangling (a de facto deletion contrary to the guard). It also places the file where atendimento_prontuario_sigilo no longer applies, so any gestor/plantonista of the unit could read it through atendimento_read without a record-open log. The application never needs UPDATE: the only client write to prontuario attachments uses upsert:false. The same unit-wide grant covers '<unit>/justificativas/' objects. There, the restrictive SELECT policy limits upsert/move to the owner or the unit gestor. Whether the hosted storage-api evaluates exactly these policies for upsert and move, and whether the deployed policies match the migrations, is not observable from source.

**Claimed root cause.** Policy disagreement in the guard lifecycle. 20261001000004 restricts atendimento_delete to the super admin, but the permissive atendimento_update (20260817000013:42-63) still grants UPDATE on every 'atendimento' object to any gestor/plantonista of the path's unit. It does not confine the update to the object's owner, its subfolder, or the immutable prontuario folder. The registered anexos_prontuario row (append/cancel-only) has no content hash binding it to the stored bytes.

**Trace.**

1. entrypoint — `supabase/migrations/20260817000013_fix_atendimento_bucket_rls.sql:42` (storage.objects policy atendimento_update): Permissive FOR UPDATE TO authenticated. USING and WITH CHECK only require bucket_id='atendimento' and a first path segment in private.unidades_gestor_plantonista() (or super admin). Reached through Storage API upsert/update/move by a gestor/plantonista JWT that passes storage_segundo_fator.
2. propagation — `supabase/migrations/20260815000007_fase1_fix_admin_leitos.sql:11` (private.unidades_gestor_plantonista): Returns every unit where the caller has an active gestor or plantonista vinculo. It binds no patient, sector, owner or subfolder.
3. propagation — `supabase/migrations/20261005000003_documentos_estados.sql:347` (storage.objects policy atendimento_prontuario_sigilo): RESTRICTIVE FOR SELECT only. It requires private.prontuario_aberto for the patient in segment 2, which a gestor/plantonista who opened the record within 12 hours satisfies. It stops applying once the object name no longer matches '^uuid/uuid/prontuario/'. No restrictive UPDATE policy exists.
4. propagation — `supabase/migrations/20261005000003_documentos_estados.sql:366` (public.registrar_anexo_prontuario): Registers the attachment by path only: unit/patient/prontuario prefix, existence in storage.objects, declared MIME and size. No content hash is stored, so a later byte replacement is not detectable from the clinical record.
5. sink — `supabase/migrations/20261001000004_fase8_guarda_20_anos.sql:70` (storage.objects policy atendimento_delete (guard)): The guard narrows only DELETE to the super admin. It neither revokes nor narrows atendimento_update, so overwrite and move can still destroy or relocate registered attachment content, contrary to the guard's stated invariant at line 15.

**Evidence.**

- `supabase/migrations/20261001000004_fase8_guarda_20_anos.sql:15`: Stated invariant: prontuario attachments in bucket 'atendimento' may only be deleted by the super admin.
- `supabase/migrations/20260817000013_fix_atendimento_bucket_rls.sql:42`: atendimento_update is the only UPDATE policy for this bucket in source (repository-wide grep finds no later DROP or redefinition).
- `supabase/migrations/20261005000003_documentos_estados.sql:314`: anexos_prontuario is placed under the delete guard and the cancel-only update trigger, so the design intends attachments to be immutable records.
- `supabase/migrations/20260926000012_fase1_consulta_impressao_servidor.sql:116`: private.prontuario_aberto is satisfied by any leitura_prontuario log row from the caller for that patient in the last 12 hours, so it opens a 12-hour window.
- `supabase/migrations/20261001000003_fase7_teleinterconsulta.sql:290`: gravar_acesso (used by abrir_prontuario) requires pode_atuar_no_paciente or a break-glass/teleinterconsulta grant, so the actor must be an insider able to open the patient's record; the opening is logged, the later overwrite/move is not audited by the application.
- `supabase/migrations/20261023000001_segundo_fator_servidor.sql:150`: storage_segundo_fator is the only other restrictive storage policy; it requires a valid second factor and does not restrict UPDATE scope.
- `src/pages/prontuario/ImpressaoProntuario.tsx:222`: The only client write to prontuario attachments uses upsert:false, so the application does not need the UPDATE grant.
- `supabase/migrations/20270208000004_escala_atestado_falta.sql:66`: The restrictive sigilo policy for '<unit>/justificativas/' is SELECT-only, so the unit-wide UPDATE grant also reaches employee atestados for the unit gestor (and for the owner).

**Blockers.**

- No OS-enforced sandbox and no local Supabase stack (Postgres + storage-api) are available on the audit host, so the upsert and move outcomes could not be observed.
- The storage-api source is not in this repository. Source alone cannot show which RLS checks the hosted storage-api applies to upsert (INSERT ... ON CONFLICT DO UPDATE with RETURNING), update and move, including whether it evaluates source-row SELECT policies or adds its own checks. CI pins storage-api v1.60.0, but the hosted version is unknown.
- It is not observable from source whether the storage policies or bucket settings in the deployed projects (homolog and production) were changed outside the migrations, for example in the dashboard.

**Validation plan.**

- Local: In a sandboxed local Supabase stack without network (storage-api v1.60.0 as in CI), apply the migrations and seed. Create dummy unit U, dummy patient P in a sector where dummy plantonista X is scheduled (so pode_atuar_no_paciente is true), dummy plantonista Y of U not scheduled for P, and a dummy gestor G of U, each with a valid second factor. As X, call abrir_prontuario(P), upload '<U>/<P>/prontuario/a.pdf' with upsert:false, and call registrar_anexo_prontuario. Then, as X: (1) upload different bytes to the same path with x-upsert: true; (2) call POST /storage/v1/object/move from that path to '<U>/outro/a.pdf'. If vulnerable, expect: (1) 200, changed bytes on a later signed download, and the anexos_prontuario row unchanged; (2) 200, the original path gone, and Y (who never opened P's record) able to download '<U>/outro/a.pdf'. Repeat (1) as G after G opens the record, and as X without opening the record (expected to fail, which confirms the SELECT dependency). Then drop atendimento_update and confirm that both calls fail with an RLS error. Stop at the first observed overwrite or move.
- Owner-observed: Owner-observed only, on homologation: in the Supabase dashboard, list the policies on storage.objects that apply to bucket 'atendimento'. Confirm whether atendimento_update exists with the unit-wide predicate and whether any restrictive UPDATE policy exists, and note the hosted storage-api version. Send no audit traffic and do not probe production.

## Invite codes can be guessed through aceitar_convite (and the signUp trigger) without the brute-force throttle that protects conferir_convite

Fingerprint: `supabase/migrations/aplicar_primeiro_acesso:invite-code-guess-without-attempt-limit`

Invite codes (CC- plus 5 symbols from a 31-symbol alphabet, about 28.6M values with a slight modulo bias toward the first 8 symbols, globally unique across all units, valid up to 30 days) grant an ACTIVE vinculo with the invite's role (any role except admin/gestor: plantonista, enfermeiro, tecnico_enfermagem, farmaceutico, recepcao, telemedicina, etc.) in the inviting unit. After the pentest, the anon check RPCs (conferir_convite, pedir_novo_convite, conferir_contrato) consult private.primeiro_acesso_bloqueado (per-origin 10/15 min plus a header-independent global breaker of 120 failures/5 min) and record failures. The state-changing consume path does not: public.aceitar_convite, executable by any authenticated account and allow-listed before 2FA by the PostgREST pre-request hook portao_requisicao, forwards the caller-chosen code to private.aplicar_primeiro_acesso. That function looks the code up across all units, raises 'Convite nao confere.' on a miss and a different message for used/revoked/expired codes, and on a hit (after identity checks the caller satisfies with its own profile data and the current termo version) inserts an active vinculo for the caller in the invite's unit and marks the invite used, consuming the legitimate invitee's code. It never calls primeiro_acesso_bloqueado or registrar_tentativa_primeiro_acesso, and failed attempts roll back with the exception, so nothing is recorded. The later rewrite in 20270209000008 only swaps current_date and adds no throttle. An existing low-privilege account (an insider, or an account created through a guessable contract code) can therefore iterate codes limited only by whatever request rate limiting exists outside the database; with k live invites the expected work is about 28.6M/k calls, and a hit lands the caller in an arbitrary (not chosen) unit. Successful acceptances are written to log_auditoria. Variant with the same root cause: GoTrue signUp with raw_user_meta_data.codigo_convite reaches the same function through the auth.users AFTER INSERT trigger with no DB-side throttle; there the only barriers are Auth captcha/rate limits, which are deployment configuration (local config.toml: captcha commented out, sign_in_sign_ups = 30 per 5 min per IP), making that variant far slower than the RPC path.

**Claimed root cause.** private.aplicar_primeiro_acesso (and its callers public.aceitar_convite and the auth.users AFTER INSERT trigger private.primeiro_acesso_no_cadastro) validate and consume the invite code without calling private.primeiro_acesso_bloqueado or private.registrar_tentativa_primeiro_acesso, so the brute-force control exists only on the read-only check RPCs and not on the state-changing consume path.

**Trace.**

1. entrypoint — `supabase/migrations/20261003000001_convites_primeiro_acesso.sql:748` (public.aceitar_convite(p_codigo, p_termo_versao, ...)): SECURITY DEFINER RPC granted to authenticated (line 783); only requires auth.uid() IS NOT NULL and a non-blank code (lines 759-764). Not redefined by any later migration.
2. propagation — `supabase/migrations/20261023000001_segundo_fator_servidor.sql:130` (public.portao_requisicao()): PostgREST db_pre_request hook (line 143) allow-lists /rpc/aceitar_convite for authenticated callers without a valid second factor; it applies no rate limit.
3. propagation — `supabase/migrations/20261003000001_convites_primeiro_acesso.sql:765` (public.aceitar_convite): Forwards the caller-chosen code, the caller's auth.uid() and email to private.aplicar_primeiro_acesso with no throttle check or attempt recording.
4. propagation — `supabase/migrations/20261003000001_convites_primeiro_acesso.sql:527` (private.aplicar_primeiro_acesso): Global lookup of the code in public.convites (any unit); line 528 raises 'Convite nao confere.' on a miss and line 531 a distinct message for used/revoked/expired; the function (lines 499-619) never calls primeiro_acesso_bloqueado or registrar_tentativa_primeiro_acesso.
5. sink — `supabase/migrations/20261003000001_convites_primeiro_acesso.sql:598` (private.aplicar_primeiro_acesso): On a hit, inserts (or reactivates) an active public.vinculos row for the caller with the invite's unidade_id and papel, then marks the invite used (line 602) and writes log_auditoria.

**Evidence.**

- `supabase/migrations/20261018000001_correcoes_pentest.sql:26`: Strongest control: primeiro_acesso_bloqueado with per-origin (10/15 min) and global (120 failures/5 min) breaker, documented as the fix against enumerating invite codes; it is referenced only by conferir_convite, pedir_novo_convite and conferir_contrato.
- `supabase/migrations/20261003000001_convites_primeiro_acesso.sql:400`: conferir_convite checks the breaker and records failures without raising (lines 406, 414); aplicar_primeiro_acesso has no equivalent.
- `supabase/migrations/20261003000001_convites_primeiro_acesso.sql:293`: 31-symbol alphabet; codes built from 5 random bytes mod 31 (lines 318-322), about 28.6M values shared by all units; validity 1-30 days.
- `supabase/migrations/20270209000008_menores_datas.sql:42`: Only later change to aplicar_primeiro_acesso: text substitution of current_date by private.data_atual(); no throttle added.
- `supabase/migrations/20261003000009_cadastro_so_por_convite.sql:22`: SignUp variant: the BEFORE INSERT trigger parks metadata containing codigo_convite; private.primeiro_acesso_no_cadastro (20261003000001_convites_primeiro_acesso.sql:713) then calls aplicar_primeiro_acesso, again without the breaker.
- `supabase/config.toml:208`: Only Auth-level throttle visible in source is sign_in_sign_ups = 30 per 5 min per IP, with captcha commented out (line 215); it covers signUp, not PostgREST RPC calls. Production Auth settings and any PostgREST/gateway rate limit are not in source.

**Blockers.**

- No OS-enforced sandbox or local Supabase stack on the audit host, so the bounded RPC loop against a dummy invite could not be executed and observed.
- Whether the deployed Supabase API gateway or PostgREST applies any per-user or per-IP rate limit to /rest/v1/rpc/aceitar_convite is a deployment fact not visible in source; together with the typical number of live invites it decides attempts-per-hour and therefore realistic likelihood.
- For the signUp variant, whether hosted Auth enforces Turnstile captcha and which signup rate limit is configured in production is not visible in source.

**Validation plan.**

- Local: On a local Supabase stack, or via the supabase/tests harness inside a transaction that is rolled back: create a dummy unit, a dummy gestor and one valid invite via gerar_convite; create a dummy authenticated profile with a valid test CPF and birth date. As that user (simulated JWT claims), call public.aceitar_convite 200 times with distinct wrong CC-XXXXX codes and the current private.termo_uso_versao(); expect every call to fail with 'Convite nao confere.', none to return a throttle error, and private.tentativas_primeiro_acesso to gain no rows (contrast: 120+ wrong conferir_convite calls return 'muitas_tentativas'). Then call with the valid code and confirm a new active public.vinculos row for the dummy profile in the dummy unit and convites.usado_em set. Regression test for the fix: the 200-wrong-code loop must start failing with the throttle error, with attempts recorded in a way that survives the failing call's rollback.
- Owner-observed: Owner-observed only, no probing: in the Supabase project settings, record whether any API/PostgREST rate limiting applies to authenticated RPC routes such as /rest/v1/rpc/aceitar_convite, whether Auth captcha (Turnstile) is enforced on signUp, the configured sign-up rate limit, and the typical count of simultaneously valid invites (SELECT count(*) FROM public.convites WHERE usado_em IS NULL AND revogado_em IS NULL AND expira_em > now()).

## Organization admin can reset another tenant user's second factor and end all their sessions by first attaching a vinculo to them

Fingerprint: `zerar_segundo_fator/unilateral-vinculo-satisfies-reset-guard`

public.zerar_segundo_fator authorizes a non-super-admin caller when the target has any active vinculo in a unit where the caller's papel_na_unidade is gestor or admin. The vinculos_insert RLS policy (and vinculos_update for reactivation) lets an organization admin create an active vinculo for any perfil_id other than their own in any unit of their organization, with no acceptance by the target and no requirement of a prior relationship; the client flow in src/lib/api.ts upserts directly through PostgREST. An admin of organization A who knows the UUID of a user of organization B can therefore insert (or reactivate) a vinculo for that user in an A unit, call zerar_segundo_fator, and delete the victim's TOTP factors, trusted devices, recovery codes, second-factor session approvals and every auth.sessions row, forcing a cross-tenant logout and stripping the victim's enrolled factors until re-enrollment. The admin can then set the vinculo to ativo=false. Only super admins are protected. Whether this practically reaches a victim who never had a vinculo in A depends on how the admin learns the victim's UUID, which source does not establish.

**Claimed root cause.** The reset guard's authorization predicate (target has an active vinculo in a unit where the caller is gestor/admin) is satisfied by a row the caller can write unilaterally: vinculos_insert/vinculos_update require only that the caller be admin of the unit's organization and that the row is not their own, so 'the person's unit' is not an authenticated, pre-existing relationship.

**Trace.**

1. entrypoint — `supabase/migrations/20260815000003_fase1_rls.sql:138` (policy vinculos_insert on public.vinculos): POST /rest/v1/vinculos by an authenticated org admin with perfil_id=<victim of another org>, unidade_id=<own unit>; WITH CHECK only requires perfil_id <> caller and eh_admin_da_organizacao for the unit's organization. No later migration redefines the policy or revokes INSERT on vinculos.
2. propagation — `supabase/migrations/20260815000001_fase1_schema.sql:84` (public.vinculos.ativo): ativo defaults to true, so the inserted vinculo is immediately active; the only BEFORE INSERT trigger (20261116000002:73) restricts network roles only.
3. propagation — `supabase/migrations/20270208000019_papel_mais_forte.sql:23` (private.papel_na_unidade): Returns the caller's strongest active papel in the unit ('admin' for the attacking org admin in their own unit); latest definition in source.
4. propagation — `supabase/migrations/20261023000001_segundo_fator_servidor.sql:304` (public.zerar_segundo_fator guard): Selects any active vinculo of p_usuario in a unit where the caller's papel is gestor/admin; the just-inserted vinculo satisfies it, so v_unidade is non-null and the guard passes (caller must already satisfy their own 2FA, motive of at least 10 chars, target not self and not super admin).
5. sink — `supabase/migrations/20261023000001_segundo_fator_servidor.sql:315` (public.zerar_segundo_fator reset): Deletes the victim's auth.mfa_factors, dispositivos_confiaveis, recovery codes and failures, segundo_fator_sessao_ok, pending email code, attempt counters and all auth.sessions (:315-322).

**Evidence.**

- `supabase/migrations/20261023000001_segundo_fator_servidor.sql:16`: Owner decision: only the gestor of the person's unit or the super admin may reset. A unit attachment created by the resetter moments before does not fit that intent.
- `supabase/migrations/20260815000002_fase1_funcoes.sql:70`: orgs_admin() derives org-admin status from any active 'admin' vinculo in an active unit of that organization: a per-tenant role, not a platform role; eh_admin_da_organizacao (:86) wraps it.
- `supabase/migrations/20260815000003_fase1_rls.sql:153`: vinculos_update has the same predicate, so an org admin can also reactivate an inactive vinculo of former staff who now work in another organization.
- `supabase/migrations/20260823000002_auditoria_partes_ab.sql:79`: Current perfis_select: org admins see perfis with any vinculo (active or not) in their org, and (:92) perfis with no active vinculo at all for admins of any org. A victim with an active vinculo only in another org is not visible, so UUID discovery for that case is not shown by source.
- `src/lib/api.ts:31`: Designed admin flow upserts vinculos directly through PostgREST with ativo=true; the 'vinculo_criado' audit entry is written client-side afterwards, so a direct POST leaves only the server-side 'segundo_fator_zerado' audit.
- `supabase/tests/fase0_segundo_fator_servidor.sql:269`: Tests cover only a legitimate same-unit gestor reset; there is no case for a vinculo created just before the reset or for a target belonging to another organization.

**Blockers.**

- No OS-enforced sandbox or local Supabase stack on the audit host, so the RLS insert followed by the RPC call could not be executed and observed locally.
- How an admin of organization A obtains the perfil UUID of a user whose only active vinculo is in organization B is not established by source (perfis_select hides such perfis); this decides realistic likelihood beyond former or shared staff.
- Whether the deployed homologation/production pg_policies for public.vinculos still match 20260815000003, and whether more than one organization with separate admins exists, is not visible in source.

**Validation plan.**

- Local: In an isolated local Supabase stack, inside a transaction that is rolled back (as supabase/tests do): seed org A with unit UA and admin user AA (admin vinculo in UA, second factor satisfied for the session), and org B with unit UB and gestor GB (vinculo only in UB) holding a verified dummy TOTP row in auth.mfa_factors and one auth.sessions row. SET ROLE authenticated with request.jwt.claims sub=AA, run INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES (GB, UA, 'tecnico_enfermagem'), then SELECT public.zerar_segundo_fator(GB, 'teste de reset entre organizacoes'). Confirmed if both statements succeed and GB has no rows left in auth.mfa_factors or auth.sessions; refuted if the insert or the RPC raises an RLS violation or insufficient_privilege.
- Owner-observed: Owner, read-only on homologation: SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='vinculos'; confirm vinculos_insert and vinculos_update still accept any perfil_id other than the caller for org admins. Also SELECT count(*) FROM public.organizacoes to confirm multi-tenant use, and review log_auditoria rows with acao='segundo_fator_zerado' whose target's vinculo in that unit was created shortly before the reset.

