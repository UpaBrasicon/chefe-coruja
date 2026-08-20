// ─────────────────────────────────────────────────────────────────────────────
// Montagem da tabela `cid10` a partir dos arquivos oficiais do DATASUS:
//   CID-10-SUBCATEGORIAS.CSV (códigos completos A00.0)
//   CID-10-CATEGORIAS.CSV    (códigos A00)
//   CID-10-GRUPOS.CSV        (faixas CATINIC..CATFIM + descrição)
//   CID-10-CAPITULOS.CSV     (faixas CATINIC..CATFIM + descrição)
//
// Gera ~14,5 mil linhas (2.045 categorias + 12.451 subcategorias), cada uma
// com capitulo/grupo resolvidos por faixa — atendendo o critério de "14 mil
// linhas carregadas". Funções puras, testáveis sem banco.
// ─────────────────────────────────────────────────────────────────────────────

export type LinhaDatasus = Record<string, string>

export type PayloadCid10 = {
  codigo: string
  descricao: string
  capitulo: string | null
  grupo: string | null
}

/** "A000" → "A00.0"; "A00" → "A00" (categoria já sem ponto). */
export function formatarCodigoCid(codigo: string): string {
  const c = codigo.trim().toUpperCase()
  if (c.length === 4) return `${c.slice(0, 3)}.${c.slice(3)}`
  return c
}

/** Encontra a descrição da faixa (grupo/capítulo) que contém o código. */
function descricaoDaFaixa(
  codigo: string,
  faixas: { catinic: string; catfim: string; descricao: string }[]
): string | null {
  for (const f of faixas) {
    if (codigo >= f.catinic && codigo <= f.catfim) return f.descricao
  }
  return null
}

function extrairFaixas(
  linhas: LinhaDatasus[],
  colInic: string,
  colFim: string,
  colDesc: string
): { catinic: string; catfim: string; descricao: string }[] {
  const faixas: { catinic: string; catfim: string; descricao: string }[] = []
  for (const l of linhas) {
    // cabeçalhos vêm normalizados pelo parser (minúsculas, sem acento)
    const inic = (l[colInic.toLowerCase()] ?? l[colInic] ?? '').trim().toUpperCase()
    const fim = (l[colFim.toLowerCase()] ?? l[colFim] ?? '').trim().toUpperCase()
    const desc = (l[colDesc.toLowerCase()] ?? l[colDesc] ?? '').trim()
    if (inic && fim && desc) faixas.push({ catinic: inic, catfim: fim, descricao: desc })
  }
  // ordena por início para a primeira faixa que casa ser a mais específica
  faixas.sort((a, b) => a.catinic.localeCompare(b.catinic))
  return faixas
}

export type EntradasCid10 = {
  subcategorias: LinhaDatasus[]
  categorias: LinhaDatasus[]
  grupos: LinhaDatasus[]
  capitulos: LinhaDatasus[]
}

/** Monta os payloads de cid10 (categorias + subcategorias), ordenados por código. */
export function montarCid10(entradas: EntradasCid10): PayloadCid10[] {
  const { subcategorias, categorias, grupos, capitulos } = entradas

  const faixasGrupos = extrairFaixas(grupos, 'CATINIC', 'CATFIM', 'DESCRICAO')
  const faixasCapitulos = extrairFaixas(capitulos, 'CATINIC', 'CATFIM', 'DESCRICAO')

  // categorias: código sem ponto ("A00")
  const payloads: PayloadCid10[] = categorias.map((c) => {
    const codigo = (c.cat ?? c.CAT ?? '').trim().toUpperCase()
    return {
      codigo,
      descricao: (c.descricao ?? c.DESCRICAO ?? '').trim(),
      capitulo: descricaoDaFaixa(codigo, faixasCapitulos),
      grupo: descricaoDaFaixa(codigo, faixasGrupos),
    }
  })

  // subcategorias: código com ponto ("A00.0")
  for (const s of subcategorias) {
    const subcat = (s.subcat ?? s.SUBCAT ?? '').trim().toUpperCase()
    if (!subcat) continue
    const codigo = formatarCodigoCid(subcat)
    const categoria = codigo.split('.')[0]
    payloads.push({
      codigo,
      descricao: (s.descricao ?? s.DESCRICAO ?? '').trim(),
      capitulo: descricaoDaFaixa(categoria, faixasCapitulos),
      grupo: descricaoDaFaixa(categoria, faixasGrupos),
    })
  }

  // remove duplicatas por código (subcategoria repetida no arquivo, ex.: X)
  const vistos = new Set<string>()
  const unicos: PayloadCid10[] = []
  for (const p of payloads) {
    if (p.codigo && !vistos.has(p.codigo)) {
      vistos.add(p.codigo)
      unicos.push(p)
    }
  }

  unicos.sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'))
  return unicos
}
