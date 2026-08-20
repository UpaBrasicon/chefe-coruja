# Security Penetration Test Report

**Generated:** 2026-08-20 03:15:29 UTC

# Executive Summary

# Executive Summary

A white-box security assessment was conducted against the **Chefe Coruja** application — a React 19 / TypeScript single-page application backed by Supabase (PostgreSQL + Auth + Edge Functions), targeting Brazilian healthcare shift management. The assessment covered static code review of authentication flows, authorization controls, Row Level Security (RLS) policies, secrets management, and frontend rendering patterns.

**Overall risk posture:** Low-to-moderate. No critical or high-severity vulnerabilities were confirmed during the assessment window. The application demonstrates a security-conscious architecture with well-structured RLS policies, proper use of Supabase's anon key (public by design), and client-side role gates backed by server-side policy enforcement.

**Key observations:**
- RLS is enabled on all tables and policies consistently scope data to `auth.uid()` via `private.meu_perfil_id()` helper functions — no `USING (true)` permissive policies were found.
- The service role key (which bypasses RLS) was **not** found in any client-facing source file.
- Role escalation is explicitly prevented at the database level: the `vinculos_insert` policy enforces `perfil_id <> private.meu_perfil_id()`, blocking self-assignment of roles.
- `.env.local` (containing the Supabase anon key) is correctly listed in `.gitignore` and is not committed to version control. The anon key is intentionally public in Supabase's architecture and is safe to expose.
- Frontend authentication uses Supabase's session management; no custom JWT handling that could introduce algorithm-confusion vulnerabilities was observed.

**Areas requiring follow-up (not confirmed vulnerabilities):**
- The `perfis_update` RLS policy permits users to update their own profile row (`id = auth.uid()`). A deeper review should confirm that sensitive columns (e.g., any role-related fields added in future) are not writable through this policy without column-level restrictions.
- Third-party document parsing libraries (`pdfjs-dist`, `mammoth`, `tesseract.js`, `xlsx`) were not fully audited for known-CVE exposure or malicious-file processing risks within the assessment window.
- No dynamic testing was performed against the live Supabase project; RLS policy correctness should be validated with integration tests that attempt cross-user data access.

# Methodology

# Methodology

**Engagement type:** White-box static analysis of a local codebase.

**Scope:** `/workspace/chefe-coruja` — React/TypeScript SPA with Supabase backend.

**Frameworks followed:** OWASP WSTG (Web Security Testing Guide), OWASP Top 10 (2021).

**Activities performed:**

- Repository structure mapping and technology fingerprinting (React 19, Vite 8, Supabase JS v2, React Router v7, Zod, TanStack Query).
- Authentication and session management review (`AuthContext.tsx`, `RequireAuth.tsx`, `RequireRole.tsx`, `Login.tsx`).
- Authorization and access control review: client-side role gates, `UnidadeContext`, `vinculos` table design.
- Supabase RLS policy audit: all policies in `20260815000003_fase1_rls.sql` reviewed for permissive expressions, missing scoping, and privilege escalation paths.
- Database schema review (`20260815000001_fase1_schema.sql`) for sensitive column exposure.
- Secrets management review: `.env.local`, `.gitignore`, `src/lib/supabase.ts`, `src/lib/api.ts`, `src/lib/constants.ts`.
- Frontend security patterns: search for `dangerouslySetInnerHTML`, `eval`, `innerHTML`, open-redirect vectors, and localStorage usage.
- Dependency inventory review (`package.json`, `package-lock.json`) for high-risk libraries.

**Limitations:**
- No dynamic testing was performed against the live Supabase project (no service role key was present to simulate cross-tenant requests).
- Automated SAST (semgrep), secret scanning (gitleaks/trufflehog), and dependency CVE scanning (trivy/npm audit) were initiated but could not complete within the assessment window.
- Edge Functions and scripts (`/workspace/chefe-coruja/scripts/`) were not fully reviewed.
- The full `src/pages/` component tree was not exhaustively audited for stored XSS vectors in chat/messaging components.

# Technical Analysis

# Technical Analysis

**Severity model:** CVSS v3.1 base score, exploitability × impact.

No confirmed exploitable vulnerabilities were identified in the areas audited. The following summarizes findings and observations by category:

## Authentication & Session Management

The application uses Supabase Auth exclusively. Session tokens are managed by the Supabase JS client (stored in `localStorage` per Supabase defaults). The `AuthContext` correctly reacts to `onAuthStateChange` events and clears local draft data on sign-out (`limparTodosRascunhos()`) — a positive LGPD (Brazilian data protection) consideration for shared hospital workstations. No custom JWT signing, algorithm selection, or token parsing was implemented client-side.

**`RequireAuth`** guards all protected routes by checking `perfil` (loaded from the `perfis` table post-authentication). A loading state prevents flash-of-unauthenticated-content. No bypass path was identified in the reviewed code.

## Authorization & Role-Based Access Control

**`RequireRole`** performs client-side role filtering based on the `vinculos` array fetched from Supabase. Critically, the server-side RLS policies enforce the same restrictions independently, so a client-side bypass would not grant additional data access.

