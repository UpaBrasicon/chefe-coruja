// ─────────────────────────────────────────────────────────────────────────────
// LeitoAberto — o CADERNO DO LEITO (protótipo, index.html 2640–3142).
//
// Cabeçalho único do paciente no topo e as 12 abas do protótipo (LEITO_ABAS):
// Resumo (acuidade com tendência e motivo do alerta, pendências, passagem),
// Classificação, Evolução, Diagnóstico, Admissão, Prescrição, Exames, AIH,
// Encaminhamento, Atestado, Parecer e termos, Alta e documentos. As peças
// moram em ./caderno; toda regra mora no servidor, aqui só se mostra e se pede.
//
// modo="simples" (o padrão, usado pela observação) é o leito de antes, sem
// abas: acuidade, vitais, pendências, exames, passagem, alta e pacote.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity, ArrowUpRight, BookOpen, ClipboardList, FileText, FlaskConical, LayoutDashboard, MessageSquare, Pill, ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { abrirProntuario } from '@/lib/prontuario'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { ehPediatrico } from '@/domain/idade'
import type { CorRisco } from '@/domain/risco'
import { ExamesEAgravos } from '@/components/clinico/ExamesEAgravos'
import { CabecalhoPaciente } from '@/components/paciente/CabecalhoPaciente'
import { AbaAvaliacaoCrescimento } from '@/components/avaliacao/AbaAvaliacaoCrescimento'
import { AbaEncaminhamentoInterno } from '@/components/encaminhamento/AbaEncaminhamentoInterno'
import { AbaEvolucao } from '@/components/evolucao/AbaEvolucao'
import { AbaParecer } from '@/components/parecer/AbaParecer'
import { AbaTermoConsentimento } from '@/components/termo/AbaTermoConsentimento'
import { PassagensDoPlantao } from '@/components/internacao/PassagensDoPlantao'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

import { BlocoAcuidade } from './caderno/Acuidade'
import { BlocoAlta, BlocoPacote, CancelarAlta } from './caderno/Alta'
import { Secao } from './caderno/caixas'
import { AbaClassificacao } from './caderno/Classificacao'
import {
  type Acao, type Acuidade, ATIVO, diaHora, type Internacao, msg, type Pacote, type Passagem, type Pendencia,
} from './caderno/comum'
import { AbaDiagnostico } from './caderno/Diagnostico'
import { useDiagnosticos } from './caderno/diagnosticos'
import { AbaAdmissao, AbaAih, AbaAtestado, AbaExames, AbaPrescricao } from './caderno/Documentos'
import { useDocumentosLeito } from './caderno/rascunhoLeito'
import { BlocoPassagem } from './caderno/Passagem'
import { BlocoPendencias } from './caderno/Pendencias'
import { BlocoSepse } from './caderno/Sepse'
import { ChecklistAdmissao, TrilhaEpisodio } from './caderno/Trilha'

export { SepsePorta } from './caderno/Sepse'

type IdAba = 'resumo' | 'classif' | 'evol' | 'diag' | 'admissao' | 'receituario' | 'exames' | 'aih' | 'encaminhamento' | 'atestado' | 'comp' | 'alta'

// LEITO_ABAS do protótipo (index.html ~21611), na mesma ordem.
const ABAS: [IdAba, string, LucideIcon][] = [
  ['resumo', 'Resumo', LayoutDashboard],
  ['classif', 'Classificação', Activity],
  ['evol', 'Evolução', Activity],
  ['diag', 'Diagnóstico', ClipboardList],
  ['admissao', 'Admissão', BookOpen],
  ['receituario', 'Prescrição', Pill],
  ['exames', 'Exames', FlaskConical],
  ['aih', 'AIH', ClipboardList],
  ['encaminhamento', 'Encaminhamento', ArrowUpRight],
  ['atestado', 'Atestado', FileText],
  ['comp', 'Parecer e termos', MessageSquare],
  ['alta', 'Alta e documentos', ShieldCheck],
]
/** O que se lê sem escrever: gestor, e o leito depois da alta. */
const ABAS_LEITURA: IdAba[] = ['resumo', 'classif', 'diag', 'alta']

