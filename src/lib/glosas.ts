// Glosas da conta (Fase 5B, tarefa 6): formatos das RPCs e as ações de cada
// etapa. Quem decide é o servidor (public.mudar_glosa); aqui só se escolhe o
// que mostrar.

export type EtapaGlosa = 'aberta' | 'em_recurso' | 'recuperada' | 'perdida'
export type MotivoGlosa = 'cns' | 'cbo' | 'cid' | 'quantidade' | 'duplicidade' | 'prazo' | 'documento' | 'outro'

export type Glosa = {
  id: string; conta_id: string; conta_numero: string; paciente: string | null
  item_origem: string | null; item_id: string | null; item_rotulo: string
  competencia: string; valor: number; valor_sugerido: number | null
  motivo_codigo: MotivoGlosa; motivo_texto: string | null; status: EtapaGlosa
  competencia_recurso: string | null; valor_recuperado: number | null
  registrada_por: string | null; registrada_em: string; status_em: string
  eventos: { evento: string; de: string | null; para: string | null; motivo: string | null; competencia: string | null; valor: number | null; por: string | null; em: string }[]
}
/** O que pode ser glosado na conta fechada: a conta inteira, os itens e as APACs ligadas. */
export type Glosavel = { origem: string | null; id: string | null; rotulo: string; valor: number; competencia: string }

export type PainelGlosas = {
  glosas: Glosa[]
  por_competencia: { competencia: string; quantidade: number; glosado: number; recuperado: number; perdido: number; em_andamento: number }[]
  por_motivo: { motivo: MotivoGlosa; quantidade: number; glosado: number; recuperado: number }[]
  totais: { quantidade: number; glosado: number; recuperado: number; perdido: number; em_andamento: number }
  pode_conduzir: boolean
  pode_perder: boolean
}

export const MOTIVO_GLOSA: Record<MotivoGlosa, string> = {
  cns: 'CNS do paciente ou do profissional', cbo: 'CBO incompatível', cid: 'CID ausente ou incompatível',
  quantidade: 'Quantidade acima do permitido', duplicidade: 'Duplicidade', prazo: 'Fora do prazo da competência',
  documento: 'AIH ou APAC não autorizada ou vencida', outro: 'Outro',
}
export const ETAPA_GLOSA: Record<EtapaGlosa, string> = {
  aberta: 'aberta', em_recurso: 'em recurso', recuperada: 'recuperada', perdida: 'perdida',
}
export const EVENTO_GLOSA: Record<string, string> = {
  registrada: 'Registrada', recurso: 'Reapresentada ou em recurso', recurso_negado: 'Recurso negado',
  recuperada: 'Recuperada', perdida: 'Perdida (gestor)',
}

export type AcaoGlosa = { para: EtapaGlosa; rotulo: string; pedeCompetencia?: boolean; pedeValor?: boolean }

/** Ações da etapa atual (5a/6a): o faturamento conduz o recurso; só o gestor marca como perdida. */
export function acoesDaGlosa(g: Pick<Glosa, 'status'>, quem: { pode_conduzir: boolean; pode_perder: boolean }): AcaoGlosa[] {
  const a: AcaoGlosa[] = []
  if (quem.pode_conduzir) {
    if (g.status === 'aberta') a.push({ para: 'em_recurso', rotulo: 'Reapresentar ou recorrer', pedeCompetencia: true })
    if (g.status === 'em_recurso') {
      a.push({ para: 'recuperada', rotulo: 'Recuperada', pedeValor: true })
      a.push({ para: 'aberta', rotulo: 'Recurso negado' })
    }
  }
  if (quem.pode_perder && (g.status === 'aberta' || g.status === 'em_recurso')) a.push({ para: 'perdida', rotulo: 'Marcar como perdida' })
  return a
}

/** Valor digitado em reais ("1.234,56" ou "12,5") para número; vazio ou inválido vira null. */
export function lerValor(texto: string): number | null {
  const t = texto.trim().replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  return Number(t)
}
