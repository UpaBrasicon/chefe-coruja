// Percurso da UBS, U15, vacina, PR 3 (VC3 = A): lotes de vacina da UBS.
// O LEDI APS 8.7.0 aceita no lote letras, números, "/", "." e "-", até 30.
// Banco: migration 20270415000027 (vacina_lotes_da_unidade, vacina_lote_salvar).

export type LoteVacina = {
  id: string; imunobiologico: number; imunobiologico_nome: string; sigla: string
  lote: string; fabricante: string; fabricante_nome: string; validade: string; vencido: boolean; ativo: boolean
}
export type PainelLotes = {
  pode_cadastrar: boolean; hoje: string; lotes: LoteVacina[]
  imunobiologicos: { codigo: number; nome: string; sigla: string }[]
  fabricantes: { codigo: string; nome: string }[]
}
export type SituacaoLote = 'desativado' | 'vencido' | 'vence_logo' | 'valido'

/** Dias para o lote vencer avisados na lista. */
export const AVISO_VALIDADE_DIAS = 30

/** Lote no formato do LEDI: maiúscula, sem espaço nas pontas. */
export const normalizarLote = (lote: string) => lote.trim().toUpperCase()

/** O que falta ou está errado no cadastro do lote (null = pode salvar). */
export function conferirLote(f: { imunobiologico: string; lote: string; fabricante: string; validade: string }, hoje: string): string | null {
  if (!f.imunobiologico) return 'Escolha o imunobiológico.'
  const lote = normalizarLote(f.lote)
  if (!lote) return 'Informe o lote.'
  if (!/^[A-Z0-9/.-]{1,30}$/.test(lote)) return 'Lote: até 30 letras, números, "/", "." ou "-".'
  if (!f.fabricante) return 'Escolha o fabricante.'
  if (!f.validade) return 'Informe a validade.'
  if (f.validade < hoje) return 'A validade já passou.'
  return null
}

/** Dias entre duas datas ISO (aaaa-mm-dd). */
export function diasAte(hoje: string, dia: string): number {
  return Math.round((Date.parse(dia + 'T12:00:00Z') - Date.parse(hoje + 'T12:00:00Z')) / 86_400_000)
}

export function situacaoLote(l: Pick<LoteVacina, 'ativo' | 'validade'>, hoje: string): SituacaoLote {
  if (!l.ativo) return 'desativado'
  const d = diasAte(hoje, l.validade)
  if (d < 0) return 'vencido'
  return d <= AVISO_VALIDADE_DIAS ? 'vence_logo' : 'valido'
}

export const ROTULO_SITUACAO: Record<SituacaoLote, string> = {
  desativado: 'Desativado', vencido: 'Vencido', vence_logo: 'Vence em breve', valido: 'Na validade',
}

/** Lotes que a sala de vacina oferece: ativos e na validade. */
export const lotesParaAplicar = (lotes: LoteVacina[], hoje: string) =>
  lotes.filter((l) => situacaoLote(l, hoje) === 'valido' || situacaoLote(l, hoje) === 'vence_logo')
