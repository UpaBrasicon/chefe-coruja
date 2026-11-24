// Anotações pessoais do médico (pedido 7; AN1 a AN4 = A do RT em 23/11/2026,
// docs/plantonista/ANOTACOES-MEDICO-DIAGNOSTICO.md). Lembretes, sem dado de
// paciente; apagam 30 dias depois da última mudança.

export type Anotacao = { id: string; texto: string; feita: boolean; fixada: boolean; criada_em: string; alterada_em: string }

export const LIMITE_TEXTO = 1000
export const DIAS_GUARDA = 30

/**
 * O que no texto parece dado de paciente (AN1 = A): CPF, Cartão SUS ou data
 * de nascimento (dd/mm/aaaa de ano anterior ao atual). Só avisa; quem decide
 * salvar é o médico.
 */
export function pareceDadoDePaciente(texto: string, anoAtual: number): string[] {
  const achados: string[] = []
  if (/(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/.test(texto)) achados.push('CPF')
  if (/(?<!\d)[1-9]\d{2}[ .]?\d{4}[ .]?\d{4}[ .]?\d{4}(?!\d)/.test(texto)) achados.push('Cartão SUS')
  for (const m of texto.matchAll(/(?<!\d)(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/g)) {
    const [d, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (d >= 1 && d <= 31 && mes >= 1 && mes <= 12 && ano >= 1900 && ano < anoAtual) {
      achados.push('data de nascimento')
      break
    }
  }
  return achados
}

/** Dias que faltam para a nota apagar sozinha (0 = hoje). */
export function diasParaApagar(alteradaEm: string, agora: number): number {
  const t = Date.parse(alteradaEm)
  if (!Number.isFinite(t)) return DIAS_GUARDA
  return Math.max(0, DIAS_GUARDA - Math.floor((agora - t) / 86_400_000))
}

/** Fixadas primeiro, depois as não feitas; dentro de cada grupo, a mais recente antes. */
export function ordenarAnotacoes(lista: Anotacao[]): Anotacao[] {
  return [...lista].sort((a, b) =>
    Number(b.fixada) - Number(a.fixada) || Number(a.feita) - Number(b.feita) || Date.parse(b.alterada_em) - Date.parse(a.alterada_em))
}
