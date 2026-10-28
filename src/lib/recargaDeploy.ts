// Recarga depois de um deploy (main.tsx, evento 'vite:preloadError'): uma aba
// aberta pede um pedaço do código (chunk) que não existe mais e recarrega para
// pegar o index.html novo. Antes recarregava uma vez por sessão; com duas
// publicações seguidas a aba ficava quebrada até recarregar à mão (homologação,
// 28/10/2026). Agora recarrega a cada versão nova, com uma trava de tempo: se a
// última recarga foi há pouco, o erro é de verdade e não vira laço.

/** Intervalo mínimo entre duas recargas automáticas. */
export const INTERVALO_RECARGA_MS = 30_000

/** Recarrega se nunca recarregou nesta sessão ou se a última recarga já passou do intervalo. */
export function deveRecarregar(ultimaRecarga: string | null, agora: number): boolean {
  if (!ultimaRecarga) return true
  const quando = Number(ultimaRecarga)
  // marca antiga ('1') ou estragada: conta como recarga velha
  if (!Number.isFinite(quando)) return true
  return agora - quando > INTERVALO_RECARGA_MS
}
