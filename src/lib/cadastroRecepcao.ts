// Regras da revisão do perfil Recepção (RT, 24/11/2026) que valem fora da
// tela: o que falta no cadastro achado na busca (RE3) e quando o bloco do
// responsável aparece no formulário (CA2).
import { idadeEm } from '../domain/idade.ts'

/** "CPF", "CPF e CNS", "CPF, CNS e mãe". */
export function porExtenso(itens: string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

type Achado = { cpf_final: string | null; cns_final: string | null; nome_mae: string | null; data_nascimento: string | null }

/** RE3: o que falta no cadastro achado, numa linha ("Falta CPF e CNS"); vazio quando está completo. */
export function faltaNoCadastro(a: Achado): string {
  const falta = [
    !a.cpf_final ? 'CPF' : null,
    !a.cns_final ? 'CNS' : null,
    !a.data_nascimento ? 'nascimento' : null,
    !a.nome_mae?.trim() ? 'mãe' : null,
  ].filter((x): x is string => !!x)
  return falta.length ? `Falta ${porExtenso(falta)}` : ''
}

const CAMPOS_RESPONSAVEL = ['responsavel_nome', 'responsavel_parentesco', 'responsavel_documento', 'responsavel_telefone'] as const
type Responsavel = Partial<Record<(typeof CAMPOS_RESPONSAVEL)[number], string>>

/** Menor de 18 anos pela data de nascimento (sem data, não é menor). */
export function menorDeIdade(nascimento: string | null | undefined, hoje: string): boolean {
  const i = nascimento ? idadeEm(nascimento, hoje) : null
  return !!i && i.anos < 18
}

/**
 * CA2: o bloco do responsável aparece para menor de 18 anos, quando a recepção
 * marca "tem responsável" ou quando o cadastro já tem algum dado do responsável
 * (nada que já está gravado some da tela).
 */
export function mostraResponsavel(nascimento: string | null | undefined, hoje: string, marcado: boolean, valores: Responsavel): boolean {
  return menorDeIdade(nascimento, hoje) || marcado || CAMPOS_RESPONSAVEL.some((k) => !!valores[k]?.trim())
}
