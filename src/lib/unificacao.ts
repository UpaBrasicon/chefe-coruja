// Unificação de pacientes duplicados (Fase 1, tarefa 9): formatos das RPCs e
// a sugestão de qual cadastro fica como principal.

export type Cadastro = {
  id: string; nome: string; nome_mae: string | null; data_nascimento: string | null
  prontuario: string | null; cpf: string | null; cns: string | null; criado_em: string
  atendimentos: number; aberto: boolean; ultimo_atendimento: string | null
}
export type Candidato = { regras: ('nome_nascimento' | 'mae_nascimento' | 'documento' | 'nome_conferir')[]; pedido_pendente: boolean; cadastros: Cadastro[] }

type Resumo = { id: string; nome: string; prontuario: string | null; data_nascimento: string | null; nome_mae: string | null }
export type PedidoUnificacao = {
  id: string; status: 'pendente' | 'aprovado' | 'recusado' | 'cancelado' | 'desfeito'; motivo: string
  pedido_em: string; pedido_por: string | null; meu: boolean
  decidido_por: string | null; decidido_em: string | null; motivo_decisao: string | null
  desfeito_em: string | null; motivo_desfazer: string | null
  /** Portão 2, tarefa 3: documentos diferentes (CPF, CNS) e as confirmações */
  divergencias: string[]; confirmado_no_pedido: boolean; confirmado_na_decisao: boolean
  principal: Resumo; absorvido: Resumo
}

export const ROTULO_REGRA: Record<Candidato['regras'][number], string> = {
  nome_nascimento: 'mesmo nome e nascimento',
  mae_nascimento: 'mesma mãe e nascimento',
  documento: 'mesmo CPF ou CNS',
  nome_conferir: 'mesmo nome, nascimento diferente ou em branco — conferir',
}

/**
 * Sugestão de principal: o cadastro com atendimento aberto (é nele que a equipe
 * está trabalhando); depois o com mais atendimentos; empate, o mais antigo.
 */
export function sugerirPrincipal(cadastros: Cadastro[]): string {
  const ordem = [...cadastros].sort((a, b) =>
    Number(b.aberto) - Number(a.aberto) || b.atendimentos - a.atendimentos || a.criado_em.localeCompare(b.criado_em))
  return ordem[0].id
}

const digitos = (v: string | null) => (v ?? '').replace(/\D/g, '')

/**
 * Documentos diferentes entre dois cadastros (Portão 2, tarefa 3, decisão 1a do
 * RT): CPF ou CNS preenchidos nos dois e diferentes. A mesma regra está no
 * servidor (private.documentos_divergentes), que é quem trava.
 */
export function documentosDivergentes(cadastros: Pick<Cadastro, 'cpf' | 'cns'>[]): string[] {
  const [a, b] = cadastros
  if (!a || !b) return []
  return ([['CPF', a.cpf, b.cpf], ['CNS', a.cns, b.cns]] as const)
    .filter(([, x, y]) => digitos(x) !== '' && digitos(y) !== '' && digitos(x) !== digitos(y))
    .map(([nome]) => nome)
}

/** Motivo mínimo do pedido: 30 letras com documento diferente, 10 sem. */
export const motivoMinimo = (divergencias: string[]) => (divergencias.length > 0 ? 30 : 10)
