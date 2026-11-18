// Lista do dia da agenda de consultas da UBS (5A, tarefa 3): a linha com
// Chegou, Falta e Cancelar, e os diálogos de chegada e de cancelamento. Usada
// na Agenda de consultas e na tela "Hoje" da recepção (percurso da UBS, U4).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, LogIn, UserX, X } from 'lucide-react'
import * as React from 'react'

import { Chip, Chips, Vazio } from '@/components/monitor/Pagina'
import { Estado } from '@/components/porta/Estado'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { MOTIVOS_RESERVA, SITUACAO, acoesDaLinha, contagem, linhasDoDia, rotuloMotivo, rotuloServico, type LinhaDia } from '@/domain/agenda'
import { rotuloIdade } from '@/domain/idade'
import { hora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { useAgendaDia, useAgora } from '@/hooks/useAgenda'

type Filtro = 'todos' | 'agendados' | 'presentes' | 'faltas'
const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

export function ListaDoDia({ unidadeId, dia, hoje }: { unidadeId: string; dia: string; hoje: string }) {
  const agenda = useAgendaDia(unidadeId, dia)
  const agora = useAgora()
  const [filtro, setFiltro] = React.useState<Filtro>('todos')
  const [chegada, setChegada] = React.useState<LinhaDia | null>(null)
  const [cancelar, setCancelar] = React.useState<LinhaDia | null>(null)
  const linhas = linhasDoDia(agenda.data)
  const n = contagem(linhas)
  const visiveis = linhas.filter((l) => filtro === 'todos'
    || (l.tipo === 'consulta' && l.situacao === { agendados: 'agendado', presentes: 'presente', faltas: 'nao_compareceu' }[filtro]))
  const fechados = (agenda.data?.profissionais ?? []).filter((p) => p.fechamento)

  return (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
      <div className="border-b border-trilha px-4 pt-3">
        <Chips rotulo="Filtrar a lista do dia">
          <Chip ativo={filtro === 'todos'} contagem={n.todos} onClick={() => setFiltro('todos')}>Todos</Chip>
          <Chip ativo={filtro === 'agendados'} contagem={n.agendados} onClick={() => setFiltro('agendados')}>Agendados</Chip>
          <Chip ativo={filtro === 'presentes'} contagem={n.presentes} onClick={() => setFiltro('presentes')}>Presentes</Chip>
          <Chip ativo={filtro === 'faltas'} contagem={n.faltas} onClick={() => setFiltro('faltas')}>Faltas</Chip>
        </Chips>
      </div>
      {fechados.map((p) => (
        <p key={p.perfil_id} className="border-b border-trilha bg-campo px-4 py-2 text-apoio text-tinta-apoio">
          Agenda de {p.nome} fechada neste dia ({p.fechamento!.especifique || p.fechamento!.motivo}).
        </p>
      ))}
      {agenda.isLoading && <div className="px-4 py-5"><Spinner /></div>}
      {agenda.error && <p className="px-4 py-4 text-apoio text-critico">{msg(agenda.error)}</p>}
      {!agenda.isLoading && !agenda.error && visiveis.length === 0 && (
        <div className="p-4"><Vazio icone={CalendarCheck} titulo="Nada marcado" texto={filtro === 'todos' ? 'Nenhuma consulta ou reserva neste dia.' : 'Nada nesta situação.'} /></div>
      )}
      <ul aria-label="Agenda do dia">
        {visiveis.map((l) => <Linha key={l.id} l={l} dia={dia} hoje={hoje} agora={agora} onChegou={() => setChegada(l)} onCancelar={() => setCancelar(l)} />)}
      </ul>
      {chegada && <DialogoChegada unidadeId={unidadeId} l={chegada} onFechar={() => setChegada(null)} />}
      {cancelar && <DialogoCancelar l={cancelar} onFechar={() => setCancelar(null)} />}
    </section>
  )
}

function Linha({ l, dia, hoje, agora, onChegou, onCancelar }: {
  l: LinhaDia; dia: string; hoje: string; agora: number; onChegou: () => void; onCancelar: () => void
}) {
  const qc = useQueryClient()
  const acoes = acoesDaLinha(l, agora, hoje, dia)
  const rpc = useMutation({
    mutationFn: async (nome: 'agenda_registrar_falta' | 'agenda_desfazer_falta') => {
      const { error } = await supabase.rpc(nome, { p_agendamento: l.id })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['agenda-dia'] }),
  })
  const sit = SITUACAO[l.situacao]
  return (
    <li className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-b border-trilha px-4 py-2.5 last:border-0">
      <strong className="w-12 text-controle tabular-nums text-tinta">{hora(l.inicio)}</strong>
      <div className="flex min-w-0 flex-[1_1_220px] flex-col">
        {l.tipo === 'consulta' ? (
          <span className="text-controle text-tinta">
            {l.nome_social || l.nome}
            <span className="text-apoio text-tinta-sussurro">{l.data_nascimento ? ` · ${rotuloIdade(l.data_nascimento, hoje)}` : ''} · {l.profissional}{rotuloServico(l.servico) ? ` · ${rotuloServico(l.servico)}` : ''}</span>
          </span>
        ) : (
          <span className="text-controle text-tinta-apoio">
            {rotuloMotivo(MOTIVOS_RESERVA, l.motivo_reserva)}{l.especifique ? `: ${l.especifique}` : ''}
            <span className="text-apoio text-tinta-sussurro"> · {l.profissional}</span>
          </span>
        )}
        {(l.observacao || (!l.na_escala && l.situacao === 'agendado')) && (
          <span className="text-rotulo text-tinta-sussurro">
            {l.observacao}
            {!l.na_escala && l.situacao === 'agendado' && (
              <span className="text-atencao">{l.observacao ? ' · ' : ''}fora da escala do profissional: sem escala, ele não abre a consulta</span>
            )}
          </span>
        )}
        {rpc.error && <span role="alert" className="text-rotulo text-critico">{msg(rpc.error)}</span>}
      </div>
      {l.tipo === 'reserva' ? <Estado tom="cinza">Reserva</Estado> : <Estado tom={sit.tom}>{sit.rotulo}</Estado>}
      {acoes.length > 0 && (
        <div className="flex gap-1.5">
          {acoes.includes('chegou') && <Button size="sm" onClick={onChegou}><LogIn /> Chegou</Button>}
          {acoes.includes('falta') && <Button size="sm" variant="outline" disabled={rpc.isPending} onClick={() => rpc.mutate('agenda_registrar_falta')}><UserX /> Falta</Button>}
          {acoes.includes('desfazer_falta') && <Button size="sm" variant="outline" disabled={rpc.isPending} onClick={() => rpc.mutate('agenda_desfazer_falta')}>Desfazer falta</Button>}
          {acoes.includes('cancelar') && <Button size="sm" variant="outline" onClick={onCancelar}><X /> Cancelar</Button>}
        </div>
      )}
    </li>
  )
}

