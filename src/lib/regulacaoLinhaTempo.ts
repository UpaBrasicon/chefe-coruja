// Linha do tempo e situação do pedido de regulação (revisão do perfil Médico
// regulador, RD2 = A, RT em 24/11/2026). Uma lista só, da mais recente para a
// mais antiga: mudanças de situação, conversa (pergunta da central e
// resposta, mensagens quando houver) e anexos, com nomes legíveis no lugar
// dos códigos do banco ("devolvida_a_fila" vira "devolvida à fila"). No
// "Tempo em cada status", só a situação de agora fica marcada como atual.
import { STATUS, formatarEspera, type StatusRegulacao } from './regulacao.ts'

/** Os pedidos que ainda esperam decisão (os mesmos do painel de prazos, regulacao_sla_painel). */
export const ESPERANDO_DECISAO: readonly StatusRegulacao[] = ['enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino']
export const esperandoDecisao = (status: StatusRegulacao) => ESPERANDO_DECISAO.includes(status)

/** Nome legível de cada evento gravado em regulacao_eventos. */
export const ROTULO_EVENTO: Record<string, string> = {
  enviada: 'enviada à central',
  reenviada: 'corrigida e reenviada',
  assumida: 'assumida pelo regulador',
  devolvida_a_fila: 'devolvida à fila',
  prioridade_regulador: 'prioridade definida pelo regulador',
  externo_registrado: 'regulação externa registrada',
  pendencia: 'pergunta da central',
  pendencia_respondida: 'pergunta respondida',
  devolvida: 'devolvida à origem para corrigir',
  autorizada: 'autorizada',
  negada: 'negada',
  cancelada: 'cancelada',
  destino_aceitou: 'aceita pelo destino',
  destino_recusou: 'recusada pelo destino',
  saiu: 'paciente saiu da origem',
  chegou: 'paciente chegou ao destino',
  nao_chegou: 'paciente não chegou ao destino',
  origem_encerrada: 'atendimento da origem encerrado',
  evolucao_atualizada: 'evolução atualizada',
  anexo_incluido: 'anexo incluído',
  anexo_retirado: 'anexo retirado',
  anexo_aberto: 'anexo aberto',
  mensagem: 'mensagem na conversa',
  // Internação do NIR (migration 20270425000030)
  pendencia_unidade: 'pendência da unidade registrada',
  pendencia_unidade_reaviso: 'aviso ao médico reenviado',
  pendencia_unidade_resolvida: 'pendência da unidade resolvida',
  isolamento_alterado: 'isolamento do pedido alterado',
}

/** Rótulo do evento; o que não está no mapa sai sem os sublinhados. */
export function rotuloEvento(evento: string): string {
  return ROTULO_EVENTO[evento] ?? evento.replace(/_/g, ' ')
}

export type TipoItem = 'situacao' | 'conversa' | 'anexo' | 'evolucao'
export type ItemLinhaDoTempo = {
  chave: string; em: string; tipo: TipoItem; titulo: string; texto: string | null; por: string | null
}

export type EventoPedido = { evento: string; por: string | null; em: string; detalhes: Record<string, unknown> | null }
export type EvolucaoPedido = { texto: string; sinais_vitais: string | null; em: string; autor: string | null; papel?: string | null }
export type MensagemPedido = { id: string; lado: 'origem' | 'central'; texto: string; em: string; autor: string | null; intencao?: string }

function tipoDoEvento(evento: string): TipoItem {
  if (evento.startsWith('anexo_')) return 'anexo'
  if (evento === 'pendencia' || evento === 'pendencia_respondida' || evento === 'mensagem') return 'conversa'
  if (evento === 'evolucao_atualizada') return 'evolucao'
  return 'situacao'
}

/** O texto útil dos detalhes do evento (nome do anexo, pergunta, resposta, motivo). */
export function textoDoEvento(e: Pick<EventoPedido, 'evento' | 'detalhes'>): string | null {
  const d = e.detalhes ?? {}
  const txt = (k: string) => (typeof d[k] === 'string' && (d[k] as string).trim() ? (d[k] as string).trim() : null)
  // na negação o motivo é um código (a tela do pedido já mostra o motivo por extenso)
  const motivo = e.evento === 'negada' ? null : txt('motivo')
  const partes = [txt('nome'), txt('pergunta'), txt('resposta'), txt('texto'), txt('titulo'), txt('observacao'), txt('nota'), motivo].filter((x): x is string => !!x)
  return partes.length > 0 ? partes.join(' · ') : null
}

