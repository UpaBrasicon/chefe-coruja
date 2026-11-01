// ─────────────────────────────────────────────────────────────────────────────
// LeitoAberto — o CADERNO DO LEITO (protótipo, index.html 2640–3142).
//
// Cabeçalho único do paciente no topo e as abas do protótipo (LEITO_ABAS):
// Resumo (em sub-abas, ponto 6), Evolução (com o Diagnóstico dentro, ponto 9), Admissão,
// Prescrição, Exames, AIH, Encaminhamento, Atestado, Parecer e termos, Alta e
// documentos. As peças
// moram em ./caderno; toda regra mora no servidor, aqui só se mostra e se pede.
//
// modo="simples" (o padrão, usado pela observação) é o leito de antes, sem
// abas: acuidade, vitais, pendências, exames, passagem, alta e pacote.
//
// Revisão visual 3.5 (opção B do RT com ressalvas, 26/10/2026): no caderno, o
// cabeçalho sem cartão com transferir de setor no canto direito; as abas numa
// linha só, sublinhadas; embaixo, a aba à esquerda e o painel Paciente à direita,
// começando na mesma altura.
//
// Pontos 6 a 8 do plantonista (RT, 29/10/2026): o Resumo em quatro sub-abas
// (Agora, Pendências, Histórico na unidade, Regulações); transferir, passar e
// registrar intercorrência juntos no cabeçalho, só para quem cuida da
// internação ativa; a aba Classificação saiu — a cor abre o histórico numa janela.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, ArrowRightLeft, Handshake, History, ListTodo, Printer, Siren, Waypoints } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { HistoricoEncerrado } from '@/components/prontuario/HistoricoEncerrado'
import { HistoricoRegulacao } from '@/components/regulacao/HistoricoRegulacao'
import { DialogoIntercorrencia, Intercorrencias } from '@/components/prontuario/Intercorrencias'
import { ReentradaContingencia } from '@/components/prontuario/ReentradaContingencia'
import { supabase } from '@/lib/supabase'
import { abrirProntuario } from '@/lib/prontuario'
import { abaDoEndereco, type AcaoLeito, acoesDoLeito, rotuloPendencias, type SubResumo, subResumoInicial } from '@/lib/acoesLeito'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import type { CorRisco } from '@/domain/risco'
import { ExamesEAgravos } from '@/components/clinico/ExamesEAgravos'
import { CabecalhoPaciente } from '@/components/paciente/CabecalhoPaciente'
import { BotaoRnDaMae } from '@/components/paciente/CadastroRn'
import { AbaAvaliacaoCrescimento } from '@/components/avaliacao/AbaAvaliacaoCrescimento'
import { AbaEncaminhamento } from '@/components/encaminhamento/AbaEncaminhamento'
import { AbaEvolucao } from '@/components/evolucao/AbaEvolucao'
import { AbaParecer } from '@/components/parecer/AbaParecer'
import { AbaTermoConsentimento } from '@/components/termo/AbaTermoConsentimento'
import { AbaCuidadosPaliativos } from '@/components/paliativo/AbaCuidadosPaliativos'
import { PassagensDoPlantao } from '@/components/internacao/PassagensDoPlantao'
import { Estado } from '@/components/porta/Estado'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'

import { BlocoAcuidade } from './caderno/Acuidade'
import { BlocoAlta, BlocoPacote, CancelarAlta } from './caderno/Alta'
import { Secao } from './caderno/caixas'
import { DialogoClassificacao } from './caderno/Classificacao'
import {
  type Acao, type Acuidade, ATIVO, diaHora, type Internacao, msg, type Pacote, type Passagem, type Pendencia,
} from './caderno/comum'
import { useDiagnosticos } from './caderno/diagnosticos'
import { AbaAdmissao, AbaAih, AbaApac, AbaExames, AbaPrescricao } from './caderno/Documentos'
import { PassosAlta } from './caderno/PassosAlta'
import { DOCS_INICIAL, type EstadoDocs } from '@/lib/documentosAlta'
import { useDocumentosLeito } from './caderno/rascunhoLeito'
import { PainelPaciente } from './caderno/PainelPaciente'
import { BlocoPassagem, DialogoPassagem } from './caderno/Passagem'
import { BlocoPendencias } from './caderno/Pendencias'
import { BlocoSepse } from './caderno/Sepse'
import { ChecklistAdmissao, TrilhaEpisodio } from './caderno/Trilha'

