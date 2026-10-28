// Regras da aba "Webhooks" em Integrações (Fase 5C, tarefa 4, etapa 4.3; opção
// A do RT: lista com gaveta). Os dados vêm de public.webhook_destinos_lista e
// public.webhook_entregas_do_destino (migration 20270201000001_webhooks.sql).

export type EventoWebhook =
  | 'paciente.criado' | 'atendimento.aberto' | 'atendimento.encerrado' | 'internacao.iniciada'
  | 'internacao.alta' | 'prescricao.assinada' | 'regulacao.status_alterado'

/** Na ordem em que aparecem no cadastro. */
export const EVENTOS: { valor: EventoWebhook; rotulo: string }[] = [
  { valor: 'paciente.criado', rotulo: 'Paciente cadastrado' },
  { valor: 'atendimento.aberto', rotulo: 'Atendimento aberto' },
  { valor: 'atendimento.encerrado', rotulo: 'Atendimento encerrado' },
  { valor: 'internacao.iniciada', rotulo: 'Internação' },
  { valor: 'internacao.alta', rotulo: 'Alta da internação' },
  { valor: 'prescricao.assinada', rotulo: 'Prescrição assinada' },
  { valor: 'regulacao.status_alterado', rotulo: 'Regulação mudou de status' },
]
export const rotuloEvento = (e: string) => EVENTOS.find((x) => x.valor === e)?.rotulo ?? e

export type DestinoWebhook = {
  id: string; nome: string; url: string; eventos: EventoWebhook[]
  chave: { id: string; nome: string; prefixo: string; valida: boolean }
  unidades: { id: string; nome: string }[]
  ligado: boolean; desligado_em: string | null; desligado_por: string | null; motivo_desligamento: string | null
  desligado_automatico: boolean; falhando_desde: string | null; segredo_girado_em: string | null
  criado_por: string | null; criado_em: string
  entregas_24h: { entregue: number; pendente: number; falhou: number }
  pode_editar: boolean
}

export type EntregaWebhook = {
  id: string; evento_id: string; tipo: EventoWebhook; ocorrido_em: string; unidade: string | null
  situacao: 'pendente' | 'entregue' | 'falhou' | 'cancelada'; tentativas: number; proxima_em: string
  ultima_em: string | null; ultimo_status: number | null; ultimo_erro: string | null
  entregue_em: string | null; reenviada_em: string | null
}

export type SituacaoDestino = 'ligado' | 'falhando' | 'sem_chave' | 'desligado'

export function situacaoDestino(d: DestinoWebhook): SituacaoDestino {
  if (!d.ligado) return 'desligado'
  if (!d.chave.valida) return 'sem_chave'
  return d.falhando_desde ? 'falhando' : 'ligado'
}
export const ROTULO_DESTINO: Record<SituacaoDestino, string> = {
  ligado: 'Ligado', falhando: 'Falhando', sem_chave: 'Chave vencida', desligado: 'Desligado',
}
export const VARIANTE_DESTINO: Record<SituacaoDestino, 'success' | 'warning' | 'destructive' | 'outline'> = {
  ligado: 'success', falhando: 'warning', sem_chave: 'destructive', desligado: 'outline',
}

/** "38 entregues · 6 na fila · 2 falharam" (só o que tem). */
export function resumo24h(r: DestinoWebhook['entregas_24h']): { texto: string; tom?: 'atencao' | 'critico' }[] {
  const partes: { texto: string; tom?: 'atencao' | 'critico' }[] = [{ texto: `${r.entregue} ${r.entregue === 1 ? 'entregue' : 'entregues'}` }]
  if (r.pendente) partes.push({ texto: `${r.pendente} na fila`, tom: 'atencao' })
  if (r.falhou) partes.push({ texto: `${r.falhou} ${r.falhou === 1 ? 'falhou' : 'falharam'}`, tom: 'critico' })
  return partes
}

export const ROTULO_ENTREGA: Record<EntregaWebhook['situacao'], string> = {
  pendente: 'Na fila', entregue: 'Entregue', falhou: 'Falhou', cancelada: 'Cancelada',
}
export const VARIANTE_ENTREGA: Record<EntregaWebhook['situacao'], 'success' | 'warning' | 'destructive' | 'outline'> = {
  pendente: 'warning', entregue: 'success', falhou: 'destructive', cancelada: 'outline',
}

/** "3ª tentativa · 503 · Service Unavailable" (o que o receptor respondeu). */
export function respostaEntrega(e: EntregaWebhook): string {
  const partes: string[] = []
  if (e.tentativas > 0) partes.push(`${e.tentativas}ª tentativa`)
  if (e.ultimo_status !== null) partes.push(String(e.ultimo_status))
  // o motor grava "HTTP 503: <começo da resposta>"; o status já está ao lado
  const erro = (e.ultimo_erro ?? '').replace(/^HTTP \d+:?\s*/, '')
  if (erro) partes.push(erro)
  return partes.join(' · ')
}

/** Reenvio manual: só o que saiu da fila, e só com o destino ligado. */
export const podeReenviar = (e: EntregaWebhook, destinoLigado: boolean) => destinoLigado && e.situacao !== 'pendente'

/** Endereço aceito pelo banco (private.webhook_url_valida): https com nome público. */
export function enderecoValido(url: string): boolean {
  let u: URL
  try { u = new URL(url.trim()) } catch { return false }
  if (u.protocol !== 'https:' || u.username || u.password) return false
  const host = u.hostname.toLowerCase()
  return !host.startsWith('[') && host.includes('.')
    && !/(^localhost$|\.localhost$|\.local$|\.internal$|\.lan$|\.home$|\.test$|\.invalid$|^[0-9.]+$)/.test(host)
}
