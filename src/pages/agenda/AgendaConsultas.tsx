// Agenda de consultas da UBS (5A, tarefa 3, parte 3.2; decisões F1 a F6 e
// opção B do RT em 02/11/2026): a lista do dia em ordem de horário, com
// Chegou, Falta e Cancelar na linha, e o painel de marcar com o calendário e
// os horários livres do profissional (ref. Cal.com, escolha de horário). O
// gestor tem também a configuração (grade e fechamento). Tudo pelas RPCs da
// agenda; o servidor confere de novo as regras do Manual do PEC.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, ChevronLeft, ChevronRight, CircleAlert, LogIn, UserX, X } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { Chip, Chips, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Estado } from '@/components/porta/Estado'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import {
  MOTIVOS_RESERVA, SITUACAO, acoesDaLinha, contagem, horariosLivres, linhasDoDia, rotuloMotivo,
  type LinhaDia, type MotivoReserva,
} from '@/domain/agenda'
import { rotuloIdade } from '@/domain/idade'
import { dataIso, dataPura, diaMes, hora, mesAno, semanaCurta } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import { ConfiguracaoAgenda } from './ConfiguracaoAgenda'
import { useAgendaDia, useAgora, useConfiguracaoAgenda } from './useAgenda'
import { useValorAdiado } from '@/hooks/useValorAdiado'

type Filtro = 'todos' | 'agendados' | 'presentes' | 'faltas'
type Achado = { id: string; nome: string; nome_social: string | null; data_nascimento: string | null }

const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
const somarDias = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
// meio-dia em UTC cai no mesmo dia em Brasília
const rotuloDia = (iso: string) => `${semanaCurta(iso + 'T12:00:00Z')}, ${diaMes(iso + 'T12:00:00Z')}`

