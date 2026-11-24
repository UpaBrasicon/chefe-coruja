// ─────────────────────────────────────────────────────────────────────────────
// Regulação (Fase 4, tarefa 1; decisões do RT de 10/10/2026, revistas em
// 11/10/2026 depois da pesquisa dos sistemas de regulação).
//
// • Super admin: define a Central de Regulação de cada organização.
// • Unidade de origem (médico ou gestor): abre a solicitação (consulta, exame,
//   leito, transferência) com os campos do MIRA — procedimento SIGTAP, caráter,
//   CID-10, CBO na consulta —, prioridade (4 níveis ou não classificada) e o
//   quadro clínico em blocos; liga ou não a um atendimento/internação aberta;
//   acompanha e cancela com motivo.
// • Central (regulador): fila ordenada (não classificadas no topo, depois
//   prioridade e espera), com filtros, busca, "Assumir" e "Devolver à fila",
//   atualizada a cada 30 s (tarefa 2); anota a regulação externa e a
//   prioridade da central. A decisão é a tarefa 4.
// • Prazos (tarefa 7): painel de SLA na central e na origem, prazos da
//   central, selos na fila e na lista, tempo por status e evolução no detalhe
//   (src/components/regulacao/SlaRegulacao.tsx).
// • Mapa de vagas (tarefa 8): na central e para o gestor da unidade, que
//   oferta os setores e informa os serviços; ao lado da autorização
//   (src/components/regulacao/MapaVagas.tsx).
// • Aceite pelo destino (tarefa 9): o destino aceita ou recusa e marca a
//   chegada; a origem marca a saída; a central registra o destino de fora
//   (src/components/regulacao/DestinoRegulacao.tsx).
// • Indicadores (tarefa 10): aba para a central e para o gestor da unidade
//   (src/components/regulacao/IndicadoresRegulacao.tsx).
// Migration 20261107000001_regulacao_solicitacao.sql; src/lib/regulacao.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Paperclip, Plus, Send, Waypoints, X } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { ESPECIALIDADES } from '@/components/encaminhamento/useEncaminhamentos'
import { AnexosRegulacao } from '@/components/regulacao/AnexosRegulacao'
import { LeituraTransferencia } from '@/components/transferencia/DocumentoTransferencia'
import { IndicadoresRegulacao } from '@/components/regulacao/IndicadoresRegulacao'
import { AcoesDestino, BlocoDestino, DestinoExterno, RecebidosDestino, SaidaOrigem, type PedidoDestino } from '@/components/regulacao/DestinoRegulacao'
import { MapaVagas, OfertaSetores } from '@/components/regulacao/MapaVagas'
import { FormEvolucao, PainelSla, PrazosCentral, SeloSla, type Evolucao } from '@/components/regulacao/SlaRegulacao'
import { LinhaDoTempoPedido } from '@/components/regulacao/LinhaDoTempoPedido'
import { DialogoMotivo, ListaComPainel, MenuAcoesPedido } from '@/components/regulacao/PainelPedido'
import { Abas, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { BuscaTerminologia } from '@/components/terminologia/BuscaTerminologia'
import { AreaDeAnexo } from '@/components/ui/area-de-anexo'
import { Badge } from '@/components/ui/badge'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useValorAdiado } from '@/hooks/useValorAdiado'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { dataIso } from '@/lib/formato'
import {
  CARATER, FORMULARIO_VAZIO, INTERNACAO_PSIQUIATRICA, ISOLAMENTOS, PRIORIDADES, STATUS, TIPOS, TIPOS_LEITO, TRANSPORTES,
  ANEXO_LIMITE_BYTES, ANEXO_TIPOS, MOTIVOS_NEGACAO, VULNERABILIDADES, caminhoAnexo, dadosParaEnvio, dataHoraLocalParaIso, ehNeonato, emDecisao, faltasFormulario,
  filtrosParaEnvio, formatarEspera, marcadoresPelaIdade,
  erroArquivo, novosDesde, prioridadeEfetiva, resumoPedido,
  type Carater, type DestinoTipo, type FiltrosFila, type Formulario, type Prioridade, type StatusRegulacao, type TipoSolicitacao,
  type MotivoNegacao, type Sla, type Vulnerabilidade,
} from '@/lib/regulacao'
import { esperandoDecisao, montarLinhaDoTempo } from '@/lib/regulacaoLinhaTempo'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Json } from '@/types/database'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'

type Ref = { id: string; nome: string }
type Contexto = {
  central: Ref | null; sou_central: boolean; pode_solicitar: boolean; sou_regulador: boolean; sou_super_admin: boolean
  unidades_rede: Ref[]
}
type Solicitacao = Omit<PedidoDestino, 'destino_tipo' | 'destino_unidade' | 'destino_externo'> & {
  id: string; numero: number; status: StatusRegulacao; tipo: TipoSolicitacao; carater: Carater; modalidade: string
  prioridade: Prioridade; prioridade_central: string | null
  prioridade_regulador: Prioridade | null; prioridade_regulador_por: string | null; prioridade_regulador_em: string | null
  prioridade_regulador_motivo: string | null; vulnerabilidades: Vulnerabilidade[]
  autorizada_em: string | null; autorizada_por: string | null; data_prevista: string | null; observacao_decisao: string | null
  negada_em: string | null; negada_por: string | null; motivo_negacao: MotivoNegacao | null
  devolvida_em: string | null; devolvida_por: string | null; motivo_devolucao: string | null; reenviada_em: string | null
  pendencia_pergunta: string | null; pendencia_em: string | null; pendencia_por: string | null
  pendencia_resposta: string | null; pendencia_respondida_em: string | null; pendencia_respondida_por: string | null
  origem_pode_responder: boolean
  procedimento: string; procedimento_nome: string | null; especialidade: string | null; cbo: string | null
  tipo_leito: string | null; internacao_psiquiatrica: string | null; isolamento: boolean; isolamento_tipo: string | null
  transporte: string | null; transporte_central: string | null; incubadora: boolean | null
  destino_tipo: DestinoTipo; destino_unidade: Ref | null; destino_externo: string | null
  cid: string; cid_descricao: string | null
  quadro_clinico: string; tempo_evolucao: string | null; sinais_vitais: string | null; exames: string | null
  medicacoes: string | null; hipotese: string | null; telefone_contato: string | null
  paciente: { id: string; nome: string; nascimento: string | null; sexo: string | null; cns: string | null
    /** Portão 2, tarefa 5: recém-nascido vinculado à mãe (documento dela) */
    mae?: { nome: string; cns: string | null; cpf: string | null } | null }
  paciente_nao_identificado: boolean
  episodio_id: string | null; internacao_id: string | null; origem: Ref; cnes_solicitante: string; central: Ref
  solicitante: string | null; solicitante_papel: 'medico' | 'gestor'; medico_assistente: string | null
  externo_sistema: string | null; externo_protocolo: string | null
  criada_em: string; cancelada_em: string | null; cancelamento_origem: string | null; motivo_cancelamento: string | null
  eventos?: { evento: string; por: string | null; em: string; detalhes: Record<string, unknown> | null }[]
  sla: Sla | null
  tempos?: { status: StatusRegulacao; segundos: number; vezes: number; atual: boolean }[]
  evolucoes?: Evolucao[]; pode_evoluir?: boolean
}

const TOM: Record<string, 'destructive' | 'warning' | 'info' | 'secondary'> = {
  critico: 'destructive', atencao: 'warning', info: 'info', neutro: 'secondary',
}
const hoje = () => dataIso()

// RN vinculado à mãe: a regulação o identifica pelo CNS/CPF da mãe (Portão 2, tarefa 5)
const docMae = (m?: { nome: string; cns: string | null; cpf: string | null } | null) =>
  m ? ` · mãe: ${m.nome}${m.cns ? ` · CNS ${m.cns}` : m.cpf ? ` · CPF ${m.cpf}` : ' · sem documento'}` : ''

/**
 * Abas do quadro (MR2 = A, RT 24/11/2026). Na origem: Esperando decisão (com o
 * prazo), Enviados (o resto, sem repetir os que esperam), Recebidos da central
 * e Mapa de vagas. Na central: Esperando decisão (a fila), Mapa de vagas e
 * Prazos e critérios. Indicadores para a central e o gestor.
 */
type AbaQuadro = 'esperando' | 'enviados' | 'recebidos' | 'mapa' | 'config' | 'indicadores'

