// Interações medicamentosas críticas (Fase 2, tarefa 3; migration
// 20261031000005): formatos das RPCs e a leitura do erro que trava a prescrição.

export type InteracaoNaPrescricao = {
  interacao_id: string; outro_item_id: string; outro: string; gravidade: 'contraindicada' | 'grave'
  efeito: string; conduta: string | null; fonte: string; grupos: string
}

export type GrupoInteracao = { id: string; nome: string; membros: string[]; no_cadastro: number }
export type ParInteracao = {
  id: string; grupo_a: string; grupo_b: string; grupo_a_id: string; grupo_b_id: string
  gravidade: 'contraindicada' | 'grave'; efeito: string; conduta: string | null; fonte: string
  situacao: 'proposta' | 'ativa' | 'inativa'; motivo: string | null; atualizado_em: string; atualizado_por: string | null; modelo: string | null
}
export type ListaInteracoes = { pode_editar: boolean; grupos: GrupoInteracao[]; pares: ParInteracao[] }
export type InteracaoJustificada = { item_id: string; outro: string; efeito: string; gravidade: string; justificativa: string; por: string | null; em: string }

/** O servidor trava o item com HINT 'interacao_critica' e as interações no DETAIL (JSON). */
export function interacoesDoErro(erro: { hint?: string | null; details?: string | null } | null): InteracaoNaPrescricao[] | null {
  if (!erro || erro.hint !== 'interacao_critica' || !erro.details) return null
  try {
    const lista = JSON.parse(erro.details) as InteracaoNaPrescricao[]
    return Array.isArray(lista) && lista.length > 0 ? lista : null
  } catch {
    return null
  }
}

/** "Fluoxetina, Sertralina" → ["fluoxetina", "sertralina"] (o banco normaliza de novo). */
export function lerPrincipios(texto: string): string[] {
  return [...new Set(texto.split(/[,;\n]+/).map((p) => p.trim().toLowerCase()).filter((p) => p.length >= 3))]
}
