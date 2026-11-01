/**
 * Início do turno no horário de Brasília (UTC−3, sem horário de verão), igual a
 * `private.inicio_do_turno`: manhã 07 h, tarde 13 h, noite 19 h, madrugada 01 h.
 */
const HORA_DO_TURNO: Record<string, string> = { manha: '07:00', tarde: '13:00', noite: '19:00', madrugada: '01:00' }

export function inicioDoTurno(data: string, turno: string): Date {
  return new Date(`${data}T${HORA_DO_TURNO[turno] ?? '07:00'}:00-03:00`)
}

/**
 * B3 (RT, 31/10/2026, "Aceita como retroativo"): escalar um plantão que já
 * começou vale, só pelo gestor, e fica como acerto retroativo no histórico
 * (`adicionar_plantao_escala`). A tela avisa antes de confirmar.
 */
export function ehRetroativo(data: string, turno: string, agora: number): boolean {
  return inicioDoTurno(data, turno).getTime() <= agora
}
