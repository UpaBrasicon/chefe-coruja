import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Abas, Chip, TituloPagina } from '@/components/monitor/Pagina'
import { BUCKET_JUSTIFICATIVA, caminhoDoAnexo, caminhoNovoAnexo } from '@/lib/anexoJustificativa'
import { dataHora, hora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import type { EscalaFixa, EscalaPlantao, Papel, PlantonistaDaUnidade, ResumoCargaPlantonista } from '@/types/database'
import { PAPEL_LABEL } from '@/lib/constants'
import { Estado } from '@/components/porta/Estado'
import { contarPedidos, useCandidaturasEscala, useSolicitacoesEscala, useTrocasEscala, type SolicitacaoComExtra } from '@/hooks/usePedidosEscala'

const TURNOS = [
  { id: 'manha', label: 'Manhã', horario: '07h–13h' },
  { id: 'tarde', label: 'Tarde', horario: '13h–19h' },
  { id: 'noite', label: 'Noite', horario: '19h–07h' },
] as const

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
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

const contagem = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

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

// A escala é lida pela RPC: a RLS da tabela só devolve ao plantonista os próprios
// plantões, e os dos colegas apareciam como "livre" (aba Escala, entrega E0).
async function lerEscalaDaUnidade(unidadeId: string, de: string, ate: string): Promise<PlantaoComPerfil[]> {
  const { data, error } = await supabase.rpc('escala_da_unidade', { p_unidade: unidadeId, p_de: de, p_ate: ate })
  if (error) throw error
  return (data ?? []).map(({ nome_completo, crm, ...p }) => ({
    ...p,
    perfis: nome_completo == null ? null : { id: p.perfil_id, nome_completo, crm },
  })) as unknown as PlantaoComPerfil[]
}

type EscalaFixaComPerfil = EscalaFixa & {
  setores: { nome: string } | null
  perfis: { id: string; nome_completo: string; crm: string | null } | null
}

type VagaGeracao = { data: string; turno: string; setor: string | null; profissional: string | null; conflito: string }

export default function Escala({
  embutido = false,
  aba,
  abaGestorFixa,
}: {
  /** Dentro de um agrupador de abas: esconde breadcrumb, título e barra de abas própria. */
  embutido?: boolean
  /** Aba do plantonista controlada por fora (`minha` | `geral`). */
  aba?: 'minha' | 'geral'
  /** Aba do gestor controlada por fora (`fixa` | `mensal` | `pedidos` | `carga`). */
  abaGestorFixa?: 'fixa' | 'mensal' | 'pedidos' | 'carga'
} = {}) {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id
  const queryClient = useQueryClient()

  const [turno, setTurno] = React.useState<'manha' | 'tarde' | 'noite'>('manha')
  const [mes, setMes] = React.useState(() => hojeISO().slice(0, 7))
  const [semana, setSemana] = React.useState(() => hojeISO())
  const [abaGestorLocal, setAbaGestor] = React.useState<'fixa' | 'mensal' | 'pedidos' | 'carga'>('mensal')
  const [abaPlantonistaLocal, setAbaPlantonista] = React.useState<'minha' | 'geral'>('minha')
  const abaGestor = abaGestorFixa ?? abaGestorLocal
  const abaPlantonista = aba ?? abaPlantonistaLocal
  const [diaGeral, setDiaGeral] = React.useState<string | null>(null)
  const [fechandoGeral, setFechandoGeral] = React.useState(false)
  const [celula, setCelula] = React.useState<{ setor_id: string; data: string } | null>(null)
  const [celulaFixa, setCelulaFixa] = React.useState<{ setor_id: string; dia_semana: number } | null>(null)
  const [plantonistaId, setPlantonistaId] = React.useState('')
  // E2 da aba Escala: o gestor escolhe pessoa e categoria juntas (quem tem dois papéis aparece duas vezes)
  const [papelEscolhido, setPapelEscolhido] = React.useState<Papel | null>(null)
  const [rotulo, setRotulo] = React.useState('')
  const [quinzenal, setQuinzenal] = React.useState(false)

  // Ações do plantonista no dia
  const [diaSelecionado, setDiaSelecionado] = React.useState<string | null>(null)
  const [fechando, setFechando] = React.useState(false)
  const [acao, setAcao] = React.useState<'sair_fixo' | 'passar_plantao' | 'justificar_falta' | 'trocar_plantao' | 'fracionar' | null>(null)
  const [justificativa, setJustificativa] = React.useState('')
  const [destinoId, setDestinoId] = React.useState('')
  const [tipoFalta, setTipoFalta] = React.useState<'atestado_medico' | 'licenca_maternidade'>('atestado_medico')
  const [anexo, setAnexo] = React.useState<File | null>(null)
  const [anexando, setAnexando] = React.useState(false)
  const [mensagem, setMensagem] = React.useState<string | null>(null)
  const [erroAcao, setErroAcao] = React.useState<string | null>(null)
  const [mensagemGeracao, setMensagemGeracao] = React.useState<string | null>(null)
  // Portão 2, tarefa 4: plantões da fixa que bateram com outro plantão da pessoa viram vaga aberta
  const [vagasGeracao, setVagasGeracao] = React.useState<VagaGeracao[]>([])

  // Troca bilateral
  const [meuPlantaoTroca, setMeuPlantaoTroca] = React.useState<string>('')
  const [outroPlantaoTroca, setOutroPlantaoTroca] = React.useState<string>('')
  const [fracionarPartes, setFracionarPartes] = React.useState('2')
  const [turnoEscolhido, setTurnoEscolhido] = React.useState<{ dia: string; id: string } | null>(null)

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
    queryFn: () => lerEscalaDaUnidade(unidadeId!, dataInicio, dataFim),
  })

  // Escala do mês inteiro (contador + calendário do plantonista)
  const { data: escalaMes, isLoading: carregandoMes } = useQuery({
    queryKey: ['escala-plantao-mes', unidadeId, mesInicio, mesFim],
    enabled: !!unidadeId,
    queryFn: () => lerEscalaDaUnidade(unidadeId!, mesInicio, mesFim),
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

  const { data: profissionais, isLoading: carregandoProf } = useQuery({
    queryKey: ['escala-profissionais', unidadeId],
    enabled: !!unidadeId && ehGestor,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('profissionais_da_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as { perfil_id: string; nome_completo: string; crm: string | null; papel: Papel }[]
    },
  })

  // Plantões de outros plantonistas (para troca bilateral)
  const { data: plantoesDeOutros, isLoading: carregandoOutros } = useQuery({
    queryKey: ['escala-plantao-outros', unidadeId, mesInicio, mesFim],
    enabled: !!unidadeId && !!diaSelecionado,
    queryFn: async () =>
      (await lerEscalaDaUnidade(unidadeId!, mesInicio, mesFim)).filter((p) => p.perfil_id !== perfil?.id),
  })

  // Minhas solicitações de troca (status)
  const { data: minhasTrocas, refetch: refetchTrocas } = useQuery({
    queryKey: ['minhas-trocas', unidadeId, perfil?.id],
    enabled: !!unidadeId && !!perfil,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trocas_plantao')
        .select('id, status, mensagem, erro, created_at, plantao_a_id, plantao_b_id, perfil_b_id')
        .or(`perfil_a_id.eq.${perfil!.id},perfil_b_id.eq.${perfil!.id}`)
        .eq('unidade_id', unidadeId!)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return (data ?? []) as { id: string; status: string; mensagem: string | null; erro: string | null; created_at: string; plantao_a_id: string; plantao_b_id: string; perfil_b_id: string }[]
    },
  })

  // Pedidos da escala: mesma chave e mesmo select da aba Pedidos e do calendário do mês
  const { data: solicitacoes, isLoading: carregandoSolic } = useSolicitacoesEscala(unidadeId, ehGestor || ehAdmin)
  // Candidaturas a plantões livres (plantonista) — visível também ao gestor
  const { data: candidaturas, isLoading: carregandoCand } = useCandidaturasEscala(unidadeId, ehGestor || ehAdmin || ehPlantonista)
  // Trocas para o gestor decidir (A2)
  const { data: trocas } = useTrocasEscala(unidadeId, ehGestor || ehAdmin)

  // Partes de plantão fracionado (vagas com janela, migration 20261012000001):
  // a candidatura aponta a vaga; aqui mostramos a parte e o horário dela.
  const { data: vagasAbertas } = useQuery({
    queryKey: ['vagas'],
    enabled: !!unidadeId && (candidaturas ?? []).some((c) => c.vaga_id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('vagas_abertas')
      if (error) throw error
      return data ?? []
    },
  })
  const janelaDaVaga = (vagaId: string | null) => {
    const v = vagaId ? (vagasAbertas ?? []).find((x) => x.id === vagaId) : undefined
    if (!v?.parte) return ''
    return ` · parte ${v.parte} de ${v.partes}, ${hora(v.inicio)}–${hora(v.fim)}`
  }

  const candidatar = useMutation({
    mutationFn: async (cel: { setor_id: string; data: string; turno: string }) => {
      if (!unidadeId || !perfil) return
      const { error } = await supabase.from('candidaturas_escala').insert({
        unidade_id: unidadeId,
        setor_id: cel.setor_id,
        data: cel.data,
        turno: cel.turno,
        perfil_id: perfil.id,
        criado_por: perfil.id,
      })
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['candidaturas-escala'] }),
  })

  const aprovarCandidatura = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('aprovar_candidatura', { p_candidatura: id })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidar()
      void queryClient.invalidateQueries({ queryKey: ['candidaturas-escala'] })
      void queryClient.invalidateQueries({ queryKey: ['vagas'] })
    },
  })

  const recusarCandidatura = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('candidaturas_escala')
        .update({ status: 'recusado', decidido_por: perfil!.id })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['candidaturas-escala'] }),
  })

  // Escala FIXA (template) — gestor mantém; a mensal é gerada a partir dela
  const { data: escalaFixa, isLoading: carregandoFixa } = useQuery({
    queryKey: ['escala-fixa', unidadeId],
    enabled: !!unidadeId && (ehGestor || ehAdmin),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('escala_fixa')
        .select('id, setor_id, perfil_id, dia_semana, turno, quinzenal, setores(nome), perfis!escala_fixa_perfil_id_fkey(id, nome_completo, crm)')
        .eq('unidade_id', unidadeId!)
        .eq('ativo', true)
        .order('dia_semana', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as EscalaFixaComPerfil[]
    },
  })

  // E1: resumo de carga horária dos plantonistas (gestor/admin)
  const { data: resumoCarga, isLoading: carregandoCarga } = useQuery({
    queryKey: ['resumo-carga', unidadeId, mesInicio, mesFim],
    enabled: !!unidadeId && (ehGestor || ehAdmin),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('resumo_carga_plantonistas', {
        p_unidade: unidadeId!,
        p_inicio: mesInicio,
        p_fim: mesFim,
      })
      if (error) throw error
      return (data ?? []) as ResumoCargaPlantonista[]
    },
  })

  function exportarEscalaCSV() {
    if (!setores || !escalaMes) return
    const linhas = ['Setor;Data;Turno;Plantonista;Quinzenal']
    for (const s of setores) {
      const plantoes = (escalaMes ?? []).filter((e) => e.setor_id === s.id)
      for (const e of plantoes) {
        linhas.push(
          `${s.nome};${e.data};${TURNO_LABEL[e.turno]};${e.perfis?.nome_completo ?? ''};${e.quinzenal ? 'sim' : 'nao'}`
        )
      }
    }
    const blob = new Blob(['\uFEFF' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `escala_${fmtMesBR(mesInicio).replace('/', '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const adicionarFixa = useMutation({
    mutationFn: async () => {
      if (!unidadeId || !celulaFixa || !plantonistaId) return
      const { error } = await supabase.from('escala_fixa').insert({
        unidade_id: unidadeId,
        setor_id: celulaFixa.setor_id,
        perfil_id: plantonistaId,
        dia_semana: celulaFixa.dia_semana,
        turno,
        quinzenal,
        papel: papelEscolhido,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['escala-fixa'] })
      setDialogAberto(false)
      setPlantonistaId('')
      setPapelEscolhido(null)
      setQuinzenal(false)
    },
  })

  const removerFixa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('escala_fixa').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['escala-fixa'] }),
  })

  const gerarMes = useMutation({
    mutationFn: async () => {
      if (!unidadeId) return
      const [ano, mesNum] = mes.split('-').map(Number)
      const { data, error } = await supabase.rpc('gerar_escala_mensal_detalhada', {
        p_unidade: unidadeId,
        p_ano: ano,
        p_mes: mesNum,
      })
      if (error) throw error
      return data
    },
    onSuccess: (r) => {
      invalidar()
      const g = r as unknown as { dias: number; gerados: number; vagas: VagaGeracao[] } | undefined
      setVagasGeracao(g?.vagas ?? [])
      setMensagemGeracao(g ? `Mês gerado: ${g.dias} dias processados, ${g.gerados} plantões gravados.` : 'Mês gerado a partir da escala fixa.')
    },
  })

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ['escala-plantao'] })
    void queryClient.invalidateQueries({ queryKey: ['escala-plantao-mes'] })
    void queryClient.invalidateQueries({ queryKey: ['solicitacoes-escala'] })
    void queryClient.invalidateQueries({ queryKey: ['escala-fixa'] })
    void queryClient.invalidateQueries({ queryKey: ['candidaturas-escala'] })
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
      const { error } = await supabase.rpc('adicionar_plantao_escala', {
        p_unidade: unidadeId,
        p_setor: celula.setor_id,
        p_perfil: plantonistaId,
        p_data: celula.data,
        p_turno: turno,
        p_rotulo: rotulo || undefined,
        p_quinzenal: quinzenal,
        p_papel: papelEscolhido ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalidar()
      setDialogAberto(false)
      setPlantonistaId('')
      setPapelEscolhido(null)
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

  // A2: o gestor aprova (aplica na escala) ou recusa a troca
  const decidirTroca = useMutation({
    mutationFn: async ({ id, aprovar }: { id: string; aprovar: boolean }) => {
      const { error } = aprovar
        ? await supabase.rpc('aprovar_troca', { p_troca: id })
        : await supabase.rpc('recusar_troca', { p_troca: id })
      if (error) throw error
    },
    onSettled: () => {
      invalidar()
      void queryClient.invalidateQueries({ queryKey: ['trocas-escala'] })
      void refetchTrocas()
    },
  })

  // atestado da justificativa: bucket privado, abre com URL assinada (A5)
  const [erroAnexo, setErroAnexo] = React.useState<string | null>(null)
  async function abrirAnexo(anexo: string) {
    setErroAnexo(null)
    const caminho = caminhoDoAnexo(anexo)
    if (!caminho) return setErroAnexo('Não foi possível achar o arquivo do anexo.')
    const { data, error } = await supabase.storage.from(BUCKET_JUSTIFICATIVA).createSignedUrl(caminho, 120)
    if (error) return setErroAnexo('Não foi possível abrir o anexo: ' + error.message)
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  const [dialogAberto, setDialogAberto] = React.useState(false)

  function abrirCelula(setor_id: string, data: string) {
    setCelula({ setor_id, data })
    setPlantonistaId('')
    setPapelEscolhido(null)
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
  // Dia com mais de um turno: as ações (sair do fixo, passar, fracionar,
  // justificar falta) valem para o turno escolhido nos chips, nunca para o
  // primeiro da lista por acaso.
  const plantaoDaAcao = (diaISO: string) => {
    const doDia = plantoesDoDia(diaISO)
    if (doDia.length === 1) return doDia[0]
    return turnoEscolhido?.dia === diaISO ? doDia.find((p) => p.id === turnoEscolhido.id) : undefined
  }
  const escalaDaAcao = (diaISO: string) => {
    const id = plantaoDaAcao(diaISO)?.id
    if (!id) setErroAcao('Este dia tem mais de um turno: toque no turno antes de seguir.')
    return id
  }

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
    }, 300)
  }

  function fecharDiaGeral() {
    if (fechandoGeral) return
    setFechandoGeral(true)
    setTimeout(() => {
      setDiaGeral(null)
      setFechandoGeral(false)
    }, 300)
  }

  function abrirCelulaFixa(setor_id: string, dia_semana: number) {
    setCelulaFixa({ setor_id, dia_semana })
    setPlantonistaId('')
    setPapelEscolhido(null)
    setQuinzenal(false)
    setDialogAberto(true)
  }

  const fixasDoCelula = (setorId: string, diaSemana: number) =>
    (escalaFixa ?? []).filter((f) => f.setor_id === setorId && f.dia_semana === diaSemana && f.turno === turno)

  const pedidos = contarPedidos(solicitacoes, candidaturas, trocas)
  const alertas = React.useMemo(() => {
    if (!solicitacoes) return { pendentes: 0, sairam: 0, atestados: 0, faltas: 0, interesses: 0, lista: [] as SolicitacaoComExtra[] }
    const pendentes = solicitacoes.filter((s) => s.status === 'pendente')
    const sairam = solicitacoes.filter((s) => s.tipo === 'passar_plantao')
    const atestados = solicitacoes.filter((s) => s.tipo === 'justificar_falta' && s.tipo_falta === 'atestado_medico')
    // B8: "faltas" são as justificativas que não são atestado (o tipo 'falta' não é criado por nenhuma tela)
    const faltas = solicitacoes.filter((s) => s.tipo === 'justificar_falta' && s.tipo_falta !== 'atestado_medico')
    const interesses = solicitacoes.filter((s) => s.tipo === 'sair_fixo')
    return {
      pendentes: pendentes.length,
      sairam: sairam.length,
      atestados: atestados.length,
      faltas: faltas.length,
      interesses: interesses.length,
      lista: solicitacoes.filter((s) => s.status === 'pendente').slice(0, 20),
    }
  }, [solicitacoes])

  async function enviarSairFixo() {
    if (!diaSelecionado || !unidadeId || !perfil) return
    setErroAcao(null)
    const escalaId = escalaDaAcao(diaSelecionado)
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
    const escalaId = escalaDaAcao(diaSelecionado)
    if (!escalaId) return

    // o bucket é privado: grava o caminho; o gestor abre com URL assinada (A5)
    let anexoUrl: string | null = null
    if (anexo) {
      setAnexando(true)
      const caminho = caminhoNovoAnexo(unidadeId, anexo.name, crypto.randomUUID())
      const { error: upErr } = await supabase.storage.from(BUCKET_JUSTIFICATIVA).upload(caminho, anexo, {
        cacheControl: '3600',
        upsert: false,
      })
      setAnexando(false)
      if (upErr) {
        setErroAcao('Falha ao enviar o anexo: ' + upErr.message)
        return
      }
      anexoUrl = caminho
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
    const escalaId = escalaDaAcao(diaSelecionado)
    if (!escalaId) return
    try {
      const { data, error } = await supabase.rpc('passar_plantao', {
        p_escala: escalaId,
        p_destino: destinoId,
        p_justificativa: justificativa || undefined,
      })
      if (error) throw error
      invalidar()
      // passar_plantao devolve o id do plantão quando passa na hora e o do pedido quando espera o gestor
      setMensagem(data === escalaId ? 'Plantão passado com sucesso.' : 'Passagem pedida. O plantão continua com você até o gestor aprovar.')
      setJustificativa('')
      setDestinoId('')
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Erro ao passar o plantão.')
    }
  }

  async function enviarTrocaPlantao() {
    if (!meuPlantaoTroca || !outroPlantaoTroca) return
    setErroAcao(null)
    setMensagem(null)
    try {
      const { error } = await supabase.rpc('solicitar_troca', {
        p_plantao_a: meuPlantaoTroca,
        p_plantao_b: outroPlantaoTroca,
        p_mensagem: justificativa || undefined,
      })
      if (error) throw error
      invalidar()
      void refetchTrocas()
      setMensagem('Troca solicitada. Se a aprovação automática estiver habilitada, foi aplicada na hora.')
      setMeuPlantaoTroca('')
      setOutroPlantaoTroca('')
      setJustificativa('')
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Erro ao solicitar a troca.')
    }
  }

  async function enviarFracionar() {
    if (!diaSelecionado) return
    setErroAcao(null)
    setMensagem(null)
    const escalaId = escalaDaAcao(diaSelecionado)
    if (!escalaId) return
    try {
      const { data, error } = await supabase.rpc('fracionar_plantao', {
        p_plantao: escalaId,
        p_partes: Number(fracionarPartes || 2),
      })
      if (error) throw error
      invalidar()
      setMensagem(data ? `Plantão fracionado em ${data} partes. A 1ª continua com você; as outras viraram vagas em Vagas.` : 'Plantão fracionado.')
      void queryClient.invalidateQueries({ queryKey: ['vagas'] })
      setAcao(null)
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Erro ao fracionar o plantão.')
    }
  }

  const diasDoMes = React.useMemo(() => gerarDiasDoMes(mes), [mes])

  return (
    <div className={embutido ? 'flex w-full flex-col gap-6' : 'mx-auto flex w-full max-w-6xl flex-col gap-6'}>
      {(!embutido || ehPlantonista || abaGestor === 'mensal') && <div className="flex flex-col gap-1">
        {!embutido && (
          <div className="flex items-center gap-1 text-apoio text-tinta-sussurro">
            <Link to="/" className="transition-colors hover:text-tinta">
              Início
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="font-medium text-tinta">Escala</span>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {embutido ? <div /> : <TituloPagina icone={CalendarClock} titulo="Escala" className="mb-0" />}
          {abaGestor !== 'mensal' && !ehPlantonista ? null : ehPlantonista ? (
            <div className="flex items-center gap-2 text-apoio text-tinta-sussurro">
              <Button size="xs" variant="outline" onClick={() => mudarMes(-1)}>
                <ChevronLeft /> Mês
              </Button>
              <span className="font-medium text-tinta">{fmtMesBR(mesInicio)}</span>
              <Button size="xs" variant="outline" onClick={() => mudarMes(1)}>
                Mês <ChevronRight />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-apoio text-tinta-sussurro">
              <Button size="xs" variant="outline" onClick={() => mudarSemana(-1)}>
                <ChevronLeft /> Semana
              </Button>
              <span className="font-medium text-tinta">
                {fmtDiaBR(dataInicio)} – {fmtDiaBR(dataFim)}
              </span>
              <Button size="xs" variant="outline" onClick={() => mudarSemana(1)}>
                Semana <ChevronRight />
              </Button>
            </div>
          )}
        </div>
        {!embutido && (
          <p className="text-apoio text-tinta-sussurro">
            {unidadeAtiva?.unidade.nome ?? 'Unidade'} ·{' '}
            {ehGestor ? 'Gestor — monte a escala' : ehAdmin ? 'Admin — todas as unidades' : 'Sua escala'}
          </p>
        )}
      </div>}

      {/* Abas do plantonista: Minha Escala / Escala Geral */}
      {ehPlantonista && !aba && (
        <Abas
          abas={[['minha', 'Minha escala'], ['geral', 'Escala geral']]}
          valor={abaPlantonista}
          onChange={setAbaPlantonista}
          rotulo="Visão da escala"
          className="mb-0 gap-2"
        />
      )}

      {ehPlantonista ? (
        abaPlantonista === 'minha' ? (
        <>
          {/* CALENDÁRIO MENSAL — contexto geral do mês */}
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-corpo">
                  <CalendarClock className="size-4 text-tinta-sussurro" />
                  {diaSelecionado ? `Plantão de ${fmtDiaBR(diaSelecionado)}` : `Visão geral de ${fmtMesBR(mesInicio)}`}
                </CardTitle>
                <CardDescription>
                  {diaSelecionado
                    ? 'Período(s) em que você está de plantão:'
                    : 'Clique em um dia com plantão para sair do fixo, passar o plantão ou justificar falta.'}
                </CardDescription>
              </div>
              {diaSelecionado && (
                <Button
                  variant="ghost"
                  onClick={fecharDia}
                  className="group relative h-14 w-48 rounded-cartao bg-superficie p-0 text-dialogo font-semibold text-tinta transition-shadow hover:text-tinta hover:shadow-md"
                >
                  <div className="absolute top-[4px] left-1 z-10 flex h-12 w-1/4 items-center justify-center rounded-container bg-leitos duration-500 group-hover:w-[184px]">
                    <ChevronLeft className="size-6 text-tinta" />
                  </div>
                  <p className="translate-x-2">Voltar</p>
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
                  className={`origin-center ${
                    fechando
                      ? 'animate-in fade-in-0 zoom-in-95 duration-300 ease-out animate-out fade-out-0 zoom-out-95'
                      : 'animate-in fade-in-0 zoom-in-95 duration-300 ease-out'
                  }`}
                >
                  <div className="flex flex-wrap gap-2">
                    {plantoesDoDia(diaSelecionado).map((p, _i, doDia) => {
                      const varios = doDia.length > 1
                      const escolhido = varios && plantaoDaAcao(diaSelecionado)?.id === p.id
                      return (
                      <Button
                        key={p.id}
                        disabled={!varios}
                        aria-pressed={varios ? escolhido : undefined}
                        onClick={() => { setTurnoEscolhido({ dia: diaSelecionado, id: p.id }); setErroAcao(null) }}
                        className={cn(
                          'h-auto gap-1.5 rounded-container border px-3 py-2 font-semibold text-sobre-acao shadow-sm disabled:cursor-default disabled:opacity-100',
                          escolhido
                            ? 'border-tinta bg-leitos ring-2 ring-tinta/40 hover:bg-leitos'
                            : varios
                              ? 'border-conforme/30 bg-leitos/60 hover:bg-leitos/60'
                              : 'border-conforme/30 bg-leitos hover:bg-leitos',
                        )}
                      >
                        {TURNO_LABEL[p.turno]}
                        <span className="font-normal text-sobre-acao">
                          {TURNOS.find((t) => t.id === p.turno)?.horario}
                        </span>
                        {p.quinzenal && <span className="text-rotulo font-semibold text-sobre-acao">15/15</span>}
                      </Button>
                      )
                    })}
                  </div>
                  {plantoesDoDia(diaSelecionado).length > 1 && !plantaoDaAcao(diaSelecionado) && (
                    <p className="mt-2 text-rotulo text-tinta-sussurro">Este dia tem mais de um turno. Toque no turno para escolher a qual a ação se aplica.</p>
                  )}

                  {!acao ? (
                    <div className="animate-in fade-in-0 zoom-in-95 mt-4 duration-300 ease-out origin-center">
                      <div className="mb-2 text-rotulo font-semibold uppercase tracking-wide text-tinta-sussurro">
                        O que deseja fazer?
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Button
                          variant="outline"
                          className="h-auto flex-col items-start gap-1 bg-superficie p-4 text-left"
                          onClick={() => setAcao('sair_fixo')}
                        >
                          <LogOut className="size-4 text-atencao" />
                          <span className="font-medium">Sair do fixo</span>
                          <span className="text-rotulo font-normal text-tinta-sussurro">
                            Aviso prévio de 15 dias
                          </span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-auto flex-col items-start gap-1 bg-superficie p-4 text-left"
                          onClick={() => setAcao('passar_plantao')}
                        >
                          <RefreshCcw className="size-4 text-suprimento" />
                          <span className="font-medium">Passar plantão</span>
                          <span className="text-rotulo font-normal text-tinta-sussurro">
                            Transferir para outro plantonista
                          </span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-auto flex-col items-start gap-1 bg-superficie p-4 text-left"
                          onClick={() => setAcao('trocar_plantao')}
                        >
                          <RefreshCcw className="size-4 text-pediatria" />
                          <span className="font-medium">Trocar plantão</span>
                          <span className="text-rotulo font-normal text-tinta-sussurro">
                            Troca bilateral com outro plantonista
                          </span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-auto flex-col items-start gap-1 bg-superficie p-4 text-left"
                          onClick={() => setAcao('fracionar')}
                        >
                          <FileText className="size-4 text-critico" />
                          <span className="font-medium">Fracionar plantão</span>
                          <span className="text-rotulo font-normal text-tinta-sussurro">
                            Dividir em partes para negociação
                          </span>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-auto flex-col items-start gap-1 bg-superficie p-4 text-left"
                          onClick={() => setAcao('justificar_falta')}
                        >
                          <FileText className="size-4 text-suprimento" />
                          <span className="font-medium">Justificar falta</span>
                          <span className="text-rotulo font-normal text-tinta-sussurro">
                            Atestado ou licença
                          </span>
                        </Button>
                      </div>
                    </div>
                  ) : acao === 'sair_fixo' ? (
                    <div className="animate-in fade-in-0 zoom-in-95 mt-4 duration-300 ease-out origin-center">
                      <div className="rounded-controle border border-atencao/30 bg-alerta-atencao p-3 text-apoio text-atencao">
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
                      {erroAcao && <p className="mt-2 text-apoio text-critico">{erroAcao}</p>}
                      {mensagem && <p className="mt-2 text-apoio text-conforme">{mensagem}</p>}
                      <div className="mt-3 flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setAcao(null)}>
                          Voltar
                        </Button>
                        <Button onClick={enviarSairFixo}>
                          <LogOut /> Solicitar saída do fixo
                        </Button>
                      </div>
                    </div>
                  ) : acao === 'trocar_plantao' ? (
                    <div className="animate-in fade-in-0 zoom-in-95 mt-4 duration-300 ease-out origin-center">
                      <div className="flex flex-col gap-1.5">
                        <Label>Meu plantão (que quero trocar)</Label>
                        <Select items={Object.fromEntries(meusPlantoes.map((p) => [p.id, `${fmtDiaBR(p.data)} · ${TURNO_LABEL[p.turno] ?? p.turno}`]))} value={meuPlantaoTroca || null} onValueChange={(v) => setMeuPlantaoTroca(v ?? '')}>
                          <SelectTrigger className="w-full bg-superficie">
                            <SelectValue placeholder="Selecione um dos meus plantões" />
                          </SelectTrigger>
                          <SelectContent>
                            {meusPlantoes.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {fmtDiaBR(p.data)} · {TURNO_LABEL[p.turno] ?? p.turno}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="mt-3 flex flex-col gap-1.5">
                        <Label>Plantão de outro plantonista (que quero assumir)</Label>
                        <Select items={Object.fromEntries((plantoesDeOutros ?? []).map((p) => [p.id, `${fmtDiaBR(p.data)} · ${TURNO_LABEL[p.turno] ?? p.turno} · ${p.perfis?.nome_completo ?? '?'}`]))} value={outroPlantaoTroca || null} onValueChange={(v) => setOutroPlantaoTroca(v ?? '')}>
                          <SelectTrigger className="w-full bg-superficie">
                            <SelectValue placeholder="Selecione o plantão do outro" />
                          </SelectTrigger>
                          <SelectContent>
                            {(plantoesDeOutros ?? []).map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {fmtDiaBR(p.data)} · {TURNO_LABEL[p.turno] ?? p.turno} ·{' '}
                                {p.perfis?.nome_completo ?? '?'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {carregandoOutros && <Spinner />}
                      </div>
                      <div className="mt-3 flex flex-col gap-1.5">
                        <Label htmlFor="troca-just">Mensagem (opcional)</Label>
                        <Textarea
                          id="troca-just"
                          value={justificativa}
                          onChange={(e) => setJustificativa(e.target.value)}
                          placeholder="Motivo da troca…"
                        />
                      </div>
                      <p className="mt-2 text-rotulo text-tinta-sussurro">
                        Na troca bilateral, você oferece um plantão e recebe outro em troca. Validações de
                        conflito de horário são feitas automaticamente.
                      </p>
                      {erroAcao && <p className="mt-2 text-apoio text-critico">{erroAcao}</p>}
                      {mensagem && <p className="mt-2 text-apoio text-conforme">{mensagem}</p>}
                      <div className="mt-3 flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setAcao(null)}>
                          Voltar
                        </Button>
                        <Button onClick={enviarTrocaPlantao} disabled={!meuPlantaoTroca || !outroPlantaoTroca}>
                          <RefreshCcw /> Solicitar troca
                        </Button>
                      </div>
                    </div>
                  ) : acao === 'fracionar' ? (
                    <div className="animate-in fade-in-0 zoom-in-95 mt-4 duration-300 ease-out origin-center">
                      <div className="flex flex-col gap-1.5">
                        <Label>Em quantas partes deseja dividir?</Label>
                        <Select value={fracionarPartes} onValueChange={(v) => setFracionarPartes(v ?? '2')}>
                          <SelectTrigger className="w-full bg-superficie">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2">2 partes</SelectItem>
                            <SelectItem value="3">3 partes</SelectItem>
                            <SelectItem value="4">4 partes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="mt-2 text-rotulo text-tinta-sussurro">
                        O horário do plantão é dividido em partes iguais (12 h em 2 = duas de 6 h). A 1ª
                        parte continua com você; as outras viram vagas, e outros plantonistas se candidatam
                        em Vagas. O gestor aprova quem assume cada parte.
                      </p>
                      {erroAcao && <p className="mt-2 text-apoio text-critico">{erroAcao}</p>}
                      {mensagem && <p className="mt-2 text-apoio text-conforme">{mensagem}</p>}
                      <div className="mt-3 flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setAcao(null)}>
                          Voltar
                        </Button>
                        <Button onClick={enviarFracionar}>
                          <FileText /> Fracionar
                        </Button>
                      </div>
                    </div>
                  ) : acao === 'passar_plantao' ? (
                    <div className="animate-in fade-in-0 zoom-in-95 mt-4 duration-300 ease-out origin-center">
                      <div className="flex flex-col gap-1.5">
                        <Label>Passar para</Label>
                        <Select items={Object.fromEntries((plantonistas ?? []).map((p) => [p.perfil_id, p.nome_completo + (p.crm ? ` · CRM ${p.crm}` : '')]))} value={destinoId || null} onValueChange={(v) => setDestinoId(v ?? '')}>
                          <SelectTrigger className="w-full bg-superficie">
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
                      <p className="mt-2 text-rotulo text-tinta-sussurro">
                        A passagem pode ser aplicada na hora ou depender de aprovação do gestor (conforme
                        configuração da unidade). A pessoa que recebe o plantão será notificada.
                      </p>
                      {erroAcao && <p className="mt-2 text-apoio text-critico">{erroAcao}</p>}
                      {mensagem && <p className="mt-2 text-apoio text-conforme">{mensagem}</p>}
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
                    <div className="animate-in fade-in-0 zoom-in-95 mt-4 duration-300 ease-out origin-center">
                      <div className="flex flex-col gap-1.5">
                        <Label>Tipo de justificativa</Label>
                        <Select
                          value={tipoFalta}
                          onValueChange={(v) =>
                            setTipoFalta((v as 'atestado_medico' | 'licenca_maternidade') ?? 'atestado_medico')
                          }
                        >
                          <SelectTrigger className="w-full bg-superficie">
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
                        {anexo && <span className="text-rotulo text-tinta-sussurro">{anexo.name}</span>}
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
                      {erroAcao && <p className="mt-2 text-apoio text-critico">{erroAcao}</p>}
                      {mensagem && <p className="mt-2 text-apoio text-conforme">{mensagem}</p>}
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
                  {DIAS_SEMANA.map((d, idx) => (
                    <div
                      key={d}
                      className={`py-1 text-rotulo font-semibold uppercase tracking-wide ${
                        idx === 0 || idx === 6 ? 'text-atencao' : 'text-tinta-sussurro'
                      }`}
                    >
                      {d}
                    </div>
                  ))}
                  {diasDoMes.map((c, i) => {
                    if (c.fora) return <div key={`v-${i}`} />
                    const plantoes = plantoesDoDia(c.iso)
                    const turnos = [...new Set(plantoes.map((p) => p.turno))]
                    const eHoje = ehHoje(c.iso)
                    const selecionado = diaSelecionado === c.iso
                    const dow = new Date(c.iso + 'T12:00:00').getDay()
                    const fimSemana = dow === 0 || dow === 6
                    return (
                      // padrao-ok: célula do calendário mensal da escala (cor por plantão/fim de semana/hoje; nenhuma peça cobre)
                      <button
                        key={c.iso}
                        type="button"
                        onClick={() => (plantoes.length ? abrirDia(c.iso) : undefined)}
                        className={`flex min-h-[76px] min-w-0 flex-col gap-1 rounded-controle border p-1.5 text-left transition-all duration-200 ${
                          plantoes.length
                            ? 'border-conforme/30 bg-leitos text-sobre-acao shadow-md hover:bg-leitos hover:shadow-lg'
                            : fimSemana
                              ? 'border-atencao/30 bg-alerta-atencao hover:bg-atencao/10'
                              : 'border-fio bg-superficie hover:bg-trilha'
                        } ${selecionado ? 'ring-2 ring-acao ring-offset-2' : ''} ${eHoje ? 'ring-2 ring-acao/60' : ''}`}
                      >
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-capsula text-apoio font-semibold ${
                            plantoes.length
                              ? 'bg-tinta/15 text-sobre-acao'
                              : eHoje
                                ? 'bg-acao text-sobre-acao'
                                : fimSemana
                                  ? 'bg-atencao/20 text-atencao'
                                  : 'bg-trilha text-tinta'
                          }`}
                        >
                          {c.dia}
                        </span>
                        {turnos.map((t) => (
                          <span
                            key={t}
                            className={`truncate rounded-capsula px-1.5 py-0.5 text-rotulo leading-none font-semibold ${
                              plantoes.length ? 'bg-tinta/15 text-sobre-acao' : 'bg-trilha text-tinta-apoio'
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

          {/* TROCAS BILATERAIS */}
          {(minhasTrocas ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-corpo">
                  <RefreshCcw className="size-4 text-tinta-sussurro" />
                  Minhas trocas
                </CardTitle>
                <CardDescription>Solicitações de troca bilateral relacionadas a você.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {(minhasTrocas ?? []).map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-controle border p-2.5 text-apoio">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          t.status === 'aprovado'
                            ? 'success'
                            : t.status === 'recusado' || t.status === 'erro'
                              ? 'destructive'
                              : t.status === 'pendente'
                                ? 'warning'
                                : 'secondary'
                        }
                      >
                        {t.status}
                      </Badge>
                      <span className="text-rotulo text-tinta-sussurro">
                        {dataHora(t.created_at)}
                      </span>
                    </div>
                    {t.status === 'erro' && t.erro && (
                      <span className="text-rotulo text-critico">{t.erro}</span>
                    )}
                    {/* A2: quem aprova a troca é o gestor, na aba Pedidos; o colega pode recusar */}
                    {t.status === 'pendente' && t.perfil_b_id !== perfil?.id && (
                      <span className="text-rotulo text-tinta-sussurro">Aguardando a coordenação</span>
                    )}
                    {t.status === 'pendente' && t.perfil_b_id === perfil?.id && (
                      <div className="flex items-center gap-2">
                        <span className="text-rotulo text-tinta-sussurro">A coordenação decide.</span>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={async () => {
                            await supabase.rpc('recusar_troca', { p_troca: t.id })
                            void refetchTrocas()
                          }}
                        >
                          <X /> Recusar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* CONTADOR MENSAL */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-corpo">
                <CalendarClock className="size-4 text-tinta-sussurro" />
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
                  <div className="flex flex-1 flex-col rounded-container border bg-trilha/40 p-4">
                    <span className="text-rotulo font-semibold uppercase tracking-wide text-tinta-sussurro">
                      Horas no mês
                    </span>
                    <span className="mt-1 text-numeral-ok leading-none font-semibold tracking-[-0.03em] tabular">{resumo.horas}h</span>
                    <span className="text-rotulo text-tinta-sussurro">
                      {resumo.dias} dia(s) escalado(s) em {fmtMesBR(mesInicio)}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col rounded-container border bg-suprimento/10 p-4">
                    <span className="text-rotulo font-semibold uppercase tracking-wide text-suprimento">
                      Diurnos (manhã + tarde = 12h)
                    </span>
                    <span className="mt-1 text-numeral-ok leading-none font-semibold tracking-[-0.03em] tabular text-suprimento">{resumo.diurnos}</span>
                    <span className="text-rotulo text-suprimento">
                      {resumo.diurnos * 12}h · manhã e tarde juntas contam como diurno
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col rounded-container border bg-suprimento/10 p-4">
                    <span className="text-rotulo font-semibold uppercase tracking-wide text-suprimento">
                      Noturnos (noite = 12h)
                    </span>
                    <span className="mt-1 text-numeral-ok leading-none font-semibold tracking-[-0.03em] tabular text-suprimento">{resumo.noturnos}</span>
                    <span className="text-rotulo text-suprimento">{resumo.noturnos * 12}h</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
        ) : (
        <>
          {/* ESCALA GERAL — plantões livres para candidatura */}
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-corpo">
                  <CalendarClock className="size-4 text-tinta-sussurro" />
                  {diaGeral ? `Plantões de ${fmtDiaBR(diaGeral)}` : `Escala Geral · ${fmtMesBR(mesInicio)}`}
                </CardTitle>
                <CardDescription>
                  {diaGeral
                    ? 'Plantões do dia por setor e turno — candidat-se aos livres.'
                    : 'Clique em um dia para ver os plantões do mês inteiro.'}
                </CardDescription>
              </div>
              {diaGeral && (
                <Button
                  variant="ghost"
                  onClick={fecharDiaGeral}
                  className="group relative h-14 w-48 shrink-0 rounded-cartao bg-superficie p-0 text-dialogo font-semibold text-tinta transition-shadow hover:text-tinta hover:shadow-md"
                >
                  <div className="absolute top-[4px] left-1 z-10 flex h-12 w-1/4 items-center justify-center rounded-container bg-leitos duration-500 group-hover:w-[184px]">
                    <ChevronLeft className="size-6 text-tinta" />
                  </div>
                  <p className="translate-x-2">Voltar</p>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {carregandoEscala || carregandoCand ? (
                <div className="flex h-40 items-center justify-center">
                  <Spinner />
                </div>
              ) : diaGeral ? (
                /* DETALHE DO DIA */
                <div
                  key={`painel-geral-${diaGeral}`}
                  className={`origin-center ${
                    fechandoGeral
                      ? 'animate-in fade-in-0 zoom-in-95 duration-300 ease-out animate-out fade-out-0 zoom-out-95'
                      : 'animate-in fade-in-0 zoom-in-95 duration-300 ease-out'
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    {(setores ?? []).map((s) => (
                      <div key={s.id} className="rounded-container border">
                        <div className="rounded-t-container bg-trilha/50 px-3 py-1.5 text-apoio font-semibold">{s.nome}</div>
                        <div className="grid gap-1 p-2 sm:grid-cols-3">
                          {TURNOS.map((t) => {
                            const ocupados = (escalaMes ?? []).filter(
                              (e) => e.setor_id === s.id && e.data === diaGeral && e.turno === t.id
                            )
                            const jaCand = (candidaturas ?? []).some(
                              (c) =>
                                c.setor_id === s.id && c.data === diaGeral && c.turno === t.id && c.perfil_id === perfil?.id
                            )
                            const livre = ocupados.length === 0
                            return (
                              <div
                                key={`${s.id}-${t.id}`}
                                className={`rounded-controle border p-2 ${
                                  livre ? 'border-dashed border-conforme/30 bg-alerta-conforme' : 'bg-trilha/40'
                                }`}
                              >
                                <div className="mb-1 flex items-center justify-between">
                                  <span className="text-rotulo font-semibold text-tinta-sussurro">{t.label}</span>
                                  <Badge variant={livre ? 'success' : 'secondary'} className="text-rotulo">
                                    {livre ? 'Livre' : 'Ocupado'}
                                  </Badge>
                                </div>
                                {livre ? (
                                  <Button
                                    disabled={jaCand || candidatar.isPending}
                                    onClick={() => candidatar.mutate({ setor_id: s.id, data: diaGeral, turno: t.id })}
                                    className={cn(
                                      'min-h-0 w-full px-2 py-1.5 text-rotulo font-semibold disabled:opacity-100',
                                      jaCand
                                        ? 'cursor-default bg-suprimento/10 text-suprimento hover:bg-suprimento/10'
                                        : 'bg-leitos text-sobre-acao hover:bg-leitos',
                                    )}
                                  >
                                    {jaCand ? 'Candidatura enviada' : 'Candidatar-se'}
                                  </Button>
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    {ocupados.map((e) => (
                                      <span
                                        key={e.id}
                                        className="rounded-controle bg-superficie px-1.5 py-0.5 text-rotulo text-tinta-sussurro"
                                      >
                                        {e.perfis?.nome_completo ?? 'Ocupado'}
                                        {e.quinzenal && <span className="ml-1 font-semibold text-acao">15/15</span>}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* M10: o erro da candidatura aparece (antes falhava calado) */}
                  {candidatar.error && (
                    <p role="alert" className="mt-2 text-apoio text-critico">{candidatar.error.message}</p>
                  )}

                  {/* Minhas candidaturas */}
                  <div className="mt-4 flex flex-col gap-2">
                    <div className="text-rotulo font-semibold uppercase tracking-wide text-tinta-sussurro">
                      Minhas candidaturas
                    </div>
                    {(candidaturas ?? []).filter((c) => c.perfil_id === perfil?.id).length === 0 ? (
                      <p className="text-apoio text-tinta-sussurro">Nenhuma candidatura enviada.</p>
                    ) : (
                      (candidaturas ?? [])
                        .filter((c) => c.perfil_id === perfil?.id)
                        .map((c) => (
                          <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-controle border p-2 text-apoio">
                            <span className="font-medium">{c.setores?.nome ?? 'Setor'}</span>
                            <span className="text-rotulo text-tinta-sussurro">
                              {fmtDiaBR(c.data)} · {TURNO_LABEL[c.turno]}{janelaDaVaga(c.vaga_id)}
                            </span>
                            <Badge
                              variant={
                                c.status === 'aprovado' ? 'success' : c.status === 'recusado' ? 'destructive' : 'warning'
                              }
                            >
                              {c.status === 'aprovado' ? 'Aprovado' : c.status === 'recusado' ? 'Recusado' : 'Pendente'}
                            </Badge>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              ) : (
                /* CALENDÁRIO DO MÊS */
                <div className="grid grid-cols-7 gap-1 text-center">
                  {DIAS_SEMANA.map((d, idx) => (
                    <div
                      key={d}
                      className={`py-1 text-rotulo font-semibold uppercase tracking-wide ${
                        idx === 0 || idx === 6 ? 'text-atencao' : 'text-tinta-sussurro'
                      }`}
                    >
                      {d}
                    </div>
                  ))}
                  {diasDoMes.map((c, i) => {
                    if (c.fora) return <div key={`v-${i}`} />
                    const plantoesDia = (escalaMes ?? []).filter((e) => e.data === c.iso)
                    const livres = plantoesDia.length === 0
                    const candidaturasDia = (candidaturas ?? []).filter(
                      (cd) => cd.data === c.iso && cd.perfil_id === perfil?.id
                    )
                    const temMinhaCand = candidaturasDia.length > 0
                    const eHoje = ehHoje(c.iso)
                    return (
                      // padrao-ok: célula do calendário mensal da escala geral (livre/ocupado/hoje; nenhuma peça cobre)
                      <button
                        key={c.iso}
                        type="button"
                        onClick={() => setDiaGeral(c.iso)}
                        className={`flex min-h-[76px] min-w-0 flex-col gap-1 rounded-controle border p-1.5 text-left transition-all duration-200 ${
                          livres
                            ? 'border-dashed border-conforme/30 bg-alerta-conforme hover:bg-conforme/10'
                            : 'border-fio bg-superficie hover:bg-trilha'
                        } ${eHoje ? 'ring-2 ring-acao/60' : ''}`}
                      >
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-capsula text-apoio font-semibold ${
                            eHoje
                              ? 'bg-acao text-sobre-acao'
                              : livres
                                ? 'bg-conforme/20 text-conforme'
                                : 'bg-trilha text-tinta'
                          }`}
                        >
                          {c.dia}
                        </span>
                        {livres ? (
                          <span className="text-rotulo font-semibold text-conforme">Tudo livre</span>
                        ) : (
                          <span className="text-rotulo font-semibold text-tinta-sussurro">
                            {plantoesDia.length} plantão(ões)
                          </span>
                        )}
                        {temMinhaCand && (
                          <span className="truncate rounded-capsula bg-suprimento/10 px-1.5 py-0.5 text-rotulo leading-none font-semibold text-suprimento">
                            {candidaturasDia.length} candidatura(s)
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Minhas candidaturas (resumo) */}
              {!diaGeral && (
                <div className="mt-4 flex flex-col gap-2">
                  <div className="text-rotulo font-semibold uppercase tracking-wide text-tinta-sussurro">
                    Minhas candidaturas
                  </div>
                  {(candidaturas ?? []).filter((c) => c.perfil_id === perfil?.id).length === 0 ? (
                    <p className="text-apoio text-tinta-sussurro">Nenhuma candidatura enviada.</p>
                  ) : (
                    (candidaturas ?? [])
                      .filter((c) => c.perfil_id === perfil?.id)
                      .map((c) => (
                        <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-controle border p-2 text-apoio">
                          <span className="font-medium">{c.setores?.nome ?? 'Setor'}</span>
                          <span className="text-rotulo text-tinta-sussurro">
                            {fmtDiaBR(c.data)} · {TURNO_LABEL[c.turno]}{janelaDaVaga(c.vaga_id)}
                          </span>
                          <Badge
                            variant={
                              c.status === 'aprovado' ? 'success' : c.status === 'recusado' ? 'destructive' : 'warning'
                            }
                          >
                            {c.status === 'aprovado' ? 'Aprovado' : c.status === 'recusado' ? 'Recusado' : 'Pendente'}
                          </Badge>
                        </div>
                      ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
        )
      )
      : (
        <>
          {/* Pedidos (revisão visual 3.9, opção A do RT): solicitações e candidaturas numa lista só */}
          {abaGestor === 'pedidos' && (
            <div className="flex flex-col gap-4">
              <section aria-label="Pedidos aguardando você" className="overflow-hidden rounded-cartao border border-fio bg-superficie">
                <div className="flex flex-wrap items-center gap-2 border-b border-trilha px-4 py-2.5">
                  <span className="text-apoio font-semibold text-tinta">Aguardando você</span>
                  <span className={cn('text-rotulo font-semibold tabular-nums', pedidos.total ? 'text-atencao' : 'text-acao')}>{pedidos.total}</span>
                  <span className="ml-auto text-rotulo text-tinta-sussurro">Aprovar ou recusar vale na hora e fica no histórico.</span>
                </div>
                {decidir.error && (
                  <p role="alert" className="border-b border-trilha px-4 py-2 text-apoio text-critico">{decidir.error.message}</p>
                )}
                {/* M10: erro de aprovar ou recusar candidatura visível */}
                {(aprovarCandidatura.error ?? recusarCandidatura.error) && (
                  <p role="alert" className="border-b border-trilha px-4 py-2 text-apoio text-critico">{(aprovarCandidatura.error ?? recusarCandidatura.error)?.message}</p>
                )}
                {decidirTroca.error && (
                  <p role="alert" className="border-b border-trilha px-4 py-2 text-apoio text-critico">{decidirTroca.error.message}</p>
                )}
                {erroAnexo && (
                  <p role="alert" className="border-b border-trilha px-4 py-2 text-apoio text-critico">{erroAnexo}</p>
                )}
                {carregandoSolic ? (
                  <div className="flex h-16 items-center justify-center"><Spinner /></div>
                ) : pedidos.total === 0 ? (
                  <p className="px-4 py-4 text-apoio text-tinta-sussurro">Nenhum pedido aguardando.</p>
                ) : (
                  <ul className="flex flex-col">
                    {(solicitacoes ?? []).filter((s) => s.status === 'pendente').map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-trilha px-4 py-2.5 text-apoio last:border-b-0">
                        <span className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
                          <span className="text-tinta"><b className="font-medium">{s.solicitante?.nome_completo ?? 'Profissional'}</b>{s.escala_plantao?.papel && <span className="text-tinta-sussurro"> ({PAPEL_LABEL[s.escala_plantao.papel]})</span>} · {(TIPO_SOLICITACAO_LABEL[s.tipo] ?? 'Falta').toLowerCase()}</span>
                          <span className="text-rotulo text-tinta-sussurro">
                            {s.escala_plantao ? `${fmtDiaBR(s.escala_plantao.data)} · ${TURNO_LABEL[s.escala_plantao.turno]}` : 'Plantão removido'}
                            {s.tipo === 'passar_plantao' && s.destino && ` · para ${s.destino.nome_completo}`}
                            {s.tipo_falta && ` · ${TIPO_FALTA_LABEL[s.tipo_falta]}`}
                            {s.justificativa && ` · ${s.justificativa}`}
                            {s.anexo_url && <> · <Button type="button" variant="link" size="xs" className="h-auto min-h-0 p-0 align-baseline text-rotulo font-medium" onClick={() => void abrirAnexo(s.anexo_url!)}>ver anexo</Button></>}
                          </span>
                        </span>
                        <span className="flex gap-1.5">
                          <Button size="xs" disabled={decidir.isPending} onClick={() => decidir.mutate({ id: s.id, status: 'aprovado' })}>Aprovar</Button>
                          <Button size="xs" variant="ghost" disabled={decidir.isPending} onClick={() => decidir.mutate({ id: s.id, status: 'recusado' })}>Recusar</Button>
                        </span>
                      </li>
                    ))}
                    {/* A2: a troca só entra na escala com o gestor */}
                    {(trocas ?? []).filter((t) => t.status === 'pendente').map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-trilha px-4 py-2.5 text-apoio last:border-b-0">
                        <span className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
                          <span className="text-tinta"><b className="font-medium">{t.pedinte?.nome_completo ?? 'Profissional'}</b> · troca com <b className="font-medium">{t.colega?.nome_completo ?? 'colega'}</b></span>
                          <span className="text-rotulo text-tinta-sussurro">
                            {t.plantao_a ? `${fmtDiaBR(t.plantao_a.data)} · ${TURNO_LABEL[t.plantao_a.turno]}` : 'Plantão removido'}
                            {' ⇄ '}
                            {t.plantao_b ? `${fmtDiaBR(t.plantao_b.data)} · ${TURNO_LABEL[t.plantao_b.turno]}` : 'Plantão removido'}
                            {t.mensagem && ` · ${t.mensagem}`}
                          </span>
                        </span>
                        <span className="flex gap-1.5">
                          <Button size="xs" disabled={decidirTroca.isPending} onClick={() => decidirTroca.mutate({ id: t.id, aprovar: true })}>Aprovar</Button>
                          <Button size="xs" variant="ghost" disabled={decidirTroca.isPending} onClick={() => decidirTroca.mutate({ id: t.id, aprovar: false })}>Recusar</Button>
                        </span>
                      </li>
                    ))}
                    {(candidaturas ?? []).filter((c) => c.status === 'pendente').map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-trilha px-4 py-2.5 text-apoio last:border-b-0">
                        <span className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
                          <span className="text-tinta"><b className="font-medium">{c.perfis?.nome_completo ?? 'Plantonista'}</b> · candidatura a plantão livre</span>
                          <span className="text-rotulo text-tinta-sussurro">{c.setores?.nome ?? 'Setor'} · {fmtDiaBR(c.data)} · {TURNO_LABEL[c.turno]}{janelaDaVaga(c.vaga_id)}</span>
                        </span>
                        <span className="flex gap-1.5">
                          <Button size="xs" disabled={aprovarCandidatura.isPending} onClick={() => aprovarCandidatura.mutate(c.id)}>Aprovar</Button>
                          <Button size="xs" variant="ghost" disabled={recusarCandidatura.isPending} onClick={() => recusarCandidatura.mutate(c.id)}>Recusar</Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {(solicitacoes ?? []).length > 0 && (
                  <p className="border-t border-trilha bg-campo px-4 py-2 text-rotulo text-tinta-sussurro">
                    Nos últimos pedidos: {contagem(alertas.sairam, 'passagem de plantão', 'passagens de plantão')} · {contagem(alertas.atestados, 'atestado', 'atestados')} · {contagem(alertas.faltas, 'falta', 'faltas')} · {contagem(alertas.interesses, 'pedido para sair do fixo', 'pedidos para sair do fixo')}.
                  </p>
                )}
              </section>
              {(solicitacoes ?? []).some((s) => s.status !== 'pendente') && (
                <section aria-label="Pedidos decididos" className="overflow-hidden rounded-cartao border border-fio bg-superficie">
                  <div className="border-b border-trilha px-4 py-2.5 text-apoio font-semibold text-tinta">Decididos</div>
                  <ul className="flex flex-col">
                    {(solicitacoes ?? []).filter((s) => s.status !== 'pendente').slice(0, 30).map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-trilha px-4 py-2 text-apoio last:border-b-0">
                        <span className="min-w-0 flex-[1_1_280px] text-tinta">
                          <b className="font-medium">{s.solicitante?.nome_completo ?? 'Profissional'}</b>{s.escala_plantao?.papel && <span className="text-tinta-sussurro"> ({PAPEL_LABEL[s.escala_plantao.papel]})</span>} · {(TIPO_SOLICITACAO_LABEL[s.tipo] ?? 'Falta').toLowerCase()}
                          <span className="text-rotulo text-tinta-sussurro">
                            {' · '}{s.escala_plantao ? `${fmtDiaBR(s.escala_plantao.data)} · ${TURNO_LABEL[s.escala_plantao.turno]}` : 'plantão removido'}
                            {s.tipo === 'passar_plantao' && s.destino && ` · para ${s.destino.nome_completo}`}
                          </span>
                        </span>
                        <Estado tom={s.status === 'aprovado' ? 'verde' : 'vermelho'}>{s.status === 'aprovado' ? 'aprovado' : 'recusado'}</Estado>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {/* Abas: Escala Fixa / Mensal */}
          <Abas
            abas={[['fixa', 'Escala fixa'], ['mensal', 'Escala mensal']]}
            valor={abaGestor === 'fixa' ? 'fixa' : 'mensal'}
            onChange={setAbaGestor}
            rotulo="Tipo de escala"
            className={abaGestorFixa ? 'hidden' : 'mb-0 gap-2'}
          />

          {/* Carga horária (aba própria desde a revisão visual 3.9) + exportar a escala do mês */}
          {abaGestor === 'carga' && (
            <section aria-label="Carga horária" className="overflow-hidden rounded-cartao border border-fio bg-superficie">
              <div className="flex flex-wrap items-center gap-2 border-b border-trilha px-4 py-2.5">
                <Button size="icon-sm" variant="outline" aria-label="Mês anterior" onClick={() => mudarMes(-1)}><ChevronLeft /></Button>
                <span className="text-apoio font-semibold text-tinta">Carga horária · {fmtMesBR(mesInicio)}</span>
                <Button size="icon-sm" variant="outline" aria-label="Próximo mês" onClick={() => mudarMes(1)}><ChevronRight /></Button>
                <Button size="sm" variant="outline" className="ml-auto" onClick={exportarEscalaCSV} disabled={!setores || !escalaMes}>
                  <Download /> Exportar escala (CSV)
                </Button>
              </div>
              {carregandoCarga ? (
                <div className="flex h-24 items-center justify-center"><Spinner /></div>
              ) : (resumoCarga ?? []).length === 0 ? (
                <p className="px-4 py-4 text-apoio text-tinta-sussurro">Nenhum plantão neste mês.</p>
              ) : (
                <Table aria-label="Carga horária por plantonista">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4">Plantonista</TableHead>
                      <TableHead className="text-right">Diurnos</TableHead>
                      <TableHead className="text-right">Noturnos</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      <TableHead className="pr-4 text-right">Dias</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(resumoCarga ?? []).map((r) => (
                      <TableRow key={r.perfil_id}>
                        <TableCell className="pl-4 font-medium text-tinta">{r.nome}</TableCell>
                        <TableCell className="text-right tabular">{r.diurnos}</TableCell>
                        <TableCell className="text-right tabular">{r.noturnos}</TableCell>
                        <TableCell className="text-right font-semibold tabular">{r.horas} h</TableCell>
                        <TableCell className="pr-4 text-right tabular">{r.dias}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <p className="border-t border-trilha bg-campo px-4 py-2 text-rotulo text-tinta-sussurro">Diurnos, noturnos e horas por plantonista no mês, contados da escala.</p>
            </section>
          )}

          {/* Turnos (gestor/admin): só nas grades */}
          {(abaGestor === 'fixa' || abaGestor === 'mensal') && <div role="radiogroup" aria-label="Turno" className="flex flex-wrap gap-2">
            {TURNOS.map((t) => (
              <Chip key={t.id} radio ativo={turno === t.id} onClick={() => setTurno(t.id)}>
                {t.label} <span className="opacity-70">· {t.horario}</span>
              </Chip>
            ))}
          </div>}

          {abaGestor === 'fixa' ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-corpo">
                  Escala fixa · {TURNO_LABEL[turno]}
                </CardTitle>
                <CardDescription>
                  Template que não muda (ex.: 15/15). Clique numa célula para adicionar. Gere o mês
                  para criar a escala mensal a partir daqui.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {carregandoFixa ? (
                  <div className="flex h-24 items-center justify-center">
                    <Spinner />
                  </div>
                ) : (
                  <Table variante="referencia" className="w-full min-w-[760px] border-collapse text-apoio">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-40 border-b border-r bg-trilha/50 p-2 text-left text-rotulo font-semibold text-tinta-sussurro">
                          Setor
                        </TableHead>
                        {DIAS_SEMANA.map((d) => (
                          <TableHead key={d} className="border-b border-r p-2 text-center text-rotulo font-semibold">
                            {d}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(setores ?? []).map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="border-b border-r p-2 align-top font-medium">{s.nome}</TableCell>
                          {DIAS_SEMANA.map((_, i) => {
                            const fixas = fixasDoCelula(s.id, i)
                            return (
                              <TableCell key={i} className="border-b border-r p-1 align-top">
                                {/* padrao-ok: célula da grade da escala fixa (setor × dia; contém o "remover" de cada nome) */}
                                <button
                                  type="button"
                                  onClick={() => abrirCelulaFixa(s.id, i)}
                                  className="flex min-h-[52px] w-full flex-col gap-1 rounded-controle p-1 text-left transition-colors hover:bg-acao/5"
                                >
                                  {fixas.length === 0 && <span className="text-rotulo text-tinta-sussurro">+ adicionar</span>}
                                  {fixas.map((f) => (
                                    <span key={f.id} className="group flex items-center gap-1">
                                      <span className="block flex-1 rounded-controle bg-trilha px-1.5 py-0.5 text-rotulo leading-tight">
                                        {f.perfis?.nome_completo?.split(' ').slice(0, 2).join(' ') ?? 'Sem nome'}
                                        {f.quinzenal && <span className="ml-1 font-semibold text-acao">15/15</span>}
                                      </span>
                                      <Button
                                        variant="link"
                                        size="xs"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          removerFixa.mutate(f.id)
                                        }}
                                        className="hidden min-h-0 px-0 text-rotulo text-critico hover:text-critico group-hover:block"
                                      >
                                        remover
                                      </Button>
                                    </span>
                                  ))}
                                </button>
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {mensagemGeracao && <p className="text-apoio text-conforme">{mensagemGeracao}</p>}
                {vagasGeracao.length > 0 && (
                  <div role="alert" className="flex flex-col gap-1 rounded-controle border border-atencao/30 bg-alerta-atencao p-3 text-apoio">
                    <span className="font-medium text-tinta">
                      {vagasGeracao.length} plantão(ões) viraram vaga aberta: a pessoa já estava escalada em outro lugar no mesmo horário.
                    </span>
                    <ul className="list-disc pl-5 text-tinta-apoio">
                      {vagasGeracao.map((v) => (
                        <li key={`${v.data}-${v.turno}-${v.setor}-${v.profissional}`}>
                          {v.data.split('-').reverse().join('/')} · {v.turno} · {v.setor ?? 'setor'}: {v.profissional ?? 'profissional'} já estava {v.conflito}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => gerarMes.mutate()} disabled={gerarMes.isPending || carregandoFixa}>
                    {gerarMes.isPending ? <Spinner /> : <RefreshCcw />} Gerar mês {fmtMesBR(mesInicio)} a partir da fixa
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : abaGestor === 'mensal' ? (
          <>
          {carregandoSetores || carregandoEscala ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-corpo">
                  {TURNO_LABEL[turno]} · semana de {fmtDiaBR(dataInicio)}
                </CardTitle>
                <CardDescription>Clique em uma célula para adicionar ou remover plantonistas.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table variante="referencia" className="w-full min-w-[760px] border-collapse text-apoio">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40 border-b border-r bg-trilha/50 p-2 text-left text-rotulo font-semibold text-tinta-sussurro">
                        Setor
                      </TableHead>
                      {dias.map((d) => (
                        <TableHead
                          key={d}
                          className={`border-b p-2 text-center text-rotulo font-semibold ${
                            [0, 6].includes(new Date(d + 'T12:00:00').getDay()) ? 'border-r border-r-atencao/30 bg-alerta-atencao text-atencao' : 'border-r'
                          }`}
                        >
                          {DIAS_SEMANA[new Date(d + 'T12:00:00').getDay()]}
                          <span className="block text-rotulo font-normal text-tinta-sussurro">{fmtDiaBR(d)}</span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(setores ?? []).map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="border-b border-r p-2 align-top font-medium">{s.nome}</TableCell>
                        {dias.map((d) => {
                          const plantoes = plantoesDaCelula(s.id, d)
                          return (
                            <TableCell key={d} className="border-b border-r p-1 align-top">
                              {/* padrao-ok: célula da grade da escala semanal (setor × dia; abre a edição do plantão) */}
                              <button
                                type="button"
                                onClick={() => abrirCelula(s.id, d)}
                                className="flex min-h-[52px] w-full flex-col gap-1 rounded-controle p-1 text-left transition-colors hover:bg-acao/5"
                              >
                                {plantoes.length === 0 && (
                                  <span className="text-rotulo text-tinta-sussurro">+ adicionar</span>
                                )}
                                {plantoes.map((p) => (
                                  <span key={p.id} className="block">
                                    <span className="block rounded-controle bg-trilha px-1.5 py-0.5 text-rotulo leading-tight">
                                      {p.perfis?.nome_completo?.split(' ').slice(0, 2).join(' ') ?? 'Sem nome'}
                                      {p.quinzenal && <span className="ml-1 font-semibold text-acao">15/15</span>}
                                    </span>
                                    {p.rotulo && (
                                      <span className="block px-1.5 text-rotulo text-tinta-sussurro">{p.rotulo}</span>
                                    )}
                                  </span>
                                ))}
                              </button>
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Gestor: detalhe dos plantões da célula */}
          {ehGestor && celula && !dialogAberto && (
            <Card>
              <CardHeader>
                <CardTitle className="text-corpo">
                  {setores?.find((s) => s.id === celula.setor_id)?.nome} · {fmtDiaBR(celula.data)} ·{' '}
                  {TURNO_LABEL[turno]}
                </CardTitle>
                <CardDescription>Plantonistas escalados neste plantão.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {(escala ?? [])
                  .filter((e) => e.setor_id === celula.setor_id && e.data === celula.data && e.turno === turno)
                  .map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-controle border p-2">
                      <div>
                        <div className="font-medium">{e.perfis?.nome_completo ?? 'Sem nome'}</div>
                        <div className="text-rotulo text-tinta-sussurro">
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
                  ).length === 0 && <p className="text-apoio text-tinta-sussurro">Nenhum plantonista neste plantão.</p>}
              </CardContent>
            </Card>
          )}

          </>
          ) : null}
        </>
      )}

      {/* Dialog: adicionar plantonista (gestor) */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{abaGestor === 'fixa' ? 'Adicionar à escala fixa' : 'Adicionar plantonista'}</DialogTitle>
            <DialogDescription>
              {setores?.find((s) => s.id === (abaGestor === 'fixa' ? celulaFixa?.setor_id : celula?.setor_id))?.nome}
              {abaGestor === 'fixa'
                ? ` · ${DIAS_SEMANA[celulaFixa?.dia_semana ?? 0]}`
                : celula
                  ? ` · ${fmtDiaBR(celula.data)}`
                  : ''}{' '}
              · {TURNO_LABEL[turno]}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{ehGestor ? 'Profissional e categoria' : 'Plantonista'}</Label>
              {ehGestor ? (
                <Select
                  value={plantonistaId && papelEscolhido ? `${plantonistaId}|${papelEscolhido}` : null}
                  onValueChange={(v) => {
                    const [id, papel] = (v ?? '').split('|')
                    setPlantonistaId(id ?? '')
                    setPapelEscolhido((papel || null) as Papel | null)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(profissionais ?? []).map((p) => (
                      <SelectItem key={`${p.perfil_id}|${p.papel}`} value={`${p.perfil_id}|${p.papel}`}>
                        {p.nome_completo} · {PAPEL_LABEL[p.papel]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
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
              )}
              {(ehGestor ? carregandoProf : carregandoPlant) && <Spinner />}
            </div>

            {abaGestor !== 'fixa' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="esc-rotulo">Rótulo (opcional)</Label>
                <Input
                  id="esc-rotulo"
                  value={rotulo}
                  onChange={(e) => setRotulo(e.target.value)}
                  placeholder='Ex: "escala 15/15", "cobertura"'
                />
              </div>
            )}

            <label className="flex cursor-pointer items-center gap-2 text-apoio font-medium">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={quinzenal}
                onChange={(e) => setQuinzenal(e.target.checked)}
              />
              Escala quinzenal (15/15)
            </label>
          </div>
          {/* M10: o erro de escalar aparece (antes o clique não fazia nada) */}
          {(abaGestor === 'fixa' ? adicionarFixa.error : adicionar.error) && (
            <p role="alert" className="text-apoio text-critico">{(abaGestor === 'fixa' ? adicionarFixa.error : adicionar.error)?.message}</p>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            {abaGestor === 'fixa' ? (
              <Button onClick={() => adicionarFixa.mutate()} disabled={!plantonistaId || adicionarFixa.isPending}>
                {adicionarFixa.isPending ? <Spinner /> : <Plus />} Adicionar
              </Button>
            ) : (
              <Button onClick={() => adicionar.mutate()} disabled={!plantonistaId || adicionar.isPending}>
                {adicionar.isPending ? <Spinner /> : <Plus />} Adicionar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

