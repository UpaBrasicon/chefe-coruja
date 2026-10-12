// CID-10 digitado pelo médico, no mesmo formato que o banco grava
// (private.cid_normalizado): K359 vira K35.9; categoria de 3 caracteres vale.
// Devolve null quando não é um código (texto livre, formato errado).

export function normalizarCid(texto: string): string | null {
  const c = texto.replace(/\s/g, '').toUpperCase()
  if (/^[A-Z]\d{2}$/.test(c)) return c
  if (/^[A-Z]\d{2}\.[0-9A-Z]{1,2}$/.test(c)) return c
  if (/^[A-Z]\d{3,4}$/.test(c)) return `${c.slice(0, 3)}.${c.slice(3)}`
  return null
}
