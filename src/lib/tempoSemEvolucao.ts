/**
 * Tempo sem evolução do pedido de regulação, para a tela: até 47 h em horas
 * ("26 h"); a partir de 48 h em dias e horas ("44 d 15 h"), porque "1071 h"
 * não se lê de relance (conferência com login, RT 25/11/2026).
 */
export function tempoSemEvolucao(horas: number | null | undefined): string {
  if (horas == null || !Number.isFinite(horas)) return '—'
  const h = Math.max(0, Math.floor(horas))
  if (h < 48) return `${h} h`
  return `${Math.floor(h / 24)} d ${h % 24} h`
}
