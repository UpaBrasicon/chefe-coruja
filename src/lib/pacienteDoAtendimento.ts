import { idadeEm, type FaixaEtaria } from '../domain/idade.ts'
import type { UnidadeIdade } from '../domain/pacienteCentral.ts'

// F3 das ferramentas pelo CID (pedido do RT de 17/11/2026; condições da sessão
// de obrigatórios legais): a ferramenta aberta por cima do atendimento pode
// receber a idade e o peso do paciente, mas só depois do clique do médico, com
// a origem e a data à vista, e o campo continua editável. Peso velho não vai:
// na criança, mais de 24 h; no adulto, mais de 7 dias (decisão do RT). Sem
// idade conhecida, vale o prazo da criança (o mais curto).

export const PRAZO_PESO_HORAS = { pediatrico: 24, adulto: 24 * 7 } as const

export type PesoAferido = { valor_num: number; aferido_em: string }

const dataCurta = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Peso que pode ir à ferramenta, com a origem; null se não há, é inválido ou está velho. */
export function pesoParaFerramenta(peso: PesoAferido | null | undefined, faixa: FaixaEtaria, agora: Date):
  { kg: number; origem: string } | { kg: null; motivo: string } {
  if (!peso || !(peso.valor_num > 0)) return { kg: null, motivo: 'Sem peso aferido no prontuário.' }
  const horas = (agora.getTime() - new Date(peso.aferido_em).getTime()) / 3_600_000
  const prazo = faixa === 'adulto' ? PRAZO_PESO_HORAS.adulto : PRAZO_PESO_HORAS.pediatrico
  if (!Number.isFinite(horas) || horas < 0) return { kg: null, motivo: 'Data do peso inválida.' }
  if (horas > prazo) {
    return { kg: null, motivo: `Último peso de ${dataCurta(peso.aferido_em)}, com mais de ${faixa === 'adulto' ? '7 dias' : '24 h'}: digite o peso de hoje.` }
  }
  return { kg: peso.valor_num, origem: `peso do prontuário, ${dataCurta(peso.aferido_em)}` }
}

/** Idade para a Central: abaixo de 2 anos em meses, depois em anos completos. */
export function idadeParaFerramenta(nascimento: string | null | undefined, agora: Date):
  { valor: number; unidade: UnidadeIdade; rotulo: string } | null {
  if (!nascimento) return null
  const i = idadeEm(nascimento, agora)
  if (!i) return null
  if (i.anos < 2) {
    const meses = i.anos * 12 + i.meses
    return { valor: meses, unidade: 'meses', rotulo: `${meses} ${meses === 1 ? 'mês' : 'meses'}` }
  }
  return { valor: i.anos, unidade: 'anos', rotulo: `${i.anos} anos` }
}
