// A faixa de notificações do turno, no topo da casca do plantonista. Num dia
// movimentado (regulação, exames, turno) a pessoa acumula dezenas; listar
// todas empurrava a Central para baixo (achado 4 da conferência de 07/11/2026).
// A faixa mostra só as mais novas e conta as outras.

export const MAX_NA_FAIXA = 3

export function faixaDeNotificacoes<T extends { created_at: string }>(lista: readonly T[], max = MAX_NA_FAIXA) {
  const ordenada = [...lista].sort((a, b) => b.created_at.localeCompare(a.created_at))
  return { visiveis: ordenada.slice(0, max), outras: Math.max(0, ordenada.length - max) }
}

export function rotuloDasOutras(n: number) {
  return `e mais ${n} ${n === 1 ? 'notificação' : 'notificações'}`
}