export default function Regulacao() {
  const { unidadeAtiva, papeisDaUnidade, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id ?? ''
  const souGestorDaUnidade = papeisDaUnidade.includes('gestor')
  const [aba, setAba] = React.useState<AbaQuadro>('esperando')
  // RD1: o pedido aberto fica no painel ao lado da lista
  const [aberto, setAberto] = React.useState<string | null>(null)
  const trocarAba = (a: AbaQuadro) => { setAba(a); setAberto(null) }
  // MR2: no perfil regulador, "Nova solicitação" é um botão no topo; nos outros
  // perfis o formulário continua aberto de saída, como antes
  const [novaAberta, setNovaAberta] = React.useState(papelAtivo !== 'regulador')
  const abrirEnviada = (id: string) => { setAba('esperando'); setAberto(id) }
  // 5A, tarefa 5 (H2): vindo da consulta da UBS, o formulário abre preenchido
  const [busca] = useSearchParams()
  const pacienteUrl = busca.get('paciente')
  const daUrl = useQuery({
    queryKey: ['regulacao-paciente-url', pacienteUrl],
    enabled: !!pacienteUrl,
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('id, nome, nome_social, data_nascimento, prontuario').eq('id', pacienteUrl!).maybeSingle()
      if (error) throw error
      return data as Paciente | null
    },
  })
  const tipoUrl = busca.get('tipo')
  const inicial: InicialSolicitacao | undefined = daUrl.data ? {
    paciente: daUrl.data,
    tipo: tipoUrl === 'consulta' || tipoUrl === 'exame' || tipoUrl === 'leito' ? tipoUrl : undefined,
    cid: busca.get('cid') ?? undefined, quadro: busca.get('quadro') ?? undefined, hipotese: busca.get('hipotese') ?? undefined,
  } : undefined
  const ctx = useQuery({
    queryKey: ['regulacao-contexto', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_contexto', { p_unidade: unidadeId })
      if (error) throw error
      return data as unknown as Contexto
    },
  })
  const c = ctx.data
  const comIndicadores = !!c && (c.sou_central || (!!c.central && souGestorDaUnidade))
  const origem = !!c && !c.sou_central && !!c.central && c.pode_solicitar
  const contas = useContasQuadro(unidadeId, !!c && (c.sou_central || origem), origem)
  const abas: [AbaQuadro, string, number | undefined][] = !c ? [] : c.sou_central ? [
    ['esperando', 'Esperando decisão', contas.esperando], ['mapa', 'Mapa de vagas', undefined], ['config', 'Prazos e critérios', undefined],
  ] : origem ? [
    ['esperando', 'Esperando decisão', contas.esperando], ['enviados', 'Enviados', contas.enviados], ['recebidos', 'Recebidos da central', contas.recebidos],
    ...(souGestorDaUnidade ? [['mapa', 'Mapa de vagas', undefined] as [AbaQuadro, string, undefined]] : []),
  ] : []
  if (comIndicadores) abas.push(['indicadores', 'Indicadores', undefined])
  const abaVale = abas.some(([k]) => k === aba) ? aba : 'esperando'
  // o detalhe é o mesmo nas abas; muda só o lado de quem vê
  const painel = (id: string) => (
    <Detalhe key={id} id={id} unidadeId={unidadeId} central={!!c?.sou_central} podeRegistrarExterno={!!c?.sou_central && !!c?.sou_regulador}
      aoFechar={() => setAberto(null)} />
  )
  const comPainel = (lista: React.ReactNode) => (
    <ListaComPainel lista={lista} aberto={aberto} painel={painel} aoFechar={() => setAberto(null)} rotulo="Pedido de regulação aberto" />
  )
  return (
    <div className={cn('flex w-full flex-col gap-4', aberto ? 'max-w-7xl' : 'max-w-5xl')}>
      <TituloPagina icone={Waypoints} titulo="Regulação"
        descricao={c?.sou_central
          ? 'Solicitações recebidas pela Central de Regulação da rede.'
          : 'Pedidos de consulta, exame, leito ou transferência para a Central de Regulação da rede.'}
        acoes={origem && !novaAberta && !inicial ? <Button onClick={() => setNovaAberta(true)}><Plus /> Nova solicitação</Button> : undefined} />
      {c?.sou_super_admin && <Centrais />}
      {!unidadeId ? null : ctx.isLoading ? <Spinner /> : ctx.error ? <MensagemErro texto={(ctx.error as Error).message} /> : !c ? null
        : !c.sou_central && !c.central ? (
          <Vazio icone={Waypoints} titulo="A rede ainda não tem Central de Regulação"
            texto="A administração da plataforma define a central da organização. Até lá, não há para onde enviar." />
        ) : !c.sou_central && !c.pode_solicitar ? (
          <Vazio icone={Waypoints} titulo="Sem acesso à regulação nesta unidade" texto="Solicitam o médico e o gestor da unidade; quem regula é a central da rede." />
        ) : (
          <>
            {origem && (novaAberta || inicial) && (
              <div className="flex flex-col gap-2">
                <NovaSolicitacao key={inicial?.paciente.id ?? 'nova'} unidadeId={unidadeId} ctx={c} aoEnviar={abrirEnviada} inicial={inicial} />
                {!inicial && <Button variant="ghost" size="sm" className="self-start" onClick={() => setNovaAberta(false)}>Fechar a nova solicitação</Button>}
              </div>
            )}
            <Abas abas={abas} valor={abaVale} onChange={trocarAba} rotulo="Regulação" className="mb-0" />
            {abaVale === 'indicadores' ? (
              <IndicadoresRegulacao unidadeId={unidadeId} unidades={c.sou_central ? c.unidades_rede : []} />
            ) : abaVale === 'mapa' ? (
              <>
                <MapaVagas unidadeId={unidadeId} />
                {!c.sou_central && <OfertaSetores unidadeId={unidadeId} />}
              </>
            ) : abaVale === 'config' ? (
              <>
                <PrazosCentral unidadeId={unidadeId} editavel />
                <Criterios unidadeId={unidadeId} editavel />
              </>
            ) : c.sou_central ? comPainel(
              <Fila centralId={unidadeId} souRegulador={c.sou_regulador} selecionado={aberto} aoSelecionar={setAberto} />,
            ) : abaVale === 'enviados' ? comPainel(
              <Lista unidadeId={unidadeId} central={false} selecionado={aberto} aoSelecionar={setAberto} />,
            ) : abaVale === 'recebidos' ? comPainel(
              <RecebidosDestino unidadeId={unidadeId} selecionado={aberto} aoSelecionar={setAberto} />,
            ) : comPainel(
              <PainelSla unidadeId={unidadeId} central={false} selecionado={aberto} aoSelecionar={setAberto} />,
            )}
          </>
        )}
    </div>
  )
}

/**
 * Contagens das abas, nas mesmas chaves de cache das listas (abrir a aba não
 * refaz a consulta): esperando decisão (resumo do painel de prazos), enviados
 * fora dos que esperam e recebidos da central.
 */
function useContasQuadro(unidadeId: string, ativo: boolean, origem: boolean) {
  const sla = useQuery({
    queryKey: ['regulacao-sla', unidadeId, {}],
    enabled: ativo && !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_sla_painel', { p_unidade: unidadeId, p_filtros: {} })
      if (error) throw error
      return data as unknown as { resumo: { abertos: number } }
    },
  })
  const lista = useListaUnidade(unidadeId, origem)
  const destino = useQuery({
    queryKey: ['regulacao-destino', unidadeId],
    enabled: origem && !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_destino_lista', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as { id: string }[]
    },
  })
  return {
    esperando: sla.data?.resumo.abertos,
    enviados: lista.data ? lista.data.filter((s) => !esperandoDecisao(s.status)).length : undefined,
    recebidos: destino.data?.length,
  }
}

function useListaUnidade(unidadeId: string, ativo = true) {
  return useQuery({
    queryKey: ['regulacao-lista', unidadeId],
    enabled: ativo && !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_lista', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as Solicitacao[]
    },
  })
}

function Centrais() {
  const qc = useQueryClient()
  const lista = useQuery({
    queryKey: ['regulacao-centrais'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_centrais')
      if (error) throw error
      return (data ?? []) as unknown as { organizacao_id: string; organizacao: string; central: Ref | null; unidades: Ref[] }[]
    },
  })
  const definir = useMutation({
    mutationFn: async (unidade: string) => {
      const { error } = await supabase.rpc('regulacao_definir_central', { p_unidade: unidade })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['regulacao-centrais'] }); void qc.invalidateQueries({ queryKey: ['regulacao-contexto'] }) },
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">Centrais de regulação</CardTitle>
        <CardDescription>Uma central por organização. Os médicos reguladores ficam vinculados a ela com o papel "regulador".</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-apoio">
        {lista.isLoading ? <Spinner /> : (lista.data ?? []).map((o) => (
          <div key={o.organizacao_id} className="flex flex-wrap items-center gap-2">
            <span className="min-w-48 font-medium text-tinta">{o.organizacao}</span>
            <CampoSelecao aria-label={`Central de ${o.organizacao}`} tamanho="compacto"
              value={o.central?.id ?? ''} onChange={(e) => e.target.value && definir.mutate(e.target.value)} disabled={definir.isPending}>
              <option value="">Sem central</option>
              {o.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </CampoSelecao>
          </div>
        ))}
        <MensagemErro texto={(lista.error ?? definir.error) ? ((lista.error ?? definir.error) as Error).message : null} />
      </CardContent>
    </Card>
  )
}

type Paciente = { id: string; nome: string; nome_social: string | null; data_nascimento: string | null; prontuario: string | null }
type Vinculos = {
  tem_documento: boolean; nascimento: string | null
  episodio: { id: string; chegada_em: string; etapa: string } | null
  internacao: { id: string; admissao_em: string; leito: string | null } | null
  medicos: Ref[]
}

function Campo({ id, rotulo, children, className }: { id?: string; rotulo: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      {id ? <Label htmlFor={id} className="text-rotulo">{rotulo}</Label> : <span className="text-rotulo text-tinta-apoio">{rotulo}</span>}
      {children}
    </div>
  )
}

/** Busca de terminologia em linha própria; escolhido o item, mostra o código e "Trocar". */
function CampoTerminologia({ rotulo, tipo, escolhido, onEscolher, onLimpar }: {
  rotulo: React.ReactNode; tipo: 'sigtap_procedimento' | 'cbo' | 'cid10'; escolhido: string
  onEscolher: (codigo: string, rotulo: string) => void; onLimpar: () => void
}) {
  return (
    <Campo rotulo={rotulo}>
      {escolhido ? (
        <div className="flex items-center gap-2 rounded-controle border border-fio bg-campo px-2 py-1.5">
          <span className="min-w-0 flex-1 truncate text-tinta">{escolhido}</span>
          <Button size="xs" variant="outline" onClick={onLimpar}>Trocar</Button>
        </div>
      ) : (
        <BuscaTerminologia tipo={tipo} onSelecionar={(r) => onEscolher(r.codigo, `${r.codigo} ${r.descricao}`)} />
      )}
    </Campo>
  )
}

type DocumentoProntuario = { id: string; tipo: string; numero: string | null; versao: number; emitido_em: string; autor: string | null }

type InicialSolicitacao = { paciente: Paciente; tipo?: 'consulta' | 'exame' | 'leito'; cid?: string; quadro?: string; hipotese?: string }

