import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  LogOut,
  Plus,
  RefreshCcw,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import type { EscalaPlantao, PlantonistaDaUnidade, SolicitacaoEscala } from '@/types/database'

const TURNOS = [
  { id: 'manha', label: 'Manhã', horario: '07h–13h' },
  { id: 'tarde', label: 'Tarde', horario: '13h–19h' },
  { id: 'noite', label: 'Noite', horario: '19h–07h' },
] as const

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const DIAS_SEMANA_SEG = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']
const TURNO_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const TIPO_SOLICITACAO_LABEL: Record<string, string> = {
  sair_fixo: 'Sair do fixo',
  passar_plantao: 'Passar plantão',
  justificar_falta: 'Justificar falta',
}

const TIPO_FALTA_LABEL: Record<string, string> = {
  atestado_medico: 'Atestado médico',
  licenca_maternidade: 'Licença-maternidade',
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

function fmtDiaBR(isoDate: string) {
  const [, m, d] = isoDate.split('-')
  return `${d}/${m}`
}

function fmtMesBR(isoDate: string) {
  const [y, m] = isoDate.split('-')
  return `${MESES[Number(m) - 1]}/${y}`
}

function hojeISO() {
  return iso(new Date())
}

function diasPara(dataISO: string) {
  const hoje = new Date(hojeISO() + 'T12:00:00')
  const alvo = new Date(dataISO + 'T12:00:00')
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
}

function gerarDiasDoMes(mesISO: string) {
  const [y, m] = mesISO.split('-').map(Number)
  const primeiro = new Date(y, m - 1, 1)
  const diasNoMes = new Date(y, m, 0).getDate()
  const celulas: { iso: string; dia: number; fora: boolean }[] = []
  const inicioSemana = primeiro.getDay()
  for (let i = 0; i < inicioSemana; i++) {
    celulas.push({ iso: '', dia: 0, fora: true })
  }
  for (let d = 1; d <= diasNoMes; d++) {
    celulas.push({ iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dia: d, fora: false })
  }
  while (celulas.length % 7 !== 0) {
    celulas.push({ iso: '', dia: 0, fora: true })
  }
  return celulas
}

function ehHoje(dataISO: string) {
  return dataISO === hojeISO()
}

type PlantaoComPerfil = EscalaPlantao & {
  perfis: { id: string; nome_completo: string; crm: string | null } | null
}

type SolicitacaoComExtra = SolicitacaoEscala & {
  escala_plantao: { setor_id: string; data: string; turno: string } | null
  solicitante: { nome_completo: string } | null
  destino: { nome_completo: string } | null
}

export default function Escala() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id
  const queryClient = useQueryClient()

  const [turno, setTurno] = React.useState<'manha' | 'tarde' | 'noite'>('manha')
  const [mes, setMes] = React.useState(() => hojeISO().slice(0, 7))
  const [semana, setSemana] = React.useState(() => hojeISO())
  const [celula, setCelula] = React.useState<{ setor_id: string; data: string } | null>(null)
  const [plantonistaId, setPlantonistaId] = React.useState('')
  const [rotulo, setRotulo] = React.useState('')
  const [quinzenal, setQuinzenal] = React.useState(false)

  // Ações do plantonista no dia
  const [diaSelecionado, setDiaSelecionado] = React.useState<string | null>(null)
  const [fechando, setFechando] = React.useState(false)
  const [acao, setAcao] = React.useState<'sair_fixo' | 'passar_plantao' | 'justificar_falta' | null>(null)
  const [justificativa, setJustificativa] = React.useState('')
  const [destinoId, setDestinoId] = React.useState('')
  const [tipoFalta, setTipoFalta] = React.useState<'atestado_medico' | 'licenca_maternidade'>('atestado_medico')
  const [anexo, setAnexo] = React.useState<File | null>(null)
  const [anexando, setAnexando] = React.useState(false)
  const [mensagem, setMensagem] = React.useState<string | null>(null)
  const [erroAcao, setErroAcao] = React.useState<string | null>(null)

  const ehGestor = papelAtivo === 'gestor'
  const ehAdmin = papelAtivo === 'admin'
  const ehPlantonista = papelAtivo === 'plantonista'

  const dias = React.useMemo(() => Array.from({ length: 7 }, (_, i) => somaDias(semana, i)), [semana])
  const dataInicio = dias[0]
  const dataFim = dias[6]
  const mesInicio = primeiroDiaDoMes(`${mes}-01`)
  const mesFim = ultimoDiaDoMes(`${mes}-01`)

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
      return (data ?? []) as PlantaoComPerfil[]
    },
  })

  // Escala do mês inteiro (contador + calendário do plantonista)
  const { data: escalaMes, isLoading: carregandoMes } = useQuery({
    queryKey: ['escala-plantao-mes', unidadeId, mesInicio, mesFim],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('escala_plantao')
        .select('id, setor_id, perfil_id, data, turno, quinzenal, perfis!escala_plantao_perfil_id_fkey(id, nome_completo, crm)')
        .eq('unidade_id', unidadeId!)
        .eq('ativo', true)
        .gte('data', mesInicio)
        .lte('data', mesFim)
      if (error) throw error
      return (data ?? []) as PlantaoComPerfil[]
    },
  })

  const { data: plantonistas, isLoading: carregandoPlant } = useQuery({
    queryKey: ['escala-plantonistas', unidadeId],
    enabled: !!unidadeId && (ehGestor || ehAdmin || !!diaSelecionado),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('plantonistas_da_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as PlantonistaDaUnidade[]
    },
  })

  const { data: solicitacoes, isLoading: carregandoSolic } = useQuery({
    queryKey: ['solicitacoes-escala', unidadeId],
    enabled: !!unidadeId && (ehGestor || ehAdmin),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitacoes_escala')
        .select('*, escala_plantao(setor_id, data, turno), solicitante!solicitacoes_escala_perfil_id_fkey(nome_completo), destino!solicitacoes_escala_destino_perfil_id_fkey(nome_completo)')
        .eq('unidade_id', unidadeId!)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as unknown as SolicitacaoComExtra[]
    },
  })

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ['escala-plantao'] })
    void queryClient.invalidateQueries({ queryKey: ['escala-plantao-mes'] })
    void queryClient.invalidateQueries({ queryKey: ['solicitacoes-escala'] })
  }

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('escala_plantao').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
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
      invalidar()
      setDialogAberto(false)
      setPlantonistaId('')
      setRotulo('')
      setQuinzenal(false)
    },
  })

  const decidir = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'aprovado' | 'recusado' }) => {
      const { error } = await supabase
        .from('solicitacoes_escala')
        .update({ status, decidido_por: perfil!.id })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  const [dialogAberto, setDialogAberto] = React.useState(false)

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

  function mudarMes(n: number) {
    const [y, m] = mes.split('-').map(Number)
    const d = new Date(y, m - 1 + n, 1)
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
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

  const plantoesDoDia = (diaISO: string) => meusPlantoes.filter((p) => p.data === diaISO)

  function abrirDia(diaISO: string) {
    const plantoes = plantoesDoDia(diaISO)
    if (!plantoes.length) return
    setDiaSelecionado(diaISO)
    setAcao(null)
    setJustificativa('')
    setDestinoId('')
    setAnexo(null)
    setMensagem(null)
    setErroAcao(null)
  }

  function fecharDia() {
    if (fechando) return
    setFechando(true)
    setTimeout(() => {
      setDiaSelecionado(null)
      setAcao(null)
      setFechando(false)
    }, 200)
  }

  async function enviarSairFixo() {
    if (!diaSelecionado || !unidadeId || !perfil) return
    setErroAcao(null)
    const escalaId = plantoesDoDia(diaSelecionado)[0]?.id
    if (!escalaId) return
    const { error } = await supabase.from('solicitacoes_escala').insert({
      unidade_id: unidadeId,
      escala_plantao_id: escalaId,
      perfil_id: perfil.id,
      tipo: 'sair_fixo',
      justificativa: justificativa || null,
      criado_por: perfil.id,
    })
    if (error) {
      setErroAcao(error.message)
      return
    }
    invalidar()
    setMensagem('Solicitação de saída do fixo enviada.')
    setJustificativa('')
  }

  async function enviarJustificarFalta() {
    if (!diaSelecionado || !unidadeId || !perfil) return
    setErroAcao(null)
    const escalaId = plantoesDoDia(diaSelecionado)[0]?.id
    if (!escalaId) return

    let anexoUrl: string | null = null
    if (anexo) {
      setAnexando(true)
      const nomeSeguro = anexo.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const caminho = `${unidadeId}/justificativas/${crypto.randomUUID()}-${nomeSeguro}`
      const { error: upErr } = await supabase.storage.from('atendimento').upload(caminho, anexo, {
        cacheControl: '3600',
        upsert: false,
      })
      setAnexando(false)
      if (upErr) {
        setErroAcao('Falha ao enviar o anexo: ' + upErr.message)
        return
      }
      const { data } = supabase.storage.from('atendimento').getPublicUrl(caminho)
      anexoUrl = data.publicUrl
    }

    const { error } = await supabase.from('solicitacoes_escala').insert({
      unidade_id: unidadeId,
      escala_plantao_id: escalaId,
      perfil_id: perfil.id,
      tipo: 'justificar_falta',
      tipo_falta: tipoFalta,
      justificativa: justificativa || null,
      anexo_url: anexoUrl,
      criado_por: perfil.id,
    })
    if (error) {
      setErroAcao(error.message)
      return
    }
    invalidar()
    setMensagem('Justificativa enviada. O gestor será notificado.')
    setJustificativa('')
    setAnexo(null)
  }

  async function enviarPassarPlantao() {
    if (!diaSelecionado || !destinoId || !perfil) return
    setErroAcao(null)
    const escalaId = plantoesDoDia(diaSelecionado)[0]?.id
    if (!escalaId) return
    try {
      const { data, error } = await supabase.rpc('passar_plantao', {
        p_escala: escalaId,
        p_destino: destinoId,
        p_justificativa: justificativa || undefined,
      })
      if (error) throw error
      invalidar()
      setMensagem(data ? 'Plantão passado com sucesso.' : 'Solicitação de passagem registrada.')
      setJustificativa('')
      setDestinoId('')
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Erro ao passar o plantão.')
    }
  }

  const diasDoMes = React.useMemo(() => gerarDiasDoMes(mes), [mes])

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
          <h1 className="text-2xl font-semibold tracking-tight">
            {ehPlantonista ? 'Minha Escala' : 'Escala de Plantões'}
          </h1>
          {ehPlantonista ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Button size="xs" variant="outline" onClick={() => mudarMes(-1)}>
                <ChevronLeft /> Mês
              </Button>
              <span className="font-medium text-foreground">{fmtMesBR(mesInicio)}</span>
              <Button size="xs" variant="outline" onClick={() => mudarMes(1)}>
                Mês <ChevronRight />
              </Button>
            </div>
          ) : (
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
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {unidadeAtiva?.unidade.nome ?? 'Unidade'} ·{' '}
          {ehGestor ? 'Gestor — monte a escala' : ehAdmin ? 'Admin — todas as unidades' : 'Sua escala'}
        </p>
      </div>

      {ehPlantonista ? (
        <>
          {/* CALENDÁRIO MENSAL — contexto geral do mês */}
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="size-4 text-muted-foreground" />
                  {diaSelecionado ? `Plantão de ${fmtDiaBR(diaSelecionado)}` : `Visão geral de ${fmtMesBR(mesInicio)}`}
                </CardTitle>
                <CardDescription>
                  {diaSelecionado
                    ? 'Período(s) em que você está de plantão:'
                    : 'Clique em um dia com plantão para sair do fixo, passar o plantão ou justificar falta.'}
                </CardDescription>
              </div>
              {diaSelecionado && (
                <Button size="xs" variant="ghost" onClick={fecharDia}>
                  <X /> Voltar ao mês
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {carregandoMes ? (
                <div className="flex h-40 items-center justify-center">
                  <Spinner />
                </div>
              ) : diaSelecionado ? (
                <div
                  key={`painel-${diaSelecionado}`}
                  className={`animate-in fade-in-0 zoom-in-95 duration-200 ease-out ${
                    fechando ? 'animate-out fade-out-0 zoom-out-95' : ''
                  }`}
                >
                  <div className="flex flex-wrap gap-2">
                    {plantoesDoDia(diaSelecionado).map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow-sm"
                      >
                        {TURNO_LABEL[p.turno]}
                        <span className="font-normal text-emerald-50">
                          {TURNOS.find((t) => t.id === p.turno)?.horario}
                        </span>
                        {p.quinzenal && <span className="text-[10px] font-bold text-white">15/15</span>}
                      </span>
                    ))}
                  </div>

                  {!acao ? (
                    <div className="animate-in fade-in-0 zoom-in-95 mt-4 duration-200 ease-out">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        O que deseja fazer?
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Button
                          variant="outline"
                          className="h-auto flex-col items-start gap-1 bg-white p-4 text-left"
                          onClick={() => setAcao('sair_fixo')}
                        >
                          <LogOut className="size-4 text-amber-600" />
                          <span className="font-medium">Sair do fixo</span>
                          <span className="text-[11px] font-normal text-muted-foreground">
                            Aviso prévio de 15 dias
                          </span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-auto flex-col items-start gap-1 bg-white p-4 text-left"
                          onClick={() => setAcao('passar_plantao')}
                        >
                          <RefreshCcw className="size-4 text-sky-600" />
                          <span className="font-medium">Passar plantão</span>
                          <span className="text-[11px] font-normal text-muted-foreground">
                            Transferir para outro plantonista
                          </span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-auto flex-col items-start gap-1 bg-white p-4 text-left"
                          onClick={() => setAcao('justificar_falta')}
                        >
                          <FileText className="size-4 text-indigo-600" />
                          <span className="font-medium">Justificar falta</span>
                          <span className="text-[11px] font-normal text-muted-foreground">
                            Atestado ou licença
                          </span>
                        </Button>
                      </div>
                    </div>
                  ) : acao === 'sair_fixo' ? (
                    <div className="animate-in fade-in-0 zoom-in-95 mt-4 duration-200 ease-out">
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        <strong>Aviso prévio:</strong> a saída do plantão fixo deve ser comunicada com{' '}
                        <strong>pelo menos 15 dias de antecedência</strong>. Faltam{' '}
                        <strong>{Math.max(0, diasPara(diaSelecionado))} dia(s)</strong> para este plantão.
                      </div>
                      <div className="mt-3 flex flex-col gap-1.5">
                        <Label htmlFor="sair-just">Justificativa (opcional)</Label>
                        <Textarea
                          id="sair-just"
                          value={justificativa}
                          onChange={(e) => setJustificativa(e.target.value)}
                          placeholder="Motivo da saída do plantão fixo…"
                        />
                      </div>
                      {erroAcao && <p className="mt-2 text-sm text-destructive">{erroAcao}</p>}
                      {mensagem && <p className="mt-2 text-sm text-emerald-700">{mensagem}</p>}
                      <div className="mt-3 flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setAcao(null)}>
                          Voltar
                        </Button>
                        <Button onClick={enviarSairFixo}>
                          <LogOut /> Solicitar saída do fixo
                        </Button>
                      </div>
                    </div>
                  ) : acao === 'passar_plantao' ? (
                    <div className="animate-in fade-in-0 zoom-in-95 mt-4 duration-200 ease-out">
                      <div className="flex flex-col gap-1.5">
                        <Label>Passar para</Label>
                        <Select value={destinoId || null} onValueChange={(v) => setDestinoId(v ?? '')}>
                          <SelectTrigger className="w-full bg-white">
                            <SelectValue placeholder="Selecione o plantonista" />
                          </SelectTrigger>
                          <SelectContent>
                            {(plantonistas ?? [])
                              .filter((p) => p.perfil_id !== perfil?.id)
                              .map((p) => (
                                <SelectItem key={p.perfil_id} value={p.perfil_id}>
                                  {p.nome_completo}
                                  {p.crm ? ` · CRM ${p.crm}` : ''}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {carregandoPlant && <Spinner />}
                      </div>
                      <div className="mt-3 flex flex-col gap-1.5">
                        <Label htmlFor="passar-just">Justificativa (opcional)</Label>
                        <Textarea
                          id="passar-just"
                          value={justificativa}
                          onChange={(e) => setJustificativa(e.target.value)}
                          placeholder="Motivo da passagem…"
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        A passagem pode ser aplicada na hora ou depender de aprovação do gestor (conforme
                        configuração da unidade). A pessoa que recebe o plantão será notificada.
                      </p>
                      {erroAcao && <p className="mt-2 text-sm text-destructive">{erroAcao}</p>}
                      {mensagem && <p className="mt-2 text-sm text-emerald-700">{mensagem}</p>}
                      <div className="mt-3 flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setAcao(null)}>
                          Voltar
                        </Button>
                        <Button onClick={enviarPassarPlantao} disabled={!destinoId}>
                          <UserCheck /> Passar plantão
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="animate-in fade-in-0 zoom-in-95 mt-4 duration-200 ease-out">
                      <div className="flex flex-col gap-1.5">
                        <Label>Tipo de justificativa</Label>
                        <Select
                          value={tipoFalta}
                          onValueChange={(v) =>
                            setTipoFalta((v as 'atestado_medico' | 'licenca_maternidade') ?? 'atestado_medico')
                          }
                        >
                          <SelectTrigger className="w-full bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="atestado_medico">Atestado médico</SelectItem>
                            <SelectItem value="licenca_maternidade">Licença-maternidade</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="mt-3 flex flex-col gap-1.5">
                        <Label htmlFor="falta-anexo">Anexar documento (PDF ou imagem)</Label>
                        <Input
                          id="falta-anexo"
                          type="file"
                          accept=".pdf,image/png,image/jpeg,image/jpg"
                          onChange={(e) => setAnexo(e.target.files?.[0] ?? null)}
                        />
                        {anexo && <span className="text-xs text-muted-foreground">{anexo.name}</span>}
                      </div>
                      <div className="mt-3 flex flex-col gap-1.5">
                        <Label htmlFor="falta-just">Justificativa</Label>
                        <Textarea
                          id="falta-just"
                          value={justificativa}
                          onChange={(e) => setJustificativa(e.target.value)}
                          placeholder="Descreva o motivo da falta…"
                        />
                      </div>
                      {erroAcao && <p className="mt-2 text-sm text-destructive">{erroAcao}</p>}
                      {mensagem && <p className="mt-2 text-sm text-emerald-700">{mensagem}</p>}
                      <div className="mt-3 flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setAcao(null)}>
                          Voltar
                        </Button>
                        <Button onClick={enviarJustificarFalta} disabled={anexando}>
                          {anexando ? <Spinner /> : <Check />} Enviar justificativa
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1 text-center">
                  {DIAS_SEMANA.map((d) => (
                    <div key={d} className="py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {d}
                    </div>
                  ))}
                  {diasDoMes.map((c, i) => {
                    if (c.fora) return <div key={`v-${i}`} />
                    const plantoes = plantoesDoDia(c.iso)
                    const turnos = [...new Set(plantoes.map((p) => p.turno))]
                    const eHoje = ehHoje(c.iso)
                    const selecionado = diaSelecionado === c.iso
                    return (
                      <button
                        key={c.iso}
                        type="button"
                        onClick={() => (plantoes.length ? abrirDia(c.iso) : undefined)}
                        className={`flex min-h-[76px] flex-col gap-1 rounded-lg border p-1.5 text-left transition-all duration-200 ${
                          plantoes.length
                            ? 'border-emerald-600 bg-emerald-500 text-white shadow-md hover:bg-emerald-600 hover:shadow-lg'
                            : 'border-transparent hover:bg-muted/60'
                        } ${selecionado ? 'ring-2 ring-primary ring-offset-2' : ''} ${eHoje ? 'ring-2 ring-primary/50' : ''}`}
                      >
                        <span className={`text-xs font-bold ${plantoes.length ? 'text-white' : eHoje ? 'text-primary' : ''}`}>
                          {c.dia}
                        </span>
                        {turnos.map((t) => (
                          <span
                            key={t}
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                              plantoes.length ? 'bg-white/25 text-white' : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {TURNO_LABEL[t]}
                          </span>
                        ))}
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* CONTADOR MENSAL */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="size-4 text-muted-foreground" />
                Meus plantões no mês
              </CardTitle>
              <CardDescription>
                {perfil?.nome_completo ?? 'Você'} · {fmtMesBR(mesInicio)}
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

        </>
      ) : (
        <>
          {/* Turnos (gestor/admin) */}
          <div className="flex flex-wrap gap-2">
            {TURNOS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTurno(t.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  turno === t.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted'
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
                <CardDescription>Clique em uma célula para adicionar ou remover plantonistas.</CardDescription>
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
                            {DIAS_SEMANA_SEG[i]}
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
                            return (
                              <td key={d} className="border-b border-r p-1 align-top">
                                <button
                                  type="button"
                                  onClick={() => abrirCelula(s.id, d)}
                                  className="flex min-h-[52px] w-full flex-col gap-1 rounded-md p-1 text-left transition-colors hover:bg-primary/5"
                                >
                                  {plantoes.length === 0 && (
                                    <span className="text-[10px] text-muted-foreground/50">+ adicionar</span>
                                  )}
                                  {plantoes.map((p) => (
                                    <span key={p.id} className="block">
                                      <span className="block rounded bg-muted px-1.5 py-0.5 text-[11px] leading-tight">
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
                  (escala ?? []).filter(
                    (e) => e.setor_id === celula.setor_id && e.data === celula.data && e.turno === turno
                  ).length === 0 && <p className="text-sm text-muted-foreground">Nenhum plantonista neste plantão.</p>}
              </CardContent>
            </Card>
          )}

          {/* Gestor: solicitações de escala */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-muted-foreground" />
                Solicitações da escala
              </CardTitle>
              <CardDescription>Pedidos de saída do fixo, passagem de plantão e justificativa de falta.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {carregandoSolic ? (
                <div className="flex h-24 items-center justify-center">
                  <Spinner />
                </div>
              ) : (solicitacoes ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma solicitação no momento.</p>
              ) : (
                (solicitacoes ?? []).map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{s.solicitante?.nome_completo ?? 'Plantonista'}</span>
                        <Badge variant="outline">{TIPO_SOLICITACAO_LABEL[s.tipo]}</Badge>
                        <Badge
                          variant={
                            s.status === 'aprovado' ? 'success' : s.status === 'recusado' ? 'destructive' : 'warning'
                          }
                        >
                          {s.status === 'aprovado' ? 'Aprovado' : s.status === 'recusado' ? 'Recusado' : 'Pendente'}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {s.escala_plantao ? `${fmtDiaBR(s.escala_plantao.data)} · ${TURNO_LABEL[s.escala_plantao.turno]}` : 'Plantão removido'}
                        {s.tipo === 'passar_plantao' && s.destino && ` → ${s.destino.nome_completo}`}
                        {s.tipo === 'justificar_falta' && s.tipo_falta && ` · ${TIPO_FALTA_LABEL[s.tipo_falta]}`}
                        {s.anexo_url && (
                          <a
                            href={s.anexo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 font-medium text-primary hover:underline"
                          >
                            ver anexo
                          </a>
                        )}
                      </div>
                      {s.justificativa && <div className="mt-1 text-xs">{s.justificativa}</div>}
                    </div>
                    {s.status === 'pendente' && (
                      <div className="flex gap-2">
                        <Button size="xs" onClick={() => decidir.mutate({ id: s.id, status: 'aprovado' })}>
                          <Check /> Aprovar
                        </Button>
                        <Button size="xs" variant="outline" onClick={() => decidir.mutate({ id: s.id, status: 'recusado' })}>
                          <X /> Recusar
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Dialog: adicionar plantonista (gestor) */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar plantonista</DialogTitle>
            <DialogDescription>
              {setores?.find((s) => s.id === celula?.setor_id)?.nome} · {celula ? fmtDiaBR(celula.data) : ''} ·{' '}
              {TURNO_LABEL[turno]}
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
