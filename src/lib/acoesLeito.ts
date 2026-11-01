// Ações do cabeçalho do leito (ponto 7 do plantonista, RT 29/10/2026): os
// três botões do paciente juntos no topo do caderno — transferir de setor,
// passar o paciente e registrar intercorrência. Só para quem escreve no leito
// (não o gestor) e com a internação ativa; o banco continua recusando o resto.

export type AcaoLeito = 'transferir' | 'passar' | 'intercorrencia'

export type ItemAcaoLeito = {
  id: AcaoLeito
  rotulo: string
  /** Motivo de o botão estar desligado; null quando pode. */
  bloqueio: string | null
}

export function acoesDoLeito({ ativa, ehGestor, podeTransferir, passagens }: {
  ativa: boolean
  ehGestor: boolean
  /** A tela que abriu o leito sabe transferir (a lista de internados). */
  podeTransferir: boolean
  passagens: { situacao: string }[]
}): ItemAcaoLeito[] {
  if (!ativa || ehGestor) return []
  const aguardando = passagens.some((p) => p.situacao === 'aguardando')
  const itens: ItemAcaoLeito[] = []
  if (podeTransferir) itens.push({ id: 'transferir', rotulo: 'Transferir de setor', bloqueio: null })
  itens.push({
    id: 'passar',
    rotulo: passagens.length > 0 ? 'Passar de novo' : 'Passar este paciente',
    bloqueio: aguardando ? 'Passagem aguardando aceite. Retire no Resumo para passar a outro colega.' : null,
  })
  itens.push({ id: 'intercorrencia', rotulo: 'Registrar intercorrência', bloqueio: null })
  return itens
}

export type SubResumo = 'agora' | 'pendencias' | 'historico' | 'regulacoes'

/** Sub-aba do Resumo que abre primeiro: com a internação encerrada, não há "agora". */
export function subResumoInicial(ativa: boolean): SubResumo {
  return ativa ? 'agora' : 'historico'
}

/** Rótulo da sub-aba Pendências, com a contagem das abertas (ponto 6, risco 1). */
export function rotuloPendencias(lista: { situacao: string }[]): string {
  const abertas = lista.filter((p) => p.situacao === 'aberta').length
  return abertas > 0 ? `Pendências (${abertas})` : 'Pendências'
}

/** Aba do caderno pedida pelo endereço (?aba=). A aba Classificação saiu (ponto 8): abre o Resumo com a janela. */
export function abaDoEndereco(abaInicial: string | undefined): { aba: string | undefined; classificacao: boolean } {
  if (abaInicial === 'classif') return { aba: 'resumo', classificacao: true }
  if (abaInicial === 'diag') return { aba: 'evol', classificacao: false }
  if (abaInicial === 'atestado') return { aba: 'alta', classificacao: false }
  // ponto 15: "Parecer e termos" virou quatro abas; o endereço antigo abre o Parecer
  if (abaInicial === 'comp') return { aba: 'parecer', classificacao: false }
  return { aba: abaInicial, classificacao: false }
}
