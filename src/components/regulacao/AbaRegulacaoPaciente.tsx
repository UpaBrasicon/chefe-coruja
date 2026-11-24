// ─────────────────────────────────────────────────────────────────────────────
// Aba Regulação do paciente (R1, pedido do RT de 24/11/2026): no caderno do
// leito, na janela do atendimento da porta, no cartão da observação, na lista
// de pacientes em regulação do médico e na Internação do NIR.
//
// Para cada pedido que saiu desta unidade: situação e prazo no topo; a
// pergunta formal da central com a resposta; o histórico do pedido; anexar
// exame; atualizar os dados clínicos para a central (evolução, médico e
// gestor); e, embaixo, a conversa com o médico regulador.
// "Novo pedido" (RT, 24/11/2026): o formulário abre aqui mesmo, com o
// paciente já escolhido, e volta a esta aba com o pedido novo aberto; nada
// daqui leva à página Regulação, que o médico não tem no menu.
// Migration 20270421000040_regulacao_conversa_nir.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Plus, Waypoints } from 'lucide-react'
import * as React from 'react'

import { AnexosRegulacao } from '@/components/regulacao/AnexosRegulacao'
import { ConversaRegulacao } from '@/components/regulacao/ConversaRegulacao'
import { AvisoEnviado, NovoPedidoPaciente, type PedidoEnviado } from '@/components/regulacao/NovaSolicitacao'
import { PrazosDoPedido, SeloSla, type Evolucao } from '@/components/regulacao/SlaRegulacao'
import { Badge } from '@/components/ui/badge'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { PRIORIDADES, STATUS, prioridadeEfetiva, resumoPedido, type Sla } from '@/lib/regulacao'
import { esperaAOrigem, rotuloAguardando, type PedidoResumo } from '@/lib/regulacaoPaciente'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Resposta = { pode_solicitar: boolean; pedidos: PedidoResumo[] }
type Detalhe = {
  id: string; status: string; sla: Sla | null
  eventos?: { evento: string; por: string | null; em: string }[]
  tempos?: React.ComponentProps<typeof PrazosDoPedido>['tempos']
  evolucoes?: Evolucao[]; pode_evoluir?: boolean
  pendencia_resposta: string | null; pendencia_respondida_por: string | null
}

const TOM: Record<string, 'destructive' | 'warning' | 'info' | 'secondary'> = {
  critico: 'destructive', atencao: 'warning', info: 'info', neutro: 'secondary',
}

/** Rótulos do histórico do pedido (o nome do evento no banco, legível). */
const EVENTOS: Record<string, string> = {
  enviada: 'Pedido enviado', mensagem: 'Mensagem na conversa', pendencia: 'Pergunta da central',
  pendencia_respondida: 'Resposta à central', assumida: 'Regulador assumiu', devolvida_a_fila: 'Voltou à fila da central',
  prioridade_regulador: 'Prioridade do regulador', autorizada: 'Autorizado', negada: 'Negado',
  devolvida: 'Devolvido para correção', reenviada: 'Corrigido e reenviado', cancelada: 'Cancelado',
  evolucao_atualizada: 'Dados clínicos atualizados', anexo_incluido: 'Anexo incluído', anexo_retirado: 'Anexo retirado',
  anexo_aberto: 'Anexo aberto', destino_aceitou: 'Destino aceitou', destino_recusou: 'Destino recusou',
  saiu: 'Saída do paciente', chegou: 'Chegada no destino', nao_chegou: 'Não chegou', externo_registrado: 'Regulação externa',
  origem_encerrada: 'Atendimento de origem encerrado',
}

