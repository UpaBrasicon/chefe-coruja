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
import type { TransferenciaPaciente } from '@/types/database'

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

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ['pacientes-internados'] })
    void queryClient.invalidateQueries({ queryKey: ['transferencias-paciente'] })
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
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowRightLeft className="size-4 text-muted-foreground" />
                  Transferências recentes
                </CardTitle>
                <CardDescription>Registro de auditoria das transferências entre setores.</CardDescription>
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

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserPlus className="size-3.5" /> Para internar um paciente, use a Internação em Plantão e
        direcione-o para o setor. Transferências entre setores são registradas em auditoria.
      </p>
    </div>
  )
}
