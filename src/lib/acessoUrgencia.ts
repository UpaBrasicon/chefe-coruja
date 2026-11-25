// Acesso de urgência ao prontuário, a "quebra de vidro" (ajustes da revisão,
// item 6, RT em 24/11/2026; migration 20270421000075). O médico abre na hora,
// sem esperar o gestor: só leitura, por 2 horas, com justificativa de pelo
// menos 20 letras. O banco confere tudo de novo (abrir_acesso_urgencia).

export const MIN_LETRAS_URGENCIA = 20
export const HORAS_URGENCIA = 2

/** Quantas letras a justificativa tem (números, espaços e sinais não contam). */
export function letrasDaJustificativa(texto: string): number {
  return (texto.match(/\p{L}/gu) ?? []).length
}

/** Quem pode abrir a urgência: o médico da unidade (plantonista ou telemedicina). */
export function podeAbrirUrgencia(papel: string | null | undefined): boolean {
  return papel === 'plantonista' || papel === 'telemedicina'
}
