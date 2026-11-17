// LG13 (decisões do RT de 17/11/2026, K1–K6 = A; docs/regulatorio/LG13-REGIMENTO-COMITE.md):
// comitê clínico. Médico revisa tudo; farmacêutico, a ficha com dose;
// enfermeiro, as fichas de enfermagem e de classificação de risco.

export type Revisor = 'medico' | 'farmaceutico' | 'enfermeiro'

export const NOME_REVISOR: Record<Revisor, string> = {
  medico: 'médico',
  farmaceutico: 'farmacêutico',
  enfermeiro: 'enfermeiro',
}

const ehRevisor = (r: string): r is Revisor => r in NOME_REVISOR

/** K6: o lote vale só para fichas sem dose (as que não pedem farmacêutico). */
export function podeAprovarEmLote(revisoesExigidas: readonly string[] | undefined): boolean {
  return !(revisoesExigidas ?? []).includes('farmaceutico')
}

/** "farmacêutico" · "farmacêutico e enfermeiro" (o médico vem antes, se faltar). */
export function listaRevisores(revisores: readonly string[]): string {
  const ordem: Revisor[] = ['medico', 'farmaceutico', 'enfermeiro']
  const nomes = ordem.filter((r) => revisores.includes(r)).map((r) => NOME_REVISOR[r])
  const outros = revisores.filter((r) => !ehRevisor(r))
  const todos = [...nomes, ...outros]
  if (todos.length <= 1) return todos.join('')
  return `${todos.slice(0, -1).join(', ')} e ${todos.at(-1)}`
}

/**
 * Aviso da tela da ferramenta aprovada: o que ainda falta revisar. Enquanto não
 * houver revisor nomeado da profissão, a ficha segue aprovada pelo médico e a
 * tela diz o que falta (regimento, item 4).
 */
export function textoRevisaoPendente(pendentes: readonly string[] | null | undefined): string | null {
  const faltam = (pendentes ?? []).filter((r) => r !== 'medico')
  if (faltam.length === 0) return null
  const quem = faltam.map((r) => (ehRevisor(r) ? `do ${NOME_REVISOR[r]}` : r))
  const lista = quem.length === 1 ? quem[0] : `${quem.slice(0, -1).join(', ')} e ${quem.at(-1)}`
  const conferir = faltam.includes('farmaceutico') ? 'Confira a dose com a fonte citada.' : 'Confira com a fonte citada.'
  return `Falta a revisão ${lista} do comitê clínico. ${conferir}`
}
