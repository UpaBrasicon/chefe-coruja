// Tempo em minutos para leitura humana (revisão do gestor, RT 24/11/2026:
// "64707 min além do prazo" vira "44 dias além do prazo").

/** 45 → "45 min"; 200 → "3 h 20 min"; 1440 → "1 dia"; 64707 → "44 dias". */
export function minutosLegiveis(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m} min`
  if (m < 24 * 60) {
    const h = Math.floor(m / 60)
    const r = m % 60
    return r ? `${h} h ${r} min` : `${h} h`
  }
  const d = Math.floor(m / (24 * 60))
  return d === 1 ? '1 dia' : `${d} dias`
}

/** Troca, num texto pronto, cada "N min" (N ≥ 60) pela forma legível. */
export function textoComTempoLegivel(texto: string): string {
  return texto.replace(/(\d+)\s?min(utos)?\b/g, (inteiro, n: string) => (Number(n) >= 60 ? minutosLegiveis(Number(n)) : inteiro))
}
