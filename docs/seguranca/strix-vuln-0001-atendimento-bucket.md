# Overly Permissive Storage RLS Policies on `atendimento` Bucket Allow Cross-Tenant Clinical Document Access

**ID:** vuln-0001
**Severity:** HIGH
**Found:** 2026-08-20 03:14:00 UTC
**Target:** https://saqjrjtrkzkswsxxvdxn.supabase.co / repository /workspace/chefe-coruja
**Endpoint:** /storage/v1/object/atendimento/
**Method:** GET
**CWE:** CWE-862
**CVSS:** 7.1
**Fix Effort:** Low

## Description

The `atendimento` Supabase Storage bucket, which stores private patient clinical attachments (intake forms, documents), is protected by RLS policies that grant **any authenticated user** unrestricted read and write access to every file in the bucket, with no path-based tenant scoping. A plantonista authenticated to Hospital A can freely download clinical documents belonging to Hospital B, or upload arbitrary files into any tenant's path.

## Evidence

Migration file `supabase/migrations/20260815000012_fase2_bucket_atendimento.sql` lines 11–19 confirm the policies contain only `bucket_id = 'atendimento'` with no path or user scoping. No subsequent migration overrides these policies (confirmed by `grep -rn "atendimento" supabase/migrations/`). The `banners` bucket (migration `20260815000008_fase1_banners.sql`) correctly uses `(regexp_match(name, '^([^/]+)/'))[1]::uuid` to extract and validate the unit from the path — the same pattern is absent from the `atendimento` policies.

## Impact

Any authenticated user (plantonista, gestor, or admin from any organization) can read all files stored in the `atendimento` bucket, regardless of which hospital or patient the documents belong to. This constitutes cross-tenant PHI (Protected Health Information) exposure in violation of LGPD and patient confidentiality requirements. An attacker can also upload arbitrary content (including malicious files) to any tenant's document path.

## Technical Analysis

Migration `20260815000012_fase2_bucket_atendimento.sql` creates two storage policies on `storage.objects` for the `atendimento` bucket:

```sql title=supabase/migrations/20260815000012_fase2_bucket_atendimento.sql startLineNumber=11 endLineNumber=19
DROP POLICY IF EXISTS "atendimento_upload" ON storage.objects;
CREATE POLICY "atendimento_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'atendimento');

DROP POLICY IF EXISTS "atendimento_read" ON storage.objects;
CREATE POLICY "atendimento_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'atendimento');
```

Both policies check **only** `bucket_id = 'atendimento'`. There is no check on `name` (the object path), `auth.uid()`, or any join against `unidades`/`vinculos` tables to verify the caller belongs to the same tenant as the document. The bucket is marked `public = false`, so URL-based access requires authentication — but once authenticated, access is fully open.

By contrast, the `banners` bucket correctly parses the unit UUID from the file path (`(regexp_match(name, '^([^/]+)/'))[1]::uuid`) and validates it against the caller's vinculos. The `atendimento` bucket lacks any equivalent scoping.

No subsequent migration overrides these policies.

## Proof of Concept

1. Log in as User A (e.g., a plantonista authenticated to Unit 1, Organization X).
2. Upload a sensitive clinical document via the Supabase Storage API to the `atendimento` bucket at any path.
3. Log in as User B (a plantonista authenticated to Unit 2, Organization Y — a completely different tenant).
4. Issue a Storage `list` or `download` request authenticated as User B targeting files uploaded by User A:
   `GET /storage/v1/object/atendimento/<any_path>`
5. User B successfully retrieves the document, demonstrating cross-tenant PHI exposure.
6. Conversely, User B can also upload files to paths owned by Organization X (`POST /storage/v1/object/atendimento/org-x/...`).

```python
import httpx

SUPABASE_URL = "https://saqjrjtrkzkswsxxvdxn.supabase.co"

# Step 1: Obtain JWT for User A (Org X) and User B (Org Y)
# (tokens omitted — use normal sign-in flow)
jwt_user_a = "JWT_OF_USER_A"
jwt_user_b = "JWT_OF_USER_B"
anon_key   = "ANON_KEY"

# Step 2: User A uploads a document
upload_path = "orgX-unit1/patient-uuid/admission.pdf"
r = httpx.post(
    f"{SUPABASE_URL}/storage/v1/object/atendimento/{upload_path}",
    headers={"Authorization": f"Bearer {jwt_user_a}", "apikey": anon_key,
             "Content-Type": "application/pdf"},
    content=b"%PDF-sensitive-phi-data",
)
print("Upload status:", r.status_code)  # Expected 200

# Step 3: User B (different org) downloads the same file
r2 = httpx.get(
    f"{SUPABASE_URL}/storage/v1/object/atendimento/{upload_path}",
    headers={"Authorization": f"Bearer {jwt_user_b}", "apikey": anon_key},
)
print("Cross-tenant read status:", r2.status_code)   # 200 = vulnerable
print("Body preview:", r2.content[:40])              # Shows PDF content
```

