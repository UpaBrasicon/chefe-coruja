// Contenção mecânica (lacuna 4; decisão do RT em 10/11/2026, A em K1 a K10;
// migration 20270325000001). Formatos das RPCs e os rótulos da tela.
//
// A regra é da Resolução COFEN 746/2024 (contenção só como único meio de
// prevenir dano imediato ou iminente, sob supervisão direta do enfermeiro,
// monitorada pela enfermagem e registrada no prontuário). O padrão da unidade
// vem da Nota Técnica ANVISA GVIMS/GGTES/DIRE5 nº 07/2026: revisão da
// enfermagem em até 1 hora e renovação da prescrição médica a cada 24 horas.
// Os prazos são calculados no servidor (private.contencao_estado); aqui só se
// mostra. Sinais vitais saem como foram escritos (crus).

export type LocalContencao = 'msd' | 'mse' | 'mid' | 'mie' | 'tronco'

export const LOCAIS: { valor: LocalContencao; rotulo: string }[] = [
  { valor: 'msd', rotulo: 'Membro superior direito' },
  { valor: 'mse', rotulo: 'Membro superior esquerdo' },
  { valor: 'mid', rotulo: 'Membro inferior direito' },
  { valor: 'mie', rotulo: 'Membro inferior esquerdo' },
  { valor: 'tronco', rotulo: 'Tronco' },
]

export const FONTES_CONTENCAO =
  'Resolução COFEN 746/2024; Nota Técnica ANVISA GVIMS/GGTES/DIRE5 nº 07/2026 (revisão em até 1 h, prescrição renovada a cada 24 h).'

export type Renovacao = 'em_dia' | 'perto' | 'vencida'

/** O que o servidor calcula (private.contencao_estado). */
export type EstadoContencao = {
  ativa: boolean
  revisoes: number
  ultima_revisao_em: string | null
  proxima_revisao_em: string | null
  revisao_atrasada: boolean
  sem_prescricao: boolean
  prescricao_vence_em: string | null
  renovacao: Renovacao | null
}

export type RevisaoContencao = {
  id: string; revisada_em: string; consciencia: string; rass: number | null
  sinais_vitais: string; pele: string; perfusao: string; necessidades: string | null; observacao: string | null
  intercorrencia_id: string | null; intercorrencia: string | null
  registrado_por: string | null; papel: string; registrado_em: string
  retifica_id: string | null; retificada: boolean
}

export type Contencao = EstadoContencao & {
  id: string; paciente_id: string; episodio_id: string | null; internacao_id: string | null; setor: string | null
  pediatrico: boolean; motivo: string; alternativas: string; locais: LocalContencao[]; pontos: number
  iniciada_em: string; registrada_em: string; papel_inicio: 'enfermeiro' | 'plantonista'; iniciada_por: string | null
  prescrita_em: string | null
  prescricao: { id: string; descricao: string; observacao: string | null; prescrita_em: string; suspenso_em: string | null; medico: string | null } | null
  familia_informada: boolean | null; familia_detalhe: string | null; familia_em: string | null; familia_registrado_por: string | null
  retirada_em: string | null; motivo_retirada: string | null; retirada_automatica: boolean; retirada_por: string | null
  lista_revisoes?: RevisaoContencao[]
}

/** public.contencao_do_paciente */
export type TelaContencao = {
  pediatrico: boolean
  pode_iniciar: boolean; pode_revisar: boolean; pode_retirar: boolean
  ativa: Contencao | null
  anteriores: Contencao[]
}

/** public.contencoes_ativas (listas da enfermagem) */
export type ContencaoAtiva = EstadoContencao & { contencao_id: string; paciente_id: string; iniciada_em: string; pediatrico: boolean }

/** public.relatorio_contencoes */
export type RelatorioContencoes = {
  contencoes: number; pacientes: number; pacientes_atendidos: number; pediatricas: number
  em_curso: number; encerradas: number; horas_encerradas: number; tempo_medio_h: number | null
  revisoes_previstas: number; revisoes_no_prazo: number
  eventos_adversos: number; pacientes_com_evento: number
  iniciadas_sem_prescricao: number; nunca_prescritas: number
  por_setor: { setor: string; total: number }[]
}

export const PAPEL_CONTENCAO: Record<string, string> = {
  plantonista: 'médico', enfermeiro: 'enfermeiro', tecnico_enfermagem: 'técnico de enfermagem',
}

/** "Membro superior direito, membro inferior esquerdo". */
export function rotuloLocais(locais: readonly string[]): string {
  const nomes = LOCAIS.filter((l) => locais.includes(l.valor)).map((l) => l.rotulo)
  return nomes.map((n, i) => (i === 0 ? n : n.toLowerCase())).join(', ')
}

export const rotuloPontos = (n: number) => `${n} ${n === 1 ? 'ponto' : 'pontos'}`

export type Selo = { texto: string; tom: 'critico' | 'ambar' }

/** Os selos do leito e das listas, do mais urgente para o menos. */
export function selosDaContencao(e: Pick<EstadoContencao, 'ativa' | 'revisao_atrasada' | 'sem_prescricao' | 'renovacao'>): Selo[] {
  if (!e.ativa) return []
  const out: Selo[] = []
  if (e.revisao_atrasada) out.push({ texto: 'Revisão da contenção atrasada', tom: 'critico' })
  if (e.sem_prescricao) out.push({ texto: 'Contenção sem prescrição', tom: 'critico' })
  if (e.renovacao === 'vencida') out.push({ texto: 'Prescrição da contenção vencida', tom: 'critico' })
  if (e.renovacao === 'perto') out.push({ texto: 'Renovar a prescrição da contenção', tom: 'ambar' })
  return out
}

/** Só as revisões vigentes (as retificadas saem), da mais nova. */
export function revisoesVigentes(lista: readonly RevisaoContencao[]): RevisaoContencao[] {
  return lista.filter((r) => !r.retificada).sort((a, b) => b.revisada_em.localeCompare(a.revisada_em) || b.registrado_em.localeCompare(a.registrado_em))
}

/** "45 min", "2h05", "3 dias". */
export function duracaoContencao(inicio: string, fim: string | null, agora: number): string {
  const min = Math.max(0, Math.round(((fim ? Date.parse(fim) : agora) - Date.parse(inicio)) / 60_000))
  if (min < 60) return `${min} min`
  if (min < 48 * 60) return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
  return `${Math.floor(min / 1440)} dias`
}

/** Percentual com uma casa ("50%", "33,3%"); sem denominador, null. */
export function percentual(n: number, d: number): string | null {
  if (!d) return null
  const v = Math.round((n / d) * 1000) / 10
  return `${String(v).replace('.', ',')}%`
}

/** As ativas por paciente, para os selos das listas. */
export function ativasPorPaciente(lista: readonly ContencaoAtiva[] | undefined): Map<string, ContencaoAtiva> {
  return new Map((lista ?? []).map((c) => [c.paciente_id, c]))
}

/** RASS do servidor (-5 a +4) como a tela escreve: "+2", "0", "−3". */
export const rotuloRass = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')
