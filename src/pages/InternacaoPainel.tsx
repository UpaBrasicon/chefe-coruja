import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRightLeft, ChevronRight, Eye, Hospital, UserPlus } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import type { AltaPaciente, ChecklistAdmissao, OcupacaoSetor, TransferenciaPaciente } from '@/types/database'
import type { Database } from '@/types/database'
type ChecklistAdmissaoInsert = Database['public']['Tables']['checklist_admissao']['Insert']

type PacienteInternado = {
  id: string
  nome: string
  cpf: string | null
  data_nascimento: string | null
  sexo: string | null
  setor_id: string | null
  created_at: string
}

type PacienteComSetor = PacienteInternado & {
  setores: { id: string; nome: string } | null
}

function fmtDia(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

type Setor = { id: string; nome: string; tipo: string; ordem: number }

export default function InternacaoPainel({ modo = 'internacao' }: { modo?: 'internacao' | 'observacao' }) {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const queryClient = useQueryClient()

  const [transferir, setTransferir] = React.useState<PacienteComSetor | null>(null)
  const [destinoId, setDestinoId] = React.useState('')
  const [motivo, setMotivo] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [sucesso, setSucesso] = React.useState<string | null>(null)

  const ehGestor = papelAtivo === 'gestor'
  const ehAdmin = papelAtivo === 'admin'
  const titulo = modo === 'internacao' ? 'Internação' : 'Observação'
  const rpcSetores = modo === 'internacao' ? 'setores_internacao' : 'setores_observacao'
  const IconePainel = modo === 'internacao' ? Hospital : Eye

  // Setores da unidade (internação ou observação)
  const { data: setores, isLoading: carregandoSetores } = useQuery({
    queryKey: ['setores-' + modo, unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(rpcSetores, { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as Setor[]
    },
  })

  // Pacientes internados (RLS: plantonista só vê setores da escala atual)
  const { data: pacientes, isLoading: carregandoPacientes } = useQuery({
    queryKey: ['pacientes-internados', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('id, nome, cpf, data_nascimento, sexo, setor_id, created_at, setores!pacientes_setor_id_fkey(id, nome)')
        .eq('unidade_id', unidadeId!)
        .eq('ativo', true)
        .not('setor_id', 'is', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as PacienteComSetor[]
    },
  })

  // Auditoria de transferências recentes (gestor/super)
  const { data: transferencias, isLoading: carregandoTransf } = useQuery({
    queryKey: ['transferencias-paciente', unidadeId],
    enabled: !!unidadeId && (ehGestor || ehAdmin),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transferencias_paciente')
        .select('*, pacientes(id, nome), setores_internacao:setor_destino_id(id, nome)')
        .eq('unidade_id', unidadeId!)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return (data ?? []) as unknown as (TransferenciaPaciente & {
        pacientes: { id: string; nome: string } | null
      })[]
    },
  })

  // Horário do servidor (relógio de São Paulo) para o aviso das 18:30
  const { data: horaServidor } = useQuery({
    queryKey: ['hora-servidor'],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('horario_servidor')
      if (error) throw error
      return data as string
    },
    refetchInterval: 30_000,
  })

  const agora = React.useMemo(
    () => (horaServidor ? new Date(horaServidor) : null),
    [horaServidor]
  )
  const minutos = agora ? agora.getHours() * 60 + agora.getMinutes() : -1
  const pertoDoFim = minutos >= 18 * 60 + 30 // 18:30

  const pacientesObservacao = React.useMemo(() => {
    if (modo !== 'observacao') return []
    const setorObsIds = new Set((setores ?? []).map((s) => s.id))
    return (pacientes ?? []).filter((p) => p.setor_id && setorObsIds.has(p.setor_id))
  }, [modo, setores, pacientes])

  const emObservacaoMuitoTempo = React.useMemo(() => {
    if (!agora) return []
    return pacientesObservacao.filter((p) => {
      const entrada = new Date(p.created_at)
      const horas = (agora.getTime() - entrada.getTime()) / 3600000
      return horas >= 5.5
    })
  }, [agora, pacientesObservacao])

  // I2/I3: ocupação por setor (contagem viva + alerta de superlotação)
  const { data: ocupacao } = useQuery({
    queryKey: ['ocupacao-setores', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ocupacao_setores', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as OcupacaoSetor[]
    },
  })

  // I1: linha do tempo (transferências) do paciente selecionado
  const [pacienteDetalhe, setPacienteDetalhe] = React.useState<PacienteComSetor | null>(null)
  const { data: historico } = useQuery({
    queryKey: ['historico-paciente', pacienteDetalhe?.id],
    enabled: !!pacienteDetalhe,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transferencias_paciente')
        .select('*, perfis!transferencias_paciente_transferido_por_fkey(nome_completo)')
        .eq('paciente_id', pacienteDetalhe!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as (TransferenciaPaciente & { perfis: { nome_completo: string } | null })[]
    },
  })

  // I4: checklist de admissão do paciente selecionado
  const { data: checklist } = useQuery({
    queryKey: ['checklist-admissao', pacienteDetalhe?.id],
    enabled: !!pacienteDetalhe,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_admissao')
        .select('*')
        .eq('paciente_id', pacienteDetalhe!.id)
        .maybeSingle()
      if (error) throw error
      return data as ChecklistAdmissao | null
    },
  })

  // I5: alta do paciente selecionado
  const { data: alta } = useQuery({
    queryKey: ['alta-paciente', pacienteDetalhe?.id],
    enabled: !!pacienteDetalhe,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alta_paciente')
        .select('*')
        .eq('paciente_id', pacienteDetalhe!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as AltaPaciente | null
    },
  })

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ['pacientes-internados'] })
    void queryClient.invalidateQueries({ queryKey: ['transferencias-paciente'] })
    void queryClient.invalidateQueries({ queryKey: ['ocupacao-setores'] })
  }

  async function toggleChecklist(campo: 'prescricao' | 'dieta' | 'leito' | 'responsavel') {
    if (!pacienteDetalhe || !unidadeId) return
    const base: ChecklistAdmissaoInsert = { paciente_id: pacienteDetalhe.id, unidade_id: unidadeId }
    const patch: ChecklistAdmissaoInsert =
      campo === 'prescricao'
        ? { ...base, prescricao: !(checklist?.prescricao ?? false) }
        : campo === 'dieta'
          ? { ...base, dieta: !(checklist?.dieta ?? false) }
          : campo === 'leito'
            ? { ...base, leito: !(checklist?.leito ?? false) }
            : { ...base, responsavel: !(checklist?.responsavel ?? false) }
    const { error } = await supabase.from('checklist_admissao').upsert(patch, { onConflict: 'paciente_id' })
    if (!error) void queryClient.invalidateQueries({ queryKey: ['checklist-admissao'] })
  }

  async function solicitarAlta() {
    if (!pacienteDetalhe || !unidadeId) return
    const { error } = await supabase.from('alta_paciente').insert({
      paciente_id: pacienteDetalhe.id,
      unidade_id: unidadeId,
      status: 'em_alta',
      criterios: { clinico: true },
      liberou_leito: false,
    })
    if (!error) void queryClient.invalidateQueries({ queryKey: ['alta-paciente'] })
  }

  function exportarAuditoriaCSV() {
    if (!transferencias || transferencias.length === 0) return
    const linhas = ['Paciente;Data;Motivo']
    for (const t of transferencias) {
      linhas.push(`${t.pacientes?.nome ?? ''};${fmtDia(t.created_at)};${t.motivo || ''}`)
    }
    const blob = new Blob(['\uFEFF' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auditoria_transferencias_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const transferirMutation = useMutation({
    mutationFn: async () => {
      if (!transferir || !destinoId) return
      const { data, error } = await supabase.rpc('transferir_paciente', {
        p_paciente: transferir.id,
        p_destino: destinoId,
        p_motivo: motivo || undefined,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidar()
      setSucesso('Paciente transferido com sucesso.')
      setTransferir(null)
      setDestinoId('')
      setMotivo('')
      setErro(null)
      setTimeout(() => setSucesso(null), 4000)
    },
    onError: (e) => {
      setErro(e instanceof Error ? e.message : 'Erro ao transferir o paciente.')
    },
  })

  const carregando = carregandoSetores || carregandoPacientes

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-foreground">
            Início
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">{titulo}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        <p className="text-sm text-muted-foreground">
          {unidadeAtiva?.unidade.nome ?? 'Unidade'} ·{' '}
          {modo === 'internacao'
            ? 'Enfermaria Clínica, Enfermaria Pediátrica, Sala Vermelha/Semi-Crítica (e outros setores do gestor).'
            : 'Setor de Observação — pacientes permanecem em observação por no máximo 6 horas.'}{' '}
          Você só vê os pacientes dos setores onde está na escala agora.
        </p>
      </div>

      {sucesso && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{sucesso}</p>}

      {/* Aviso de internação — observação (18:30 / >6h) */}
      {modo === 'observacao' && pertoDoFim && emObservacaoMuitoTempo.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="mb-1 text-sm font-bold text-red-700">
            ⏰ Fim do turno se aproxima ({agora?.toLocaleTimeString('pt-BR')})
          </div>
          <p className="mb-2 text-sm text-red-700">
            Pacientes em observação por <strong>5h30+</strong> precisam ser <strong>internados</strong>{' '}
            (enfermaria/sala vermelha) ou liberados antes do fim do plantão.
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {emObservacaoMuitoTempo.map((p) => {
              const entrada = new Date(p.created_at)
              const horas = Math.floor((agora!.getTime() - entrada.getTime()) / 3600000)
              const mins = Math.floor(((agora!.getTime() - entrada.getTime()) % 3600000) / 60000)
              return (
                <li key={p.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                  <span className="font-medium">{p.nome}</span>
                  <span className="text-xs text-red-600">observação há {horas}h{mins}m</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* I2/I3: ocupação por setor + alerta de superlotação */}
      <div className="flex flex-wrap gap-2">
        {(ocupacao ?? []).map((o) => {
          const lotado = o.limite > 0 && o.internados >= o.limite
          const alerta = o.limite > 0 && o.internados >= Math.ceil(o.limite * 0.85)
          return (
            <div
              key={o.setor_id}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                lotado
                  ? 'border-red-300 bg-red-50'
                  : alerta
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-border bg-card'
              }`}
            >
              <span className="text-sm font-medium">{o.setor_nome}</span>
              <span className={`text-sm font-bold ${lotado ? 'text-red-600' : alerta ? 'text-amber-600' : 'text-foreground'}`}>
                {o.internados}/{o.limite || '∞'}
              </span>
              {lotado && <span className="text-xs font-bold text-red-600">LOTADO</span>}
            </div>
          )
        })}
      </div>

      {carregando ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(setores ?? []).map((s) => {
              const internados = (pacientes ?? []).filter((p) => p.setor_id === s.id)
              return (
                <Card key={s.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <IconePainel className="size-4 text-primary" />
                      {s.nome}
                    </CardTitle>
                    <CardDescription>
                      <Badge variant={internados.length > 0 ? 'success' : 'secondary'}>
                        {internados.length} paciente(s) internado(s)
                      </Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {internados.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum paciente neste setor.</p>
                    ) : (
                      internados.map((p) => (
                        <div key={p.id} className="rounded-lg border p-2">
                          <div className="font-medium">{p.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.sexo ? `${p.sexo} · ` : ''}
                            {fmtDia(p.data_nascimento)}
                            {p.cpf ? ` · CPF ${p.cpf}` : ''}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Button size="xs" variant="outline" onClick={() => setTransferir(p)}>
                              <ArrowRightLeft /> Transferir
                            </Button>
                            <Button size="xs" variant="ghost" onClick={() => setPacienteDetalhe(p)}>
                              <Eye /> Detalhes
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => window.open('/plantao/internacao', '_blank')}
                            >
                              Abrir
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Auditoria (gestor/admin) */}
          {(ehGestor || ehAdmin) && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ArrowRightLeft className="size-4 text-muted-foreground" />
                    Transferências recentes
                  </CardTitle>
                  <CardDescription>Registro de auditoria das transferências entre setores.</CardDescription>
                </div>
                <Button size="xs" variant="outline" onClick={exportarAuditoriaCSV} disabled={(transferencias ?? []).length === 0}>
                  Exportar CSV
                </Button>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {carregandoTransf ? (
                  <div className="flex h-16 items-center justify-center">
                    <Spinner />
                  </div>
                ) : (transferencias ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma transferência registrada.</p>
                ) : (
                  (transferencias ?? []).map((t) => (
                    <div key={t.id} className="rounded-lg border p-2 text-sm">
                      <div className="font-medium">{t.pacientes?.nome ?? 'Paciente'}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDia(t.created_at)} · {t.motivo || 'sem motivo'}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Dialog de transferência */}
      <Dialog open={!!transferir} onOpenChange={(o) => !o && setTransferir(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transferir paciente</DialogTitle>
            <DialogDescription>
              {transferir?.nome} — para qual setor? Apenas quem está na escala do setor de origem pode
              transferir.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Setor de destino</Label>
              <Select value={destinoId || null} onValueChange={(v) => setDestinoId(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {(setores ?? [])
                    .filter((s) => s.id !== transferir?.setor_id)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="motivo">
                Justificativa do encaminhamento <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: piora clínica, necessidade de UTI, descompensação…"
                required
              />
              {!motivo.trim() && (
                <p className="text-xs text-amber-600">Informe o motivo para justificar a transferência.</p>
              )}
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setTransferir(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => transferirMutation.mutate()}
              disabled={!destinoId || !motivo.trim() || transferirMutation.isPending}
            >
              {transferirMutation.isPending ? <Spinner /> : <ArrowRightLeft />} Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* I1/I4/I5: detalhes do paciente — linha do tempo, checklist, alta */}
      <Dialog open={!!pacienteDetalhe} onOpenChange={(o) => !o && setPacienteDetalhe(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{pacienteDetalhe?.nome}</DialogTitle>
            <DialogDescription>Linha do tempo, checklist de admissão e alta.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* I1: linha do tempo */}
            <div className="flex flex-col gap-1.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Linha do tempo (transferências)
              </div>
              {(historico ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem transferências registradas.</p>
              ) : (
                (historico ?? []).map((h) => (
                  <div key={h.id} className="rounded-lg border p-2 text-sm">
                    <span className="text-xs text-muted-foreground">{fmtDia(h.created_at)}</span>
                    <div>
                      por <strong>{h.perfis?.nome_completo ?? '—'}</strong> · {h.motivo || 'sem motivo'}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* I4: checklist de admissão */}
            <div className="flex flex-col gap-1.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Checklist de admissão
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['prescricao', 'Prescrição'],
                    ['dieta', 'Dieta'],
                    ['leito', 'Leito'],
                    ['responsavel', 'Responsável'],
                  ] as const
                ).map(([campo, rotulo]) => {
                  const marcado = checklist?.[campo] ?? false
                  return (
                    <button
                      key={campo}
                      type="button"
                      onClick={() => toggleChecklist(campo)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                        marcado
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-border bg-background hover:bg-muted'
                      }`}
                    >
                      {marcado ? '✓ ' : '○ '}
                      {rotulo}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* I5: alta */}
            <div className="flex flex-col gap-1.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alta</div>
              {alta?.status === 'concluida' ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  ✓ Alta concluída · {fmtDia(alta.created_at)}
                </div>
              ) : alta?.status === 'em_alta' ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  Alta em processo (aguardando liberação do leito).
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={solicitarAlta}>
                  Solicitar alta
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserPlus className="size-3.5" /> Para internar um paciente, use a Internação em Plantão e
        direcione-o para o setor. Transferências entre setores são registradas em auditoria.
      </p>
    </div>
  )
}