export default function AgendaConsultas() {
  const { unidadeAtiva, ehGestor } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const [busca, setBusca] = useSearchParams()
  const hoje = dataIso()
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(busca.get('data') ?? '') ? busca.get('data')! : hoje
  const aba = ehGestor && busca.get('aba') === 'configuracao' ? 'configuracao' : 'dia'
  const trocar = (k: string, v: string | null) =>
    setBusca((b) => { const n = new URLSearchParams(b); if (v) n.set(k, v); else n.delete(k); return n }, { replace: true })

  return (
    <>
      <TituloPagina
        titulo="Agenda de consultas"
        descricao="Consultas e reservas por profissional: marcar, chegou, falta e cancelar."
        acoes={aba === 'dia' && (
          <div className="flex items-center gap-1.5">
            <Button size="icon-sm" variant="outline" aria-label="Dia anterior" onClick={() => trocar('data', somarDias(dia, -1))}><ChevronLeft /></Button>
            <Button size="sm" variant="outline" onClick={() => trocar('data', null)}>{dia === hoje ? 'Hoje' : 'Ir para hoje'} · {rotuloDia(dia)}</Button>
            <Button size="icon-sm" variant="outline" aria-label="Próximo dia" onClick={() => trocar('data', somarDias(dia, 1))}><ChevronRight /></Button>
          </div>
        )}
      />
      {ehGestor && (
        <Tabs value={aba} onValueChange={(v) => trocar('aba', v === 'dia' ? null : String(v))} className="mb-3">
          <TabsList aria-label="Agenda" className="gap-5">
            <TabsTrigger value="dia">Dia</TabsTrigger>
            <TabsTrigger value="configuracao">Configuração</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      {!unidadeId ? null : aba === 'configuracao' ? <ConfiguracaoAgenda unidadeId={unidadeId} /> : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <ListaDoDia unidadeId={unidadeId} dia={dia} hoje={hoje} />
          <MarcarConsulta unidadeId={unidadeId} diaInicial={dia >= hoje ? dia : hoje} hoje={hoje}
            pacienteUrl={busca.get('paciente')} origemUrl={busca.get('origem')}
            tipoUrl={busca.get('consulta') === 'consulta_programada' ? 'consulta_programada' : 'consulta_agendada'} />
        </div>
      )}
    </>
  )
}

// ── lista do dia ────────────────────────────────────────────────────────────
function ListaDoDia({ unidadeId, dia, hoje }: { unidadeId: string; dia: string; hoje: string }) {
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
            <span className="text-apoio text-tinta-sussurro">{l.data_nascimento ? ` · ${rotuloIdade(l.data_nascimento, hoje)}` : ''} · {l.profissional}</span>
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
function Calendario({ valor, onEscolher, hoje, diasComAgenda }: {
  valor: string; onEscolher: (iso: string) => void; hoje: string; diasComAgenda: Set<number>
}) {
  const [mes, setMes] = React.useState(valor.slice(0, 7))
  const primeiro = new Date(mes + '-01T12:00:00Z')
  const dias = new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth() + 1, 0)).getUTCDate()
  const desloc = primeiro.getUTCDay()
  const trocarMes = (n: number) => {
    const d = new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth() + n, 1, 12))
    setMes(d.toISOString().slice(0, 7))
  }
  const rotuloMes = mesAno(primeiro.getUTCFullYear(), primeiro.getUTCMonth() + 1)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Button size="icon-xs" variant="ghost" aria-label="Mês anterior" onClick={() => trocarMes(-1)}><ChevronLeft /></Button>
        <span className="text-apoio font-medium text-tinta first-letter:uppercase">{rotuloMes}</span>
        <Button size="icon-xs" variant="ghost" aria-label="Próximo mês" onClick={() => trocarMes(1)}><ChevronRight /></Button>
      </div>
      <div role="grid" aria-label="Escolha o dia" className="grid grid-cols-7 gap-1 text-center">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i} className="text-rotulo text-tinta-sussurro">{d}</span>)}
        {Array.from({ length: desloc }, (_, i) => <span key={`v${i}`} />)}
        {Array.from({ length: dias }, (_, i) => {
          const iso = `${mes}-${String(i + 1).padStart(2, '0')}`
          const dow = (desloc + i) % 7
          const pode = iso >= hoje && diasComAgenda.has(dow)
          return (
            <Button key={iso} size="xs" variant={iso === valor ? 'default' : 'ghost'} disabled={!pode}
              aria-pressed={iso === valor} className="tabular-nums" onClick={() => onEscolher(iso)}>
              {i + 1}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

function MarcarConsulta({ unidadeId, diaInicial, hoje, pacienteUrl, origemUrl, tipoUrl }: {
  unidadeId: string; diaInicial: string; hoje: string
  /** F6: vindo da conduta ou da escuta, o paciente e o episódio de origem chegam pela URL */
  pacienteUrl: string | null; origemUrl: string | null; tipoUrl: 'consulta_agendada' | 'consulta_programada'
}) {
  const qc = useQueryClient()
  const config = useConfiguracaoAgenda(unidadeId)
  const comAgenda = (config.data ?? []).filter((p) => p.horarios.length > 0)
  const [modo, setModo] = React.useState<'consulta' | 'reserva'>('consulta')
  const [perfil, setPerfil] = React.useState('')
  const prof = comAgenda.find((p) => p.perfil_id === perfil) ?? (comAgenda.length === 1 ? comAgenda[0] : undefined)
  const [data, setData] = React.useState(diaInicial)
  const [inicio, setInicio] = React.useState<string | null>(null)
  const [termo, setTermo] = React.useState('')
  const [escolhido, setPaciente] = React.useState<Achado | null>(null)
  const [usarUrl, setUsarUrl] = React.useState(!!pacienteUrl)
  const daUrl = useQuery({
    queryKey: ['agenda-paciente-url', pacienteUrl],
    enabled: !!pacienteUrl && usarUrl,
    queryFn: async () => {
      const { data: r, error } = await supabase.from('pacientes').select('id, nome, nome_social, data_nascimento').eq('id', pacienteUrl!).maybeSingle()
      if (error) throw error
      return r as Achado | null
    },
  })
  const paciente = escolhido ?? (usarUrl ? daUrl.data ?? null : null)
  const origem = usarUrl && !escolhido && paciente?.id === pacienteUrl ? origemUrl : null
  const [tipo, setTipo] = React.useState<'consulta_agendada' | 'consulta_programada'>(tipoUrl)
  const [obs, setObs] = React.useState('')
  const [motivo, setMotivo] = React.useState<MotivoReserva | null>(null)
  const [especifique, setEspecifique] = React.useState('')
  const [aviso, setAviso] = React.useState<string | null>(null)

  const doDia = useAgendaDia(unidadeId, data)
  const agora = useAgora()
  const livres = horariosLivres(doDia.data?.profissionais.find((p) => p.perfil_id === prof?.perfil_id), agora)
  const slot = livres.find((h) => h.inicio === inicio)
  const fechado = doDia.data?.profissionais.find((p) => p.perfil_id === prof?.perfil_id)?.fechamento

  const t = useValorAdiado(termo.trim())
  const achados = useQuery({
    queryKey: ['agenda-busca-paciente', unidadeId, t],
    enabled: modo === 'consulta' && t.length >= 3 && !paciente,
    queryFn: async (): Promise<Achado[]> => {
      const { data: r, error } = await supabase.rpc('buscar_pacientes', { p_unidade: unidadeId, p_termo: t })
      if (error) throw error
      return (r ?? []).slice(0, 8)
    },
  })

  const marcar = useMutation({
    mutationFn: async () => {
      if (modo === 'consulta') {
        const { error } = await supabase.rpc('agenda_marcar', {
          p_unidade: unidadeId, p_perfil: prof!.perfil_id, p_inicio: inicio!, p_paciente: paciente!.id,
          p_tipo_atendimento: tipo, p_observacao: obs.trim() || undefined, p_origem_episodio: origem ?? undefined,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.rpc('agenda_reservar', {
          p_unidade: unidadeId, p_perfil: prof!.perfil_id, p_inicio: inicio!, p_motivo: motivo!, p_especifique: especifique.trim() || undefined,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      setAviso(modo === 'consulta'
        ? `Consulta marcada: ${paciente!.nome_social || paciente!.nome}, ${dataPura(data)} às ${hora(inicio!)} com ${prof!.nome}.`
        : `Horário reservado: ${dataPura(data)} às ${hora(inicio!)} com ${prof!.nome}.`)
      setInicio(null); setPaciente(null); setUsarUrl(false); setTermo(''); setObs(''); setMotivo(null); setEspecifique('')
      void qc.invalidateQueries({ queryKey: ['agenda-dia'] })
    },
  })
  const pronto = !!prof && !!slot && (modo === 'consulta' ? !!paciente : !!motivo && (motivo !== 'outro' || especifique.trim().length >= 3))

  return (
    <section aria-label="Marcar" className="flex flex-col gap-3 rounded-cartao border border-fio bg-campo p-4">
      <div role="radiogroup" aria-label="O que marcar" className="flex gap-2">
        <Chip variante="opcao" radio ativo={modo === 'consulta'} onClick={() => { setModo('consulta'); setAviso(null) }}>Marcar consulta</Chip>
        <Chip variante="opcao" radio ativo={modo === 'reserva'} onClick={() => { setModo('reserva'); setAviso(null) }}>Reservar horário</Chip>
      </div>
      {aviso && <p role="status" className="rounded-container border border-acao/25 bg-acao/5 px-3 py-2 text-apoio text-acao">{aviso}</p>}

      {modo === 'consulta' && (paciente ? (
        <div className="flex items-center justify-between rounded-controle border border-fio bg-superficie px-3 py-2 text-apoio">
          <span className="font-medium text-tinta">{paciente.nome_social || paciente.nome}
            {paciente.data_nascimento && <span className="font-normal text-tinta-sussurro"> · {rotuloIdade(paciente.data_nascimento, hoje)}</span>}</span>
          <Button size="xs" variant="ghost" onClick={() => { setPaciente(null); setUsarUrl(false) }}>Trocar</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agenda-paciente">Paciente (nome, CPF, CNS ou prontuário)</Label>
          <Input id="agenda-paciente" value={termo} autoComplete="off" onChange={(e) => setTermo(e.target.value)} />
          {achados.isLoading && <Spinner />}
          {(achados.data ?? []).length > 0 && (
            <ul className="flex flex-col rounded-controle border border-fio bg-superficie">
              {(achados.data ?? []).map((a) => (
                <li key={a.id}>
                  <BotaoLinha variante="linha" onClick={() => setPaciente(a)} className="py-2 text-apoio">
                    {a.nome_social || a.nome}
                    {a.data_nascimento && <span className="text-tinta-sussurro"> · {dataPura(a.data_nascimento)}</span>}
                  </BotaoLinha>
                </li>
              ))}
            </ul>
          )}
          {t.length >= 3 && achados.isSuccess && (achados.data ?? []).length === 0 && (
            <span className="text-rotulo text-tinta-sussurro">Ninguém com esse nome ou documento. O cadastro é feito na Nova ficha.</span>
          )}
        </div>
      ))}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agenda-profissional">Profissional</Label>
        <CampoSelecao id="agenda-profissional" value={prof?.perfil_id ?? ''} onChange={(e) => { setPerfil(e.target.value); setInicio(null) }}>
          {comAgenda.length !== 1 && <option value="">Escolha…</option>}
          {comAgenda.map((p) => <option key={p.perfil_id} value={p.perfil_id}>{p.nome}</option>)}
        </CampoSelecao>
        {config.isSuccess && comAgenda.length === 0 && <span className="text-rotulo text-atencao">Nenhum profissional com agenda configurada. O gestor configura na aba Configuração.</span>}
      </div>

      {prof && (
        <>
          <Calendario valor={data} hoje={hoje} diasComAgenda={new Set(prof.horarios.map((h) => h.dia))}
            onEscolher={(iso) => { setData(iso); setInicio(null) }} />
          <span className="rotulo text-tinta-sussurro">Horários livres · {rotuloDia(data)}</span>
          {fechado && <span className="text-apoio text-tinta-apoio">Agenda fechada neste dia ({fechado.especifique || fechado.motivo}).</span>}
          {doDia.isLoading && <Spinner />}
          {!fechado && doDia.isSuccess && livres.length === 0 && <span className="text-apoio text-tinta-sussurro">Sem horário livre neste dia.</span>}
          <div role="radiogroup" aria-label="Horário" className="grid grid-cols-3 gap-1.5">
            {livres.map((h) => (
              <Chip key={h.inicio} variante="opcao" radio ativo={inicio === h.inicio} titulo={h.na_escala ? undefined : 'Fora da escala do profissional'}
                onClick={() => setInicio(h.inicio)}>
                <span className={cn('w-full text-center tabular-nums', !h.na_escala && 'text-atencao')}>{hora(h.inicio)}{!h.na_escala && ' *'}</span>
              </Chip>
            ))}
          </div>
          {slot && !slot.na_escala && (
            <span className="flex items-start gap-1.5 text-rotulo text-atencao">
              <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
              Fora da escala do profissional neste horário: sem a escala, ele não consegue abrir a consulta.
            </span>
          )}
        </>
      )}

      {modo === 'consulta' ? (
        <>
          <div role="radiogroup" aria-label="Tipo da consulta" className="flex flex-wrap gap-2">
            <Chip variante="opcao" radio ativo={tipo === 'consulta_agendada'} onClick={() => setTipo('consulta_agendada')}>Consulta agendada</Chip>
            <Chip variante="opcao" radio ativo={tipo === 'consulta_programada'} onClick={() => setTipo('consulta_programada')}>Cuidado continuado</Chip>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agenda-obs">Observação <span className="font-normal text-tinta-sussurro">(opcional)</span></Label>
            <Textarea id="agenda-obs" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </>
      ) : (
        <>
          <div role="radiogroup" aria-label="Motivo da reserva" className="flex flex-wrap gap-2">
            {MOTIVOS_RESERVA.map((m) => <Chip key={m.valor} variante="opcao" radio ativo={motivo === m.valor} onClick={() => setMotivo(m.valor)}>{m.rotulo}</Chip>)}
          </div>
          {motivo === 'outro' && <Input aria-label="Especifique" placeholder="Especifique" value={especifique} onChange={(e) => setEspecifique(e.target.value)} />}
          <span className="text-rotulo text-tinta-sussurro">Reserva é para atividade curta dentro do turno. Período maior (férias, licença) é fechamento, com o gestor.</span>
        </>
      )}

      {marcar.error && <p role="alert" className="text-apoio text-critico">{msg(marcar.error)}</p>}
      <Button disabled={!pronto || marcar.isPending} onClick={() => marcar.mutate()}>
        <CalendarCheck /> {modo === 'consulta' ? 'Marcar' : 'Reservar'}{slot ? ` ${hora(slot.inicio)}` : ''}
      </Button>
    </section>
  )
}