const CHAVES_DO_LEITO = [
  'leito-aberto', 'acuidade', 'tendencia-acuidade', 'vitais-qsofa', 'pendencias', 'passagens', 'impeditivos', 'pacotes-alta',
  'pacientes-internados', 'internados-leitos', 'pendencias-lista', 'diagnosticos-leito', 'diagnosticos-lista', 'altas-recentes',
  'ocupacao-setores', 'pendencias-observacao', 'alertas-sepse',
]

export function LeitoAberto({ pacienteId, pacienteNome, ehGestor, modo = 'simples', acoesTopo }: {
  pacienteId: string
  pacienteNome: string
  ehGestor: boolean
  /** "caderno": as 12 abas do protótipo; "simples": o leito sem abas (observação). */
  modo?: 'simples' | 'caderno'
  /** Botões do painel ao lado das abas (ex.: transferir de setor). */
  acoesTopo?: React.ReactNode
}) {
  const { perfil } = useAuth()
  const eu = perfil?.id
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [agora] = React.useState(() => Date.now())

  const internacao = useQuery({
    queryKey: ['leito-aberto', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internacoes')
        .select('id, status, data_admissao, data_alta, alta_registrada_em, alta_por, cid_alta, cid_principal, episodio_id, leito:leitos!internacoes_leito_atual_id_fkey(identificador), setor_atual_id, episodio:episodios!internacoes_episodio_id_fkey(cor_atual, queixa)')
        .eq('paciente_id', pacienteId)
        .order('data_admissao', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as unknown as Internacao | null
    },
  })
  const i = internacao.data
  const ativa = !!i && ATIVO.includes(i.status)

  // abrir o leito é abrir o prontuário: consulta registrada no servidor
  const prontuario = useQuery({
    queryKey: ['abrir-prontuario', pacienteId, i?.id],
    enabled: !!i,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      await abrirProntuario(pacienteId, i!.id)
      return true
    },
  })
  const acuidade = useQuery({
    queryKey: ['acuidade', pacienteId],
    enabled: ativa,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('acuidade', { p_paciente: pacienteId })
      if (error) throw error
      return data as unknown as Acuidade
    },
  })
  const pendencias = useQuery({
    queryKey: ['pendencias', i?.id],
    enabled: !!i,
    queryFn: async () => {
      const { data, error } = await supabase.from('pendencias').select('*').eq('internacao_id', i!.id).order('criada_em')
      if (error) throw error
      return (data ?? []) as Pendencia[]
    },
  })
  const passagens = useQuery({
    queryKey: ['passagens', i?.id],
    enabled: !!i,
    queryFn: async () => {
      const { data, error } = await supabase.from('passagens_plantao').select('id, de_perfil, para_perfil, resumo, situacao, enviada_em, motivo_recusa').eq('internacao_id', i!.id).order('enviada_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as Passagem[]
    },
  })
  const impeditivos = useQuery({
    queryKey: ['impeditivos', i?.id],
    enabled: ativa,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('impeditivos_alta', { p_internacao: i!.id })
      if (error) throw error
      return (data ?? []) as unknown as { tipo: string; descricao: string }[]
    },
  })
  const pacotes = useQuery({
    queryKey: ['pacotes-alta', i?.id],
    enabled: !!i,
    queryFn: async () => {
      const { data, error } = await supabase.from('pacotes_alta').select('id, situacao, criado_em, expira_em, tentativas').eq('internacao_id', i!.id).order('criado_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as Pacote[]
    },
  })

  const recarregar = () => {
    for (const k of CHAVES_DO_LEITO) void qc.invalidateQueries({ queryKey: [k] })
  }
  const acao: Acao = <T,>(fn: () => Promise<T>, ok?: string) =>
    fn()
      .then((r) => {
        setErro(null)
        setAviso(ok ?? null)
        recarregar()
        return r
      })
      .catch((e) => {
        setAviso(null)
        setErro(msg(e))
        return null
      })

  if (internacao.isLoading) return <Spinner />
  if (!i) return <p className="text-sm text-tinta-sussurro">Sem internação ou observação registrada para este paciente.</p>

  const altaRecente = !ativa && !!i.alta_registrada_em && Date.parse(i.alta_registrada_em) > agora - 24 * 3600_000
  const aoGravarVitais = () => {
    for (const k of ['acuidade', 'tendencia-acuidade', 'vitais-qsofa', 'pendencias', 'alertas-sepse']) void qc.invalidateQueries({ queryKey: [k] })
  }

  const p: PartesLeito = {
    i, ativa, altaRecente, pacienteId, pacienteNome, ehGestor, eu, acao,
    acuidade: acuidade.data, acuidadeCarregando: acuidade.isLoading,
    pendencias: pendencias.data ?? [], passagens: passagens.data ?? [], impeditivos: impeditivos.data ?? [], pacotes: pacotes.data ?? [],
    prontuarioAberto: prontuario.isSuccess, aoGravarVitais, aoErro: setErro,
  }

  const cabecalho = (onClassificacao?: () => void) => (
    // D4: cabeçalho único — leito/setor, nome, idade, sexo, permanência, alergia em
    // três estados, cor da classificação da porta e acuidade. D5: atendimento
    // anterior sem desfecho, na gaveta lateral.
    <CabecalhoPaciente
      pacienteId={pacienteId}
      nome={pacienteNome}
      local={i.leito ? i.leito.identificador : ativa ? 'Aguardando box/leito' : null}
      setorId={i.setor_atual_id}
      desde={ativa ? i.data_admissao : null}
      rotuloDesde={i.status === 'em_observacao' ? 'em observação há' : 'internado há'}
      contexto={`desde ${diaHora(i.data_admissao)}`}
      extra={
        <Badge variant={ativa ? 'info' : 'secondary'}>
          {i.status === 'em_observacao' ? 'Em observação' : ativa ? 'Internado' : 'Alta ' + diaHora(i.data_alta)}
        </Badge>
      }
      corClassificacao={(i.episodio?.cor_atual as CorRisco | null | undefined) ?? null}
      onClassificacao={onClassificacao}
      acuidade={ativa}
      episodios
    />
  )
  const avisos = (
    <>
      {erro && <p role="alert" className="rounded-lg border border-critico/30 bg-critico/[0.08] p-2 text-critico">{erro}</p>}
      {aviso && <p className="rounded-lg border border-conforme/30 bg-conforme/[0.08] p-2 text-conforme">{aviso}</p>}
    </>
  )

  if (modo === 'simples') {
    return (
      <div className="flex flex-col gap-5 text-sm">
        {cabecalho()}
        {avisos}
        <Resumo p={p} />
        {ativa && (
          <Secao titulo="Exames e agravos">
            <ExamesEAgravos pacienteId={pacienteId} medico={!ehGestor} />
          </Secao>
        )}
        <AltaEDocumentos p={p} />
      </div>
    )
  }
  return <Caderno p={p} cabecalho={cabecalho} avisos={avisos} acoesTopo={acoesTopo} />
}

