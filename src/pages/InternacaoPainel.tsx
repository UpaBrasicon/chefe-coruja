import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRightLeft, ChevronRight, UserPlus } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { ListaInternados, type PacienteDaLista } from '@/components/internacao/ListaInternados'
import { PainelObservacao } from '@/components/observacao/PainelObservacao'
import type { OcupacaoSetor, TransferenciaPaciente } from '@/types/database'

type PacienteComSetor = PacienteDaLista & { cpf: string | null; created_at: string }

function fmtDia(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

type Setor = { id: string; nome: string; tipo: string; ordem: number }

// Porte da observação (Bloco 3): o modo observação é o painel próprio, em
// components/observacao; este arquivo segue sendo o da internação.
export default function InternacaoPainel(props: { modo?: 'internacao' | 'observacao'; embutido?: boolean }) {
  if (props.modo === 'observacao') return <PainelObservacao embutido={props.embutido} />
  return <PainelInternacao {...props} />
}

// Painel de internação: a lista de internados do protótipo (com o caderno do
// leito na própria linha), a ocupação por setor, a transferência entre setores
// e, para o gestor, a auditoria das transferências.
function PainelInternacao({ embutido = false }: { modo?: 'internacao' | 'observacao'; embutido?: boolean }) {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const queryClient = useQueryClient()

  const [transferir, setTransferir] = React.useState<PacienteDaLista | null>(null)
  const [destinoId, setDestinoId] = React.useState('')
  const [motivo, setMotivo] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [sucesso, setSucesso] = React.useState<string | null>(null)

  const ehGestor = papelAtivo === 'gestor'
  const ehAdmin = papelAtivo === 'admin'
  const ehPlantonista = papelAtivo === 'plantonista'
  const titulo = 'Pacientes internados'

  // Setores de internação da unidade
  const { data: setores, isLoading: carregandoSetores } = useQuery({
    queryKey: ['setores-internacao', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('setores_internacao', { p_unidade: unidadeId! })
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

  // Pediatria com infecção: Phoenix calculado no servidor (Fase 3.7)
  const { data: alertasSepse } = useQuery({
    queryKey: ['alertas-sepse', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('alertas_sepse', { p_unidade: unidadeId! })
      if (error) throw error
      return new Map((data ?? []).map((a) => [a.paciente_id, a]))
    },
  })

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

  const invalidar = () => {
    for (const k of ['pacientes-internados', 'transferencias-paciente', 'ocupacao-setores', 'internados-leitos', 'leito-aberto', 'historico-paciente'])
      void queryClient.invalidateQueries({ queryKey: [k] })
  }

  function exportarAuditoriaCSV() {
    if (!transferencias || transferencias.length === 0) return
    const linhas = ['Paciente;Data;Motivo']
    for (const t of transferencias) {
      linhas.push(`${t.pacientes?.nome ?? ''};${fmtDia(t.created_at)};${t.motivo || ''}`)
    }
    const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' })
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
      const { data, error } = await supabase.rpc('transferir_internado', {
        p_paciente: transferir.id,
        p_destino: destinoId,
        p_motivo: motivo || undefined,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidar()
      setSucesso('Paciente transferido com sucesso (evento ADT registrado).')
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      {!embutido && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-sm text-tinta-sussurro">
            <Link to="/" className="transition-colors hover:text-tinta">
              Início
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="font-medium text-tinta">{titulo}</span>
          </div>
          <h1 className="text-titulo leading-[1.1] font-semibold tracking-[-0.02em] text-tinta">{titulo}</h1>
          <p className="text-sm text-tinta-sussurro">{unidadeAtiva?.unidade.nome ?? 'Unidade'}</p>
        </div>
      )}

      {sucesso && <p className="rounded-lg border border-conforme/30 bg-conforme/[0.08] p-3 text-sm text-conforme">{sucesso}</p>}

      {/* I2/I3: ocupação por setor + alerta de superlotação */}
      {(ocupacao ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(ocupacao ?? []).map((o) => {
            const lotado = o.limite > 0 && o.internados >= o.limite
            const alerta = o.limite > 0 && o.internados >= Math.ceil(o.limite * 0.85)
            return (
              <div
                key={o.setor_id}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                  lotado ? 'border-critico/30 bg-critico/[0.08]' : alerta ? 'border-atencao/30 bg-atencao/[0.08]' : 'border-fio bg-superficie'
                }`}
              >
                <span className="text-sm font-medium">{o.setor_nome}</span>
                <span className={`text-sm font-semibold tabular-nums ${lotado ? 'text-critico' : alerta ? 'text-atencao' : 'text-tinta'}`}>
                  {o.internados}/{o.limite || '∞'}
                </span>
                {lotado && <span className="text-xs font-semibold text-critico">LOTADO</span>}
              </div>
            )
          })}
        </div>
      )}

      <ListaInternados
        unidadeId={unidadeId}
        setores={setores ?? []}
        pacientes={pacientes ?? []}
        carregando={carregandoSetores || carregandoPacientes}
        ehGestor={ehGestor || ehAdmin}
        podeDarAlta={ehPlantonista}
        alertasSepse={alertasSepse}
        onTransferir={(p) => { setErro(null); setTransferir(p) }}
      />

      {/* Auditoria (gestor/admin) */}
      {(ehGestor || ehAdmin) && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowRightLeft className="size-4 text-tinta-sussurro" />
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
              <p className="text-sm text-tinta-sussurro">Nenhuma transferência registrada.</p>
            ) : (
              (transferencias ?? []).map((t) => (
                <div key={t.id} className="rounded-lg border p-2 text-sm">
                  <div className="font-medium">{t.pacientes?.nome ?? 'Paciente'}</div>
                  <div className="text-xs text-tinta-sussurro">
                    {fmtDia(t.created_at)} · {t.motivo || 'sem motivo'}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
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
                Justificativa do encaminhamento <span className="text-critico">*</span>
              </Label>
              <Textarea
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: piora clínica, necessidade de UTI, descompensação…"
                required
              />
              {!motivo.trim() && (
                <p className="text-xs text-atencao">Informe o motivo para justificar a transferência.</p>
              )}
            </div>
            {erro && <p className="text-sm text-critico">{erro}</p>}
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

      <p className="flex items-center gap-1.5 text-xs text-tinta-sussurro">
        <UserPlus className="size-3.5" /> Para internar um paciente, use o desfecho do atendimento na porta (internação) e
        direcione-o para o setor. Transferências entre setores são registradas em auditoria.
      </p>
    </div>
  )
}
