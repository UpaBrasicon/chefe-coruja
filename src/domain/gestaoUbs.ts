// Gestão ambulatorial da UBS (percurso da UBS, U13, PR 2). Tipo do retorno de
// public.gestao_ubs (migration 20270415000020_ubs_u13_gestao_ambulatorial.sql)
// e as contas da tela: períodos, faixas e proporções.

export type GestaoUbs = {
  de: string
  ate: string
  producao: {
    total: number
    por_tipo: Record<string, number>
    por_turno: { manha: number; tarde: number; noite: number }
    por_faixa: { ate_1: number; de_2_a_11: number; de_12_a_17: number; de_18_a_59: number; de_60_mais: number; sem_idade: number }
    por_profissional: { nome: string; n: number }[]
    gestantes: number
    criancas_ate_2: number
    hipertensos: number
    diabeticos: number
    escutas_por_cor: Partial<Record<'vermelho' | 'amarelo' | 'verde' | 'azul', number>>
  }
  agenda: {
    por_situacao: Record<string, number>
    comparecimento: number | null
    por_profissional: { nome: string; marcadas: number; faltas: number }[]
  }
  espera: {
    escuta_media_min: number | null
    escuta_mediana_min: number | null
    consulta_media_min: number | null
    consulta_mediana_min: number | null
    nao_aguardou: number
    fichas_vencidas: number
  }
  medicamentos: {
    itens: number
    pacientes: number
    sem_farmaceutico: number
    mais_dispensados: { nome: string; quantidade: number }[]
    estoque_critico: number
    estoque_falta: number
    administracoes: number
  }
  rede: { envios_upa: Record<string, number>; retornos: number; retornos_a_ver: number }
  vigilancia: { pendentes: number; total: number }
}

/** Períodos da tela, em dias até hoje (o banco aceita até 366). */
export const PERIODOS = [
  { dias: 7, rotulo: '7 dias' },
  { dias: 30, rotulo: '30 dias' },
  { dias: 90, rotulo: '90 dias' },
  { dias: 365, rotulo: '12 meses' },
] as const

/** Início do período: hoje menos (dias - 1), para o período ter `dias` dias contando hoje. */
export function inicioDoPeriodo(hojeIso: string, dias: number): string {
  const d = new Date(hojeIso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - (dias - 1))
  return d.toISOString().slice(0, 10)
}

export const FAIXAS: { chave: keyof GestaoUbs['producao']['por_faixa']; rotulo: string }[] = [
  { chave: 'ate_1', rotulo: 'até 1 ano' },
  { chave: 'de_2_a_11', rotulo: '2 a 11 anos' },
  { chave: 'de_12_a_17', rotulo: '12 a 17 anos' },
  { chave: 'de_18_a_59', rotulo: '18 a 59 anos' },
  { chave: 'de_60_mais', rotulo: '60 anos ou mais' },
  { chave: 'sem_idade', rotulo: 'sem data de nascimento' },
]

/** Proporção em % inteiro; null quando não há base. */
export function proporcao(parte: number, total: number): number | null {
  return total > 0 ? Math.round((parte / total) * 100) : null
}

/** Pares [chave, n] com n > 0, do maior para o menor. */
export function ordenarContagem(obj: Record<string, number | undefined>): [string, number][] {
  return Object.entries(obj)
    .filter((e): e is [string, number] => (e[1] ?? 0) > 0)
    .sort((a, b) => b[1] - a[1])
}

/** Minutos em texto curto: "45 min" ou "2 h 05". */
export function minutos(m: number | null): string {
  if (m === null) return '—'
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}