export function AbaRegulacaoPaciente({ pacienteId, unidadeId: unidadeProp }: { pacienteId: string; unidadeId?: string }) {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeProp ?? unidadeAtiva?.unidade_id ?? ''
  const lista = useQuery({
    queryKey: ['regulacao-pacientes', 'paciente', unidadeId, pacienteId],
    enabled: !!unidadeId && !!pacienteId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_do_paciente', { p_unidade: unidadeId, p_paciente: pacienteId })
      if (error) throw error
      return data as unknown as Resposta
    },
  })
  const pedidos = lista.data?.pedidos ?? []
  const primeiroAberto = pedidos.find((p) => p.em_aberto)?.id ?? null
  const [aberto, setAberto] = React.useState<string | null | undefined>(undefined)
  const atual = aberto === undefined ? primeiroAberto : aberto
  const [novo, setNovo] = React.useState(false)
  const [enviado, setEnviado] = React.useState<PedidoEnviado | null>(null)

  if (novo) {
    return (
      <NovoPedidoPaciente pacienteId={pacienteId} unidadeId={unidadeId} aoFechar={() => setNovo(false)}
        aoEnviar={(r) => { setNovo(false); setEnviado(r); setAberto(r.id) }} />
    )
  }

  return (
    <div className="flex flex-col gap-3 text-apoio">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 text-corpo font-medium text-tinta"><Waypoints className="size-4" aria-hidden /> Regulação</h3>
        {lista.data?.pode_solicitar && pedidos.length > 0 && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setEnviado(null); setNovo(true) }}>
            <Plus /> Novo pedido
          </Button>
        )}
      </div>
      {enviado && <AvisoEnviado enviada={enviado} />}
      {lista.isLoading ? <Spinner /> : lista.error ? <MensagemErro texto={(lista.error as Error).message} />
        : pedidos.length === 0 ? (
          // RG3 (RT, 24/11/2026): o vazio diz quando pedir e o que o pedido leva
          <div className="flex flex-col gap-2 rounded-controle border border-fio bg-campo px-4 py-3">
            <span className="text-controle font-medium text-tinta">Nenhum pedido de regulação deste paciente saiu desta unidade.</span>
            <span className="text-tinta-apoio">
              Peça quando o paciente precisar de um leito, exame ou consulta que a unidade não oferece: UTI ou UCI, leito de outra
              especialidade, cirurgia, hemodinâmica, exame de imagem que a unidade não faz, avaliação de especialista.
            </span>
            <span className="text-tinta-apoio">O pedido já leva o quadro do prontuário (última evolução, sinais vitais, exames e prescrição) para você revisar.</span>
            {lista.data?.pode_solicitar && (
              <Button size="sm" className="self-start" onClick={() => { setEnviado(null); setNovo(true) }}><Plus /> Novo pedido</Button>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {pedidos.map((p) => (
              <li key={p.id} className="rounded-controle border border-fio">
                <BotaoLinha variante="linha" aria-expanded={atual === p.id}
                  className="flex-wrap items-center gap-2 rounded-controle border-0 px-3 py-2 hover:bg-campo"
                  onClick={() => setAberto(atual === p.id ? null : p.id)}>
                  <Badge variant={p.em_aberto ? 'info' : 'secondary'}>{STATUS[p.status]}</Badge>
                  <Badge variant={TOM[PRIORIDADES[prioridadeEfetiva(p)].tom]}>{PRIORIDADES[prioridadeEfetiva(p)].rotulo}</Badge>
                  <span className="font-medium text-tinta">{resumoPedido(p)}</span>
                  {p.destino && <span className="text-tinta-apoio">→ {p.destino}</span>}
                  <SeloSla sla={p.sla} />
                  {p.conversa.novas > 0 && <Badge variant="warning">{p.conversa.novas === 1 ? '1 mensagem nova' : `${p.conversa.novas} mensagens novas`}</Badge>}
                  <span className="ml-auto text-tinta-sussurro">nº {p.numero} · {fmtDataHora(p.criada_em)}</span>
                  <ChevronDown className={cn('size-4 shrink-0 text-tinta-sussurro', atual === p.id && 'rotate-180')} aria-hidden />
                </BotaoLinha>
                {esperaAOrigem(p) && atual !== p.id && <EsperaDaCentral p={p} />}
                {atual === p.id && <PedidoAberto p={p} />}
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}

/** O que a central espera da unidade (pergunta, devolução, mensagem sem resposta). */
export function EsperaDaCentral({ p }: { p: PedidoResumo }) {
  return (
    <div className="flex flex-col gap-1 border-t border-fio px-3 py-2">
      {p.status === 'pendencia' && p.pendencia_pergunta && (
        <p className="text-atencao"><b>Pergunta da central</b>{p.pendencia_em ? ` (${fmtDataHora(p.pendencia_em)})` : ''}: {p.pendencia_pergunta}</p>
      )}
      {p.status === 'devolvida' && <p className="text-atencao"><b>Devolvido para correção</b>{p.motivo_devolucao ? `: ${p.motivo_devolucao}` : ''}</p>}
      {p.conversa.aguardando.map((a, i) => (
        <p key={i} className="text-atencao"><b>{rotuloAguardando(a)}</b> ({a.autor ?? '—'}, {fmtDataHora(a.em)}): {a.texto}</p>
      ))}
    </div>
  )
}

function PedidoAberto({ p }: { p: PedidoResumo }) {
  const qc = useQueryClient()
  const d = useQuery({
    queryKey: ['regulacao-detalhe', p.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_detalhe', { p_id: p.id })
      if (error) throw error
      return data as unknown as Detalhe
    },
  })
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['regulacao-detalhe', p.id] })
    void qc.invalidateQueries({ queryKey: ['regulacao-pacientes'] })
  }
  const s = d.data
  return (
    <div className="flex flex-col gap-3 border-t border-fio bg-campo px-3 py-3">
      {/* situação e prazo no topo */}
      {esperaAOrigem(p) && <EsperaDaCentral p={p} />}
      {p.status === 'pendencia' && <ResponderPergunta id={p.id} aoFim={recarregar} />}
      {/* RG3 (RT, 24/11/2026): a linha do tempo do pedido e a conversa com o regulador no topo */}
      {s && (s.eventos ?? []).length > 0 && (
        <ol aria-label="Linha do tempo do pedido" className="flex flex-col gap-1 border-l-2 border-fio pl-3">
          {(s.eventos ?? []).map((e, i) => (
            <li key={i} className="text-apoio">
              <span className="text-tinta">{EVENTOS[e.evento] ?? e.evento.replace(/_/g, ' ')}</span>
              <span className="text-rotulo text-tinta-sussurro"> · {fmtDataHora(e.em)} · {e.por ?? '—'}</span>
            </li>
          ))}
        </ol>
      )}
      <ConversaRegulacao solicitacaoId={p.id} aoEnviar={recarregar} />
      {d.isLoading ? <Spinner /> : d.error ? <MensagemErro texto={(d.error as Error).message} /> : s && (
        <>
          {/* atualizar os dados clínicos para a central (evolução) e os prazos */}
          <PrazosDoPedido id={p.id} sla={s.sla} tempos={s.tempos ?? []} evolucoes={s.evolucoes ?? []}
            podeEvoluir={!!s.pode_evoluir} aoFim={recarregar} />
          <AnexosRegulacao solicitacaoId={p.id} />
        </>
      )}
    </div>
  )
}

function ResponderPergunta({ id, aoFim }: { id: string; aoFim: () => void }) {
  const [resposta, setResposta] = React.useState('')
  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_responder_pendencia', { p_id: id, p_resposta: resposta.trim() })
      if (error) throw error
    },
    onSuccess: () => { setResposta(''); aoFim() },
  })
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); enviar.mutate() }}>
      <label htmlFor={`resp-aba-${id}`} className="font-medium text-tinta-apoio">Resposta à pergunta da central</label>
      <Textarea id={`resp-aba-${id}`} value={resposta} onChange={(e) => setResposta(e.target.value)} />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={enviar.isPending || resposta.trim().length < 5}>Responder</Button>
        <MensagemErro texto={enviar.error ? (enviar.error as Error).message : null} />
      </div>
    </form>
  )
}
