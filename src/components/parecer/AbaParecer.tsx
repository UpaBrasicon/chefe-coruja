import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, MessageSquare } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { Chip } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'

import {
  MOTIVO_MIN, PERGUNTA_MIN, PRIORIDADES, STATUS_PARECER, mensagem, prioridade, useEspecialidades,
  type PrioridadeParecer, type StatusParecer,
} from './comum'

// Aba Parecer do atendimento e do leito (protótipo 8880–8924, parPedirVals):
// pedir o parecer de uma especialidade, acompanhar Solicitado → Em análise →
// Realizado, ver a resposta e cancelar o pedido com motivo. Quem responde é o
// especialista, na tela Pareceres (/pareceres).
export type AbaParecerProps = { pacienteId: string; episodioId?: string | null; internacaoId?: string | null }

type ParecerPaciente = {
  id: string
  especialidade: string
  prestador: string | null
  prioridade: PrioridadeParecer
  pergunta: string
  status: StatusParecer
  solicitante_nome: string
  solicitado_em: string
  analista_nome: string | null
  analise_iniciada_em: string | null
  resposta: string | null
  respondido_em: string | null
  cancelado_nome: string | null
  cancelado_em: string | null
  motivo_cancelamento: string | null
  documento_solicitacao_numero: string | null
  documento_resposta_numero: string | null
  meu_pedido: boolean
}

function meta(p: ParecerPaciente) {
  const partes = [`Pedido em ${fmtDataHora(p.solicitado_em)} por ${p.solicitante_nome}`]
  if (p.documento_solicitacao_numero) partes.push(`documento nº ${p.documento_solicitacao_numero}`)
  if (p.status === 'em_analise' && p.analista_nome) {
    partes.push(`em análise por ${p.analista_nome}${p.analise_iniciada_em ? ` desde ${fmtDataHora(p.analise_iniciada_em)}` : ''}`)
  }
  if (p.status === 'realizado' && p.analista_nome) {
    partes.push(`respondido por ${p.analista_nome}${p.respondido_em ? ` em ${fmtDataHora(p.respondido_em)}` : ''}`)
  }
  if (p.status === 'cancelado') {
    partes.push(`cancelado${p.cancelado_nome ? ` por ${p.cancelado_nome}` : ''}${p.cancelado_em ? ` em ${fmtDataHora(p.cancelado_em)}` : ''}`)
  }
  return partes.join(' · ')
}

function Cancelar({ id, aoTerminar }: { id: string; aoTerminar: () => void }) {
  const qc = useQueryClient()
  const [motivo, setMotivo] = React.useState('')
  const cancelar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('cancelar_parecer', { p_id: id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pareceres'] })
      aoTerminar()
    },
  })
  return (
    <div className="grid gap-2 rounded-controle border border-fio bg-superficie p-2.5">
      <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo do cancelamento"
        placeholder={`Motivo do cancelamento · mínimo ${MOTIVO_MIN} caracteres`} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {cancelar.error && <span className="mr-auto text-apoio text-critico">{mensagem(cancelar.error)}</span>}
        <Button size="sm" variant="ghost" onClick={aoTerminar}>Voltar</Button>
        <Button size="sm" variant="destructive" onClick={() => cancelar.mutate()}
          disabled={motivo.trim().length < MOTIVO_MIN || cancelar.isPending}>Cancelar pedido</Button>
      </div>
    </div>
  )
}