## Code Analysis

**Location 1:** `supabase/migrations/20260815000012_fase2_bucket_atendimento.sql` (lines 11-19)
  Replace flat-bucket policies with path-scoped, tenant-aware policies

  **Suggested Fix:**
```diff
- DROP POLICY IF EXISTS "atendimento_upload" ON storage.objects;
- CREATE POLICY "atendimento_upload" ON storage.objects
-   FOR INSERT TO authenticated
-   WITH CHECK (bucket_id = 'atendimento');
- 
- DROP POLICY IF EXISTS "atendimento_read" ON storage.objects;
- CREATE POLICY "atendimento_read" ON storage.objects
-   FOR SELECT TO authenticated
-   USING (bucket_id = 'atendimento');
+ DROP POLICY IF EXISTS "atendimento_upload" ON storage.objects;
+ CREATE POLICY "atendimento_upload" ON storage.objects
+   FOR INSERT TO authenticated
+   WITH CHECK (
+     bucket_id = 'atendimento'
+     AND (
+       private.eh_super_admin()
+       OR (
+         -- First path segment must be a unidade_id the caller has access to
+         (regexp_match(name, '^([^/]+)/'))[1]::uuid
+           IN (SELECT private.unidades_gestor_plantonista())
+       )
+     )
+   );
+ 
+ DROP POLICY IF EXISTS "atendimento_read" ON storage.objects;
+ CREATE POLICY "atendimento_read" ON storage.objects
+   FOR SELECT TO authenticated
+   USING (
+     bucket_id = 'atendimento'
+     AND (
+       private.eh_super_admin()
+       OR private.papel_na_unidade(
+            (regexp_match(name, '^([^/]+)/'))[1]::uuid
+          ) IN ('gestor', 'plantonista')
+       OR (regexp_match(name, '^([^/]+)/'))[1]::uuid
+            IN (SELECT private.unidades_gestor_plantonista())
+     )
+   );
```

## Remediation

Replace both flat-bucket policies with path-scoped policies that extract the `unidade_id` from the object name (e.g., first path segment) and verify it against the caller's active vinculos using `private.unidades_gestor_plantonista()` or the escala-aware helpers. Follow the pattern already established for the `banners` bucket. Additionally, enforce a canonical path convention such as `{unidade_id}/{paciente_id}/{filename}` and reject uploads that do not match the caller's allowed units.

## Assumptions

Assumes the attacker is an authenticated user (holds a valid JWT issued by Supabase Auth for this project), which is the standard entry point for any registered plantonista, gestor, or admin.

## Remediation Status: ✅ FIXED (2026-08-20)

Migration `supabase/migrations/20260817000013_fix_atendimento_bucket_rls.sql` replaces the flat policies
with path-scoped ones: the first path segment must be a `unidade_id` the caller has an active
gestor/plantonista vínculo in (`private.unidades_gestor_plantonista()`), or the caller is super admin.
Applied to remote project `saqjrjtrkzkswsxxvdxn` via `supabase db push` and confirmed with a `storage`
schema dump showing all 4 policies (`upload`, `read`, `update`, `delete`) carrying the path check.

```sql
-- Convenção de path agora obrigatória: {unidade_id}/{paciente_id}/{arquivo}
CREATE POLICY "atendimento_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'atendimento'
    AND (
      private.eh_super_admin()
      OR (
        (regexp_match(name, '^([^/]+)/'))[1]::uuid
          IN (SELECT private.unidades_gestor_plantonista())
      )
    )
  );
-- (mesmo padrão em read / update / delete)
```

Both app upload sites (`DadosPaciente.tsx`, `Escala.tsx`) already write to `{unidadeId}/...`, so no
frontend change was needed. DOWN block with the original flat policies is documented in the migration.
