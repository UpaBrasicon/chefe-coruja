import type { Fonte } from '../ficha.ts'

// Subtriagem do idoso no Manchester (revisão PubMed de 09/10/2026, itens
// médios; decisão do RT em 06/11/2026, H18 = A): uma nota de alerta na
// classificação de risco, pelo resumo do estudo. A nota NÃO sugere cor nem
// muda o protocolo: a prioridade continua sendo a que o enfermeiro marca
// (CLAUDE.md, ADR 0007). Aparece como texto fixo na tela de classificação.

export const FONTE_INGIELEWICZ_2025: Fonte = {
  citacao: 'Ingielewicz A, Szarafińska M, Zając M, et al. Triage and hospitalization outcomes in the geriatric population of an emergency department: A retrospective cohort study comparing the manchester triage system and the emergency severity index. PLoS One. 2025;20(9):e0332304 (PMID 40961061).',
  url: 'https://doi.org/10.1371/journal.pone.0332304',
}

export const NOTA_SUBTRIAGEM_IDOSO =
  'Idoso na classificação (estudo retrospectivo, PLoS One 2025; 1.063 adultos num pronto-socorro da Polônia, 475 com 65 anos ou mais): o Manchester e o ESI tiveram sensibilidade limitada nos idosos, sobretudo nas apresentações inespecíficas; nos idosos predominaram dispneia, fraqueza e alteração do estado mental, e internação ou evento crítico foram mais prováveis com a idade (OR 2,03 de 65 a 79 anos; 3,74 com 80 ou mais). É um alerta de atenção: o protocolo e a decisão da prioridade continuam com o enfermeiro.'