The `vinculos` table separates roles from identity (`perfis`), with roles assigned per healthcare unit. The `vinculos_insert` policy explicitly prevents self-role-assignment: `perfil_id <> private.meu_perfil_id()` combined with an admin-only `WITH CHECK`. This is a correct anti-escalation control.

The `perfis_update` policy allows `id = auth.uid()` — users may update their own profile row. This is standard and appropriate as long as no role-granting columns exist on the `perfis` table (confirmed: roles live in `vinculos`, not `perfis`).

## RLS Policy Quality

All tables reviewed (`organizacoes`, `unidades`, `perfis`, `vinculos`) have RLS enabled and policies that:
- Scope reads to the authenticated user's own data or organizational membership.
- Use `private.*` helper functions (`eh_super_admin`, `eh_admin_da_organizacao`, `meu_perfil_id`, `unidades_do_usuario`) for consistent, reusable security logic.
- Apply no permissive `USING (true)` expressions.
- Implement soft-delete (`ativo = false`) rather than hard DELETE policies for most entities.

## Secrets Management

- The Supabase **anon key** in `.env.local` is intentionally public in Supabase's security model; it grants only the `anon` role's permissions, which are further restricted by RLS. Its presence is not a vulnerability.
- `.env.local` is correctly excluded from version control via `.gitignore`.
- No **service role key** (which would bypass all RLS) was found in any client-facing source file.
- No hardcoded passwords, private keys, or third-party API credentials were identified in the reviewed files.

## Frontend Security Patterns

The application uses React's JSX rendering (no `dangerouslySetInnerHTML` observed in reviewed components). No `eval()` or `new Function()` calls were identified in the reviewed files. The `src/lib/search.ts` and data-fetching hooks use parameterized Supabase queries (`.eq()`, `.filter()`) rather than raw SQL string construction.

## Unaudited Areas (Residual Risk)

- **Chat components** (`Thread.tsx`, `ChatDrawer.tsx`): stored XSS risk if chat messages are rendered as HTML — not fully reviewed.
- **Document parsing** (`mammoth`, `pdfjs-dist`, `tesseract.js`, `xlsx`): malicious file processing risk — library CVE status not confirmed.
- **Edge Functions** and **scripts/**: not reviewed for injection or auth bypass vulnerabilities.
- **`src/pages/public/LinkReceita.tsx`**: public-facing page not audited for XSS or open-redirect vectors.

# Recommendations

# Recommendations

## Immediate

**1. Validate `perfis_update` column scope**
Confirm that the `perfis_update` RLS policy (`USING (id = auth.uid())`) does not inadvertently expose future sensitive columns. Consider adding column-level privileges or a `WITH CHECK` that explicitly restricts which columns a user may update on their own profile to prevent future accidental privilege escalation if a role-related column is ever added to `perfis`.

**2. Audit chat message rendering for stored XSS**
Review `src/components/chat/Thread.tsx` and related components. Ensure chat messages are rendered as plain text (React's default JSX) and never passed to `dangerouslySetInnerHTML`. If rich-text rendering is needed, use a well-maintained sanitization library (e.g., DOMPurify).

## Short-term

**3. Run automated SAST and dependency CVE scans**
Execute the following tools against the full codebase and remediate HIGH/CRITICAL findings:
- `semgrep scan --config p/default --config p/secrets --config p/javascript .`
- `gitleaks detect --source . --report-format json`
- `npm audit --audit-level=high`
- `trivy fs --scanners vuln,misconfig .`

Pay particular attention to `xlsx` (known prototype pollution CVEs), `pdfjs-dist` (frequent CVE target), and `html2canvas`.

**4. Audit `src/pages/public/LinkReceita.tsx`**
This is a publicly accessible page (no authentication required). Audit it thoroughly for reflected XSS via URL parameters, open-redirect vulnerabilities, and any server-side request triggering.

**5. Implement Supabase RLS integration tests**
Write integration tests that attempt cross-user data access (e.g., user A attempts to read or modify user B's `vinculos` or `perfis` rows) to continuously validate RLS correctness. Use `supabase test db` or a test client with different JWT sessions.

**6. Review Edge Functions and scripts/**
The `supabase/functions/` directory and `scripts/` were not audited. Review all Edge Functions for: missing JWT validation, missing authorization checks, SQL injection in raw query construction, and secrets embedded in function code.

## Medium-term

**7. Migrate session storage to `sessionStorage` or short-lived tokens**
Supabase JS v2 defaults to `localStorage` for session persistence. On shared hospital workstations, consider configuring `storageKey` with a session-scoped alternative or enforcing short session expiry to reduce session theft risk if a workstation is left unattended (complementing the existing `limparTodosRascunhos()` on sign-out).

**8. Add a Content Security Policy (CSP) header**
Deploy a restrictive CSP via the Vercel configuration (`vercel.json`) or Supabase Edge Function middleware to reduce XSS impact surface. A starting policy should restrict `script-src` to `'self'` and disallow `'unsafe-inline'`.

## Retest & Validation

After addressing the above items, retest with: dynamic RLS cross-tenant probes against the live Supabase project, a full automated SAST pass, and manual review of all public-facing pages and chat rendering paths.

