// Custo unitário dos materiais (RT, 24/11/2026; migration 20270422000090).
// O cadastro guarda o custo de hoje; o lançamento na conta congela o custo do
// momento. Sem custo é "Sem custo", nunca R$ 0,00 (zero é um custo de verdade).
import { moeda } from './formato.ts'

export const SEM_CUSTO = 'Sem custo'
const TETO = 99_999_999

/** "R$ 2,50", ou "Sem custo" quando o material não tem custo. */
export function custoNaTela(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return SEM_CUSTO
  const n = Number(v)
  return Number.isFinite(n) ? moeda(n) : SEM_CUSTO
}

/** O custo no campo de edição: 2.5 vira "2,50"; sem custo, vazio. */
export function custoParaCampo(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : ''
}

export type CustoLido = { valido: true; valor: number | null } | { valido: false }

/**
 * Lê o custo digitado: aceita "2,50", "1.234,56", "R$ 3" e "2.5". Vazio é
 * "sem custo" (valor nulo). Até 2 casas, de 0 a 99.999.999 (a mesma regra do
 * banco, material_definir_custo).
 */
export function lerCusto(texto: string): CustoLido {
  let t = texto.replace(/R\$/gi, '').replace(/\s/g, '')
  if (t === '') return { valido: true, valor: null }
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { valido: false }
  const n = Number(t)
  return n <= TETO ? { valido: true, valor: n } : { valido: false }
}

/** Valor da linha: quantidade × custo, em centavos exatos; sem custo, nulo. */
export function valorDaLinha(quantidade: number | string, custo: number | string | null | undefined): number | null {
  if (custo === null || custo === undefined || custo === '') return null
  const q = Number(quantidade)
  const c = Number(custo)
  if (!Number.isFinite(q) || !Number.isFinite(c)) return null
  return Math.round(q * c * 100) / 100
}

type LinhaComCusto = {
  quantidade: number | string
  custo_unitario?: number | string | null
  valor?: number | string | null
  retirado_em: string | null
}

/**
 * Total dos materiais da conta: soma das linhas não retiradas que têm custo.
 * `total` é nulo quando nenhuma linha tem custo; `semCusto` conta as linhas
 * não retiradas sem custo (a tela avisa que o total não as inclui).
 */
export function totalMateriais(linhas: readonly LinhaComCusto[]): { total: number | null; semCusto: number } {
  let centavos = 0
  let comCusto = 0
  let semCusto = 0
  for (const l of linhas) {
    if (l.retirado_em) continue
    const v = l.valor !== null && l.valor !== undefined && l.valor !== '' ? Number(l.valor) : valorDaLinha(l.quantidade, l.custo_unitario)
    if (v === null || !Number.isFinite(v)) { semCusto++; continue }
    centavos += Math.round(v * 100)
    comCusto++
  }
  return { total: comCusto ? centavos / 100 : null, semCusto }
}

/**
 * Quem define o custo: administrador geral, gestor ou farmacêutico da unidade
 * (qualquer dos papéis da conta na unidade, como o tenho_papel do banco). O
 * banco confere de novo em material_definir_custo.
 */
export function podeDefinirCusto(papeisDaUnidade: readonly string[], superAdmin: boolean): boolean {
  return superAdmin || papeisDaUnidade.includes('gestor') || papeisDaUnidade.includes('farmaceutico')
}