export { SepsePorta } from './caderno/Sepse'

type IdAba = 'resumo' | 'evol' | 'admissao' | 'receituario' | 'exames' | 'aih' | 'apac' | 'encaminhamento' | 'parecer' | 'termo' | 'paliativos' | 'escalas' | 'alta'

// LEITO_ABAS do protótipo (index.html ~21611), na mesma ordem.
const ABAS: [IdAba, string][] = [
  ['resumo', 'Resumo'],
  ['evol', 'Evolução'],
  ['admissao', 'Admissão'],
  ['receituario', 'Prescrição'],
  ['exames', 'Exames'],
  ['aih', 'AIH'],
  ['apac', 'APAC'],
  ['encaminhamento', 'Encaminhamento'],
  // ponto 15: Parecer, Termo de consentimento, Cuidados paliativos e Escalas (antes, "Parecer e termos")
  ['parecer', 'Parecer'],
  ['termo', 'Termo de consentimento'],
  ['paliativos', 'Cuidados paliativos'],
  ['escalas', 'Escalas'],
  ['alta', 'Alta e documentos'],
]
/**
 * O que se lê sem escrever: gestor, e o leito depois da alta. O Diagnóstico
 * agora mora dentro de Evolução (ponto 9), que entra aqui em leitura. A
 * Classificação deixou de ser aba (ponto 8): a cor do cabeçalho abre a janela.
 */
const ABAS_LEITURA: IdAba[] = ['resumo', 'evol', 'alta']

const CHAVES_DO_LEITO = [
  'leito-aberto', 'acuidade', 'tendencia-acuidade', 'vitais-qsofa', 'pendencias', 'passagens', 'impeditivos', 'pacotes-alta',
  'pacientes-internados', 'internados-leitos', 'pendencias-lista', 'diagnosticos-leito', 'diagnosticos-lista', 'altas-recentes',
  'ocupacao-setores', 'pendencias-observacao', 'alertas-sepse',
]

