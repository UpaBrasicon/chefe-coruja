// ─────────────────────────────────────────────────────────────────────────────
// Conversores de tipos para payloads das tabelas de terminologia.
// CSVs vêm como string; convertemos para o tipo SQL esperado, com tolerância
// a valores vazios ("", "NA", "-", "null") → null.
// ─────────────────────────────────────────────────────────────────────────────

export function vazio(v: unknown): boolean {
  if (v === null || v === undefined) return true
  const s = String(v).trim()
  return s === '' || s === '-' || s === 'NA' || s === 'N/A' || s === 'null' || s === 'NULL'
}

export function texto(v: unknown): string | null {
  if (vazio(v)) return null
  return String(v).trim()
}

export function inteiro(v: unknown): number | null {
  if (vazio(v)) return null
  const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10)
  return Number.isNaN(n) ? null : n
}

export function numero(v: unknown): number | null {
  if (vazio(v)) return null
  const n = parseFloat(String(v).replace(',', '.').replace(/[^0-9.-]/g, ''))
  return Number.isNaN(n) ? null : n
}
