// "Documentos e pedidos" do leito (MA1, revisão da Internação aprovada pelo RT
// em 24/11/2026): o que era a lista solta do "Mais" vira grupos — Pedidos,
// Termos e Avaliações —, cada item com a situação ao lado. Abrir um item não
// muda a ordem das abas: ele abre na área da aba "Mais", com o nome no botão.
// A Admissão saiu daqui (vai para o Resumo enquanto não feita).

export type ItemMais = 'parecer' | 'encaminhamento' | 'apac' | 'aih' | 'termo' | 'paliativos' | 'escalas'

export const GRUPOS_MAIS: { titulo: string; itens: { id: ItemMais; rotulo: string }[] }[] = [
  { titulo: 'Pedidos', itens: [
    { id: 'parecer', rotulo: 'Parecer' }, { id: 'encaminhamento', rotulo: 'Encaminhamento' },
    { id: 'apac', rotulo: 'APAC' }, { id: 'aih', rotulo: 'AIH' },
  ] },
  { titulo: 'Termos', itens: [{ id: 'termo', rotulo: 'Termo de consentimento' }, { id: 'paliativos', rotulo: 'Cuidados paliativos' }] },
  { titulo: 'Avaliações', itens: [{ id: 'escalas', rotulo: 'Escalas' }] },
]

export const ITENS_MAIS: ItemMais[] = GRUPOS_MAIS.flatMap((g) => g.itens.map((i) => i.id))
export const rotuloMais = (id: ItemMais) => GRUPOS_MAIS.flatMap((g) => g.itens).find((i) => i.id === id)?.rotulo ?? id
export const ehItemMais = (id: string): id is ItemMais => (ITENS_MAIS as string[]).includes(id)

type Doc = { tipo: string; estado: string; numero: string | null; internacao_id: string | null }

/** A situação de cada item, a partir do que o banco já devolve. */
export function situacoesMais(c: {
  internacaoId: string
  documentos: readonly Doc[]
  cadastroFaltaAih: readonly string[]
  pareceresAbertos: number
  encaminhamentoPendente: boolean
  apacs: readonly { status: string }[]
  pediatrico: boolean | null
}): Record<ItemMais, string> {
  const daInternacao = c.documentos.filter((d) => d.internacao_id === c.internacaoId && d.estado !== 'cancelado' && d.estado !== 'retificado')
  const emitido = (tipo: string) => daInternacao.find((d) => d.tipo === tipo && d.estado !== 'rascunho')
  const rascunho = (tipo: string) => daInternacao.some((d) => d.tipo === tipo && d.estado === 'rascunho')
  const laudo = emitido('laudo_aih')
  const termos = daInternacao.filter((d) => d.tipo === 'termo_consentimento' && d.estado !== 'rascunho').length
  const apacAbertas = c.apacs.filter((a) => a.status === 'solicitada').length
  return {
    aih: laudo ? `laudo nº ${laudo.numero ?? '—'}` : rascunho('laudo_aih') ? 'rascunho aberto' : c.cadastroFaltaAih.length ? 'cadastro incompleto' : 'não feito',
    parecer: c.pareceresAbertos ? `${c.pareceresAbertos} aguardando resposta` : 'nenhum aberto',
    encaminhamento: c.encaminhamentoPendente ? 'aguardando aceite' : 'nenhum aberto',
    apac: apacAbertas ? `${apacAbertas} solicitada${apacAbertas === 1 ? '' : 's'}` : c.apacs.length ? `${c.apacs.length} no histórico` : 'nenhuma',
    termo: termos ? `${termos} registrado${termos === 1 ? '' : 's'}` : 'nenhum',
    paliativos: 'avaliação e termo',
    escalas: c.pediatrico === true ? 'NIPS/FLACC e curva de crescimento' : c.pediatrico === false ? 'Braden e Morse' : 'pela idade',
  }
}