export function LeitoAberto({ pacienteId, pacienteNome, ehGestor, modo = 'simples', onTransferir, abaInicial }: {
  pacienteId: string
  pacienteNome: string
  ehGestor: boolean
  /** "caderno": as 12 abas do protótipo; "simples": o leito sem abas (observação). */
  modo?: 'simples' | 'caderno'
  /** Transferir de setor (a lista de internados sabe); o botão fica no cabeçalho do caderno. */
  onTransferir?: () => void
  /** Aba do caderno que abre primeiro (endereço do leito com ?aba=). */
  abaInicial?: string
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
        .select('id, status, data_admissao, internado_em, data_alta, alta_registrada_em, alta_por, cid_alta, cid_principal, episodio_id, leito:leitos!internacoes_leito_atual_id_fkey(identificador), setor_atual_id, episodio:episodios!internacoes_episodio_id_fkey(cor_atual, queixa)')
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
  if (!i) return <p className="text-apoio text-tinta-sussurro">Sem internação ou observação registrada para este paciente.</p>

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

  const cabecalho = (onClassificacao?: () => void, compacto = false, acoes?: React.ReactNode) => (
    // D4: cabeçalho único — leito/setor, nome, idade, sexo, permanência, alergia em
    // três estados, cor da classificação da porta e acuidade. D5: atendimento
    // anterior sem desfecho, na gaveta lateral.
    <CabecalhoPaciente
      pacienteId={pacienteId}
      nome={pacienteNome}
      local={i.leito ? i.leito.identificador : ativa ? 'Aguardando box/leito' : null}
      setorId={i.setor_atual_id}
      // internado há: da conversão quando veio da observação (correções do portão, tarefa 4)
      desde={ativa ? (i.status === 'em_observacao' ? i.data_admissao : i.internado_em ?? i.data_admissao) : null}
      rotuloDesde={i.status === 'em_observacao' ? 'em observação há' : 'internado há'}
      contexto={i.status !== 'em_observacao' && i.internado_em && i.internado_em !== i.data_admissao
        ? `internado em ${diaHora(i.internado_em)} · na unidade desde ${diaHora(i.data_admissao)}`
        : `desde ${diaHora(i.data_admissao)}`}
      extra={
        <>
          <Estado tom={i.status === 'em_observacao' ? 'ambar' : ativa ? 'teal' : 'cinza'}>
            {i.status === 'em_observacao' ? 'Em observação' : ativa ? 'Internado' : 'Alta ' + diaHora(i.data_alta)}
          </Estado>
          {/* Portão 2, tarefa 5: recém-nascido cadastrado a partir do leito da mãe */}
          {ativa && <BotaoRnDaMae maeId={pacienteId} maeNome={pacienteNome} />}
          {/* ponto 5: a impressão de prontuário abre daqui, com o paciente escolhido */}
          {!ehGestor && (
            <Button size="sm" variant="outline" render={<Link to={`/impressao-prontuario?paciente=${pacienteId}`} />}>
              <Printer /> Imprimir prontuário
            </Button>
          )}
        </>
      }
      corClassificacao={(i.episodio?.cor_atual as CorRisco | null | undefined) ?? null}
      onClassificacao={onClassificacao}
      acuidade={ativa}
      episodios
      compacto={compacto}
      semCartao={!compacto}
      acao={compacto ? acoes : undefined}
    />
  )
  const avisos = (
    <>
      {erro && <p role="alert" className="rounded-controle border border-critico/30 bg-alerta-critico p-2 text-critico">{erro}</p>}
      {aviso && <p className="rounded-controle border border-conforme/30 bg-alerta-conforme p-2 text-conforme">{aviso}</p>}
    </>
  )

  if (modo === 'simples') {
    return (
      <div className="flex flex-col gap-5 text-apoio">
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
  return <Caderno p={p} cabecalho={cabecalho} avisos={avisos} abaInicial={abaInicial} onTransferir={onTransferir} />
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
  const unidadeResumo = useUnidade().unidadeAtiva?.unidade_id
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
      {/* Fase 1, tarefa 8: atendimentos encerrados do paciente, para quem cuida */}
      {ativa && <HistoricoEncerrado pacienteId={p.pacienteId} />}
      {/* Fase 4, tarefa 5: regulações do paciente na rede (médico e gestor) */}
      <HistoricoRegulacao pacienteId={p.pacienteId} />
      {/* Fase 1, tarefa 12: reentrada de contingência do atendimento que gerou a internação */}
      {unidadeResumo && i.episodio_id && <ReentradaContingencia unidadeId={unidadeResumo} episodioId={i.episodio_id} chegadaEm={i.data_admissao} />}
      {/* Fase 2, tarefa 4: intercorrência estruturada, ligada à internação */}
      <Intercorrencias pacienteId={p.pacienteId} internacaoId={ativa ? i.id : null} episodioId={ativa ? i.episodio_id : null} />
    </>
  )
}

const SUBS_RESUMO: { id: SubResumo; Icone: typeof Activity }[] = [
  { id: 'agora', Icone: Activity },
  { id: 'pendencias', Icone: ListTodo },
  { id: 'historico', Icone: History },
  { id: 'regulacoes', Icone: Waypoints },
]

/**
 * Aba Resumo do caderno em sub-abas (ponto 6, opção A do RT): Agora (o que muda
 * no plantão), Pendências, Histórico na unidade (a trilha desta internação e os
 * atendimentos anteriores) e Regulações. O modo simples segue com o Resumo inteiro.
 */
function ResumoEmAbas({ p }: { p: PartesLeito }) {
  const { i, ativa, ehGestor } = p
  const unidadeResumo = useUnidade().unidadeAtiva?.unidade_id
  const [sub, setSub] = React.useState<SubResumo>(() => subResumoInicial(ativa))
  const rotulo: Record<SubResumo, string> = {
    agora: 'Agora', pendencias: rotuloPendencias(p.pendencias), historico: 'Histórico na unidade', regulacoes: 'Regulações',
  }
  return (
    <div className="flex flex-col">
      <div role="tablist" aria-label="Resumo" className="mb-3.5 flex flex-wrap gap-1.5">
        {SUBS_RESUMO.map(({ id, Icone }) => (
          // a mesma subaba da Evolução: o Button no papel de aba
          <Button key={id} role="tab" aria-selected={sub === id} onClick={() => setSub(id)}
            variant={sub === id ? 'default' : 'outline'}
            className={cn('min-h-10 px-3.5 py-2 text-controle', sub === id && 'border-acao')}>
            <Icone className="size-[15px]" aria-hidden /> {rotulo[id]}
          </Button>
        ))}
      </div>
      <div role="tabpanel" className="flex min-w-0 flex-col gap-4">
        {sub === 'agora' && (
          <>
            {!ativa && <p className="text-apoio text-tinta-sussurro">Internação encerrada: aqui ficam só as intercorrências registradas.</p>}
            {ativa && (
              <BlocoAcuidade a={p.acuidade} carregando={p.acuidadeCarregando} pacienteId={p.pacienteId} internacaoId={i.id}
                podeLancar={!ehGestor} prontuarioAberto={p.prontuarioAberto} perfilId={p.eu} aoGravar={p.aoGravarVitais} aoErro={p.aoErro} />
            )}
            {ativa && p.acuidade?.escala === 'PEWS' && (
              <BlocoSepse a={p.acuidade} pacienteId={p.pacienteId} podeMarcar={!ehGestor} acao={p.acao} />
            )}
            {ativa && !ehGestor && <BlocoPassagem i={i} lista={p.passagens} eu={p.eu} acao={p.acao} semBotao />}
            {ativa && <PassagensDoPlantao pacienteId={p.pacienteId} />}
            {/* Fase 1, tarefa 12: reentrada de contingência do atendimento que gerou a internação */}
            {unidadeResumo && i.episodio_id && <ReentradaContingencia unidadeId={unidadeResumo} episodioId={i.episodio_id} chegadaEm={i.data_admissao} />}
            {/* registrar é pelo cabeçalho (ponto 7); aqui a lista e o Retificar */}
            <Intercorrencias pacienteId={p.pacienteId} internacaoId={ativa ? i.id : null} episodioId={ativa ? i.episodio_id : null} semBotao />
          </>
        )}
        {sub === 'pendencias' && <BlocoPendencias internacaoId={i.id} ativa={ativa} lista={p.pendencias} eu={p.eu} acao={p.acao} />}
        {sub === 'historico' && (
          <>
            <TrilhaEpisodio pacienteId={p.pacienteId} />
            {/* Fase 1, tarefa 8: atendimentos encerrados do paciente, para quem cuida */}
            {ativa && <HistoricoEncerrado pacienteId={p.pacienteId} />}
          </>
        )}
        {/* Fase 4, tarefa 5: regulações do paciente na rede (médico e gestor) */}
        {sub === 'regulacoes' && <HistoricoRegulacao pacienteId={p.pacienteId} />}
      </div>
    </div>
  )
}

const ICONE_ACAO: Record<AcaoLeito, typeof Activity> = { transferir: ArrowRightLeft, passar: Handshake, intercorrencia: Siren }

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

function Caderno({ p, cabecalho, avisos, abaInicial, onTransferir }: {
  abaInicial?: string
  p: PartesLeito
  cabecalho: (onClassificacao?: () => void, compacto?: boolean, acoes?: React.ReactNode) => React.ReactNode
  avisos: React.ReactNode
  onTransferir?: () => void
}) {
  const { i, ativa, ehGestor, pacienteId } = p
  const { unidadeAtiva } = useUnidade()
  // link antigo para a aba Diagnóstico abre Evolução › Diagnóstico (ponto 9)
  // receita e atestado em curso na Alta e documentos: ficam enquanto o leito está aberto
  const [docsAlta, setDocsAlta] = React.useState<EstadoDocs>(DOCS_INICIAL)
  // link antigo para a aba Classificação abre o Resumo com a janela (ponto 8)
  const endereco = abaDoEndereco(abaInicial)
  const [aba, setAba] = React.useState<IdAba>(() => (ABAS.some(([id]) => id === endereco.aba) ? endereco.aba as IdAba : 'resumo'))
  const [janela, setJanela] = React.useState<'classificacao' | 'passar' | 'intercorrencia' | null>(endereco.classificacao ? 'classificacao' : null)

  const diagnosticos = useDiagnosticos(i.id)
  const vigentes = (diagnosticos.data ?? []).filter((d) => !d.encerrado_em && d.tipo === 'primario')
  const primario = vigentes.find((d) => d.origem === 'internacao') ?? vigentes[0]
  const textoPrimario = primario ? `${primario.cid}${primario.descricao ? ` — ${primario.descricao}` : ''}` : i.cid_principal ?? ''

  const doc = useDocumentosLeito({
    pacienteId, unidadeId: unidadeAtiva?.unidade_id, perfilId: p.eu,
    leito: i.leito?.identificador ?? '', setorId: i.setor_atual_id, diagnostico: textoPrimario,
  })

  const escreve = ativa && !ehGestor
  const disponiveis = ABAS.filter(([id]) => escreve || ABAS_LEITURA.includes(id))
  const atual: IdAba = disponiveis.some(([id]) => id === aba) ? aba : 'resumo'
  // CID da alta (decisão do usuário, 29/09/2026): o quadro muda ao longo da
  // internação. Desde o ponto 9 (RT, 28/10/2026) o diagnóstico muda só na
  // subaba Diagnóstico, e a evolução grava o retrato dele: vale o primário
  // vigente; sem ele, o CID da evolução mais recente (evoluções de antes);
  // sem ela, o CID da admissão.
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
  const pp: PartesLeito = { ...p, cidSugerido: primario?.cid ?? cidUltimaEvolucao ?? i.cid_principal }

  // ponto 7: transferir, passar e intercorrência juntos no cabeçalho
  const acoesTopo = acoesDoLeito({ ativa, ehGestor, podeTransferir: !!onTransferir, passagens: p.passagens }).map((a) => {
    const Icone = ICONE_ACAO[a.id]
    return (
      <Button key={a.id} size="xs" variant="outline" disabled={!!a.bloqueio} title={a.bloqueio ?? undefined}
        onClick={() => (a.id === 'transferir' ? onTransferir?.() : setJanela(a.id))}>
        <Icone /> {a.rotulo}
      </Button>
    )
  })

  const irNotificacao = () => {
    setAba('exames')
    window.setTimeout(() => document.getElementById('caderno-agravos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  return (
    <div className="flex flex-col gap-3.5 border-t border-fio pt-3.5 text-apoio">
      {cabecalho(() => setJanela('classificacao'), true, acoesTopo.length > 0 ? acoesTopo : undefined)}

      {/* abas numa linha só; na tela estreita a linha rola para o lado */}
      <Tabs value={atual} onValueChange={(v) => setAba(v as IdAba)}>
        <TabsList aria-label="Documentos do leito" className="gap-3.5">
          {disponiveis.map(([id, rotulo]) => (
            <TabsTrigger key={id} value={id} className="shrink-0">{rotulo}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {avisos}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div id={`caderno-${atual}`} role="tabpanel" className="flex min-w-0 flex-col gap-4">
        {atual === 'resumo' && <ResumoEmAbas p={pp} />}
        {atual === 'evol' && (
          <AbaEvolucao pacienteId={pacienteId} internacaoId={i.id} somenteLeitura={!escreve}
            subInicial={abaInicial === 'diag' ? 'diagnostico' : undefined}
            diagnostico={{ podeEditar: escreve, acao: p.acao, onAbrirNotificacao: irNotificacao }} />
        )}
        {atual === 'admissao' && (
          <>
            <ChecklistAdmissao pacienteId={pacienteId} unidadeId={unidadeAtiva?.unidade_id} prontuarioAberto={p.prontuarioAberto} />
            <AbaAdmissao doc={doc} internacaoId={i.id} unidadeId={unidadeAtiva?.unidade_id} />
          </>
        )}
        {atual === 'receituario' && <AbaPrescricao doc={doc} />}
        {atual === 'exames' && <AbaExames internacaoId={i.id} pacienteId={pacienteId} medico={!ehGestor} />}
        {atual === 'aih' && <AbaAih doc={doc} internacaoId={i.id} />}
        {atual === 'apac' && <AbaApac doc={doc} internacaoId={i.id} />}
        {/* ponto 13: dentro da unidade ou para outra unidade (SMS003a ligado à internação) */}
        {atual === 'encaminhamento' && <AbaEncaminhamento pacienteId={pacienteId} episodioId={i.episodio_id} internacaoId={i.id} leito={i.leito?.identificador ?? ''} />}
        {atual === 'parecer' && <AbaParecer pacienteId={pacienteId} episodioId={i.episodio_id} internacaoId={i.id} />}
        {atual === 'termo' && <AbaTermoConsentimento pacienteId={pacienteId} episodioId={i.episodio_id} internacaoId={i.id} />}
        {atual === 'paliativos' && <AbaCuidadosPaliativos pacienteId={pacienteId} episodioId={i.episodio_id} internacaoId={i.id} podeRegistrar={escreve} />}
        {/* a própria aba escolhe as escalas pela idade (NIPS/FLACC ou Braden/Morse; sem nascimento, avisa) */}
        {atual === 'escalas' && <AbaAvaliacaoCrescimento pacienteId={pacienteId} episodioId={i.episodio_id} internacaoId={i.id} />}
        {/* pontos 14 e 16: receita para casa, atestado, orientações e alta, em passos */}
        {atual === 'alta' && (
          <PassosAlta i={i} pacienteId={pacienteId} pacienteNome={p.pacienteNome} ativa={ativa} altaRecente={pp.altaRecente} ehGestor={ehGestor}
            eu={p.eu ?? null} acao={p.acao} impeditivos={p.impeditivos} pacotes={p.pacotes} cidSugerido={pp.cidSugerido ?? null}
            leito={i.leito?.identificador ?? ''} diagnostico={textoPrimario} estado={docsAlta} setEstado={setDocsAlta} />
        )}
      </div>
      <PainelPaciente i={i} ativa={ativa} acuidade={p.acuidade} diagnostico={textoPrimario} onClassificacao={() => setJanela('classificacao')}
        acoes={ativa ? <BotaoRnDaMae maeId={pacienteId} maeNome={p.pacienteNome} /> : undefined} />
      </div>

      {janela === 'classificacao' && (
        <DialogoClassificacao internacaoId={i.id} prontuarioAberto={p.prontuarioAberto} aoFechar={() => setJanela(null)} />
      )}
      {janela === 'passar' && <DialogoPassagem i={i} acao={p.acao} aoFechar={() => setJanela(null)} />}
      {janela === 'intercorrencia' && (
        <DialogoIntercorrencia pacienteId={pacienteId} episodioId={i.episodio_id} internacaoId={i.id} retifica={null} aoFechar={() => setJanela(null)} />
      )}
    </div>
  )
}
