import type { Ficha } from './ficha.ts'

// Escore declarado como dado: itens (escolha única ou marca sim/não) e uma
// função pura que devolve o resultado. Uma tela só (EscoreTela) desenha todos.
// O escore não emite conduta (ADR 0007): devolve valor, faixa e referência.

export type OpcaoEscolha = { rotulo: string; valor: number; naoTestavel?: boolean }

export type Item =
  | { tipo: 'escolha'; id: string; rotulo: string; opcoes: OpcaoEscolha[]; ajuda?: string }
  | { tipo: 'marca'; id: string; rotulo: string; pontos: number; grupo?: string }
  /** valor contínuo (laboratório, idade, sinal vital); obrigatório salvo `opcional` */
  | { tipo: 'numero'; id: string; rotulo: string; unidade?: string; min?: number; max?: number; passo?: number; opcional?: boolean; ajuda?: string }

/** escolha: índice da opção marcada; marca: true/false; numero: o valor */
export type Respostas = Record<string, number | boolean | undefined>

export type Resultado = {
  rotulo: string
  valor: string
  unidade?: string
  nota: string
  /** 0 sem alerta, 1 atenção, 2 crítico — só cor da faixa, não conduta */
  estado: 0 | 1 | 2
  derivados: [string, string][]
  alerta?: string
  cuidados: string[]
}

export type Escore = {
  ficha: Ficha
  descricao: string
  itens: Item[]
  /** null enquanto faltar alguma escolha obrigatória */
  calcular: (r: Respostas) => Resultado | null
}

/** Valor da opção escolhida, ou undefined se ainda não escolhida. */
export function escolha(escore: Escore, r: Respostas, id: string): OpcaoEscolha | undefined {
  const item = escore.itens.find((i) => i.id === id)
  const idx = r[id]
  if (!item || item.tipo !== 'escolha' || typeof idx !== 'number') return undefined
  return item.opcoes[idx]
}

/** Valor numérico informado e dentro da faixa do item, ou undefined. */
export function numero(escore: Escore, r: Respostas, id: string): number | undefined {
  const item = escore.itens.find((i) => i.id === id)
  const v = r[id]
  if (!item || item.tipo !== 'numero' || typeof v !== 'number' || !Number.isFinite(v)) return undefined
  if ((item.min !== undefined && v < item.min) || (item.max !== undefined && v > item.max)) return undefined
  return v
}

/** Escolhas e números obrigatórios respondidos? (marcas não são obrigatórias) */
export function completo(escore: Escore, r: Respostas): boolean {
  return escore.itens.every((i) =>
    i.tipo === 'escolha' ? typeof r[i.id] === 'number'
      : i.tipo === 'numero' ? i.opcional || numero(escore, r, i.id) !== undefined
        : true)
}

/** Soma dos pontos: valor das escolhas + pontos das marcas ligadas. */
export function somar(escore: Escore, r: Respostas, ids?: string[]): number {
  return escore.itens
    .filter((i) => !ids || ids.includes(i.id))
    .reduce((s, i) => {
      if (i.tipo === 'marca') return s + (r[i.id] === true ? i.pontos : 0)
      if (i.tipo === 'numero') return s
      return s + (escolha(escore, r, i.id)?.valor ?? 0)
    }, 0)
}

/** Marcas ligadas, pelo rótulo (para mostrar o que pontuou). */
export function marcadas(escore: Escore, r: Respostas): string[] {
  return escore.itens.filter((i) => i.tipo === 'marca' && r[i.id] === true).map((i) => i.rotulo)
}
