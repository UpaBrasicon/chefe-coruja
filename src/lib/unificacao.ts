// Unificação de pacientes duplicados (Fase 1, tarefa 9): formatos das RPCs e
// a sugestão de qual cadastro fica como principal.

export type Cadastro = {
  id: string; nome: string; nome_mae: string | null; data_nascimento: string | null
  prontuario: string | null; cpf: string | null; cns: string | null; criado_em: string
  atendimentos: number; aberto: boolean; ultimo_atendimento: string | null
}
export type Candidato = { regras: ('nome_nascimento' | 'mae_nascimento' | 'documento')[]; pedido_pendente: boolean; cadastros: Cadastro[] }

type Resumo = { id: string; nome: string; prontuario: string | null; data_nascimento: string | null; nome_mae: string | null }
export type PedidoUnificacao = {
  id: string; status: 'pendente' | 'aprovado' | 'recusado' | 'cancelado' | 'desfeito'; motivo: string
  pedido_em: string; pedido_por: string | null; meu: boolean
  decidido_por: string | null; decidido_em: string | null; motivo_decisao: string | null
  desfeito_em: string | null; motivo_desfazer: string | null
  principal: Resumo; absorvido: Resumo
}

export const ROTULO_REGRA: Record<Candidato['regras'][number], string> = {
  nome_nascimento: 'mesmo nome e nascimento',
  mae_nascimento: 'mesma mãe e nascimento',
  documento: 'mesmo CPF ou CNS',
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
