import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import type { EscalaPlantao, PlantonistaDaUnidade } from '@/types/database'

const TURNOS = [
  { id: 'manha', label: 'Manhã', horario: '07h–13h' },
  { id: 'tarde', label: 'Tarde', horario: '13h–19h' },
  { id: 'noite', label: 'Noite', horario: '19h–07h' },
] as const

const DIAS_SEMANA = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']
const TURNO_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

function segundaDaSemana(data: string) {
  const d = new Date(data + 'T12:00:00')
  const dia = d.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + diff)
  return d
}

function iso(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function somaDias(data: string, n: number) {
  const d = new Date(data + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return iso(d)
}

function primeiroDiaDoMes(isoDate: string) {
  const [y, m] = isoDate.split('-')
  return `${y}-${m}-01`
}

function ultimoDiaDoMes(isoDate: string) {
  const [y, m] = isoDate.split('-')
  return iso(new Date(Number(y), Number(m), 0))
}

function fmtMesBR(isoDate: string) {
  const [y, m] = isoDate.split('-')
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${meses[Number(m) - 1]}/${y}`
}

function fmtDiaBR(isoDate: string) {
  const [, m, d] = isoDate.split('-')
  return `${d}/${m}`
}

export default function Escala() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id
  const queryClient = useQueryClient()

  const [semana, setSemana] = React.useState(() => {
    const h = new Date()
    return iso(segundaDaSemana(iso(h)))
  })
  const [turno, setTurno] = React.useState<'manha' | 'tarde' | 'noite'>('manha')
  const [dialogAberto, setDialogAberto] = React.useState(false)
  const [celula, setCelula] = React.useState<{ setor_id: string; data: string } | null>(null)
  const [plantonistaId, setPlantonistaId] = React.useState('')
  const [rotulo, setRotulo] = React.useState('')
  const [quinzenal, setQuinzenal] = React.useState(false)

  const ehGestor = papelAtivo === 'gestor'
  const ehAdmin = papelAtivo === 'admin'

  const dias = React.useMemo(() => Array.from({ length: 7 }, (_, i) => somaDias(semana, i)), [semana])
  const dataInicio = dias[0]
  const dataFim = dias[6]
  const mesInicio = primeiroDiaDoMes(semana)
  const mesFim = ultimoDiaDoMes(semana)

  const { data: setores, isLoading: carregandoSetores } = useQuery({
    queryKey: ['escala-setores', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('setores')
        .select('id, nome')
        .eq('unidade_id', unidadeId!)
        .eq('ativo', true)
        .order('ordem', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  const { data: escala, isLoading: carregandoEscala } = useQuery({
    queryKey: ['escala-plantao', unidadeId, dataInicio, dataFim],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('escala_plantao')
        .select('id, setor_id, perfil_id, data, turno, rotulo, observacao, quinzenal, perfis!escala_plantao_perfil_id_fkey(id, nome_completo, crm)')
        .eq('unidade_id', unidadeId!)
        .eq('ativo', true)
        .gte('data', dataInicio)
        .lte('data', dataFim)
      if (error) throw error
      return (data ?? []) as (EscalaPlantao & { perfis: { id: string; nome_completo: string; crm: string | null } | null })[]
    },
  })

  const { data: plantonistas, isLoading: carregandoPlant } = useQuery({
    queryKey: ['escala-plantonistas', unidadeId],
    enabled: !!unidadeId && (ehGestor || ehAdmin),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('plantonistas_da_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as PlantonistaDaUnidade[]
    },
  })

  // Contador MENSAL: busca todos os plantões do mês (independente da semana exibida)
  const { data: escalaMes, isLoading: carregandoMes } = useQuery({
    queryKey: ['escala-plantao-mes', unidadeId, mesInicio, mesFim],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('escala_plantao')
        .select('perfil_id, data, turno')
        .eq('unidade_id', unidadeId!)
        .eq('ativo', true)
        .gte('data', mesInicio)
        .lte('data', mesFim)
      if (error) throw error
      return data ?? []
    },
  })

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('escala_plantao').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['escala-plantao'] }),
  })

  const adicionar = useMutation({
    mutationFn: async () => {
      if (!unidadeId || !celula || !plantonistaId) return
      const { error } = await supabase.from('escala_plantao').insert({
        unidade_id: unidadeId,
        setor_id: celula.setor_id,
        perfil_id: plantonistaId,
        data: celula.data,
        turno,
        rotulo: rotulo || null,
        quinzenal,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['escala-plantao'] })
      setDialogAberto(false)
      setPlantonistaId('')
      setRotulo('')
      setQuinzenal(false)
    },
  })

  function abrirCelula(setor_id: string, data: string) {
    setCelula({ setor_id, data })
    setPlantonistaId('')
    setRotulo('')
    setQuinzenal(false)
    setDialogAberto(true)
  }

  function mudarSemana(n: number) {
    setSemana(somaDias(semana, 7 * n))
  }

  const plantoesDaCelula = (setorId: string, data: string) =>
    (escala ?? []).filter((e) => e.setor_id === setorId && e.data === data && e.turno === turno)

  const meusPlantoes = React.useMemo(
    () => (escalaMes ?? []).filter((e) => e.perfil_id === perfil?.id),
    [escalaMes, perfil?.id]
  )

  const resumo = React.useMemo(() => {
    const porDia = new Map<string, Set<string>>()
    for (const p of meusPlantoes) {
      const set = porDia.get(p.data) ?? new Set()
      set.add(p.turno)
      porDia.set(p.data, set)
    }
    let horas = 0
    let diurnos = 0
    let noturnos = 0
    let dias = 0
    for (const turnos of porDia.values()) {
      dias++
      const temManha = turnos.has('manha')
      const temTarde = turnos.has('tarde')
      const temNoite = turnos.has('noite')
      // Manhã + tarde no mesmo dia = DIURNO de 12h (não 6h + 6h)
      if (temManha && temTarde) {
        diurnos++
        horas += 12
      } else if (temManha) {
        horas += 6
      } else if (temTarde) {
        horas += 6
      }
      if (temNoite) {
        noturnos++
        horas += 12
      }
    }
    return { horas, diurnos, noturnos, dias }
  }, [meusPlantoes])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-foreground">
            Início
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">Escala</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Escala de Plantões</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Button size="xs" variant="outline" onClick={() => mudarSemana(-1)}>
              <ChevronLeft /> Semana
            </Button>
            <span className="font-medium text-foreground">
              {fmtDiaBR(dataInicio)} – {fmtDiaBR(dataFim)}
            </span>
            <Button size="xs" variant="outline" onClick={() => mudarSemana(1)}>
              Semana <ChevronRight />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {unidadeAtiva?.unidade.nome ?? 'Unidade'} ·{' '}
          {ehGestor ? 'Gestor — monte a escala' : ehAdmin ? 'Admin — todas as unidades' : 'Sua escala'}
        </p>
      </div>

      {/* Turnos */}
      <div className="flex flex-wrap gap-2">
        {TURNOS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTurno(t.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              turno === t.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted'
            }`}
          >
            {t.label} <span className="opacity-70">· {t.horario}</span>
          </button>
        ))}
      </div>

      {carregandoSetores || carregandoEscala ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-muted-foreground" />
              {TURNO_LABEL[turno]} · Semana de {fmtDiaBR(dataInicio)}
            </CardTitle>
            <CardDescription>
              {ehGestor || ehAdmin
                ? 'Clique em uma célula para adicionar ou remover plantonistas.'
                : 'Células destacadas indicam seus plantões.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-40 border-b border-r bg-muted/50 p-2 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Setor
                    </th>
                    {dias.map((d, i) => (
                      <th
                        key={d}
                        className={`border-b p-2 text-center text-xs font-bold uppercase tracking-wide ${
                          i >= 5 ? 'border-r border-r-amber-200 bg-amber-50 text-amber-700' : 'border-r'
                        }`}
                      >
                        {DIAS_SEMANA[i]}
                        <span className="block text-[10px] font-normal text-muted-foreground">{fmtDiaBR(d)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(setores ?? []).map((s) => (
                    <tr key={s.id}>
                      <td className="border-b border-r p-2 align-top font-medium">{s.nome}</td>
                      {dias.map((d) => {
                        const plantoes = plantoesDaCelula(s.id, d)
                        const ehMeu = plantoes.some((p) => p.perfil_id === perfil?.id)
                        return (
                          <td
                            key={d}
                            className={`border-b border-r p-1 align-top ${
                              ehMeu ? 'bg-emerald-50' : ''
                            }`}
                          >
                            <button
                              type="button"
                              disabled={!ehGestor && !ehAdmin}
                              onClick={() => abrirCelula(s.id, d)}
                              className={`flex min-h-[52px] w-full flex-col gap-1 rounded-md p-1 text-left transition-colors ${
                                ehGestor || ehAdmin ? 'hover:bg-primary/5' : 'cursor-default'
                              }`}
                            >
                              {plantoes.length === 0 && (
                                <span className="text-[10px] text-muted-foreground/50">
                                  {ehGestor || ehAdmin ? '+ adicionar' : '—'}
                                </span>
                              )}
                              {plantoes.map((p) => (
                                <span key={p.id} className="block">
                                  <span
                                    className={`block rounded px-1.5 py-0.5 text-[11px] leading-tight ${
                                      p.perfil_id === perfil?.id
                                        ? 'bg-emerald-100 font-semibold text-emerald-900'
                                        : 'bg-muted text-foreground'
                                    }`}
                                  >
                                    {p.perfis?.nome_completo?.split(' ').slice(0, 2).join(' ') ?? 'Sem nome'}
                                    {p.quinzenal && <span className="ml-1 font-bold text-primary">15/15</span>}
                                  </span>
                                  {p.rotulo && (
                                    <span className="block px-1.5 text-[10px] text-muted-foreground">{p.rotulo}</span>
                                  )}
                                </span>
                              ))}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contador de plantões do plantonista — MENSAL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4 text-muted-foreground" />
            Meus plantões no mês
          </CardTitle>
          <CardDescription>
            {perfil?.nome_completo ?? 'Você'} · {fmtMesBR(mesInicio)} ({fmtDiaBR(mesInicio)} –{' '}
            {fmtDiaBR(mesFim)})
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-stretch gap-4">
          {carregandoMes ? (
            <div className="flex w-full items-center justify-center py-6">
              <Spinner />
            </div>
          ) : (
            <>
          <div className="flex flex-1 flex-col rounded-xl border bg-muted/40 p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Horas no mês
            </span>
            <span className="mt-1 text-3xl font-bold">{resumo.horas}h</span>
            <span className="text-xs text-muted-foreground">
              {resumo.dias} dia(s) escalado(s) em {fmtMesBR(mesInicio)}
            </span>
          </div>
          <div className="flex flex-1 flex-col rounded-xl border bg-sky-50 p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-sky-700">
              Diurnos (manhã + tarde = 12h)
            </span>
            <span className="mt-1 text-3xl font-bold text-sky-800">{resumo.diurnos}</span>
            <span className="text-xs text-sky-700">
              {resumo.diurnos * 12}h · manhã e tarde juntas contam como diurno
            </span>
          </div>
          <div className="flex flex-1 flex-col rounded-xl border bg-indigo-50 p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Noturnos (noite = 12h)
            </span>
            <span className="mt-1 text-3xl font-bold text-indigo-800">{resumo.noturnos}</span>
            <span className="text-xs text-indigo-700">{resumo.noturnos * 12}h</span>
          </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Gestor: detalhe dos plantões da célula */}
      {ehGestor && celula && !dialogAberto && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {setores?.find((s) => s.id === celula.setor_id)?.nome} · {fmtDiaBR(celula.data)} ·{' '}
              {TURNO_LABEL[turno]}
            </CardTitle>
            <CardDescription>Plantonistas escalados neste plantão.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {(escala ?? [])
              .filter((e) => e.setor_id === celula.setor_id && e.data === celula.data && e.turno === turno)
              .map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border p-2">
                  <div>
                    <div className="font-medium">{e.perfis?.nome_completo ?? 'Sem nome'}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.quinzenal && '15/15 · '}
                      {e.rotulo || 'sem rótulo'}
                    </div>
                  </div>
                  <Button size="xs" variant="ghost" onClick={() => remover.mutate(e.id)}>
                    <Trash2 /> Remover
                  </Button>
                </div>
              ))}
            {!carregandoEscala &&
              (escala ?? []).filter((e) => e.setor_id === celula.setor_id && e.data === celula.data && e.turno === turno)
                .length === 0 && <p className="text-sm text-muted-foreground">Nenhum plantonista neste plantão.</p>}
          </CardContent>
        </Card>
      )}

      {/* Dialog: adicionar plantonista */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar plantonista</DialogTitle>
            <DialogDescription>
              {setores?.find((s) => s.id === celula?.setor_id)?.nome} ·{' '}
              {celula ? fmtDiaBR(celula.data) : ''} · {TURNO_LABEL[turno]}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Plantonista</Label>
              <Select value={plantonistaId || null} onValueChange={(v) => setPlantonistaId(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(plantonistas ?? []).map((p) => (
                    <SelectItem key={p.perfil_id} value={p.perfil_id}>
                      {p.nome_completo}
                      {p.crm ? ` · CRM ${p.crm}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {carregandoPlant && <Spinner />}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="esc-rotulo">Rótulo (opcional)</Label>
              <Input
                id="esc-rotulo"
                value={rotulo}
                onChange={(e) => setRotulo(e.target.value)}
                placeholder='Ex: "escala 15/15", "cobertura"' 
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={quinzenal}
                onChange={(e) => setQuinzenal(e.target.checked)}
              />
              Escala quinzenal (15/15)
            </label>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => adicionar.mutate()} disabled={!plantonistaId || adicionar.isPending}>
              {adicionar.isPending ? <Spinner /> : <Plus />} Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
