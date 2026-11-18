// LG12, decisões V1–V5 = A do RT (18/11/2026,
// docs/regulatorio/LG12-TECNOVIGILANCIA-DIAGNOSTICO.md): relato de problema
// no módulo clínico. As regras valem também no banco
// (public.relatar_tecnovigilancia, migration 20270418000094); aqui a tela
// avisa antes de enviar. Um teste confere que as duas recusam os mesmos textos.

export type TipoRelato = 'conteudo' | 'sistema' | 'paciente'
export type Desfecho = 'sem_dano' | 'dano_temporario' | 'grave' | 'obito'
export type SituacaoRelato = 'recebido' | 'em_investigacao' | 'concluido'

export const TIPO_RELATO: Record<TipoRelato, string> = {
  conteudo: 'Erro de conteúdo ou de cálculo',
  sistema: 'Falha do sistema',
  paciente: 'Chegou ao paciente',
}

export const DESFECHO: Record<Desfecho, string> = {
  sem_dano: 'Sem dano',
  dano_temporario: 'Dano temporário',
  grave: 'Dano permanente ou internação',
  obito: 'Óbito',
}

export const SITUACAO_RELATO: Record<SituacaoRelato, string> = {
  recebido: 'Recebido',
  em_investigacao: 'Em investigação',
  concluido: 'Concluído',
}

/** Mesmas regras de private.tem_dado_pessoal: CPF, CNS ou telefone com DDD. */
export function temDadoPessoal(texto: string): boolean {
  const t = texto ?? ''
  return /\d{3}\.\d{3}\.\d{3}-?\d{2}/.test(t)
    || /(^|\D)\d{11}(\D|$)/.test(t.replace(/[\s.-]/g, ''))
    || /(^|\D)[1-9]\d{14}(\D|$)/.test(t.replace(/\s/g, ''))
    || /\(?\d{2}\)?\s?9?\d{4}[\s-]\d{4}/.test(t)
}

/** O que falta para enviar (vazio = pode). */
export function faltasDoRelato(r: { tipo: TipoRelato | ''; desfecho: Desfecho | ''; descricao: string }): string[] {
  const f: string[] = []
  if (!r.tipo) f.push('o tipo do problema')
  if (r.tipo === 'paciente' && !r.desfecho) f.push('o desfecho no paciente')
  const d = r.descricao.trim()
  if (d.length < 10) f.push('a descrição (10 caracteres ou mais)')
  if (d.length > 2000) f.push('uma descrição mais curta (até 2000 caracteres)')
  if (temDadoPessoal(d)) f.push('tirar CPF, CNS ou telefone do texto')
  return f
}

/** Prazo do art. 8º da RDC 67/2009, como o banco calcula. */
export function prazoDoRelato(tipo: TipoRelato, desfecho: Desfecho | ''): string {
  if (tipo === 'paciente' && desfecho === 'obito') return '72 horas'
  if (tipo === 'paciente' && desfecho === 'grave') return '10 dias'
  return '30 dias'
}

/** "vence em 2 dias", "vence em 5 h", "venceu há 3 dias". */
export function textoPrazo(prazoEm: string, agora: number = Date.now()): string {
  const ms = new Date(prazoEm).getTime() - agora
  const horas = Math.round(Math.abs(ms) / 3_600_000)
  const quanto = horas < 48 ? `${horas} h` : `${Math.round(horas / 24)} dias`
  return ms >= 0 ? `vence em ${quanto}` : `venceu há ${quanto}`
}

export type RelatoTv = {
  id: string
  numero: number
  ferramenta_id: string
  ferramenta_titulo: string | null
  versao: string | null
  unidade: string | null
  relatado_em: string
  tipo: TipoRelato
  desfecho: Desfecho | null
  descricao: string
  prazo_em: string
  prazo_legal: boolean
  grave: boolean
  situacao: SituacaoRelato
  relatado_por?: string | null
  andamento: { em: string; situacao: SituacaoRelato | 'aviso_rt'; texto: string | null; causa: string | null; acao: string | null; versao_corrigida: string | null; por: string | null }[]
  suspensao: { id: string; motivo: string; em: string } | null
}
