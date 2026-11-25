// Regulação dentro do paciente (pedidos do RT, R1 a R3, NIR e lista do
// gestor; 24/11/2026). Tipos das RPCs regulacao_pacientes,
// regulacao_do_paciente e regulacao_conversa (migration 20270421000040) e as
// contas da tela: quem tem novidade, o agrupamento por setor e os rótulos.

import type { Carater, Prioridade, Sla, StatusRegulacao, TipoSolicitacao } from './regulacao.ts'

export type IntencaoMensagem = 'mensagem' | 'pergunta' | 'pedido'
export const INTENCOES: Record<IntencaoMensagem, string> = {
  mensagem: 'Mensagem', pergunta: 'Pergunta', pedido: 'Pede dado ou exame',
}

export type Aguardando = { texto: string; intencao: IntencaoMensagem; em: string; autor: string | null }

export type PedidoResumo = {
  id: string; numero: number; status: StatusRegulacao; tipo: TipoSolicitacao; carater: Carater
  prioridade: Prioridade; prioridade_regulador: Prioridade | null
  especialidade: string | null; procedimento: string | null; procedimento_nome: string | null
  tipo_leito: string | null; transporte: string | null; cid: string; destino: string | null
  criada_em: string; em_aberto: boolean
  pendencia_pergunta: string | null; pendencia_em: string | null; motivo_devolucao: string | null
  sla: Sla | null
  conversa: { total: number; novas: number; aguardando: Aguardando[] }
  /** Eu abri o pedido (migration 20270421000041; só na lista da unidade). */
  sou_solicitante?: boolean
}

export type PacienteRegulacao = {
  paciente: { id: string; nome: string; nascimento: string | null }
  internacao: { id: string; tipo: string; admissao: string; episodio_id: string | null } | null
  setor: { id: string; nome: string } | null
  leito: string | null
  /** O setor atual da internação é de um plantão meu agora (migration 20270421000041). */
  no_meu_plantao?: boolean
  pedidos: PedidoResumo[]
}

export type MensagemConversa = {
  id: string; lado: 'origem' | 'central'; intencao: IntencaoMensagem; texto: string; em: string
  autor: string | null; minha: boolean
}
export type Conversa = { meu_lado: 'origem' | 'central' | null; pode_escrever: boolean; mensagens: MensagemConversa[] }

/** Pedido que pede ação da unidade: pergunta formal, devolvido ou mensagem da central sem resposta. */
export function esperaAOrigem(p: PedidoResumo): boolean {
  return p.status === 'pendencia' || p.status === 'devolvida' || p.conversa.aguardando.length > 0
}

/** Mensagens da central que eu ainda não li, somadas nos pedidos do paciente. */
export function mensagensNovas(l: Pick<PacienteRegulacao, 'pedidos'>): number {
  return l.pedidos.reduce((n, p) => n + (p.conversa?.novas ?? 0), 0)
}

/** Só quem tem pedido de regulação em aberto (a lista do médico). */
export function emRegulacao(lista: PacienteRegulacao[]): PacienteRegulacao[] {
  return lista.filter((l) => l.pedidos.some((p) => p.em_aberto))
}

/**
 * "Meus" na lista do médico (RT, 24/11/2026): os pedidos em aberto que eu fiz
 * ou os pacientes dos setores do meu plantão agora.
 */
export function meusPacientes(lista: PacienteRegulacao[]): PacienteRegulacao[] {
  return lista.filter((l) => l.no_meu_plantao === true || l.pedidos.some((p) => p.em_aberto && p.sou_solicitante === true))
}

/** A RPC já diz quem é meu? (sem a migration 20270421000041 a tela mostra a unidade toda) */
export function sabeQuemEMeu(lista: PacienteRegulacao[]): boolean {
  return lista.some((l) => typeof l.no_meu_plantao === 'boolean')
}

/** Grupos por setor, na ordem do nome; quem está sem leito (porta) fica no fim. */
export const SEM_SETOR = 'Sem leito (porta ou atendimento)'
export function porSetor(lista: PacienteRegulacao[]): { setor: string; pacientes: PacienteRegulacao[] }[] {
  const grupos = new Map<string, PacienteRegulacao[]>()
  for (const l of lista) {
    const k = l.setor?.nome ?? SEM_SETOR
    grupos.set(k, [...(grupos.get(k) ?? []), l])
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => (a === SEM_SETOR ? 1 : b === SEM_SETOR ? -1 : a.localeCompare(b, 'pt-BR')))
    .map(([setor, pacientes]) => ({ setor, pacientes }))
}

/** Quem pede ação primeiro, depois quem tem mensagem nova, depois o leito. */
export function ordenarPorAcao(lista: PacienteRegulacao[]): PacienteRegulacao[] {
  const peso = (l: PacienteRegulacao) => (l.pedidos.some(esperaAOrigem) ? 0 : mensagensNovas(l) > 0 ? 1 : 2)
  return lista.map((l, i) => ({ l, i })).sort((a, b) => peso(a.l) - peso(b.l) || a.i - b.i).map((x) => x.l)
}

/** "Pergunta do regulador", "O regulador pede", "Mensagem do regulador". */
export function rotuloAguardando(a: Pick<Aguardando, 'intencao'>): string {
  return a.intencao === 'pergunta' ? 'Pergunta do regulador' : a.intencao === 'pedido' ? 'O regulador pede' : 'Mensagem do regulador'
}

// ── Internação do NIR (NI2 = A, RT 24/11/2026) ───────────────────────────────

/** Algum pedido em aberto com prazo vencido (na origem, na central ou no destino). */
export function prazoVencido(l: Pick<PacienteRegulacao, 'pedidos'>): boolean {
  return l.pedidos.some((p) => p.em_aberto && !!p.sla && (p.sla.atrasado_origem || p.sla.atrasado_central || !!p.sla.atrasado_destino))
}

/**
 * Lista do NIR: quem está em regulação vem primeiro — prazo vencido no topo,
 * depois o que a central espera da unidade e a mensagem nova —; quem não tem
 * regulação fica à parte, num grupo recolhido. Na mesma faixa, a ordem de antes.
 */
export function separarParaNir(lista: PacienteRegulacao[]): { emRegulacao: PacienteRegulacao[]; semRegulacao: PacienteRegulacao[] } {
  const peso = (l: PacienteRegulacao) => (prazoVencido(l) ? 0 : l.pedidos.some(esperaAOrigem) ? 1 : mensagensNovas(l) > 0 ? 2 : 3)
  const com = emRegulacao(lista).map((l, i) => ({ l, i })).sort((a, b) => peso(a.l) - peso(b.l) || a.i - b.i).map((x) => x.l)
  const ids = new Set(com.map((l) => l.paciente.id))
  return { emRegulacao: com, semRegulacao: lista.filter((l) => !ids.has(l.paciente.id)) }
}

/** "1 paciente", "3 pacientes". */
export const pacientes = (n: number) => (n === 1 ? '1 paciente' : `${n} pacientes`)

