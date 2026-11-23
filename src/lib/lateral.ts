// Menu lateral aberto ou recolhido (contraste CT3 = A do RT, 23/11/2026): no
// computador o menu abre com o nome de cada item; a pessoa pode recolher, e a
// escolha fica neste aparelho. Sem armazenamento (aba privada, bloqueio), vale
// o padrão: aberto.

const CHAVE = 'cc-lateral-recolhida'

export function lerLateralRecolhida(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) === '1'
  } catch {
    return false
  }
}

export function guardarLateralRecolhida(recolhida: boolean): void {
  try {
    window.localStorage.setItem(CHAVE, recolhida ? '1' : '0')
  } catch {
    // sem armazenamento: a escolha vale só até recarregar
  }
}
