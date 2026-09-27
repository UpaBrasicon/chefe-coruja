import type { Ficha, Fonte } from '../ficha.ts'

// Fonte das ferramentas pediátricas com dose (Fase 5.4).
// DECISÃO DO RESPONSÁVEL TÉCNICO (Ricardo Coutinho de Oliveira Filho, CRM 27761/GO),
// no chat em 27/09/2026, com a ação liberada por ele nas permissões: doses e
// cálculos pediátricos transcritos do PedGuide (ANY App, de G. Moreira), app de
// terceiro, sem autorização do autor e sob responsabilidade do RT ("opção 3").
// O PedGuide declara como base o livro do Pronto-Socorro de Pediatria do
// HC-FMUSP; os valores NÃO foram conferidos no livro. Trocar por fonte primária
// (livro, diretriz ou protocolo da unidade) quando houver.

export const FONTES_PEDIATRIA: Fonte[] = [
  {
    citacao: 'PedGuide v4.0.0 (ANY App, G. Moreira, agosto/2026) — valores transcritos em 27/09/2026 por decisão do responsável técnico; app de terceiro, sem autorização do autor.',
    pediatrica: true,
  },
  {
    citacao: 'Base declarada pelo PedGuide: Instituto da Criança HC-FMUSP. Pronto-Socorro — Pediatria. 4ª ed. Manole; 2023. (não conferido no livro)',
    pediatrica: true,
  },
]

export const REVISADO_PEDIATRIA = '27/09/2026 (transcrito do PedGuide; conferência na fonte primária pendente)'

export function fichaPediatrica(id: string, titulo: string, extra: Fonte[] = []): Ficha {
  return { id, titulo, versao: '2026-09-27.1', publico: 'pediatrico', fontes: [...FONTES_PEDIATRIA, ...extra], revisadoEm: REVISADO_PEDIATRIA }
}