/**
 * Junta eventos, evoluções e mensagens numa lista só, da mais recente para a
 * mais antiga. "Anexo aberto" é registro de acesso e fica fora. Quando as
 * evoluções e as mensagens vêm com o texto, o evento repetido delas sai.
 */
export function montarLinhaDoTempo({ eventos = [], evolucoes = [], mensagens, rotulosDocumento }: {
  eventos?: EventoPedido[]; evolucoes?: EvolucaoPedido[]; mensagens?: MensagemPedido[]
  /** Mapa tipo → rótulo dos documentos: o anexo do prontuário sai com o nome acentuado, como na lista de anexos. */
  rotulosDocumento?: Record<string, string>
}): ItemLinhaDoTempo[] {
  const itens: ItemLinhaDoTempo[] = []
  eventos.forEach((e, i) => {
    if (e.evento === 'anexo_aberto') return
    if (e.evento === 'evolucao_atualizada' && evolucoes.length > 0) return
    if (e.evento === 'mensagem' && mensagens) return
    const nome = e.detalhes?.nome
    const ev = rotulosDocumento && e.evento.startsWith('anexo_') && typeof nome === 'string'
      ? { ...e, detalhes: { ...e.detalhes, nome: nomeAnexoLegivel(nome, rotulosDocumento) } } : e
    itens.push({ chave: `e${i}`, em: e.em, tipo: tipoDoEvento(e.evento), titulo: rotuloEvento(e.evento), texto: textoDoEvento(ev), por: e.por })
  })
  evolucoes.forEach((v, i) => {
    const texto = v.sinais_vitais ? `${v.texto}\nSinais vitais: ${v.sinais_vitais}` : v.texto
    itens.push({ chave: `v${i}`, em: v.em, tipo: 'evolucao', titulo: v.papel === 'nir' ? 'evolução atualizada pelo NIR' : 'evolução atualizada', texto, por: v.autor })
  })
  for (const m of mensagens ?? []) {
    itens.push({ chave: `m${m.id}`, em: m.em, tipo: 'conversa', titulo: m.lado === 'central' ? 'mensagem do regulador' : 'mensagem da origem', texto: m.texto, por: m.autor })
  }
  return itens.sort((a, b) => b.em.localeCompare(a.em))
}

export type TempoStatus = { status: StatusRegulacao; segundos: number; vezes: number; atual: boolean }

/**
 * Só a situação de agora fica como atual. Com a situação do pedido, é ela (e
 * pedido encerrado não tem atual); sem ela, a última que o banco marcou.
 */
export function temposComAtual<T extends TempoStatus>(tempos: T[], statusAtual?: StatusRegulacao): T[] {
  let alvo = -1
  if (statusAtual) alvo = tempos.findIndex((t) => t.status === statusAtual)
  else tempos.forEach((t, k) => { if (t.atual) alvo = k })
  return tempos.map((t, k) => ({ ...t, atual: k === alvo }))
}

/**
 * Nome do anexo que veio do prontuário (NI3, RT 24/11/2026). O banco monta o
 * nome com o tipo sem acento ("Evolucao (versão 1)", "Pedido Exames nº 3");
 * a tela troca o começo pelo rótulo do tipo ("Evolução", "Pedido de exames").
 * `rotulos` é o mapa tipo → rótulo dos documentos.
 */
export function nomeAnexoLegivel(nome: string, rotulos: Record<string, string>): string {
  const iniciais = (t: string) => t.split('_').map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p)).join(' ')
  const candidatos = Object.keys(rotulos).map((t) => [iniciais(t), rotulos[t]] as const).sort((a, b) => b[0].length - a[0].length)
  for (const [cru, rotulo] of candidatos) {
    if (nome === cru || nome.startsWith(`${cru} nº`) || nome.startsWith(`${cru} (versão`)) return rotulo + nome.slice(cru.length)
  }
  return nome
}

/** "Tempo em cada status" em texto, com a situação atual marcada uma vez só. */
export function textoTempos(tempos: TempoStatus[], statusAtual?: StatusRegulacao): string {
  return temposComAtual(tempos, statusAtual).map((t) => {
    const quanto = t.segundos < 60 ? 'menos de 1 min' : formatarEspera(t.segundos)
    return `${STATUS[t.status]} ${quanto}${t.vezes > 1 ? ` (${t.vezes}×)` : ''}${t.atual ? ', atual' : ''}`
  }).join(' · ')
}
