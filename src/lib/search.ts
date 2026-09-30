export function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// A mesma regra da coluna medicamento.principio_ativo_norm (ETL da fase 1):
// sem acento, só letras, números e espaço. A busca de medicamento compara com
// ela para "lidocaina" achar "Lidocaína" (o ilike do Postgres não ignora acento).
export function normalizarMedicamento(texto: string) {
  return normalizar(texto)
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
