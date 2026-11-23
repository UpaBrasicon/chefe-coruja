// Tela "Aguardando liberação" (Fase 1, item 15, P1): a tela confere sozinha se
// o gestor já criou o vínculo e abre o app, sem sair e entrar de novo.

/** De quanto em quanto tempo a tela confere se o vínculo saiu. */
export const INTERVALO_LIBERACAO_MS = 30_000

/** Liberado quando há ao menos um vínculo ativo ou a conta é de super admin. */
export function estaLiberado(vinculosAtivos: number, superAdmin: boolean): boolean {
  return vinculosAtivos > 0 || superAdmin
}
