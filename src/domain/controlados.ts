// Medicação controlada (lacuna 3 do Portão de 11/10/2026; decisão do RT em
// 10/11/2026, A em C1 a C6). Fontes: Portaria SVS/MS nº 344/1998 (Arts. 35,
// 40, 45, 49, 50, 52, 55 e 56) e as listas da RDC ANVISA nº 1.036/2026
// (Atualização N. 101 do Anexo I).
//
// A marca vem do banco: public.substancias_controladas (a tabela digitada da
// RDC) e as colunas controlado_* de public.medicamento, que um gatilho
// calcula. Aqui ficam só as regras puras das telas:
//  - o selo ("Controlado · B1");
//  - que receita a lista exige quando o paciente leva o remédio para casa;
//  - a mesma comparação de nome do banco, para o item escrito à mão;
//  - a separação da receita para casa: controle especial (2 vias), comum, ou
//    fora da receita (Notificação de Receita, talão da vigilância sanitária, ou
//    uso só no estabelecimento).

export type ListaControle = 'A1' | 'A2' | 'A3' | 'B1' | 'B2' | 'C1' | 'C2' | 'C3' | 'C5'

export type ReceitaControle =
  | 'notificacao_a' | 'notificacao_b' | 'notificacao_b2' | 'controle_especial'
  | 'notificacao_c2' | 'notificacao_c3' | 'so_estabelecimento'

/** Linha de public.substancias_controladas (só o que as telas usam). */
export type SubstanciaControlada = {
  substancia: string; chave: string; grafias: string[]
  lista: ListaControle; item: number; receita: ReceitaControle; adendo: string | null
}

/** O controle de um item: do catálogo (colunas controlado_*) ou do nome escrito. */
export type Controle = { lista: ListaControle; substancia: string | null; receita: ReceitaControle; adendo?: string | null }

/** Receita que cada lista exige para casa (Portaria 344, Arts. 35, 40, 45, 49, 50, 52 e 56). */
export const RECEITA_DA_LISTA: Record<ListaControle, ReceitaControle> = {
  A1: 'notificacao_a', A2: 'notificacao_a', A3: 'notificacao_a',
  B1: 'notificacao_b', B2: 'notificacao_b2',
  C1: 'controle_especial', C5: 'controle_especial',
  C2: 'notificacao_c2', C3: 'notificacao_c3',
}

/** Nome de cada receita, como a tela e o aviso dizem. */
export const ROTULO_RECEITA: Record<ReceitaControle, string> = {
  notificacao_a: 'Notificação de Receita A (amarela)',
  notificacao_b: 'Notificação de Receita B (azul)',
  notificacao_b2: 'Notificação de Receita B2 (azul)',
  controle_especial: 'Receita de Controle Especial (branca, 2 vias)',
  notificacao_c2: 'Notificação de Receita Especial (branca)',
  notificacao_c3: 'Notificação de Receita de talidomida (branca)',
  so_estabelecimento: 'uso só no estabelecimento de saúde',
}

