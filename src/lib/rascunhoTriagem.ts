// Rascunho cifrado da classificação de risco (achado guardado de 07/10/2026,
// A em M1 a M5 pelo RT em 05/11/2026; docs/porta/RASCUNHO-TRIAGEM-DIAGNOSTICO.md).
//
// Mesmo cofre dos outros rascunhos clínicos (item 13 da Fase 0): AES-256-GCM
// com a chave da sessão, nada em texto claro, apagado no logout. Validade de
// 2 h (M2), a mesma janela do modo sem conexão: sinal vital de triagem envelhece.
import type { EscalaDor, ItensDor } from '../clinico/triagem/dor.ts'
import { GESTACAO_VAZIA, type Gestacao } from '../clinico/triagem/gestacao.ts'
import type { CorRisco } from '../domain/risco.ts'
import { carregarEnvelope, novaChave, salvarEnvelope } from './rascunho.ts'

export const VALIDADE_RASCUNHO_TRIAGEM_MS = 2 * 60 * 60 * 1000

/** M1: tudo o que a enfermeira digitou, inclusive a cor que ela escolheu. */
export type RascunhoTriagem = {
  pubManual: 'adulto' | 'pediatrico' | null
  queixa: string
  cor: CorRisco | null
  fluxoId: string | null
  disc: string
  vitais: Record<string, string>
  aval: { avdi: string; glasgow: string; tempo_sintomas: string; comorbidades: string; medicacoes: string }
  escalaEscolhida: EscalaDor | null
  itensDor: ItensDor
  modoO2: 'ar_ambiente' | 'o2_suplementar'
  litros: string
  gest: Gestacao
  motivo: string
  justificativa: string
}

export const RASCUNHO_TRIAGEM_VAZIO: RascunhoTriagem = {
  pubManual: null, queixa: '', cor: null, fluxoId: null, disc: '', vitais: {},
  aval: { avdi: '', glasgow: '', tempo_sintomas: '', comorbidades: '', medicacoes: '' },
  escalaEscolhida: null, itensDor: {}, modoO2: 'ar_ambiente', litros: '', gest: GESTACAO_VAZIA,
  motivo: '', justificativa: '',
}

/** M4: um rascunho por atendimento, pessoa e unidade; a reclassificação tem o seu. */
export function chaveRascunhoTriagem(episodio: string, reclass: boolean, unidadeId?: string, perfilId?: string) {
  return novaChave(`triagem:${episodio}${reclass ? ':reclass' : ''}`, unidadeId, perfilId)
}

/** Há algo além da queixa que veio da recepção? Sem isso, não se grava nem se avisa. */
export function temConteudo(r: RascunhoTriagem, queixaDaRecepcao: string) {
  const semQueixa = (x: RascunhoTriagem) => JSON.stringify({ ...x, queixa: '' })
  return r.queixa.trim() !== (queixaDaRecepcao ?? '').trim() || semQueixa(r) !== semQueixa(RASCUNHO_TRIAGEM_VAZIO)
}

export function carregarRascunhoTriagem(chave: string) {
  return carregarEnvelope<RascunhoTriagem>(chave, VALIDADE_RASCUNHO_TRIAGEM_MS)
}

export function salvarRascunhoTriagem(chave: string, r: RascunhoTriagem) {
  salvarEnvelope(chave, r)
}
