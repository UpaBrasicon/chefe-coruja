export function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function fuzzyMatch(texto: string, consulta: string): boolean {
  const t = normalizar(texto)
  const q = normalizar(consulta).trim()
  if (!q) return true
  if (t.includes(q)) return true
  // sub-strings em ordem (aproximação fuzzy)
  let i = 0
  for (const ch of t) {
    if (ch === q[i]) i++
    if (i === q.length) return true
  }
  return false
}