const LISTAS: readonly string[] = ['A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'C2', 'C3', 'C5']
const RECEITAS: readonly string[] = Object.keys(ROTULO_RECEITA)

export const ehLista = (x: unknown): x is ListaControle => typeof x === 'string' && LISTAS.includes(x)
export const ehReceita = (x: unknown): x is ReceitaControle => typeof x === 'string' && RECEITAS.includes(x)

/** Selo das telas: "Controlado · B1". */
export function rotuloSelo(lista: ListaControle): string {
  return `Controlado · ${lista}`
}

/** As colunas controlado_* do catálogo (ou da RPC controle_dos_itens) viram o controle; sem lista, nulo. */
export function controleDoCatalogo(m: { lista?: string | null; controlado_lista?: string | null; substancia?: string | null
  controlado_substancia?: string | null; receita?: string | null; controlado_receita?: string | null } | null | undefined): Controle | null {
  if (!m) return null
  const lista = m.lista ?? m.controlado_lista
  if (!ehLista(lista)) return null
  const receita = m.receita ?? m.controlado_receita
  return { lista, substancia: m.substancia ?? m.controlado_substancia ?? null, receita: ehReceita(receita) ? receita : RECEITA_DA_LISTA[lista] }
}

/**
 * O mesmo texto comparável do banco (private.norm_medicamento): sem acento,
 * minúsculo, só letras, números e um espaço entre as palavras.
 */
export function nomeComparavel(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

const ORDEM_LISTA = (l: ListaControle) => LISTAS.indexOf(l)

/**
 * A substância da tabela que casa com o nome escrito, como palavra inteira (o
 * sal e o éster casam: "cloridrato de tramadol" é tramadol). Mais de uma: a
 * lista mais restrita (A antes de B antes de C), depois o item, como o banco.
 */
export function substanciaNoNome(nome: string, tabela: SubstanciaControlada[]): SubstanciaControlada | null {
  const texto = ` ${nomeComparavel(nome)} `
  if (texto.trim() === '') return null
  const achadas = tabela.filter((s) => [s.chave, ...(s.grafias ?? [])].some((g) => g && texto.includes(` ${g} `)))
  achadas.sort((a, b) => ORDEM_LISTA(a.lista) - ORDEM_LISTA(b.lista) || a.item - b.item)
  return achadas[0] ?? null
}

/**
 * O controle do item da receita: do cadastro, pelo id (as colunas controlado_*
 * que o gatilho calcula), ou da tabela da RDC, pelo nome escrito.
 */
export function controleDoItem(nome: string, medicamentoId: string | null | undefined,
  catalogo: Map<string, Controle> | undefined, tabela: SubstanciaControlada[] | undefined): Controle | null {
  const doCatalogo = medicamentoId ? catalogo?.get(medicamentoId) : undefined
  if (doCatalogo) return doCatalogo
  const s = tabela ? substanciaNoNome(nome, tabela) : null
  return s ? { lista: s.lista, substancia: s.substancia, receita: s.receita, adendo: s.adendo } : null
}

/** Para onde vai o item da receita para casa. */
export type Destino =
  | { tipo: 'comum' }
  | { tipo: 'controle_especial'; controle: Controle | null }
  | { tipo: 'fora'; controle: Controle; aviso: string }

/**
 * Lista C1 ou C5 (e os adendos que mandam para ela): Receita de Controle
 * Especial em 2 vias, sem marcar à mão. Lista A, B, C2 ou C3: exige a
 * Notificação de Receita (talão numerado da vigilância sanitária) e não sai
 * nesta receita. Uso só no estabelecimento (cetamina, misoprostol): não sai.
 * Item sem controle conhecido: a marca à mão do médico (item escrito fora do
 * cadastro) decide entre comum e controle especial.
 */
export function destinoDoItem(controle: Controle | null, marcadoAMao = false): Destino {
  if (!controle) return marcadoAMao ? { tipo: 'controle_especial', controle: null } : { tipo: 'comum' }
  if (controle.receita === 'controle_especial') return { tipo: 'controle_especial', controle }
  return { tipo: 'fora', controle, aviso: avisoForaDaReceita(controle) }
}

/** O aviso do item que não sai na receita para casa. */
export function avisoForaDaReceita(c: Controle): string {
  const nome = c.substancia ? `${c.substancia} (lista ${c.lista})` : `Lista ${c.lista}`
  if (c.receita === 'so_estabelecimento') {
    return `${nome}: uso só no estabelecimento de saúde (Portaria 344). Não sai na receita para casa.`
  }
  return `${nome}: exige ${ROTULO_RECEITA[c.receita]}, o talão numerado da vigilância sanitária. Não sai nesta receita: remova o item e use o talão.`
}

/** Separa os itens da receita para casa pelo destino de cada um. */
export function separarReceita<T>(itens: T[], destino: (i: T) => Destino): { comuns: T[]; controleEspecial: T[]; fora: { item: T; aviso: string }[] } {
  const comuns: T[] = []
  const controleEspecial: T[] = []
  const fora: { item: T; aviso: string }[] = []
  for (const i of itens) {
    const d = destino(i)
    if (d.tipo === 'comum') comuns.push(i)
    else if (d.tipo === 'controle_especial') controleEspecial.push(i)
    else fora.push({ item: i, aviso: d.aviso })
  }
  return { comuns, controleEspecial, fora }
}