export function AbaParecer({ pacienteId, episodioId, internacaoId }: AbaParecerProps) {
  const qc = useQueryClient()
  const especialidades = useEspecialidades()
  const [prestador, setPrestador] = React.useState('')
  const [esp, setEsp] = React.useState('')
  const [prio, setPrio] = React.useState<PrioridadeParecer>('normal')
  const [pergunta, setPergunta] = React.useState('')
  const [cancelando, setCancelando] = React.useState<string | null>(null)
  const idLista = React.useId()

  const lista = useQuery({
    queryKey: ['pareceres', 'paciente', pacienteId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pareceres_do_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as ParecerPaciente[]
    },
  })

  const espValida = (especialidades.data ?? []).includes(esp.trim())
  const naoSolicita = !espValida || pergunta.trim().length < PERGUNTA_MIN

  const solicitar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('solicitar_parecer', {
        p_paciente: pacienteId,
        p_especialidade: esp.trim(),
        p_pergunta: pergunta.trim(),
        p_prioridade: prio,
        p_prestador: prestador.trim() || undefined,
        p_episodio: episodioId ?? undefined,
        p_internacao: internacaoId ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setPrestador(''); setEsp(''); setPrio('normal'); setPergunta('')
      void qc.invalidateQueries({ queryKey: ['pareceres'] })
      // a solicitação vira documento e pode mudar os impeditivos de alta
      void qc.invalidateQueries({ queryKey: ['impeditivos-alta'] })
    },
  })

  const pareceres = lista.data ?? []

  return (
    <section className="flex flex-col gap-3 rounded-cartao border border-fio bg-superficie p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 className="flex items-center gap-2 text-controle font-semibold text-tinta">
          <MessageSquare className="size-[15px] text-acao" aria-hidden />Parecer
        </h3>
        <span className="text-apoio text-tinta-sussurro">Solicitado → Em análise → Realizado</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input className="flex-[1_1_180px]" value={prestador} onChange={(e) => setPrestador(e.target.value)}
          placeholder="Prestador (opcional)" aria-label="Prestador solicitado" />
        <Input className="flex-[1_1_220px]" value={esp} onChange={(e) => setEsp(e.target.value)} list={idLista}
          placeholder="Especialidade, ex.: Cirurgia geral" aria-label="Especialidade" aria-invalid={esp.trim() !== '' && !espValida} />
        <datalist id={idLista}>
          {(especialidades.data ?? []).map((e) => <option key={e} value={e} />)}
        </datalist>
        <div role="group" aria-label="Prioridade" className="flex flex-wrap gap-1.5">
          {PRIORIDADES.map((p) => (
            <Chip key={p.valor} ativo={prio === p.valor} onClick={() => setPrio(p.valor)}>{p.rotulo}</Chip>
          ))}
        </div>
      </div>
      <Textarea rows={2} value={pergunta} onChange={(e) => setPergunta(e.target.value)} aria-label="Pergunta ao especialista"
        placeholder={`Pergunta ao especialista · mínimo ${PERGUNTA_MIN} caracteres`} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {esp.trim() !== '' && !espValida && <span className="mr-auto text-apoio text-atencao">Escolha a especialidade na lista.</span>}
        {solicitar.error && <span className="mr-auto text-apoio text-critico">{mensagem(solicitar.error)}</span>}
        <Button onClick={() => solicitar.mutate()} disabled={naoSolicita || solicitar.isPending}>
          <ArrowUpRight className="size-3.5" />Solicitar parecer
        </Button>
      </div>

      {lista.isLoading && <Spinner />}
      {lista.error && <p className="text-apoio text-critico">{mensagem(lista.error)}</p>}
      {!lista.isLoading && !lista.error && pareceres.length === 0 && (
        <p className="text-apoio text-tinta-sussurro">Nenhum parecer pedido para este paciente.</p>
      )}
      {pareceres.map((p) => {
        const aberto = p.status === 'solicitado' || p.status === 'em_analise'
        return (
          <div key={p.id} className="flex flex-col gap-1.5 rounded-controle border border-fio bg-campo px-[13px] py-[11px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-controle font-semibold text-tinta">{p.especialidade}{p.prestador ? ` · para ${p.prestador}` : ''}</span>
              <Badge variant={prioridade(p.prioridade).variante}>{prioridade(p.prioridade).rotulo}</Badge>
              <Badge variant={STATUS_PARECER[p.status].variante}>{STATUS_PARECER[p.status].rotulo}</Badge>
            </div>
            <span className="text-apoio leading-normal text-pretty text-tinta-apoio">{p.pergunta}</span>
            <span className="text-rotulo text-tinta-sussurro">{meta(p)}</span>
            {p.status === 'realizado' && p.resposta && (
              <div className="rounded-controle border border-conforme/30 bg-conforme/[0.05] p-2">
                <p className="text-apoio leading-normal whitespace-pre-wrap text-conforme">Parecer: {p.resposta}</p>
                {p.documento_resposta_numero && <p className="mt-1 text-rotulo text-tinta-sussurro">Documento nº {p.documento_resposta_numero}</p>}
              </div>
            )}
            {p.status === 'cancelado' && p.motivo_cancelamento && (
              <span className="text-apoio text-tinta-sussurro">Motivo: {p.motivo_cancelamento}</span>
            )}
            {aberto && (cancelando === p.id
              ? <Cancelar id={p.id} aoTerminar={() => setCancelando(null)} />
              : <Button size="sm" variant="outline" className="self-start" onClick={() => setCancelando(p.id)}>Cancelar pedido</Button>)}
            {/* IMPRESSÃO (onda 6, folhas no servidor): "Imprimir" deste parecer —
                folha do protótipo (montarParecerHtml) com pergunta, parecer e as
                duas assinaturas. */}
          </div>
        )
      })}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" render={<Link to="/pareceres" />}>Responder pareceres (tela Pareceres)</Button>
        {/* IMPRESSÃO (onda 6): "Imprimir histórico de pareceres" — todas as
            folhas do paciente numa impressão (pareceres_do_paciente). */}
      </div>
    </section>
  )
}
