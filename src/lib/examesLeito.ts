// Exames do leito (EX1 e EX2, revisão da Internação aprovada pelo RT em
// 24/11/2026). Sem dependência de tela: os testes rodam no node.
//
// EX2: a lista em três grupos — com resultado (o valor como veio, a data e o
// anterior do mesmo exame para comparar), aguardando (com a idade do pedido;
// mais de 48 h em destaque) e cancelados (recolhidos). Pedidos repetidos do
// mesmo exame, na mesma situação, viram uma linha ("pedido 2×").
// EX1: o pedido rápido não oferece o citopatológico do colo do útero a quem
// não é do sexo feminino; o que já foi pedido aparece como texto, com a data.

const PENDENTES = ['pedido', 'coletado', 'em_analise', 'realizado']

export type ExameLinha = {
  id: string; exame: string; situacao: string; resultado: string | null; motivo_cancelamento: string | null
  pedido_em: string; procedimento: string | null; urgencia: string; critico: boolean; resultado_visto_em: string | null
}

export type GrupoExameLinha<T extends ExameLinha> = {
  /** o mais recente do grupo; os outros ids vêm junto (o "pedido 2×") */
  e: T
  ids: string[]
  vezes: number
  /** só nos com resultado: o resultado anterior do mesmo exame, para comparar */
  anterior?: { resultado: string; pedido_em: string } | null
  /** só nos aguardando: horas desde o pedido mais antigo do grupo */
  horas?: number
}

const chave = (e: ExameLinha) => (e.procedimento ?? e.exame.trim().toLowerCase())

export function agruparExames<T extends ExameLinha>(lista: readonly T[], agora: number): {
  comResultado: GrupoExameLinha<T>[]; aguardando: GrupoExameLinha<T>[]; cancelados: T[]
} {
  const ordenados = [...lista].sort((a, b) => Date.parse(b.pedido_em) - Date.parse(a.pedido_em))
  const resultados = ordenados.filter((e) => e.situacao === 'resultado')
  const comResultado = resultados.map((e) => {
    const anterior = resultados.find((x) => x !== e && chave(x) === chave(e) && Date.parse(x.pedido_em) < Date.parse(e.pedido_em))
    return { e, ids: [e.id], vezes: 1, anterior: anterior?.resultado != null ? { resultado: anterior.resultado, pedido_em: anterior.pedido_em } : null }
  })
  const pend = ordenados.filter((e) => PENDENTES.includes(e.situacao))
  const mapa = new Map<string, GrupoExameLinha<T>>()
  for (const e of pend) {
    const k = `${chave(e)}|${e.situacao}`
    const g = mapa.get(k)
    const horas = Math.max(0, Math.floor((agora - Date.parse(e.pedido_em)) / 3600_000))
    if (g) { g.ids.push(e.id); g.vezes++; g.horas = Math.max(g.horas ?? 0, horas) } else mapa.set(k, { e, ids: [e.id], vezes: 1, horas })
  }
  return { comResultado, aguardando: [...mapa.values()], cancelados: ordenados.filter((e) => e.situacao === 'cancelado') }
}

/** Mais de 48 horas aguardando: em destaque. */
export const atrasado = (horas: number | undefined) => (horas ?? 0) > 48

/** "há 3 h", "há 2 dias" */
export function idadePedido(horas: number): string {
  if (horas < 1) return 'há menos de 1 h'
  if (horas < 48) return `há ${horas} h`
  return `há ${Math.floor(horas / 24)} dias`
}

/** O citopatológico do colo do útero só aparece para o sexo feminino (o cadastro diz F). */
export function exameCabeParaSexo(grupo: string, sexo: string | null | undefined): boolean {
  return grupo !== 'citopatologia' || sexo === 'F'
}

/** Quando o exame já foi pedido nesta internação (não cancelado): a data do pedido mais recente. */
export function pedidoEm(b: { rotulo: string; procedimento: string | null }, pedidos: readonly { exame: string; procedimento?: string | null; situacao: string; pedido_em?: string | null }[]): string | null {
  const iguais = pedidos.filter((x) => x.situacao !== 'cancelado'
    && (b.procedimento ? x.procedimento === b.procedimento : x.exame.toLowerCase() === b.rotulo.toLowerCase()))
  const datas = iguais.map((x) => x.pedido_em).filter((d): d is string => !!d).sort()
  return iguais.length ? datas[datas.length - 1] ?? '' : null
}
