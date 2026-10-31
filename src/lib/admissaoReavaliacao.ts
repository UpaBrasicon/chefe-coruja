// Admissão única e reavaliação do quadro (ponto 10 do plantonista, modelo B do
// RT em 31/10/2026; migration 20270203000005). A admissão é uma por
// internação: erro de registro se corrige (com justificativa) e mudança
// importante do quadro vira "Reavaliação do quadro", ligada à admissão.

const t = (s: unknown) => String(s ?? '').trim()

/** Linha mínima de documentos_do_paciente que a escolha precisa. */
type DocAdm = { tipo: string; internacao_id: string | null; estado: string; versao: number }

/** A versão da admissão que vale (a corrigida fica 'retificado'). */
export function admissaoVigente<T extends DocAdm>(lista: T[], internacaoId: string | null | undefined): T | null {
  if (!internacaoId) return null
  const da = lista.filter((d) => d.tipo === 'admissao_anamnese' && d.internacao_id === internacaoId)
  return da.filter((d) => d.estado !== 'retificado').sort((a, b) => b.versao - a.versao)[0] ?? da.sort((a, b) => b.versao - a.versao)[0] ?? null
}

export const JUSTIFICATIVA_CORRECAO_ADMISSAO = 10

export type FormReavaliacao = {
  motivo: string
  subjetivo: string
  objetivo: string
  cid: string
  cidOk: boolean
  plano: string
}

export const REAVALIACAO_VAZIA: FormReavaliacao = { motivo: '', subjetivo: '', objetivo: '', cid: '', cidOk: false, plano: '' }

/** O que falta para registrar (a mesma conferência do servidor). */
export function pendenciasReavaliacao(f: FormReavaliacao): string[] {
  const p: string[] = []
  if (!t(f.motivo)) p.push('O que mudou no quadro')
  if (!t(f.subjetivo)) p.push('História')
  if (!t(f.objetivo)) p.push('Exame')
  if (!t(f.cid)) p.push('Hipótese diagnóstica')
  if (!t(f.plano)) p.push('Plano')
  return p
}

/** O texto legível que vai para o prontuário. */
export function textoReavaliacao(f: FormReavaliacao, admissaoEm: string | null): string {
  return [
    'REAVALIAÇÃO DO QUADRO',
    admissaoEm ? `Ligada à admissão de ${admissaoEm}` : '',
    `O QUE MUDOU NO QUADRO\n${t(f.motivo)}`,
    `HISTÓRIA\n${t(f.subjetivo)}`,
    `EXAME\n${t(f.objetivo)}`,
    `Hipótese diagnóstica: ${t(f.cid)}`,
    `PLANO\n${t(f.plano)}`,
  ].filter((x) => x.trim()).join('\n\n')
}

/** Os dados gravados (p_dados de registrar_reavaliacao_quadro). */
export function dadosReavaliacao(f: FormReavaliacao) {
  return { motivo: t(f.motivo), subjetivo: t(f.subjetivo), objetivo: t(f.objetivo), cid: t(f.cid), plano: t(f.plano) }
}
