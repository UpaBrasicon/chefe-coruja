// Datas civis de Brasília. `toISOString().slice(0, 10)` é a data UTC: das
// 21h à meia-noite de Brasília ela já é "amanhã" (auditoria 27/09).
export function hojeBrasilia(deslocamentoDias = 0): string {
  return new Date(Date.now() + deslocamentoDias * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}
