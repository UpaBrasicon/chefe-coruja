// Fila de validação do farmacêutico (revisão do perfil Farmacêutico, RT
// 24/11/2026: FA1, VA2 e VA3). Só leitura e ordem do que o servidor devolve em
// fila_validacao; nenhuma regra clínica nova, nenhum cálculo de dose.
//
// FA1: o menu, a faixa do topo e a aba Validação contam a mesma coisa, os itens
// a validar (contarFila).
// VA2: o item de prescrição vencida sai da validação ("vencida, aguarda
// renovação": a validade é do servidor, lacuna 6, COFEN 689/2022); um paciente
// por linha, com os itens dentro; alta vigilância e controlado primeiro, depois
// o mais antigo.
// VA3: aviso quando o item não traz a dose explícita (só aviso; não se deduz
// dose de nada).

/** O mínimo de cada item da fila que a ordem e a contagem usam. */
export type ItemDaFila = {
  item_id: string
  paciente_nome: string
  local: string | null
  alta_vigilancia: boolean
  prescrito_em: string
  /** 'vencido', 'vence_logo', 'em_dia' ou 'sem_prazo' (private.validade_item). */
  validade?: string | null
}

/** Item de prescrição vencida: não se valida, espera a renovação de quem prescreveu. */
export const itemVencido = (i: { validade?: string | null }) => i.validade === 'vencido'

/** Os itens a validar e os de prescrição vencida, na ordem em que vieram. */
export function separarVencidos<T extends { validade?: string | null }>(itens: readonly T[]): { aValidar: T[]; vencidos: T[] } {
  const aValidar: T[] = []
  const vencidos: T[] = []
  for (const i of itens) (itemVencido(i) ? vencidos : aValidar).push(i)
  return { aValidar, vencidos }
}

/** O número da fila: menu, faixa do topo e aba Validação (FA1). */
export const contarFila = (itens: readonly { validade?: string | null }[] | null | undefined) =>
  (itens ?? []).filter((i) => !itemVencido(i)).length

export type GrupoPaciente<T extends ItemDaFila> = {
  chave: string
  paciente: string
  /** Os locais dos itens (leito ou setor), sem repetir. */
  locais: string[]
  itens: T[]
  /** Tem item de alta vigilância ou controlado. */
  prioridade: boolean
  /** O item mais antigo do paciente. */
  desde: string
}

/**
 * Um paciente por linha (VA2). A chave é o paciente quando se sabe o id dele
 * (pacienteDoItem); sem o id, o nome. Ordem dita na tela: alta vigilância e
 * controlado primeiro, depois o mais antigo; dentro do paciente, a mesma ordem.
 */
export function agruparPorPaciente<T extends ItemDaFila>(
  itens: readonly T[],
  controlados: ReadonlySet<string> | null | undefined,
  pacienteDoItem?: ReadonlyMap<string, string> | null,
): GrupoPaciente<T>[] {
  const prior = (i: T) => i.alta_vigilancia || !!controlados?.has(i.item_id)
  const porItem = (a: T, b: T) => Number(prior(b)) - Number(prior(a)) || a.prescrito_em.localeCompare(b.prescrito_em)
  const grupos = new Map<string, GrupoPaciente<T>>()
  for (const i of itens) {
    const id = pacienteDoItem?.get(i.item_id)
    const chave = id ? `id:${id}` : `nome:${i.paciente_nome}`
    const g = grupos.get(chave) ?? { chave, paciente: i.paciente_nome, locais: [], itens: [], prioridade: false, desde: i.prescrito_em }
    g.itens.push(i)
    if (i.local && !g.locais.includes(i.local)) g.locais.push(i.local)
    if (prior(i)) g.prioridade = true
    if (i.prescrito_em < g.desde) g.desde = i.prescrito_em
    grupos.set(chave, g)
  }
  const lista = [...grupos.values()]
  for (const g of lista) g.itens.sort(porItem)
  return lista.sort((a, b) => Number(b.prioridade) - Number(a.prioridade) || a.desde.localeCompare(b.desde))
}

// Dose explícita: começa por número e unidade (500 mg, 1 g, 2,5 mL, 10 UI,
// 1 comprimido, 20 gotas). Texto livre como "diluir com 9 ml de AD e fazer 3 ml
// IV lento" não traz a dose do fármaco de forma explícita.
const DOSE_EXPLICITA = /^\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|ug|g|ui|u|meq|mmol|ml|l|gotas?|gts?|comprimidos?|cps?|c[aá]psulas?|amp(?:olas?)?|frascos?|envelopes?|sach[eê]s?|puffs?|jatos?|unidades?|supositórios?|adesivos?)(?![a-zà-ú])/i

/** VA3: o item não traz a dose explícita (vazia ou texto livre). Só aviso; nada se calcula. */
export function doseNaoInformada(dose: string | null | undefined): boolean {
  const d = (dose ?? '').trim()
  return d === '' || !DOSE_EXPLICITA.test(d)
}

export const AVISO_DOSE_NAO_INFORMADA = 'Dose não informada no item: confira com quem prescreveu.'
