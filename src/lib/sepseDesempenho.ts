// SP1, decisões S1–S6 = A do RT (18/11/2026,
// docs/clinico/SP1-DESEMPENHO-ALERTA-SEPSE-DIAGNOSTICO.md): textos do painel de
// desempenho do alerta de sepse. Os números vêm de public.desempenho_alerta_sepse
// (migration 20270418000095); aqui só se escreve, sempre com o número de casos.

import { numero } from './formato.ts'

export type Agregado = {
  atendimentos: number
  suspeitas: number
  sepses: number
  alertas: number
  alertas_com_sepse: number
  detectadas: number
  dispensados: number
  alertas_parciais: number
  parciais_com_sepse: number
  alertas_completos: number
  completos_com_sepse: number
  suspeitas_com_laboratorio: number
  antimicrobiano_sem_cultura: number
  antecedencia_mediana_h: number | null
  sensibilidade: number | null
  valor_preditivo: number | null
  alertas_por_100: number | null
  cobertura_laboratorio: number | null
  publicavel: boolean
  motivo_nao_publicavel: string | null
}

export type Desempenho = {
  desde: string
  adulto: Agregado
  de_14_a_17: Agregado
  meses: { mes: string; adulto: Agregado }[]
  motivos_dispensa: { motivo: string; quantos: number }[]
}

/** "50% (1 de 2)"; sem denominador, "sem casos". */
export function fracao(parte: number, total: number): string {
  if (!total) return 'sem casos'
  return `${Math.round((parte / total) * 100)}% (${parte} de ${total})`
}

/** Texto pronto para fora da empresa (S5): só quando o painel diz que é publicável. */
export function textoPublicavel(a: Agregado, unidade: string, periodo: string): string | null {
  if (!a.publicavel) return null
  return `Na ${unidade}, de ${periodo}, o alerta de sepse do Chefe Coruja identificou ${fracao(a.detectadas, a.sepses)} das sepses, `
    + `com ${numero(a.alertas_por_100 ?? 0)} alertas por 100 atendimentos; ${fracao(a.alertas_com_sepse, a.alertas)} dos alertas eram sepse. `
    + 'Sepse pelo critério Sepsis-3 (Seymour 2016), calculada dos dados do prontuário.'
}

/** "2026-11" → "nov/2026". */
export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(m) - 1] ?? m}/${ano}`
}
