// ─────────────────────────────────────────────────────────────────────────────
// HERMES — lib/telefone.ts
// Normalização de telefone para E.164 (sem o '+', igual ao wa_id da Meta).
//
// A Meta entrega o wa_id SEM '+', ex.: "5511999990001". O banco (perfis.telefone)
// pode conter formatos variados ("(11) 99999-0001", "+55 11 99999-0001",
// "5511999990001", "011999990001"...). Esta função normaliza AMBOS os lados
// para um formato canônico comparável.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove tudo que não seja dígito.
 * Ex.: "(11) 99999-0001" → "11999990001"
 */
export function soDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/**
 * Normaliza um telefone brasileiro para o padrão E.164 completo sem '+':
 * código do país (55) + DDD + número, com 8 ou 9 dígitos no número local.
 *
 * Regras (Brasil):
 *  - Se já começa com 55 e tem 12-13 dígitos → assume E.164 (mantém).
 *  - Se começa com 0 (DDD com zero à esquerda) → remove o 0.
 *  - Se tem 10-11 dígitos → é DDD + número nacional → prefixa 55.
 *  - Senão → retorna null (formato não reconhecido).
 *
 * Ex.:
 *   "(11) 99999-0001"      → "5511999990001"
 *   "+55 11 99999-0001"    → "5511999990001"
 *   "011 99999-0001"       → "5511999990001"
 *   "5511999990001"        → "5511999990001"
 *   "99999-0001" (7 díg.)  → null
 */
export function normalizarE164BR(valor: string): string | null {
  const d = soDigitos(valor)
  if (d.length === 0) return null

  // Zero à esquerda (0 + DDD + número → 11-12 dígitos): remove o 0
  // e prefixa o DDI. Precisa vir ANTES do branch E.164, senão um número
  // com DDD "0xx" de 12 dígitos cairia no branch de 12-13 dígitos.
  if ((d.length === 11 || d.length === 12) && d.startsWith('0')) {
    return `55${d.slice(1)}`
  }

  // Já em E.164 (55 + DDD + número)
  if (d.length === 12 || d.length === 13) {
    return d.startsWith('55') ? d : null
  }

  // DDD + número nacional sem zero
  if (d.length === 10 || d.length === 11) {
    return `55${d}`
  }

  return null
}

/**
 * Compara um telefone armazenado (qualquer formato) com um wa_id da Meta,
 * ambos normalizados. Retorna true se corresponderem.
 */
export function telefoneCorrespondeWaId(armazenado: string, waId: string): boolean {
  const a = normalizarE164BR(armazenado)
  const b = soDigitos(waId)
  if (!a) return false
  // wa_id pode vir sem '+' e sem DDI em alguns casos — compara pelo
  // número nacional (últimos 10-11 dígitos) como fallback.
  if (a === b) return true
  if (b.length >= 10) return a.endsWith(b.slice(-10)) || a.endsWith(b.slice(-11))
  return false
}
