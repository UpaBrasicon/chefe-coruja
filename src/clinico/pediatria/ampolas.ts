// Dose em mL pela ampola escolhida (pedido do RT de 19/11/2026; decisões
// ML1–ML11 = A em docs/clinico/DOSES-ML-PEDIATRIA-DIAGNOSTICO.md).
//
// As apresentações ficam aqui, fora das fichas de dose: as doses não mudam
// quando uma ampola entra. Este arquivo vira a ficha própria das ampolas no
// lote 1, quando entrar a primeira bula, e cada lote passa pela aprovação do
// RT (gate LG10).
//
// Regras do RT:
// - concentração do livro do ICr ou da bula do Bulário Eletrônico da ANVISA,
//   sempre com a fonte; as listas locais (data/*.csv) nunca são fonte (ML9);
// - cada concentração com registro ativo vira uma opção, por concentração e não
//   por marca (ML2); nenhuma vem marcada e sem ampola escolhida não há mL;
// - mL só com a dose e a concentração na mesma base, sal ou elemento (ML6);
// - nas que precisam de diluição, o mL é o volume a aspirar da ampola, com o
//   aviso fixo (ML5);
// - insulina nunca em mL do frasco de 100 UI/mL (ML7).

/** Base da dose e da concentração (cálcio e magnésio: sal ou elemento). */
export type BaseDose = 'sal' | 'elemento'

export type Apresentacao = {
  /** estável, para a escolha na tela (ex.: 'adenosina-3') */
  id: string
  /** o que a tela mostra no botão (ex.: 'Adenosina 3 mg/mL, ampola 2 mL') */
  rotulo: string
  /** concentração na unidade da dose, por mL */
  porMl: number
  /** só quando a dose pode estar em sal ou em elemento */
  base?: BaseDose
  /** precisa de diluição: o mL é o volume a aspirar, não o volume a infundir */
  diluir?: boolean
  /** página do livro ou bula: produto, empresa, expediente e data */
  fonte: string
  url?: string
}

/** Um item de dose que usa as ampolas de um princípio ativo. */
export type ItemComAmpola = {
  principio: string
  /** base da dose do item, quando o princípio tem ampolas em bases diferentes */
  base?: BaseDose
}

/** Apresentações por princípio ativo. Vazio no lote 0. */
export const AMPOLAS: Record<string, Apresentacao[]> = {}

/**
 * Itens de dose que mostram a escolha da ampola, pela chave "lista:id":
 * 'bolus:<id>' (bolus.ts), 'rcp:<id>' (rcp.ts), 'sri:<id>' (viaAerea.ts).
 * Vazio no lote 0.
 */
export const ITENS_COM_AMPOLA: Record<string, ItemComAmpola> = {}

export const AVISO_DILUIR = 'Volume a aspirar da ampola. Diluir antes de administrar.'
export const PECA_A_AMPOLA = 'Escolha a ampola para ver o volume em mL.'

/** As ampolas que valem para o item (mesma base da dose), ou lista vazia. */
export function ampolasDoItem(chave: string): Apresentacao[] {
  const item = ITENS_COM_AMPOLA[chave]
  if (!item) return []
  return (AMPOLAS[item.principio] ?? []).filter((a) => !a.base || !item.base || a.base === item.base)
}

export type VolumeDaAmpola = { ml: [number, number]; aspirar: boolean }

/** Volume da dose na ampola escolhida; sem ampola, ou com bases diferentes, não há volume. */
export function volumeDaAmpola(dose: [number, number], ampola: Apresentacao | undefined, baseDaDose?: BaseDose): VolumeDaAmpola | null {
  if (!ampola || !(ampola.porMl > 0)) return null
  if (ampola.base && baseDaDose && ampola.base !== baseDaDose) return null
  if (!dose.every((x) => Number.isFinite(x) && x >= 0)) return null
  return { ml: [dose[0] / ampola.porMl, dose[1] / ampola.porMl], aspirar: ampola.diluir === true }
}

/** Problemas de cadastro (os testes e o CI cobram lista vazia). */
export function problemasDasAmpolas(ampolas: Record<string, Apresentacao[]> = AMPOLAS, itens: Record<string, ItemComAmpola> = ITENS_COM_AMPOLA): string[] {
  const p: string[] = []
  for (const [principio, lista] of Object.entries(ampolas)) {
    const ids = new Set<string>()
    for (const a of lista) {
      if (ids.has(a.id)) p.push(`${principio}: id repetido ${a.id}`)
      ids.add(a.id)
      if (!(a.porMl > 0)) p.push(`${principio}/${a.id}: concentração inválida`)
      if (!a.fonte.trim()) p.push(`${principio}/${a.id}: sem fonte`)
      if (/data\/|padroniza|HU-UFGD|diluicao\.csv/i.test(a.fonte)) p.push(`${principio}/${a.id}: lista local não é fonte (ML9)`)
      if (/insulina/i.test(principio) && a.porMl >= 100) p.push(`${principio}/${a.id}: insulina do frasco não entra (ML7)`)
    }
    const porMl = lista.map((a) => `${a.base ?? ''}${a.porMl}`)
    if (new Set(porMl).size !== porMl.length) p.push(`${principio}: concentração repetida (agrupar por concentração, ML2)`)
  }
  for (const [chave, item] of Object.entries(itens)) {
    if (!/^(bolus|rcp|sri):[a-z0-9-]+$/.test(chave)) p.push(`${chave}: chave fora do padrão lista:id`)
    if (!ampolas[item.principio]?.length) p.push(`${chave}: princípio ${item.principio} sem ampola`)
    const bases = new Set((ampolas[item.principio] ?? []).map((a) => a.base).filter(Boolean))
    if (bases.size > 1 && !item.base) p.push(`${chave}: ${item.principio} tem sal e elemento; o item precisa dizer a base (ML6)`)
  }
  return p
}