type PartesLeito = {
  i: Internacao
  ativa: boolean
  altaRecente: boolean
  pacienteId: string
  pacienteNome: string
  ehGestor: boolean
  eu?: string
  acao: Acao
  acuidade?: Acuidade
  acuidadeCarregando: boolean
  pendencias: Pendencia[]
  passagens: Passagem[]
  impeditivos: { tipo: string; descricao: string }[]
  pacotes: Pacote[]
  prontuarioAberto: boolean
  aoGravarVitais: () => void
  aoErro: (m: string) => void
  cidSugerido?: string | null
}

/** Aba Resumo (e o corpo do modo simples): acuidade, sepse, pendências, passagem. */
function Resumo({ p }: { p: PartesLeito }) {
  const { i, ativa, ehGestor } = p
  return (
    <>
      {ativa && (
        <BlocoAcuidade a={p.acuidade} carregando={p.acuidadeCarregando} pacienteId={p.pacienteId} internacaoId={i.id}
          podeLancar={!ehGestor} prontuarioAberto={p.prontuarioAberto} perfilId={p.eu} aoGravar={p.aoGravarVitais} aoErro={p.aoErro} />
      )}
      {ativa && p.acuidade?.escala === 'PEWS' && (
        <BlocoSepse a={p.acuidade} pacienteId={p.pacienteId} podeMarcar={!ehGestor} acao={p.acao} />
      )}
      <BlocoPendencias internacaoId={i.id} ativa={ativa} lista={p.pendencias} eu={p.eu} acao={p.acao} />
      {ativa && !ehGestor && <BlocoPassagem i={i} lista={p.passagens} eu={p.eu} acao={p.acao} />}
      {ativa && <PassagensDoPlantao pacienteId={p.pacienteId} />}
    </>
  )
}

