// Rede a partir da Secretaria (pedido do RT, 24/11/2026): a árvore
// secretaria → ramo → unidade que a aba Secretarias da Rede mostra. Lógica
// pura, testada em redeSecretaria.test.ts. Os dados vêm de admin_rede_arvore
// (migration 20270421000020).

export type Ramo = 'hospital' | 'upa' | 'ubs' | 'clinica' | 'ambulatorio' | 'central_regulacao'

/** Ordem dos ramos na árvore e o nome de cada um (no plural, como grupo). */
export const RAMOS: { valor: Ramo; rotulo: string; singular: string; um: string; varios: string }[] = [
  { valor: 'hospital', rotulo: 'Hospitais', singular: 'Hospital', um: 'hospital', varios: 'hospitais' },
  { valor: 'upa', rotulo: 'UPAs', singular: 'UPA', um: 'UPA', varios: 'UPAs' },
  { valor: 'ubs', rotulo: 'UBS', singular: 'UBS', um: 'UBS', varios: 'UBS' },
  { valor: 'clinica', rotulo: 'Clínicas', singular: 'Clínica', um: 'clínica', varios: 'clínicas' },
  { valor: 'ambulatorio', rotulo: 'Ambulatórios', singular: 'Ambulatório', um: 'ambulatório', varios: 'ambulatórios' },
  { valor: 'central_regulacao', rotulo: 'Centrais de regulação', singular: 'Central de regulação', um: 'central de regulação', varios: 'centrais de regulação' },
]
export const RAMO_ROTULO = Object.fromEntries(RAMOS.map((r) => [r.valor, r.rotulo])) as Record<Ramo, string>
export const RAMO_SINGULAR = Object.fromEntries(RAMOS.map((r) => [r.valor, r.singular])) as Record<Ramo, string>

export const ESFERAS = [
  { valor: 'municipal', rotulo: 'Municipal' },
  { valor: 'estadual', rotulo: 'Estadual' },
  { valor: 'regional', rotulo: 'Regional' },
] as const
export type Esfera = (typeof ESFERAS)[number]['valor']

export type SecretariaRede = {
  id: string
  nome: string
  esfera: Esfera
  municipio: string | null
  uf: string | null
  cnpj: string | null
  responsavel: string | null
  telefone: string | null
  email: string | null
  endereco: string | null
  ativo: boolean
  atualizado_em: string
}

export type UnidadeNaRede = {
  id: string
  nome: string
  tipo: string
  cnes: string | null
  municipio: string | null
  uf: string | null
  endereco: string | null
  whatsapp: string | null
  ativo: boolean
  secretaria_id: string | null
  /** Ramo escolhido pelo administrador; nulo = sai do tipo. */
  ramo_rede: Ramo | null
  /** Ramo em que a unidade aparece (o escolhido ou o do tipo). */
  ramo: Ramo
  eh_central: boolean
  /** Unidade administrativa dos papéis de rede (rede_modulo). */
  eh_sede_rede: boolean
  pessoas: Record<string, number>
  gestores: string[]
}

export type OrganizacaoRede = {
  id: string
  nome: string
  secretarias: SecretariaRede[]
  unidades: UnidadeNaRede[]
}

export type GrupoRamo = { ramo: Ramo; unidades: UnidadeNaRede[] }
/** `secretaria` nula = o galho das unidades ainda sem secretaria. */
export type GalhoSecretaria = { chave: string; organizacao: OrganizacaoRede; secretaria: SecretariaRede | null; ramos: GrupoRamo[]; total: number }

/** Normaliza para a busca: sem acento e sem caixa. */
export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function casa(u: UnidadeNaRede, termo: string): boolean {
  return [u.nome, u.municipio, u.cnes, u.uf].some((c) => c && normalizar(c).includes(termo))
}

function agrupar(unidades: UnidadeNaRede[]): GrupoRamo[] {
  return RAMOS
    .map((r) => ({ ramo: r.valor, unidades: unidades.filter((u) => u.ramo === r.valor) }))
    .filter((g) => g.unidades.length > 0)
}

/**
 * Monta os galhos: cada secretaria com as unidades ligadas a ela, por ramo, e
 * por último as unidades da organização ainda sem secretaria. Com busca, fica
 * só o que casa (unidade pelo nome, município, CNES ou UF; a secretaria pelo
 * nome ou município traz o galho inteiro). Secretaria sem unidade aparece sem
 * busca, para receber a primeira.
 */
export function montarArvore(orgs: OrganizacaoRede[], busca = ''): GalhoSecretaria[] {
  const termo = normalizar(busca)
  const galhos: GalhoSecretaria[] = []
  for (const org of orgs) {
    const ids = new Set(org.secretarias.map((s) => s.id))
    for (const s of org.secretarias) {
      const todas = org.unidades.filter((u) => u.secretaria_id === s.id)
      const secretariaCasa = !termo || [s.nome, s.municipio].some((c) => c && normalizar(c).includes(termo))
      const visiveis = secretariaCasa ? todas : todas.filter((u) => casa(u, termo))
      if (termo && !secretariaCasa && visiveis.length === 0) continue
      galhos.push({ chave: s.id, organizacao: org, secretaria: s, ramos: agrupar(visiveis), total: todas.length })
    }
    const soltas = org.unidades.filter((u) => !u.secretaria_id || !ids.has(u.secretaria_id))
    const soltasVisiveis = termo ? soltas.filter((u) => casa(u, termo)) : soltas
    if (soltasVisiveis.length > 0) {
      galhos.push({ chave: `sem:${org.id}`, organizacao: org, secretaria: null, ramos: agrupar(soltasVisiveis), total: soltas.length })
    }
  }
  return galhos
}

/** Total de vínculos ativos da unidade. */
export function totalPessoas(u: Pick<UnidadeNaRede, 'pessoas'>): number {
  return Object.values(u.pessoas).reduce((s, n) => s + n, 0)
}

/** Resumo do galho: "1 hospital, 2 UBS". */
export function resumoRamos(ramos: GrupoRamo[]): string {
  const nomes = Object.fromEntries(RAMOS.map((r) => [r.valor, r]))
  return ramos.map((g) => `${g.unidades.length} ${g.unidades.length === 1 ? nomes[g.ramo].um : nomes[g.ramo].varios}`).join(', ')
}
