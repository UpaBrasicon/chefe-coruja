// "Observações que você abriu" (decisão do RT em 06/11/2026: "Sim, mostrar";
// migration 20270305000002). O médico da porta vê as observações que ele pôs
// em observação, para pedir parecer, marcar a reavaliação e encerrá-las
// (decisão do RT em 07/11/2026). Regras puras da seção, para teste.

export type ObservacaoQueAbri = {
  internacao_id: string
  paciente_id: string
  nome: string
  nome_social: string | null
  data_nascimento: string | null
  setor_nome: string
  box: string | null
  entrada: string
  prazo: string
}

/** Tira o que já está no painel normal (o médico também escalado na observação): sem cartão duplicado. */
export function semDuplicar<T extends { internacao_id: string }>(minhas: T[], noPainel: Iterable<string>): T[] {
  const ja = new Set(noPainel)
  return minhas.filter((o) => !ja.has(o.internacao_id))
}

/** Nome com o nome social na frente, como na identificação dos documentos. */
export function nomeExibido(o: { nome: string; nome_social: string | null }): string {
  return o.nome_social ? `${o.nome_social} (${o.nome})` : o.nome
}

/** A seção é só do médico (plantonista); gestor e enfermagem não a veem. */
export function mostraSecao(papel: string | null | undefined): boolean {
  return papel === 'plantonista'
}