function DialogoChegada({ unidadeId, l, onFechar }: { unidadeId: string; l: LinhaDia; onFechar: () => void }) {
  const qc = useQueryClient()
  const [setor, setSetor] = React.useState('')
  const [queixa, setQueixa] = React.useState(l.observacao ?? '')
  const consultorios = useQuery({
    queryKey: ['agenda-consultorios', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.from('setores').select('id, nome').eq('unidade_id', unidadeId).eq('tipo', 'consultorio').eq('ativo', true).order('ordem')
      if (error) throw error
      return data ?? []
    },
  })
  const lista = consultorios.data ?? []
  const escolhido = setor || (lista.length === 1 ? lista[0].id : '')
  const chegar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('agenda_registrar_chegada', { p_agendamento: l.id, p_setor: escolhido, p_queixa: queixa.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agenda-dia'] })
      void qc.invalidateQueries({ queryKey: ['recepcao-fila'] })
      onFechar()
    },
  })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chegou: {l.nome_social || l.nome}</DialogTitle>
          <DialogDescription>A ficha abre no consultório, ligada a esta consulta das {hora(l.inicio)} com {l.profissional}.</DialogDescription>
        </DialogHeader>
        {lista.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chegada-setor">Consultório</Label>
            <CampoSelecao id="chegada-setor" value={setor} onChange={(e) => setSetor(e.target.value)}>
              <option value="">Escolha…</option>
              {lista.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </CampoSelecao>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="chegada-queixa">Motivo da consulta</Label>
          <Input id="chegada-queixa" value={queixa} onChange={(e) => setQueixa(e.target.value)} />
        </div>
        {chegar.error && <p role="alert" className="text-apoio text-critico">{msg(chegar.error)}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onFechar}>Voltar</Button>
          <Button disabled={!escolhido || queixa.trim().length < 3 || chegar.isPending} onClick={() => chegar.mutate()}><LogIn /> Abrir a ficha</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DialogoCancelar({ l, onFechar }: { l: LinhaDia; onFechar: () => void }) {
  const qc = useQueryClient()
  const [motivo, setMotivo] = React.useState('')
  const cancelar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('agenda_cancelar', { p_agendamento: l.id, p_motivo: motivo.trim() || undefined })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['agenda-dia'] }); onFechar() },
  })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar {l.tipo === 'reserva' ? 'a reserva' : `a consulta de ${l.nome_social || l.nome}`}</DialogTitle>
          <DialogDescription>{hora(l.inicio)} com {l.profissional}. O horário volta a ficar livre.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cancelar-motivo">Motivo <span className="font-normal text-tinta-sussurro">(opcional)</span></Label>
          <Input id="cancelar-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        {cancelar.error && <p role="alert" className="text-apoio text-critico">{msg(cancelar.error)}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onFechar}>Voltar</Button>
          <Button variant="destructive" disabled={cancelar.isPending} onClick={() => cancelar.mutate()}>Cancelar {l.tipo === 'reserva' ? 'a reserva' : 'a consulta'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── marcar ──────────────────────────────────────────────────────────────────
