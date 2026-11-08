// A chegada regulada vista pela enfermagem (item 16 do teste da rede; decisão
// do RT em 08/11/2026: opção B e aviso de saída). O leito reservado aparece na
// lista do setor com quem chega; a tela avisa quando o paciente sai da origem.

export type ChegadaResumo = {
  regulacao_id: string
  numero: number
  status: string
  nome: string
  data_nascimento: string | null
  origem: string
  saida_em: string | null
}

function idadeEmAnos(nascimento: string | null, agora: number): number | null {
  if (!nascimento) return null
  const n = new Date(`${nascimento}T12:00:00Z`)
  const h = new Date(agora)
  let anos = h.getUTCFullYear() - n.getUTCFullYear()
  if (h.getUTCMonth() < n.getUTCMonth() || (h.getUTCMonth() === n.getUTCMonth() && h.getUTCDate() < n.getUTCDate())) anos -= 1
  return anos
}

function horaBrasilia(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

/** A linha do leito reservado: quem chega, de onde, o número e a saída. */
export function linhaDaChegada(c: ChegadaResumo, agora: number): string {
  const idade = idadeEmAnos(c.data_nascimento, agora)
  const quem = idade === null ? c.nome : `${c.nome}, ${idade}a`
  const saida = c.status === 'em_transito' && c.saida_em ? `saiu às ${horaBrasilia(c.saida_em)}` : 'ainda não saiu da origem'
  return `Reservado · chega ${quem}, da ${c.origem} (regulação nº ${c.numero}) · ${saida}`
}

/** Quem passou a "em trânsito" desde a leitura anterior. Na primeira leitura, ninguém. */
export function sairamAgora<T extends { regulacao_id: string; status: string }>(antes: readonly T[] | undefined, agora: readonly T[]): T[] {
  if (!antes) return []
  const jaEmTransito = new Set(antes.filter((c) => c.status === 'em_transito').map((c) => c.regulacao_id))
  return agora.filter((c) => c.status === 'em_transito' && !jaEmTransito.has(c.regulacao_id))
}