/** Aba Alta e documentos (e o fim do modo simples). */
function AltaEDocumentos({ p }: { p: PartesLeito }) {
  const { i, ativa, altaRecente, ehGestor } = p
  return (
    <>
      {ativa && !ehGestor && <BlocoAlta i={i} impeditivos={p.impeditivos} acao={p.acao} cidSugerido={p.cidSugerido} />}
      {!ativa && altaRecente && (i.alta_por === p.eu || ehGestor) && <CancelarAlta i={i} acao={p.acao} />}
      {(ativa || altaRecente || ehGestor) && (
        <BlocoPacote i={i} pacienteId={p.pacienteId} pacienteNome={p.pacienteNome} lista={p.pacotes} podeGerar={!ehGestor && (ativa || altaRecente)} acao={p.acao} />
      )}
      {!ativa && !altaRecente && !ehGestor && <p className="text-apoio text-tinta-sussurro">Alta há mais de 24 horas: o cancelamento é com o gestor.</p>}
    </>
  )
}

function Caderno({ p, cabecalho, avisos, acoesTopo }: {
  p: PartesLeito
  cabecalho: (onClassificacao?: () => void) => React.ReactNode
  avisos: React.ReactNode
  acoesTopo?: React.ReactNode
}) {
  const { i, ativa, ehGestor, pacienteId } = p
  const { unidadeAtiva } = useUnidade()
  const [aba, setAba] = React.useState<IdAba>('resumo')

  const diagnosticos = useDiagnosticos(i.id)
  const vigentes = (diagnosticos.data ?? []).filter((d) => !d.encerrado_em && d.tipo === 'primario')
  const primario = vigentes.find((d) => d.origem === 'internacao') ?? vigentes[0]
  const textoPrimario = primario ? `${primario.cid}${primario.descricao ? ` — ${primario.descricao}` : ''}` : i.cid_principal ?? ''

  const doc = useDocumentosLeito({
    pacienteId, unidadeId: unidadeAtiva?.unidade_id, perfilId: p.eu,
    leito: i.leito?.identificador ?? '', setorId: i.setor_atual_id, diagnostico: textoPrimario,
  })
  const nascimento = useQuery({
    queryKey: ['cabecalho-paciente', pacienteId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('nome, nome_social, data_nascimento, sexo').eq('id', pacienteId).maybeSingle()
      if (error) throw error
      return data
    },
  }).data?.data_nascimento
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const pediatrico = p.acuidade?.escala === 'PEWS' || (!!nascimento && ehPediatrico(nascimento, hoje) === true)

  const escreve = ativa && !ehGestor
  const disponiveis = ABAS.filter(([id]) => escreve || ABAS_LEITURA.includes(id))
  const atual: IdAba = disponiveis.some(([id]) => id === aba) ? aba : 'resumo'
  // CID da alta (decisão do usuário, 29/09/2026): o quadro muda ao longo da
  // internação, então vale o CID da evolução médica mais recente; sem ela, o
  // diagnóstico primário vigente; sem ele, o CID da admissão.
  const cidUltimaEvolucao = useQuery({
    queryKey: ['cid-ultima-evolucao', i.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evolucoes_estruturadas')
        .select('dados, created_at')
        .eq('internacao_id', i.id)
        .eq('tipo_documento', 'evolucao')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      const cid = (data?.dados as { cid?: { codigo?: string } } | undefined)?.cid?.codigo?.trim()
      return cid || null
    },
  }).data
  const pp: PartesLeito = { ...p, cidSugerido: cidUltimaEvolucao ?? primario?.cid ?? i.cid_principal }

  const irNotificacao = () => {
    setAba('exames')
    window.setTimeout(() => document.getElementById('caderno-agravos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      {cabecalho(() => setAba('classif'))}

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Documentos do leito" className="flex flex-1 flex-wrap gap-1.5">
          {disponiveis.map(([id, rotulo, Icone]) => (
            <button key={id} type="button" role="tab" aria-selected={atual === id} aria-controls={`caderno-${id}`}
              onClick={() => setAba(id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-capsula border px-3 py-[5px] text-apoio whitespace-nowrap transition-colors',
                atual === id ? 'border-marca/35 bg-marca/10 font-medium text-acao' : 'border-fio bg-superficie text-tinta-apoio hover:border-marca hover:text-acao',
              )}>
              <Icone className="size-3.5" aria-hidden /> {rotulo}
            </button>
          ))}
        </div>
        {acoesTopo}
      </div>

      {avisos}

      <div id={`caderno-${atual}`} role="tabpanel" className="flex flex-col gap-4">
        {atual === 'resumo' && (
          <>
            <Resumo p={pp} />
            <TrilhaEpisodio pacienteId={pacienteId} />
          </>
        )}
        {atual === 'classif' && <AbaClassificacao internacaoId={i.id} prontuarioAberto={p.prontuarioAberto} />}
        {atual === 'evol' && <AbaEvolucao pacienteId={pacienteId} internacaoId={i.id} />}
        {atual === 'diag' && <AbaDiagnostico internacaoId={i.id} podeEditar={escreve} acao={p.acao} onAbrirNotificacao={irNotificacao} />}
        {atual === 'admissao' && (
          <>
            <ChecklistAdmissao pacienteId={pacienteId} unidadeId={unidadeAtiva?.unidade_id} prontuarioAberto={p.prontuarioAberto} />
            <AbaAdmissao doc={doc} internacaoId={i.id} unidadeId={unidadeAtiva?.unidade_id} />
          </>
        )}
        {atual === 'receituario' && <AbaPrescricao doc={doc} />}
        {atual === 'exames' && <AbaExames doc={doc} pacienteId={pacienteId} medico={!ehGestor} />}
        {atual === 'aih' && <AbaAih doc={doc} />}
        {atual === 'encaminhamento' && <AbaEncaminhamentoInterno pacienteId={pacienteId} episodioId={i.episodio_id} internacaoId={i.id} />}
        {atual === 'atestado' && <AbaAtestado pacienteId={pacienteId} podeEmitir={escreve} />}
        {atual === 'comp' && (
          <>
            <AbaParecer pacienteId={pacienteId} episodioId={i.episodio_id} internacaoId={i.id} />
            <AbaTermoConsentimento pacienteId={pacienteId} episodioId={i.episodio_id} internacaoId={i.id} />
            {pediatrico && <AbaAvaliacaoCrescimento pacienteId={pacienteId} episodioId={i.episodio_id} internacaoId={i.id} />}
          </>
        )}
        {atual === 'alta' && (
          <>
            {ativa && p.impeditivos.length === 0 && !ehGestor && (
              <p className="text-apoio text-tinta-sussurro">Sem impeditivos: a alta pode ser dada.</p>
            )}
            <AltaEDocumentos p={pp} />
          </>
        )}
      </div>
    </div>
  )
}