function NovaSolicitacao({ unidadeId, ctx, aoEnviar, inicial }: {
  unidadeId: string; ctx: Contexto; aoEnviar: (id: string) => void
  /** 5A, tarefa 5 (H2): a solicitação aberta da consulta da UBS vem preenchida; o médico confere e completa */
  inicial?: InicialSolicitacao
}) {
  const qc = useQueryClient()
  // quem é médico e gestor na unidade solicita como médico (o banco decide igual)
  const { papeisDaUnidade } = useUnidade()
  const souGestor = papeisDaUnidade.includes('gestor') && !papeisDaUnidade.includes('plantonista')
  // Fase 4, tarefa 11: o NIR abre o pedido em nome do médico assistente (obrigatório)
  const souNir = papeisDaUnidade.includes('nir') && !papeisDaUnidade.includes('plantonista') && !papeisDaUnidade.includes('gestor')
  const [termo, setTermo] = React.useState('')
  const [paciente, setPaciente] = React.useState<Paciente | null>(inicial?.paciente ?? null)
  const [ligar, setLigar] = React.useState<'episodio' | 'internacao' | 'nenhum'>('nenhum')
  const [medico, setMedico] = React.useState('')
  const [naoIdentificado, setNaoIdentificado] = React.useState(false)
  const [vulnerabilidades, setVulnerabilidades] = React.useState<Vulnerabilidade[]>([])
  const criterios = useCriterios(unidadeId)
  const [f, setF] = React.useState<Formulario>(() => ({
    ...FORMULARIO_VAZIO,
    ...(inicial?.tipo ? { tipo: inicial.tipo } : {}),
    cid: inicial?.cid ?? '', quadro_clinico: inicial?.quadro ?? '', hipotese: inicial?.hipotese ?? '',
  }))
  const [cidRotulo, setCidRotulo] = React.useState(inicial?.cid ?? '')
  const [procRotulo, setProcRotulo] = React.useState('')
  const [cboRotulo, setCboRotulo] = React.useState('')
  const [enviada, setEnviada] = React.useState<{ numero: number; duplicidade: boolean; anexos: number; falhas: string[] } | null>(null)
  // anexos escolhidos antes do envio; sobem logo depois que o pedido é criado
  const [arquivos, setArquivos] = React.useState<File[]>([])
  const [docsEscolhidos, setDocsEscolhidos] = React.useState<string[]>([])
  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setF((x) => ({ ...x, [k]: v }))

  // pedido 3: a consulta espera a pessoa parar de digitar (300 ms)
  const termoAdiado = useValorAdiado(termo)
  const busca = useQuery({
    queryKey: ['regulacao-busca-paciente', unidadeId, termoAdiado],
    enabled: termoAdiado.trim().length >= 3 && !paciente,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_pacientes', { p_unidade: unidadeId, p_termo: termoAdiado.trim() })
      if (error) throw error
      return (data ?? []) as unknown as Paciente[]
    },
  })
  const vinculos = useQuery({
    queryKey: ['regulacao-vinculos', paciente?.id],
    enabled: !!paciente,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_vinculos_paciente', { p_paciente: paciente!.id })
      if (error) throw error
      const v = data as unknown as Vinculos
      setLigar(v.internacao ? 'internacao' : v.episodio ? 'episodio' : 'nenhum')
      setVulnerabilidades(marcadoresPelaIdade(v.nascimento, hoje()))
      return v
    },
  })
  const v = vinculos.data
  const neonato = ehNeonato(v?.nascimento, hoje())
  const documentos = useQuery({
    queryKey: ['regulacao-docs-paciente', paciente?.id],
    enabled: !!paciente,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_documentos_do_paciente', { p_paciente: paciente!.id })
      if (error) throw error
      return (data ?? []) as unknown as DocumentoProntuario[]
    },
  })
  const totalAnexos = arquivos.length + docsEscolhidos.length
  const enviar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_solicitar', {
        p_unidade: unidadeId, p_paciente: paciente!.id,
        p_dados: { ...dadosParaEnvio(f, {
          episodio_id: ligar === 'episodio' ? v?.episodio?.id : null,
          internacao_id: ligar === 'internacao' ? v?.internacao?.id : null,
          medico_assistente_id: souGestor || souNir ? medico || null : null,
          paciente_nao_identificado: !v?.tem_documento && naoIdentificado,
        }), vulnerabilidades },
      })
      if (error) throw error
      const r = data as unknown as { id: string; numero: number; aviso_duplicidade: boolean }
      // o pedido já existe: sobem os anexos; o que falhar fica avisado e pode ir pelo detalhe
      const falhas: string[] = []
      let anexos = 0
      for (const arquivo of arquivos) {
        const caminho = caminhoAnexo(r.id, arquivo.name, Date.now())
        const up = await supabase.storage.from('regulacao').upload(caminho, arquivo, { contentType: arquivo.type, upsert: false })
        const reg = up.error ? up : await supabase.rpc('regulacao_registrar_anexo', {
          p_solicitacao: r.id, p_caminho: caminho, p_nome: arquivo.name, p_tamanho: arquivo.size, p_tipo_mime: arquivo.type,
        })
        if (reg.error) falhas.push(`${arquivo.name} (${reg.error.message})`); else anexos++
      }
      for (const doc of docsEscolhidos) {
        const { error: e } = await supabase.rpc('regulacao_anexar_documento', { p_solicitacao: r.id, p_documento: doc })
        if (e) falhas.push(`documento do prontuário (${e.message})`); else anexos++
      }
      return { ...r, anexos, falhas }
    },
    onSuccess: (r) => {
      setEnviada({ numero: r.numero, duplicidade: r.aviso_duplicidade, anexos: r.anexos, falhas: r.falhas })
      setF(FORMULARIO_VAZIO); setCidRotulo(''); setProcRotulo(''); setCboRotulo(''); setPaciente(null); setTermo(''); setMedico('')
      setNaoIdentificado(false); setVulnerabilidades([]); setArquivos([]); setDocsEscolhidos([])
      void qc.invalidateQueries({ queryKey: ['regulacao-lista', unidadeId] })
      aoEnviar(r.id)
    },
  })
  const faltas = [...faltasFormulario(f, { neonato, semDocumento: v ? !v.tem_documento : false, naoIdentificado }),
    ...(souNir && !medico ? ['médico assistente'] : [])]
  const leitoOuTransf = f.tipo === 'leito' || f.tipo === 'transferencia'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">Nova solicitação</CardTitle>
        <CardDescription>Vai para a {ctx.central?.nome}. O autor é quem está logado. Os campos seguem o modelo nacional (MIRA).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        {enviada && (
          <p role="status" className="text-sucesso">
            Solicitação nº {enviada.numero} enviada à central{enviada.anexos > 0 ? `, com ${enviada.anexos} anexo(s)` : ''}. Ela está aberta abaixo.
            {enviada.duplicidade && <span className="ml-1 text-atencao">Atenção: já havia um pedido aberto igual para este paciente.</span>}
            {enviada.falhas.length > 0 && (
              <span className="block text-critico">Não subiu: {enviada.falhas.join('; ')}. Anexe de novo no detalhe do pedido.</span>
            )}
          </p>
        )}

        {/* paciente */}
        {paciente ? (
          <div className="flex flex-wrap items-center gap-2 rounded-controle border border-fio bg-campo px-3 py-2">
            <span className="font-medium text-tinta">{paciente.nome_social ?? paciente.nome}</span>
            {paciente.data_nascimento && <span className="text-tinta-sussurro">nasc. {fmtData(paciente.data_nascimento)}</span>}
            {paciente.prontuario && <span className="text-tinta-sussurro">pront. {paciente.prontuario}</span>}
            {neonato && <Badge variant="info">recém-nascido</Badge>}
            <Button size="xs" variant="outline" className="ml-auto" onClick={() => { setPaciente(null); setTermo('') }}>Trocar</Button>
          </div>
        ) : (
          <Campo id="reg-paciente" rotulo="Paciente (nome, CPF, CNS ou prontuário)">
            <Input id="reg-paciente" className="h-8" value={termo} onChange={(e) => { setTermo(e.target.value); setEnviada(null) }} />
            {busca.isFetching && <Spinner />}
            {(busca.data ?? []).length > 0 && (
              <ul className="flex flex-col divide-y divide-fio rounded-controle border border-fio">
                {(busca.data ?? []).slice(0, 8).map((p) => (
                  <li key={p.id}>
                    <BotaoLinha variante="linha" className="block border-0 px-3 py-1.5 hover:bg-campo" onClick={() => setPaciente(p)}>
                      {p.nome_social ?? p.nome} {p.data_nascimento && <span className="text-tinta-sussurro">· {fmtData(p.data_nascimento)}</span>}
                    </BotaoLinha>
                  </li>
                ))}
              </ul>
            )}
            {termoAdiado.trim().length >= 3 && !busca.isFetching && (busca.data ?? []).length === 0 &&<span className="text-tinta-sussurro">Nenhum paciente com esse termo.</span>}
          </Campo>
        )}

        {paciente && v && (
          <>
            {!v.tem_documento && (
              <label className="flex items-start gap-2 rounded-controle border border-atencao/30 bg-alerta-atencao px-3 py-2 text-atencao">
                <input type="checkbox" className="mt-0.5 size-4" checked={naoIdentificado} onChange={(e) => setNaoIdentificado(e.target.checked)} />
                O paciente está sem CNS e sem CPF válidos. Complete o cadastro, ou marque aqui para enviar como paciente não identificado.
              </label>
            )}
            {(v.episodio || v.internacao) && (
              <fieldset className="flex flex-col gap-1">
                <legend className="text-rotulo text-tinta-apoio">Ligar a</legend>
                {v.internacao && (
                  <label className="flex items-center gap-2"><input type="radio" className="size-4" checked={ligar === 'internacao'} onChange={() => setLigar('internacao')} />
                    Internação aberta{v.internacao.leito ? `, leito ${v.internacao.leito}` : ''} (desde {fmtDataHora(v.internacao.admissao_em)})</label>
                )}
                {v.episodio && (
                  <label className="flex items-center gap-2"><input type="radio" className="size-4" checked={ligar === 'episodio'} onChange={() => setLigar('episodio')} />
                    Atendimento aberto (chegada {fmtDataHora(v.episodio.chegada_em)})</label>
                )}
                <label className="flex items-center gap-2"><input type="radio" className="size-4" checked={ligar === 'nenhum'} onChange={() => setLigar('nenhum')} />
                  Só ao paciente</label>
              </fieldset>
            )}

            {/* o que se pede */}
            <Campo id="reg-tipo" rotulo="Tipo" className="sm:max-w-xs">
              <CampoSelecao id="reg-tipo" tamanho="compacto" value={f.tipo} onChange={(e) => set('tipo', e.target.value as TipoSolicitacao)}>
                {(Object.keys(TIPOS) as TipoSolicitacao[]).map((k) => <option key={k} value={k}>{TIPOS[k]}</option>)}
              </CampoSelecao>
            </Campo>
            <CampoTerminologia tipo="sigtap_procedimento" escolhido={procRotulo}
              rotulo={<>Procedimento (SIGTAP){f.tipo === 'leito' && ' — o da internação'}</>}
              onEscolher={(c, r) => { set('procedimento', c); setProcRotulo(r) }} onLimpar={() => { set('procedimento', ''); setProcRotulo('') }} />
            {f.tipo === 'consulta' && (
              <>
                <Campo id="reg-esp" rotulo="Especialidade" className="sm:max-w-md">
                  <Input id="reg-esp" className="h-8" list="reg-especialidades" value={f.especialidade} onChange={(e) => set('especialidade', e.target.value)} />
                  <datalist id="reg-especialidades">{ESPECIALIDADES.map((e) => <option key={e} value={e} />)}</datalist>
                </Campo>
                <CampoTerminologia tipo="cbo" escolhido={cboRotulo} rotulo="CBO da especialidade"
                  onEscolher={(c, r) => { set('cbo', c); setCboRotulo(r) }} onLimpar={() => { set('cbo', ''); setCboRotulo('') }} />
              </>
            )}
            {leitoOuTransf && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo id="reg-leito" rotulo={f.tipo === 'leito' ? 'Tipo de leito' : 'Leito no destino (se for internar)'}>
                  <CampoSelecao id="reg-leito" tamanho="compacto" value={f.tipo_leito} onChange={(e) => set('tipo_leito', e.target.value)}>
                    <option value="">{f.tipo === 'leito' ? 'Escolha…' : 'Não se aplica'}</option>
                    {Object.entries(TIPOS_LEITO).map(([k, x]) => <option key={k} value={k}>{x}</option>)}
                  </CampoSelecao>
                </Campo>
                {f.tipo_leito === 'psiquiatrico' && (
                  <Campo id="reg-psiq" rotulo="Internação psiquiátrica">
                    <CampoSelecao id="reg-psiq" tamanho="compacto" value={f.internacao_psiquiatrica} onChange={(e) => set('internacao_psiquiatrica', e.target.value)}>
                      <option value="">Escolha…</option>
                      {Object.entries(INTERNACAO_PSIQUIATRICA).map(([k, x]) => <option key={k} value={k}>{x}</option>)}
                    </CampoSelecao>
                  </Campo>
                )}
                {f.tipo === 'transferencia' && (
                  <Campo id="reg-transp" rotulo="Transporte solicitado (a central define o final)">
                    <CampoSelecao id="reg-transp" tamanho="compacto" value={f.transporte} onChange={(e) => set('transporte', e.target.value)}>
                      <option value="">Escolha…</option>
                      {Object.entries(TRANSPORTES).map(([k, x]) => <option key={k} value={k}>{x}</option>)}
                    </CampoSelecao>
                  </Campo>
                )}
                {f.tipo === 'transferencia' && neonato && (
                  <Campo id="reg-incub" rotulo="Incubadora">
                    <CampoSelecao id="reg-incub" tamanho="compacto" value={f.incubadora} onChange={(e) => set('incubadora', e.target.value as Formulario['incubadora'])}>
                      <option value="">Escolha…</option><option value="sim">Sim</option><option value="nao">Não</option>
                    </CampoSelecao>
                  </Campo>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={f.isolamento} onChange={(e) => set('isolamento', e.target.checked)} />
                Precisa de isolamento</label>
              {f.isolamento && (
                <CampoSelecao aria-label="Tipo de isolamento" tamanho="compacto" value={f.isolamento_tipo} onChange={(e) => set('isolamento_tipo', e.target.value)}>
                  <option value="">Tipo…</option>
                  {Object.entries(ISOLAMENTOS).map(([k, x]) => <option key={k} value={k}>{x}</option>)}
                </CampoSelecao>
              )}
            </div>

            {/* destino */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo id="reg-destino" rotulo="Destino">
                <CampoSelecao id="reg-destino" tamanho="compacto" value={f.destino_tipo} onChange={(e) => set('destino_tipo', e.target.value as DestinoTipo)}>
                  <option value="a_definir">A definir pela regulação</option>
                  <option value="rede">Unidade da rede</option>
                  <option value="externo">Serviço fora da rede</option>
                </CampoSelecao>
              </Campo>
              {f.destino_tipo === 'rede' && (
                <Campo id="reg-dest-un" rotulo="Unidade" className="sm:col-span-2">
                  <CampoSelecao id="reg-dest-un" tamanho="compacto" value={f.destino_unidade_id} onChange={(e) => set('destino_unidade_id', e.target.value)}>
                    <option value="">Escolha…</option>
                    {ctx.unidades_rede.filter((u) => u.id !== unidadeId).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </CampoSelecao>
                </Campo>
              )}
              {f.destino_tipo === 'externo' && (
                <Campo id="reg-dest-ext" rotulo="Serviço (nome e município)" className="sm:col-span-2">
                  <Input id="reg-dest-ext" className="h-8" value={f.destino_externo} onChange={(e) => set('destino_externo', e.target.value)} />
                </Campo>
              )}
            </div>

            {/* caráter e prioridade */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo id="reg-carater" rotulo="Caráter">
                <CampoSelecao id="reg-carater" tamanho="compacto" value={f.carater} onChange={(e) => set('carater', e.target.value as Carater)}>
                  <option value="">Escolha…</option>
                  {(Object.keys(CARATER) as Carater[]).map((k) => <option key={k} value={k}>{CARATER[k]}</option>)}
                </CampoSelecao>
              </Campo>
              <fieldset className="flex flex-col gap-1 sm:col-span-2">
                <legend className="text-rotulo text-tinta-apoio">Prioridade proposta (o regulador da central revisa)</legend>
                <div className="flex flex-wrap gap-3">
                  {(Object.keys(PRIORIDADES) as Prioridade[]).map((k) => (
                    <label key={k} className="flex items-center gap-1.5" title={criterios.data?.[k]?.texto ?? PRIORIDADES[k].descricao}>
                      <input type="radio" name="reg-prioridade" className="size-4" checked={f.prioridade === k} onChange={() => set('prioridade', k)} />
                      {PRIORIDADES[k].rotulo}
                    </label>
                  ))}
                </div>
                {f.prioridade && f.prioridade !== 'nao_classificada' && criterios.data?.[f.prioridade]?.texto && (
                  <span className="text-rotulo text-tinta-apoio">Critério da central: {criterios.data[f.prioridade]!.texto}</span>
                )}
              </fieldset>
            </div>

            {/* vulnerabilidade: selos, sem pontuação; a idade já marca idoso ou criança */}
            <fieldset className="flex flex-col gap-1">
              <legend className="text-rotulo text-tinta-apoio">Vulnerabilidade (aparece como selo para o regulador)</legend>
              <div className="flex flex-wrap gap-3">
                {(Object.keys(VULNERABILIDADES) as Vulnerabilidade[]).map((k) => (
                  <label key={k} className="flex items-center gap-1.5">
                    <input type="checkbox" className="size-4" checked={vulnerabilidades.includes(k)}
                      onChange={(e) => setVulnerabilidades((x) => e.target.checked ? [...x, k] : x.filter((y) => y !== k))} />
                    {VULNERABILIDADES[k]}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* justificativa em blocos */}
            <CampoTerminologia tipo="cid10" escolhido={cidRotulo} rotulo="CID-10"
              onEscolher={(c, r) => { set('cid', c); setCidRotulo(r) }} onLimpar={() => { set('cid', ''); setCidRotulo('') }} />
            <Campo id="reg-quadro" rotulo="Quadro clínico (obrigatório)">
              <textarea id="reg-quadro" rows={4} className="rounded-controle border border-fio bg-campo px-2 py-1.5"
                value={f.quadro_clinico} onChange={(e) => set('quadro_clinico', e.target.value)} />
            </Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo id="reg-evol" rotulo="Tempo de evolução"><Input id="reg-evol" className="h-8" value={f.tempo_evolucao} onChange={(e) => set('tempo_evolucao', e.target.value)} /></Campo>
              <Campo id="reg-sv" rotulo="Sinais vitais, com a hora">
                <Input id="reg-sv" className="h-8" placeholder="PA, FC, FR, SpO₂, Tax, às hh:mm (PA não obrigatória na criança)" value={f.sinais_vitais} onChange={(e) => set('sinais_vitais', e.target.value)} />
              </Campo>
              <Campo id="reg-exames" rotulo="Exames realizados, com a data"><Input id="reg-exames" className="h-8" value={f.exames} onChange={(e) => set('exames', e.target.value)} /></Campo>
              <Campo id="reg-meds" rotulo="Tratamento feito e medicações em uso"><Input id="reg-meds" className="h-8" value={f.medicacoes} onChange={(e) => set('medicacoes', e.target.value)} /></Campo>
              <Campo id="reg-hip" rotulo="Hipótese diagnóstica"><Input id="reg-hip" className="h-8" value={f.hipotese} onChange={(e) => set('hipotese', e.target.value)} /></Campo>
              <Campo id="reg-tel" rotulo="Telefone de contato da origem"><Input id="reg-tel" className="h-8" value={f.telefone_contato} onChange={(e) => set('telefone_contato', e.target.value)} /></Campo>
            </div>

            {/* anexos: escolhidos aqui, enviados junto com o pedido */}
            <div className="flex flex-col gap-2 rounded-controle border border-fio p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 font-medium text-tinta"><Paperclip className="size-4" aria-hidden /> Anexos (opcional){totalAnexos > 0 ? ` · ${totalAnexos}` : ''}</span>
              </div>
              <AreaDeAnexo
                id="reg-anexos"
                multiple
                descricao="PDF, JPG ou PNG, até 10 MB cada"
                accept={ANEXO_TIPOS.join(',')}
                maxBytes={ANEXO_LIMITE_BYTES}
                validar={erroArquivo}
                valor={arquivos}
                onArquivos={(novos) => setArquivos((x) => [...x, ...novos])}
                onRemover={(i) => setArquivos((x) => x.filter((_, j) => j !== i))}
              />
              {(documentos.data ?? []).length > 0 && (
                <fieldset className="flex flex-col gap-1">
                  <legend className="flex items-center gap-1.5 text-rotulo text-tinta-apoio"><FileText className="size-3.5" aria-hidden /> Documentos do prontuário deste paciente</legend>
                  {documentos.data!.map((d) => (
                    <label key={d.id} className="flex flex-wrap items-center gap-2">
                      <input type="checkbox" className="size-4" checked={docsEscolhidos.includes(d.id)}
                        onChange={(e) => setDocsEscolhidos((x) => e.target.checked ? [...x, d.id] : x.filter((y) => y !== d.id))} />
                      <span className="text-tinta">{d.tipo.replace(/_/g, ' ')}{d.numero ? ` nº ${d.numero}` : ''}</span>
                      <span className="text-rotulo text-tinta-sussurro">versão {d.versao} · {d.autor ?? '—'} · {fmtDataHora(d.emitido_em)}</span>
                    </label>
                  ))}
                </fieldset>
              )}
            </div>

            {(souGestor || souNir) && (
              <Campo id="reg-medico" rotulo={souNir ? 'Médico assistente (obrigatório: o NIR abre em nome dele)' : 'Médico assistente (fica informado)'} className="max-w-sm">
                <CampoSelecao id="reg-medico" tamanho="compacto" value={medico} onChange={(e) => setMedico(e.target.value)}>
                  <option value="">{souNir ? 'Escolha…' : 'Não informar'}</option>
                  {v.medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </CampoSelecao>
              </Campo>
            )}

            <MensagemErro texto={enviar.error ? (enviar.error as Error).message : null} />
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => enviar.mutate()} disabled={faltas.length > 0 || enviar.isPending}>
                {enviar.isPending ? <Spinner /> : <Send className="size-4" />} Enviar à central
              </Button>
              {faltas.length > 0 && <span className="text-atencao">Falta: {faltas.join(', ')}.</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Enviados (MR2): os pedidos da unidade que já saíram da espera — decididos,
 * cancelados, chegados. Os que esperam decisão ficam só na aba deles, para o
 * mesmo pedido não aparecer duas vezes.
 */
function Lista({ unidadeId, central, selecionado, aoSelecionar }: {
  unidadeId: string; central: boolean; selecionado: string | null; aoSelecionar: (id: string | null) => void
}) {
  const lista = useListaUnidade(unidadeId)
  const todos = lista.data ?? []
  const itens = central ? todos : todos.filter((s) => !esperandoDecisao(s.status))
  const esperando = todos.length - itens.length
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">{central ? 'Recebidas' : 'Enviados'}</CardTitle>
        <CardDescription>
          {central ? 'As 200 mais recentes.' : 'Pedidos da unidade já decididos, cancelados ou concluídos.'}
          {!central && esperando > 0 && ` ${esperando === 1 ? '1 pedido espera' : `${esperando} pedidos esperam`} decisão e está${esperando === 1 ? '' : 'ão'} na aba Esperando decisão.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-apoio">
        {lista.isLoading ? <EsqueletoLinhas linhas={5} rotulo="Carregando os pedidos…" /> : lista.error ? <MensagemErro texto={(lista.error as Error).message} /> : itens.length === 0 ? (
          <Vazio icone={Waypoints} titulo="Nenhuma solicitação aqui" texto={central ? 'As solicitações das unidades da rede aparecem aqui.' : 'Quando a central decidir um pedido da unidade, ele passa para cá.'} />
        ) : (
          <ul className="flex flex-col divide-y divide-fio">
            {itens.map((s) => (
              <li key={s.id} className="py-2">
                <BotaoLinha variante="linha" aria-current={selecionado === s.id ? 'true' : undefined}
                  className={cn('flex-wrap items-center gap-2 rounded-controle border-0 px-1 py-0.5 hover:bg-campo', selecionado === s.id && 'bg-campo')}
                  onClick={() => aoSelecionar(selecionado === s.id ? null : s.id)}>
                  <span className="text-tinta-sussurro">nº {s.numero}</span>
                  <SeloPrioridade s={s} />
                  <span className="font-medium text-tinta">{s.paciente.nome}{s.paciente_nao_identificado && ' (não identificado)'}{docMae(s.paciente.mae)}</span>
                  <span className="text-tinta-apoio">{resumoPedido(s)}</span>
                  {central && <span className="text-tinta-sussurro">de {s.origem.nome}</span>}
                  <SeloSla sla={s.sla} />
                  <Badge variant={s.status === 'cancelada' ? 'secondary' : 'info'} className="ml-auto">{STATUS[s.status]}</Badge>
                  <span className="text-tinta-sussurro">{fmtDataHora(s.criada_em)}</span>
                </BotaoLinha>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  if (valor == null || valor === '') return null
  return <div><dt className="inline text-tinta-sussurro">{rotulo}: </dt><dd className="inline">{valor}</dd></div>
}

/**
 * Detalhe do pedido no painel ao lado da lista (RD1 = A, RT 24/11/2026):
 * cabeçalho fixo com a prioridade, o pedido, o prazo e "Atualizar evolução";
 * "Cancelar solicitação" no menu "…", com o diálogo do motivo. Depois, o que
 * se decide, os dados do pedido, os anexos e a linha do tempo (RD2).
 */
function Detalhe({ id, unidadeId, central, podeRegistrarExterno, aoFechar }: {
  id: string; unidadeId: string; central: boolean; podeRegistrarExterno: boolean; aoFechar?: () => void
}) {
  const { papeisDaUnidade } = useUnidade()
  const souNir = papeisDaUnidade.includes('nir')
  const qc = useQueryClient()
  const d = useQuery({
    queryKey: ['regulacao-detalhe', id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_detalhe', { p_id: id })
      if (error) throw error
      return data as unknown as Solicitacao
    },
  })
  const [cancelando, setCancelando] = React.useState(false)
  const [evoluindo, setEvoluindo] = React.useState(false)
  const [sistema, setSistema] = React.useState('')
  const [protocolo, setProtocolo] = React.useState('')
  const [prioridadeCentral, setPrioridadeCentral] = React.useState('')
  const [novaPrioridade, setNovaPrioridade] = React.useState<Prioridade | ''>('')
  const [motivoPrioridade, setMotivoPrioridade] = React.useState('')
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['regulacao-detalhe', id] })
    void qc.invalidateQueries({ queryKey: ['regulacao-lista', unidadeId] })
    void qc.invalidateQueries({ queryKey: ['regulacao-fila', unidadeId] })
    void qc.invalidateQueries({ queryKey: ['regulacao-sla', unidadeId] })
    void qc.invalidateQueries({ queryKey: ['regulacao-destino', unidadeId] })
    void qc.invalidateQueries({ queryKey: ['nota-regulacao'] })
  }
  const priorizar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_priorizar', { p_id: id, p_prioridade: novaPrioridade, p_motivo: motivoPrioridade.trim() })
      if (error) throw error
    },
    onSuccess: () => { setNovaPrioridade(''); setMotivoPrioridade(''); recarregar() },
  })
  const cancelar = useMutation({
    mutationFn: async (motivo: string) => {
      const { error } = await supabase.rpc('regulacao_cancelar', { p_id: id, p_motivo: motivo })
      if (error) throw error
    },
    onSuccess: () => { setCancelando(false); recarregar() },
  })
  const externo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_registrar_externo', {
        p_id: id, p_sistema: sistema.trim(), p_protocolo: protocolo.trim(), p_prioridade_central: prioridadeCentral.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  if (d.isLoading) return <div className="p-4"><EsqueletoLinhas linhas={6} rotulo="Carregando o pedido…" /></div>
  if (d.error || !d.data) return <div className="p-4"><MensagemErro texto={d.error ? (d.error as Error).message : 'Não encontrada.'} /></div>
  const s = d.data
  const destino = s.destino_tipo === 'rede' ? s.destino_unidade?.nome : s.destino_tipo === 'externo' ? `${s.destino_externo} (fora da rede)` : 'A definir pela regulação'
  const cancelavel = !central && s.origem_pode_responder
    && ['rascunho', 'enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino', 'autorizada', 'agendada'].includes(s.status)
  const podeEvoluir = !central && !!s.pode_evoluir
  const linhaDoTempo = montarLinhaDoTempo({ eventos: s.eventos ?? [], evolucoes: s.evolucoes ?? [] })
  return (
    <article aria-label={`Pedido nº ${s.numero}`} className="flex flex-col text-apoio">
      <header className="sticky top-0 z-10 flex flex-col gap-2 border-b border-fio bg-superficie px-4 py-3">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <SeloPrioridade s={s} />
              <Badge variant={s.status === 'cancelada' ? 'secondary' : 'info'}>{STATUS[s.status]}</Badge>
            </span>
            <h2 className="text-corpo font-semibold text-tinta">Pedido nº {s.numero} · {resumoPedido(s)}</h2>
            <span className="text-tinta-apoio">
              {s.paciente.nome}{s.paciente_nao_identificado && ' (não identificado)'}{docMae(s.paciente.mae)}{central ? ` · de ${s.origem.nome}` : ''}
            </span>
          </div>
          <MenuAcoesPedido itens={cancelavel ? [{ chave: 'cancelar', rotulo: 'Cancelar solicitação', perigo: true, onSelecionar: () => setCancelando(true) }] : []} />
          {aoFechar && (
            <Button size="icon-sm" variant="ghost" aria-label="Fechar o pedido" onClick={aoFechar}><X /></Button>
          )}
        </div>
        {(podeEvoluir || s.sla) && (
          <div className="flex flex-wrap items-center gap-2">
            <SeloSla sla={s.sla} />
            {podeEvoluir && !evoluindo && <Button size="xs" className="ml-auto" onClick={() => setEvoluindo(true)}>Atualizar evolução</Button>}
          </div>
        )}
      </header>

      <div className="flex flex-col gap-4 p-4">
        {evoluindo && <FormEvolucao id={s.id} aoFim={recarregar} aoVoltar={() => setEvoluindo(false)} />}
        {s.motivo_cancelamento && <p className="text-tinta-apoio">Cancelada ({s.cancelamento_origem}): {s.motivo_cancelamento}</p>}
        <BlocosDecisao s={s} />
        {central && podeRegistrarExterno && emDecisao(s.status) && <PainelDecisao s={s} centralId={unidadeId} aoFim={recarregar} />}
        {!central && (s.origem_pode_responder || (souNir && s.origem.id === unidadeId)) && s.status === 'pendencia' && <ResponderPendencia s={s} aoFim={recarregar} />}
        {!central && s.origem_pode_responder && s.status === 'devolvida' && <Reenviar s={s} aoFim={recarregar} />}
        <BlocoDestino s={s} />
        <AcoesDestino s={s} aoFim={recarregar} nir={souNir && s.destino_unidade?.id === unidadeId} />
        {!central && <SaidaOrigem s={s} aoFim={recarregar} nir={souNir && s.origem.id === unidadeId} />}
        {central && podeRegistrarExterno && <DestinoExterno s={s} aoFim={recarregar} />}

        <dl className="grid gap-x-4 gap-y-1">
          <Linha rotulo="Procedimento (SIGTAP)" valor={`${s.procedimento} ${s.procedimento_nome ?? ''}`} />
          {s.cbo && <Linha rotulo="CBO" valor={s.cbo} />}
          <Linha rotulo="Caráter / modalidade" valor={`${CARATER[s.carater]} · ${s.modalidade}`} />
          <Linha rotulo="Prioridade proposta" valor={PRIORIDADES[s.prioridade].rotulo} />
          {s.prioridade_regulador && (
            <Linha rotulo="Prioridade do regulador" valor={`${PRIORIDADES[s.prioridade_regulador].rotulo} — ${s.prioridade_regulador_por ?? ''}, ${s.prioridade_regulador_em ? fmtDataHora(s.prioridade_regulador_em) : ''}: ${s.prioridade_regulador_motivo ?? ''}`} />
          )}
          {(s.vulnerabilidades ?? []).length > 0 && <Linha rotulo="Vulnerabilidade" valor={s.vulnerabilidades.map((v) => VULNERABILIDADES[v]).join(', ')} />}
          <Linha rotulo="Prioridade da central" valor={s.prioridade_central} />
          {s.tipo_leito && <Linha rotulo="Leito" valor={TIPOS_LEITO[s.tipo_leito] + (s.internacao_psiquiatrica ? ` · ${INTERNACAO_PSIQUIATRICA[s.internacao_psiquiatrica]}` : '')} />}
          {s.isolamento && <Linha rotulo="Isolamento" valor={s.isolamento_tipo ? ISOLAMENTOS[s.isolamento_tipo] : 'sim'} />}
          {s.incubadora != null && <Linha rotulo="Incubadora" valor={s.incubadora ? 'sim' : 'não'} />}
          <Linha rotulo="Destino" valor={destino} />
          <Linha rotulo="CID" valor={`${s.cid} ${s.cid_descricao ?? ''}`} />
          <Linha rotulo="Origem" valor={`${s.origem.nome} (CNES ${s.cnes_solicitante})${s.internacao_id ? ' · internação' : s.episodio_id ? ' · atendimento' : ''}`} />
          <Linha rotulo="Solicitante" valor={`${s.solicitante} (${s.solicitante_papel === 'medico' ? 'médico' : 'gestor/NIR'})`} />
          <Linha rotulo="Médico assistente" valor={s.medico_assistente} />
          <Linha rotulo="Telefone" valor={s.telefone_contato} />
          {s.externo_protocolo && <Linha rotulo="Regulação externa" valor={`${s.externo_sistema} · ${s.externo_protocolo}`} />}
        </dl>
        <dl className="flex flex-col gap-1 text-tinta">
          <div><dt className="text-tinta-sussurro">Quadro clínico</dt><dd className="whitespace-pre-wrap">{s.quadro_clinico}</dd></div>
          <Linha rotulo="Tempo de evolução" valor={s.tempo_evolucao} />
          <Linha rotulo="Sinais vitais" valor={s.sinais_vitais} />
          <Linha rotulo="Exames" valor={s.exames} />
          <Linha rotulo="Tratamento e medicações" valor={s.medicacoes} />
          <Linha rotulo="Hipótese" valor={s.hipotese} />
        </dl>

        {podeRegistrarExterno && ['enviada', 'em_analise', 'pendencia', 'devolvida'].includes(s.status) && (
          <div className="flex flex-wrap items-end gap-2">
            <Campo id={`prio-${id}`} rotulo="Prioridade do regulador">
              <CampoSelecao id={`prio-${id}`} tamanho="compacto" value={novaPrioridade} onChange={(e) => setNovaPrioridade(e.target.value as Prioridade | '')}>
                <option value="">Escolha…</option>
                {(['emergencia', 'urgencia', 'prioritaria', 'eletiva'] as Prioridade[]).map((k) => <option key={k} value={k}>{PRIORIDADES[k].rotulo}</option>)}
              </CampoSelecao>
            </Campo>
            <Campo id={`prio-mot-${id}`} rotulo="Motivo (fica no histórico e a origem vê)" className="min-w-60 flex-1">
              <Input id={`prio-mot-${id}`} className="h-8" value={motivoPrioridade} onChange={(e) => setMotivoPrioridade(e.target.value)} />
            </Campo>
            <Button size="sm" onClick={() => priorizar.mutate()} disabled={priorizar.isPending || !novaPrioridade || motivoPrioridade.trim().length < 10}>Definir prioridade</Button>
          </div>
        )}
        {podeRegistrarExterno && (
          <div className="flex flex-wrap items-end gap-2">
            <Campo id={`ext-sis-${id}`} rotulo="Sistema externo"><Input id={`ext-sis-${id}`} className="h-8" placeholder="SISREG, e-SUS Regulação, GERINT…" value={sistema} onChange={(e) => setSistema(e.target.value)} /></Campo>
            <Campo id={`ext-prot-${id}`} rotulo="Nº do protocolo"><Input id={`ext-prot-${id}`} className="h-8" value={protocolo} onChange={(e) => setProtocolo(e.target.value)} /></Campo>
            <Campo id={`ext-pri-${id}`} rotulo="Prioridade da central (como veio)"><Input id={`ext-pri-${id}`} className="h-8" placeholder="ex.: Vermelho (P0)" value={prioridadeCentral} onChange={(e) => setPrioridadeCentral(e.target.value)} /></Campo>
            <Button size="sm" variant="outline" onClick={() => externo.mutate()} disabled={externo.isPending || sistema.trim().length < 2 || protocolo.trim().length < 3}>Registrar</Button>
          </div>
        )}
        <MensagemErro texto={(externo.error ?? priorizar.error) ? ((externo.error ?? priorizar.error) as Error).message : null} />

        <AnexosRegulacao solicitacaoId={s.id} />
        {/* lacuna 7 (T9): o documento de transferência da origem (origem, central, NIR e destino na rede) */}
        {(s.tipo === 'transferencia' || s.tipo === 'leito') && <LeituraTransferencia solicitacaoId={s.id} />}
        <LinhaDoTempoPedido itens={linhaDoTempo} tempos={s.tempos ?? []} statusAtual={s.status} />
      </div>

      <DialogoMotivo aberto={cancelando} aoFechar={() => { setCancelando(false); cancelar.reset() }}
        titulo={`Cancelar a solicitação nº ${s.numero}`}
        rotulo="Motivo do cancelamento" confirmar="Cancelar solicitação" ocupado={cancelar.isPending} erro={cancelar.error}
        aoConfirmar={(m) => cancelar.mutate(m)} />
    </article>
  )
}

/** Prioridade que vale (a do regulador, se houver), com a proposta quando é diferente. */
function SeloPrioridade({ s }: { s: Pick<Solicitacao, 'prioridade' | 'prioridade_regulador'> }) {
  const ef = prioridadeEfetiva(s)
  return (
    <>
      <Badge variant={TOM[PRIORIDADES[ef].tom]}>{PRIORIDADES[ef].rotulo}</Badge>
      {s.prioridade_regulador && s.prioridade_regulador !== s.prioridade && (
        <span className="text-rotulo text-tinta-sussurro">regulador · proposta {PRIORIDADES[s.prioridade].rotulo}</span>
      )}
    </>
  )
}

type Criterio = { texto: string; em: string; por: string | null }
function useCriterios(unidadeId: string) {
  return useQuery({
    queryKey: ['regulacao-criterios', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_criterios', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? {}) as unknown as Partial<Record<Prioridade, Criterio>>
    },
  })
}

/** Critérios por nível, escritos pela central (Fase 4, tarefa 3). O sistema não sugere nível. */
function Criterios({ unidadeId, editavel }: { unidadeId: string; editavel: boolean }) {
  const qc = useQueryClient()
  const criterios = useCriterios(unidadeId)
  const [rascunho, setRascunho] = React.useState<Partial<Record<Prioridade, string>>>({})
  const salvar = useMutation({
    mutationFn: async (k: Prioridade) => {
      const { error } = await supabase.rpc('regulacao_definir_criterio', { p_central: unidadeId, p_prioridade: k, p_texto: (rascunho[k] ?? '').trim() })
      if (error) throw error
    },
    onSuccess: (_, k) => {
      setRascunho((x) => { const n = { ...x }; delete n[k]; return n })
      void qc.invalidateQueries({ queryKey: ['regulacao-criterios', unidadeId] })
    },
  })
  const niveis: Prioridade[] = ['emergencia', 'urgencia', 'prioritaria', 'eletiva']
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">Critérios de prioridade da central</CardTitle>
        <CardDescription>O que cabe em cada nível. Aparece para quem solicita e para o regulador; o sistema não sugere nível.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        {niveis.map((k) => {
          const atual = criterios.data?.[k]
          const valor = rascunho[k] ?? atual?.texto ?? ''
          return (
            <div key={k} className="flex flex-col gap-1">
              <Label htmlFor={`crit-${k}`} className="text-rotulo">{PRIORIDADES[k].rotulo}</Label>
              {editavel ? (
                <div className="flex flex-wrap items-start gap-2">
                  <textarea id={`crit-${k}`} rows={2} className="min-w-60 flex-1 rounded-controle border border-fio bg-campo px-2 py-1.5"
                    value={valor} onChange={(e) => setRascunho((x) => ({ ...x, [k]: e.target.value }))} />
                  <Button size="sm" variant="outline" onClick={() => salvar.mutate(k)}
                    disabled={salvar.isPending || rascunho[k] === undefined || (rascunho[k] ?? '').trim().length < 10}>Salvar</Button>
                </div>
              ) : <p className="text-tinta">{atual?.texto ?? '—'}</p>}
              {atual && <span className="text-rotulo text-tinta-sussurro">{atual.por ?? '—'} · {fmtDataHora(atual.em)}</span>}
            </div>
          )
        })}
        <MensagemErro texto={salvar.error ? (salvar.error as Error).message : null} />
      </CardContent>
    </Card>
  )
}

// ── Fila regulada (Fase 4, tarefa 2) ──────────────────────────────────────────
type ItemFila = Solicitacao & {
  assumida_por: string | null; assumida_por_mim: boolean; assumida_em: string | null; espera_segundos: number
}
type RespostaFila = { dados: ItemFila[]; resumo: Partial<Record<Prioridade, number>>; origens: Ref[]; agora: string }

function Fila({ centralId, souRegulador, selecionado, aoSelecionar }: {
  centralId: string; souRegulador: boolean
  /** RD1: o pedido escolhido abre no painel ao lado da fila */
  selecionado: string | null; aoSelecionar: (id: string | null) => void
}) {
  const qc = useQueryClient()
  const [filtros, setFiltros] = React.useState<FiltrosFila>({})
  const [busca, setBusca] = React.useState('')
  // o painel de prazos saiu da central (era a mesma lista): o filtro dos atrasados veio para a fila
  const [soAtrasados, setSoAtrasados] = React.useState(false)
  const aberta = selecionado
  const [novos, setNovos] = React.useState<Set<string>>(new Set())
  const vistos = React.useRef<Set<string> | null>(null)
  const [lidoEm, setLidoEm] = React.useState(() => Date.now())
  const [agora, setAgora] = React.useState(() => Date.now())
  // o tempo de espera corre na tela entre uma leitura e outra
  React.useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const fila = useQuery({
    queryKey: ['regulacao-fila', centralId, filtros],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_fila', { p_central: centralId, p_filtros: filtrosParaEnvio(filtros) as unknown as Json })
      if (error) throw error
      const r = data as unknown as RespostaFila
      const ids = r.dados.map((d) => d.id)
      setNovos(novosDesde(vistos.current, ids))
      vistos.current = new Set([...(vistos.current ?? []), ...ids])
      setLidoEm(Date.now()); setAgora(Date.now())
      return r
    },
  })
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['regulacao-fila', centralId] })
    if (aberta) void qc.invalidateQueries({ queryKey: ['regulacao-detalhe', aberta] })
  }
  const assumir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('regulacao_assumir', { p_id: id })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  const soltar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('regulacao_soltar', { p_id: id })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  const setF = <K extends keyof FiltrosFila>(k: K, v: FiltrosFila[K] | '') =>
    setFiltros((x) => { const n = { ...x }; if (v === '' || v === undefined) delete n[k]; else n[k] = v as FiltrosFila[K]; return n })
  const r = fila.data
  const decorrido = Math.floor((agora - lidoEm) / 1000)
  const resumo = r?.resumo ?? {}
  const dados = (r?.dados ?? []).filter((s) => !soAtrasados || !!(s.sla?.atrasado_central || s.sla?.atrasado_origem || s.sla?.atrasado_destino))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-corpo">
          Fila da central
          {(Object.keys(PRIORIDADES) as Prioridade[]).filter((p) => resumo[p]).map((p) => (
            <Badge key={p} variant={TOM[PRIORIDADES[p].tom]}>{PRIORIDADES[p].rotulo}: {resumo[p]}</Badge>
          ))}
        </CardTitle>
        <CardDescription>
          Não classificadas no topo; depois por prioridade e, em cada nível, quem espera há mais tempo. Atualiza a cada 30 segundos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        <div className="grid gap-2 sm:grid-cols-4">
          <CampoSelecao aria-label="Tipo" tamanho="compacto" value={filtros.tipo ?? ''} onChange={(e) => setF('tipo', e.target.value as TipoSolicitacao | '')}>
            <option value="">Todos os tipos</option>
            {(Object.keys(TIPOS) as TipoSolicitacao[]).map((k) => <option key={k} value={k}>{TIPOS[k]}</option>)}
          </CampoSelecao>
          <CampoSelecao aria-label="Prioridade" tamanho="compacto" value={filtros.prioridade ?? ''} onChange={(e) => setF('prioridade', e.target.value as Prioridade | '')}>
            <option value="">Todas as prioridades</option>
            {(Object.keys(PRIORIDADES) as Prioridade[]).map((k) => <option key={k} value={k}>{PRIORIDADES[k].rotulo}</option>)}
          </CampoSelecao>
          <CampoSelecao aria-label="Unidade de origem" tamanho="compacto" value={filtros.unidade_origem_id ?? ''} onChange={(e) => setF('unidade_origem_id', e.target.value)}>
            <option value="">Todas as unidades</option>
            {(r?.origens ?? []).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </CampoSelecao>
          <CampoSelecao aria-label="Status" tamanho="compacto" value={filtros.status?.[0] ?? ''}
            onChange={(e) => setF('status', e.target.value ? [e.target.value as StatusRegulacao] : '')}>
            <option value="">Em aberto (enviada, em análise, pendência)</option>
            {(Object.keys(STATUS) as StatusRegulacao[]).map((k) => <option key={k} value={k}>{STATUS[k]}</option>)}
          </CampoSelecao>
          <CampoSelecao aria-label="Caráter" tamanho="compacto" value={filtros.carater ?? ''} onChange={(e) => setF('carater', e.target.value as Carater | '')}>
            <option value="">Eletivo e urgência</option>
            {(Object.keys(CARATER) as Carater[]).map((k) => <option key={k} value={k}>{CARATER[k]}</option>)}
          </CampoSelecao>
          <CampoSelecao aria-label="Tipo de leito" tamanho="compacto" value={filtros.tipo_leito ?? ''} onChange={(e) => setF('tipo_leito', e.target.value)}>
            <option value="">Todos os leitos</option>
            {Object.entries(TIPOS_LEITO).map(([k, x]) => <option key={k} value={k}>{x}</option>)}
          </CampoSelecao>
          <CampoSelecao aria-label="Isolamento" tamanho="compacto" value={filtros.isolamento === undefined ? '' : String(filtros.isolamento)}
            onChange={(e) => setF('isolamento', e.target.value === '' ? '' : e.target.value === 'true')}>
            <option value="">Com e sem isolamento</option>
            <option value="true">Só com isolamento</option>
            <option value="false">Sem isolamento</option>
          </CampoSelecao>
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); setF('busca', busca) }}>
            <Input aria-label="Buscar" className="h-8" placeholder="Paciente, nº ou protocolo" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <Button size="sm" variant="outline" type="submit">Buscar</Button>
          </form>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4" checked={soAtrasados} onChange={(e) => setSoAtrasados(e.target.checked)} />
            Só com prazo vencido
          </label>
        </div>
        <MensagemErro texto={(fila.error ?? assumir.error ?? soltar.error) ? ((fila.error ?? assumir.error ?? soltar.error) as Error).message : null} />
        {fila.isLoading ? <Spinner /> : dados.length === 0 ? (
          <Vazio icone={Waypoints} titulo="Fila vazia" texto="Nenhuma solicitação com esses filtros." />
        ) : (
          <ul className="flex flex-col divide-y divide-fio">
            {dados.map((s) => (
              <li key={s.id} className={`py-2 ${novos.has(s.id) ? 'rounded-controle bg-alerta-atencao/40 px-2' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <BotaoLinha variante="linha" aria-current={aberta === s.id ? 'true' : undefined} className={cn('w-auto min-w-0 flex-1 flex-wrap items-center gap-2 rounded-controle border-0 px-2 py-1.5', aberta === s.id && 'bg-campo')} onClick={() => aoSelecionar(aberta === s.id ? null : s.id)}>
                    <SeloPrioridade s={s} />
                    {novos.has(s.id) && <Badge variant="warning">novo</Badge>}
                    <span className="font-semibold tabular-nums text-tinta">{formatarEspera(s.espera_segundos + decorrido)}</span>
                    <span className="font-medium text-tinta">{s.paciente.nome}{s.paciente_nao_identificado && ' (não identificado)'}{docMae(s.paciente.mae)}</span>
                    <span className="text-tinta-apoio">{resumoPedido(s)}</span>
                    {s.isolamento && <Badge variant="destructive">isolamento</Badge>}
                    <SeloSla sla={s.sla} />
                    {(s.vulnerabilidades ?? []).map((v) => <Badge key={v} variant="secondary">{VULNERABILIDADES[v]}</Badge>)}
                    <span className="text-tinta-sussurro">{CARATER[s.carater]} · de {s.origem.nome} · nº {s.numero}</span>
                  </BotaoLinha>
                  <Badge variant="info">{STATUS[s.status]}</Badge>
                  {s.assumida_por && !s.assumida_por_mim && <span className="text-tinta-sussurro">com {s.assumida_por}</span>}
                  {souRegulador && !s.assumida_por && (
                    <Button size="xs" onClick={() => assumir.mutate(s.id)} disabled={assumir.isPending}>Assumir</Button>
                  )}
                  {s.assumida_por_mim && (
                    <>
                      <span className="text-sucesso">com você</span>
                      <Button size="xs" variant="outline" onClick={() => soltar.mutate(s.id)} disabled={soltar.isPending}>Devolver à fila</Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ── decisão do regulador e respostas da origem (Fase 4, tarefa 4) ─────────────
function BlocosDecisao({ s }: { s: Solicitacao }) {
  const destino = s.destino_tipo === 'rede' ? s.destino_unidade?.nome : s.destino_tipo === 'externo' ? s.destino_externo : null
  return (
    <>
      {s.status === 'autorizada' && (
        <div className="rounded-controle border border-sucesso/30 bg-sucesso/5 px-3 py-2 text-tinta">
          <b>Autorizada</b> por {s.autorizada_por ?? '—'}{s.autorizada_em ? ` em ${fmtDataHora(s.autorizada_em)}` : ''}: destino {destino ?? '—'}
          {s.transporte_central && <> · transporte {TRANSPORTES[s.transporte_central] ?? s.transporte_central}</>}
          {s.data_prevista && <> · previsto para {fmtDataHora(s.data_prevista)}</>}
          {s.observacao_decisao && <span className="block text-tinta-apoio">{s.observacao_decisao}</span>}
        </div>
      )}
      {s.status === 'negada' && (
        <div className="rounded-controle border border-critico/30 bg-alerta-critico px-3 py-2 text-tinta">
          <b>Negada</b> por {s.negada_por ?? '—'}{s.negada_em ? ` em ${fmtDataHora(s.negada_em)}` : ''}: {s.motivo_negacao ? MOTIVOS_NEGACAO[s.motivo_negacao] : ''}
          {s.observacao_decisao && <span className="block text-tinta-apoio">{s.observacao_decisao}</span>}
        </div>
      )}
      {s.motivo_devolucao && (s.status === 'devolvida' || s.reenviada_em) && (
        <div className="rounded-controle border border-atencao/30 bg-alerta-atencao px-3 py-2 text-tinta">
          <b>Devolvida</b> por {s.devolvida_por ?? '—'}{s.devolvida_em ? ` em ${fmtDataHora(s.devolvida_em)}` : ''}: {s.motivo_devolucao}
          {s.reenviada_em && <span className="block text-tinta-apoio">Corrigida e reenviada em {fmtDataHora(s.reenviada_em)} (mantém a posição na fila).</span>}
        </div>
      )}
      {s.pendencia_pergunta && (
        <div className="rounded-controle border border-fio bg-superficie px-3 py-2 text-tinta">
          <b>Pergunta da central</b> ({s.pendencia_por ?? '—'}{s.pendencia_em ? `, ${fmtDataHora(s.pendencia_em)}` : ''}): {s.pendencia_pergunta}
          {s.pendencia_resposta
            ? <span className="block text-tinta-apoio">Resposta de {s.pendencia_respondida_por ?? '—'}{s.pendencia_respondida_em ? ` (${fmtDataHora(s.pendencia_respondida_em)})` : ''}: {s.pendencia_resposta}</span>
            : <span className="block text-atencao">Aguardando resposta da origem.</span>}
        </div>
      )}
    </>
  )
}

function ResponderPendencia({ s, aoFim }: { s: Solicitacao; aoFim: () => void }) {
  const [resposta, setResposta] = React.useState('')
  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_responder_pendencia', { p_id: s.id, p_resposta: resposta.trim() })
      if (error) throw error
    },
    onSuccess: () => { setResposta(''); aoFim() },
  })
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Campo id={`resp-${s.id}`} rotulo="Resposta à central" className="min-w-60 flex-1">
        <textarea id={`resp-${s.id}`} rows={2} className="rounded-controle border border-fio bg-campo px-2 py-1.5" value={resposta} onChange={(e) => setResposta(e.target.value)} />
      </Campo>
      <Button size="sm" onClick={() => enviar.mutate()} disabled={enviar.isPending || resposta.trim().length < 5}>Responder</Button>
      <MensagemErro texto={enviar.error ? (enviar.error as Error).message : null} />
    </div>
  )
}

/** Corrige o pedido devolvido e reenvia; mantém a posição na fila. */
function Reenviar({ s, aoFim }: { s: Solicitacao; aoFim: () => void }) {
  const [cid, setCid] = React.useState(s.cid)
  const [cidRotulo, setCidRotulo] = React.useState(`${s.cid} ${s.cid_descricao ?? ''}`)
  const [d, setD] = React.useState({
    quadro_clinico: s.quadro_clinico, tempo_evolucao: s.tempo_evolucao ?? '', sinais_vitais: s.sinais_vitais ?? '',
    exames: s.exames ?? '', medicacoes: s.medicacoes ?? '', hipotese: s.hipotese ?? '',
  })
  const set = (k: keyof typeof d, v: string) => setD((x) => ({ ...x, [k]: v }))
  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_reenviar', { p_id: s.id, p_dados: { ...d, cid } })
      if (error) throw error
    },
    onSuccess: aoFim,
  })
  return (
    <div className="flex flex-col gap-2 rounded-controle border border-atencao/30 p-3">
      <span className="font-medium text-tinta">Corrigir e reenviar</span>
      <CampoTerminologia tipo="cid10" escolhido={cidRotulo} rotulo="CID-10"
        onEscolher={(c, r) => { setCid(c); setCidRotulo(r) }} onLimpar={() => { setCid(''); setCidRotulo('') }} />
      <Campo id={`re-quadro-${s.id}`} rotulo="Quadro clínico">
        <textarea id={`re-quadro-${s.id}`} rows={3} className="rounded-controle border border-fio bg-campo px-2 py-1.5" value={d.quadro_clinico} onChange={(e) => set('quadro_clinico', e.target.value)} />
      </Campo>
      <div className="grid gap-2 sm:grid-cols-2">
        <Campo id={`re-evol-${s.id}`} rotulo="Tempo de evolução"><Input id={`re-evol-${s.id}`} className="h-8" value={d.tempo_evolucao} onChange={(e) => set('tempo_evolucao', e.target.value)} /></Campo>
        <Campo id={`re-sv-${s.id}`} rotulo="Sinais vitais, com a hora"><Input id={`re-sv-${s.id}`} className="h-8" value={d.sinais_vitais} onChange={(e) => set('sinais_vitais', e.target.value)} /></Campo>
        <Campo id={`re-ex-${s.id}`} rotulo="Exames, com a data"><Input id={`re-ex-${s.id}`} className="h-8" value={d.exames} onChange={(e) => set('exames', e.target.value)} /></Campo>
        <Campo id={`re-med-${s.id}`} rotulo="Tratamento e medicações"><Input id={`re-med-${s.id}`} className="h-8" value={d.medicacoes} onChange={(e) => set('medicacoes', e.target.value)} /></Campo>
        <Campo id={`re-hip-${s.id}`} rotulo="Hipótese"><Input id={`re-hip-${s.id}`} className="h-8" value={d.hipotese} onChange={(e) => set('hipotese', e.target.value)} /></Campo>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => enviar.mutate()} disabled={enviar.isPending || !cid || d.quadro_clinico.trim().length < 20}>
          <Send className="size-4" /> Reenviar à central
        </Button>
        <MensagemErro texto={enviar.error ? (enviar.error as Error).message : null} />
      </div>
    </div>
  )
}

type Acao = 'autorizar' | 'negar' | 'devolver' | 'pendencia'
function PainelDecisao({ s, centralId, aoFim }: { s: Solicitacao; centralId: string; aoFim: () => void }) {
  const ctx = useQuery({
    queryKey: ['regulacao-contexto', centralId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_contexto', { p_unidade: centralId })
      if (error) throw error
      return data as unknown as Contexto
    },
  })
  const [acao, setAcao] = React.useState<Acao | null>(null)
  const [destinoTipo, setDestinoTipo] = React.useState<'rede' | 'externo'>(s.destino_tipo === 'externo' ? 'externo' : 'rede')
  const [destinoUnidade, setDestinoUnidade] = React.useState(s.destino_unidade?.id ?? '')
  const [destinoExterno, setDestinoExterno] = React.useState(s.destino_externo ?? '')
  const [transporte, setTransporte] = React.useState('')
  const [dataPrevista, setDataPrevista] = React.useState('')
  const [texto, setTexto] = React.useState('')
  const [motivo, setMotivo] = React.useState<MotivoNegacao | ''>('')
  const [verMapa, setVerMapa] = React.useState(false)
  const decidir = useMutation({
    mutationFn: async () => {
      const r = acao === 'autorizar'
        ? await supabase.rpc('regulacao_autorizar', {
            p_id: s.id, p_destino_tipo: destinoTipo,
            p_destino_unidade_id: destinoTipo === 'rede' ? destinoUnidade || null : null,
            p_destino_externo: destinoTipo === 'externo' ? destinoExterno.trim() : null,
            p_transporte: transporte || null, p_data_prevista: dataHoraLocalParaIso(dataPrevista), p_observacao: texto.trim() || null,
          })
        : acao === 'negar' ? await supabase.rpc('regulacao_negar', { p_id: s.id, p_motivo: motivo, p_texto: texto.trim() })
        : acao === 'devolver' ? await supabase.rpc('regulacao_devolver', { p_id: s.id, p_motivo: texto.trim() })
        : await supabase.rpc('regulacao_pendencia', { p_id: s.id, p_pergunta: texto.trim() })
      if (r.error) throw r.error
    },
    onSuccess: () => { setAcao(null); setTexto(''); setMotivo(''); aoFim() },
  })
  const pronto = acao === 'autorizar' ? (destinoTipo === 'rede' ? !!destinoUnidade : destinoExterno.trim().length >= 3)
    : acao === 'negar' ? !!motivo && texto.trim().length >= 10
    : texto.trim().length >= 10
  const BOTOES: [Acao, string, 'default' | 'outline' | 'destructive'][] = [
    ['autorizar', 'Autorizar', 'default'], ['pendencia', 'Pergunta à origem', 'outline'],
    ['devolver', 'Devolver à origem', 'outline'], ['negar', 'Negar', 'destructive'],
  ]
  return (
    <div className="flex flex-col gap-2 rounded-controle border border-acao/30 p-3">
      <span className="font-medium text-tinta">Decisão da central</span>
      <div className="flex flex-wrap gap-2">
        {BOTOES.filter(([a]) => !(a === 'pendencia' && s.status === 'pendencia')).map(([a, rotulo, variante]) => (
          <Button key={a} size="xs" variant={acao === a ? 'default' : variante === 'destructive' ? 'destructive' : 'outline'} onClick={() => setAcao(acao === a ? null : a)}>{rotulo}</Button>
        ))}
      </div>
      {acao === 'autorizar' && (
        <div className="grid gap-2 sm:grid-cols-3">
          <Campo id={`aut-dt-${s.id}`} rotulo="Destino (obrigatório)">
            <CampoSelecao id={`aut-dt-${s.id}`} tamanho="compacto" value={destinoTipo} onChange={(e) => setDestinoTipo(e.target.value as 'rede' | 'externo')}>
              <option value="rede">Unidade da rede</option><option value="externo">Serviço fora da rede</option>
            </CampoSelecao>
          </Campo>
          {destinoTipo === 'rede' ? (
            <Campo id={`aut-un-${s.id}`} rotulo="Unidade" className="sm:col-span-2">
              <CampoSelecao id={`aut-un-${s.id}`} tamanho="compacto" value={destinoUnidade} onChange={(e) => setDestinoUnidade(e.target.value)}>
                <option value="">Escolha…</option>
                {(ctx.data?.unidades_rede ?? []).filter((u) => u.id !== s.origem.id).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </CampoSelecao>
            </Campo>
          ) : (
            <Campo id={`aut-ext-${s.id}`} rotulo="Serviço (nome e município)" className="sm:col-span-2">
              <Input id={`aut-ext-${s.id}`} className="h-8" value={destinoExterno} onChange={(e) => setDestinoExterno(e.target.value)} />
            </Campo>
          )}
          <Campo id={`aut-tr-${s.id}`} rotulo="Transporte (opcional)">
            <CampoSelecao id={`aut-tr-${s.id}`} tamanho="compacto" value={transporte} onChange={(e) => setTransporte(e.target.value)}>
              <option value="">Não definir agora</option>
              {Object.entries(TRANSPORTES).map(([k, x]) => <option key={k} value={k}>{x}</option>)}
            </CampoSelecao>
          </Campo>
          <Campo id={`aut-dp-${s.id}`} rotulo="Data e hora previstas (opcional)">
            <Input id={`aut-dp-${s.id}`} type="datetime-local" className="h-8" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} />
          </Campo>
          <Campo id={`aut-obs-${s.id}`} rotulo="Observação (opcional)">
            <Input id={`aut-obs-${s.id}`} className="h-8" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </Campo>
          <div className="sm:col-span-3">
            <Button size="xs" variant="outline" onClick={() => setVerMapa(!verMapa)}>{verMapa ? 'Esconder o mapa de vagas' : 'Ver o mapa de vagas'}</Button>
            {verMapa && <MapaVagas unidadeId={centralId} compacto />}
          </div>
        </div>
      )}
      {acao === 'negar' && (
        <div className="grid gap-2 sm:grid-cols-3">
          <Campo id={`neg-mot-${s.id}`} rotulo="Motivo">
            <CampoSelecao id={`neg-mot-${s.id}`} tamanho="compacto" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoNegacao | '')}>
              <option value="">Escolha…</option>
              {(Object.keys(MOTIVOS_NEGACAO) as MotivoNegacao[]).map((k) => <option key={k} value={k}>{MOTIVOS_NEGACAO[k]}</option>)}
            </CampoSelecao>
          </Campo>
          <Campo id={`neg-txt-${s.id}`} rotulo="Justificativa (a origem vê)" className="sm:col-span-2">
            <Input id={`neg-txt-${s.id}`} className="h-8" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </Campo>
        </div>
      )}
      {(acao === 'devolver' || acao === 'pendencia') && (
        <Campo id={`txt-${s.id}`} rotulo={acao === 'devolver' ? 'O que a origem precisa corrigir' : 'Pergunta à origem (o pedido continua na fila)'}>
          <textarea id={`txt-${s.id}`} rows={2} className="rounded-controle border border-fio bg-campo px-2 py-1.5" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </Campo>
      )}
      {acao && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={acao === 'negar' ? 'destructive' : 'default'} onClick={() => decidir.mutate()} disabled={decidir.isPending || !pronto}>
            Confirmar: {BOTOES.find(([a]) => a === acao)![1].toLowerCase()}
          </Button>
          <span className="text-rotulo text-tinta-sussurro">O solicitante e o médico assistente recebem um aviso.</span>
        </div>
      )}
      <MensagemErro texto={decidir.error ? (decidir.error as Error).message : null} />
    </div>
  )
}
