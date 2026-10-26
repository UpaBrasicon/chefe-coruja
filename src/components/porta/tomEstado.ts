import type { TomEstado } from './Estado'

/** Tom do ponto + texto para quem ainda guarda a variante do selo antigo. */
export function tomDaVariante(variante: string | null | undefined): TomEstado {
  switch (variante) {
    case 'success': return 'verde'
    case 'warning': return 'ambar'
    case 'destructive': return 'vermelho'
    case 'info': return 'teal'
    default: return 'cinza'
  }
}
