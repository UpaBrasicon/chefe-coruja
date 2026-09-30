// Busca de fluxograma pela queixa, como o paciente fala (porte do protótipo,
// 24/09). "Peito" acha "Dor torácica", "barriga" acha "Dor abdominal". O
// ranking põe na frente quem tem o termo no nome (100), depois no "inclui"
// (30), depois no texto de algum discriminador (5).
// É só busca: não escolhe fluxograma nem cor.

export type FluxogramaBusca = {
  nome: string
  inclui: string | null
  discriminadores: Partial<Record<string, [string, string][]>>
}

/** Palavra leiga → trecho do nome técnico (sem acento, minúsculas). */
export const SINONIMOS: Record<string, string> = {
  peito: 'toracica',
  barriga: 'abdominal',
  ar: 'respirat',
  cansaco: 'respirat',
  chiado: 'respirat',
  tosse: 'respirat',
  cabeca: 'cabeca',
  xixi: 'urinar',
  urina: 'urinar',
  olho: 'ocular oftalmo',
  dente: 'odonto',
  ouvido: 'otorrino',
  garganta: 'garganta',
  queda: 'trauma politrauma',
  batida: 'trauma politrauma',
  cobra: 'peconhento',
  escorpiao: 'peconhento',
  cachorro: 'mordedura',
  vomito: 'vomito',
  diarreia: 'diarreia',
  sangue: 'sangramento',
  vacina: 'vacina',
  crise: 'convulsao',
  desmaio: 'desmaio',
}

export const normalizar = (t: string | null | undefined) =>
  String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** A frase inteira + os termos técnicos das palavras leigas que ela tiver. */
export function termosDaBusca(busca: string): string[] {
  const q = normalizar(busca).trim()
  if (!q) return []
  const extras = q.split(/\s+/).flatMap((w) => (SINONIMOS[w] ? SINONIMOS[w].split(' ') : []))
  return [q, ...extras].filter(Boolean)
}

const textoDiscriminadores = (f: FluxogramaBusca) =>
  Object.values(f.discriminadores).flatMap((lista) => (lista ?? []).map(([t]) => normalizar(t)))

export function pontuar(f: FluxogramaBusca, termos: string[]): number {
  const nome = normalizar(f.nome)
  const inclui = normalizar(f.inclui)
  const discs = textoDiscriminadores(f)
  let s = 0
  for (const t of termos) {
    if (nome.includes(t)) s += 100
    else if (inclui.includes(t)) s += 30
    else if (discs.some((d) => d.includes(t))) s += 5
  }
  return s
}

/** Fluxogramas que casam com a busca, do mais ao menos pertinente. Sem busca, todos na ordem original. */
export function buscarFluxogramas<T extends FluxogramaBusca>(lista: T[], busca: string): T[] {
  const termos = termosDaBusca(busca)
  if (termos.length === 0) return lista
  return lista
    .map((f, i) => ({ f, i, s: pontuar(f, termos) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.f)
}
