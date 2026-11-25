// ─────────────────────────────────────────────────────────────────────────────
// Regulação (Fase 4, tarefa 1; decisões do RT de 10/10/2026, revistas em
// 11/10/2026 depois da pesquisa dos sistemas de regulação).
//
// • Super admin: define a Central de Regulação de cada organização.
// • Perfil Administrador (RT, 24/11/2026): só a regulamentação das centrais —
//   unidades reguladas, capacidades e prazos por tipo
//   (src/components/regulacao/RegulamentacaoCentrais.tsx).
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
// • Central certa (RT, 24/11/2026; migration 20270421000012): o pedido vai à
//   central que regula a unidade (sem vínculo, à principal); cada central vê os
//   pedidos dela; o regulador consulta o que as unidades reguladas têm ao
//   decidir o destino (src/components/regulacao/CapacidadesReguladas.tsx).
// • Nova solicitação: src/components/regulacao/NovaSolicitacao.tsx (também
//   dentro do paciente, sem sair da tela; RT, 24/11/2026).
// Migration 20261107000001_regulacao_solicitacao.sql; src/lib/regulacao.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Send, Waypoints } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { AnexosRegulacao } from '@/components/regulacao/AnexosRegulacao'
import { ConversaRegulacao } from '@/components/regulacao/ConversaRegulacao'
import { PacientesRegulacao } from '@/components/regulacao/PacientesRegulacao'
import { Campo, CampoTerminologia, NovaSolicitacao, type InicialSolicitacao, type Paciente, type PedidoEnviado } from '@/components/regulacao/NovaSolicitacao'
import { useCriterios } from '@/components/regulacao/useCriterios'
import { LeituraTransferencia } from '@/components/transferencia/DocumentoTransferencia'
import { IndicadoresRegulacao } from '@/components/regulacao/IndicadoresRegulacao'
import { AcoesDestino, BlocoDestino, DestinoExterno, RecebidosDestino, SaidaOrigem, type PedidoDestino } from '@/components/regulacao/DestinoRegulacao'
import { MapaVagas, OfertaSetores } from '@/components/regulacao/MapaVagas'
import { PainelSla, PrazosCentral, PrazosDoPedido, SeloSla, type Evolucao } from '@/components/regulacao/SlaRegulacao'
import { RegulamentacaoCentrais } from '@/components/regulacao/RegulamentacaoCentrais'
import { CapacidadesReguladas } from '@/components/regulacao/CapacidadesReguladas'
import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import {
  CARATER, INTERNACAO_PSIQUIATRICA, ISOLAMENTOS, PRIORIDADES, STATUS, TIPOS, TIPOS_LEITO, TRANSPORTES,
  MOTIVOS_NEGACAO, VULNERABILIDADES, dataHoraLocalParaIso, emDecisao,
  filtrosParaEnvio, formatarEspera, novosDesde, prioridadeEfetiva, resumoPedido,
  type Carater, type DestinoTipo, type FiltrosFila, type Prioridade, type StatusRegulacao, type TipoSolicitacao,
  type MotivoNegacao, type Sla, type Vulnerabilidade,
} from '@/lib/regulacao'
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

// RN vinculado à mãe: a regulação o identifica pelo CNS/CPF da mãe (Portão 2, tarefa 5)
const docMae = (m?: { nome: string; cns: string | null; cpf: string | null } | null) =>
  m ? ` · mãe: ${m.nome}${m.cns ? ` · CNS ${m.cns}` : m.cpf ? ` · CPF ${m.cpf}` : ' · sem documento'}` : ''

export default function Regulacao() {
  const { unidadeAtiva, papeisDaUnidade, papelAtivo, ehSuperAdmin } = useUnidade()
  // RT, 24/11/2026: no perfil Administrador a página é só a regulamentação das
  // centrais (src/components/regulacao/RegulamentacaoCentrais.tsx)
  const modoAdmin = papelAtivo === 'admin'
  const unidadeId = modoAdmin ? '' : unidadeAtiva?.unidade_id ?? ''
  const souGestorDaUnidade = papeisDaUnidade.includes('gestor')
  const [recemEnviada, setRecemEnviada] = React.useState<string | null>(null)
  const abrirEnviada = (r: PedidoEnviado) => setRecemEnviada(r.id)
  const [aba, setAba] = React.useState<'pedidos' | 'indicadores' | 'pacientes'>('pedidos')
  // 5A, tarefa 5 (H2): vindo da consulta da UBS, o formulário abre preenchido
  const [busca] = useSearchParams()
  const pacienteUrl = busca.get('paciente')
  const daUrl = useQuery({
    queryKey: ['regulacao-paciente-url', pacienteUrl],
    enabled: !!pacienteUrl && !modoAdmin,
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
  if (modoAdmin) return <RegulamentacaoCentrais superAdmin={ehSuperAdmin} />
  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <TituloPagina icone={Waypoints} titulo="Regulação"
        descricao={c?.sou_central
          ? `Solicitações recebidas pela ${c.central?.nome ?? 'Central de Regulação'}.`
          : `Pedidos de consulta, exame, leito ou transferência para a ${c?.central?.nome ?? 'Central de Regulação da rede'}.`} />
      {c?.sou_super_admin && <Centrais />}
      {/* Indicadores (tarefa 10): central (rede) e gestor da unidade (origem e destino) */}
      {c && (c.sou_central || (c.central && souGestorDaUnidade)) && (
        <div className="flex gap-1.5" role="tablist" aria-label="Regulação">
          <Button size="sm" role="tab" aria-selected={aba === 'pedidos'} variant={aba === 'pedidos' ? 'default' : 'outline'} onClick={() => setAba('pedidos')}>Pedidos</Button>
          {/* gestor da unidade (RT, 24/11/2026): os internados por setor, o que está pendente e o que o regulador pergunta */}
          {!c.sou_central && <Button size="sm" role="tab" aria-selected={aba === 'pacientes'} variant={aba === 'pacientes' ? 'default' : 'outline'} onClick={() => setAba('pacientes')}>Pacientes por setor</Button>}
          <Button size="sm" role="tab" aria-selected={aba === 'indicadores'} variant={aba === 'indicadores' ? 'default' : 'outline'} onClick={() => setAba('indicadores')}>Indicadores</Button>
        </div>
      )}
      {c && aba === 'pacientes' && !c.sou_central && c.central && souGestorDaUnidade ? (
        <PacientesRegulacao unidadeId={unidadeId} modo="gestor" />
      ) : c && aba === 'indicadores' && (c.sou_central || (c.central && souGestorDaUnidade)) ? (
        <IndicadoresRegulacao unidadeId={unidadeId} unidades={c.sou_central ? c.unidades_rede : []} />
      ) : !unidadeId ? null : ctx.isLoading ? <Spinner /> : ctx.error ? <MensagemErro texto={(ctx.error as Error).message} /> : !c ? null
        : c.sou_central ? (
          <>
            <Fila centralId={unidadeId} souRegulador={c.sou_regulador} />
            <PainelSla unidadeId={unidadeId} central
              detalhe={(id) => <Detalhe id={id} unidadeId={unidadeId} central podeRegistrarExterno={c.sou_regulador} />} />
            <MapaVagas unidadeId={unidadeId} />
            <CapacidadesReguladas centralId={unidadeId} />
            <PrazosCentral unidadeId={unidadeId} editavel />
            <Criterios unidadeId={unidadeId} editavel />
          </>
        )
        : !c.central ? (
          <Vazio icone={Waypoints} titulo="A rede ainda não tem Central de Regulação"
            texto="A administração da plataforma define a central da organização. Até lá, não há para onde enviar." />
        ) : c.pode_solicitar ? (
          <>
            <NovaSolicitacao key={inicial?.paciente.id ?? 'nova'} unidadeId={unidadeId} ctx={c} aoEnviar={abrirEnviada} inicial={inicial} />
            <PainelSla unidadeId={unidadeId} central={false}
              detalhe={(id) => <Detalhe id={id} unidadeId={unidadeId} central={false} podeRegistrarExterno={false} />} />
            <Lista unidadeId={unidadeId} central={false} podeRegistrarExterno={false} abrir={recemEnviada} />
            <RecebidosDestino unidadeId={unidadeId}
              detalhe={(id) => <Detalhe id={id} unidadeId={unidadeId} central={false} podeRegistrarExterno={false} />} />
            {souGestorDaUnidade && (
              <>
                <MapaVagas unidadeId={unidadeId} />
                <OfertaSetores unidadeId={unidadeId} />
              </>
            )}
          </>
        ) : (
          <Vazio icone={Waypoints} titulo="Sem acesso à regulação nesta unidade" texto="Solicitam o médico e o gestor da unidade; quem regula é a central da rede." />
        )}
    </div>
  )
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


function Lista({ unidadeId, central, podeRegistrarExterno, abrir }: { unidadeId: string; central: boolean; podeRegistrarExterno: boolean; abrir?: string | null }) {
  const lista = useQuery({
    queryKey: ['regulacao-lista', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_lista', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as Solicitacao[]
    },
  })
  const [aberta, setAberta] = React.useState<string | null>(null)
  // pedido recém-enviado: abre o detalhe (com os anexos) na lista
  const [abrirVisto, setAbrirVisto] = React.useState(abrir)
  if (abrir !== abrirVisto) {
    setAbrirVisto(abrir)
    if (abrir) setAberta(abrir)
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">{central ? 'Recebidas' : 'Solicitações da unidade'}</CardTitle>
        <CardDescription>Clique num pedido para ver o detalhe, os anexos e o histórico.</CardDescription>
        {central && <CardDescription>As 200 mais recentes.</CardDescription>}
      </CardHeader>
      <CardContent className="text-apoio">
        {lista.isLoading ? <EsqueletoLinhas linhas={5} rotulo="Carregando os pedidos…" /> : lista.error ? <MensagemErro texto={(lista.error as Error).message} /> : (lista.data ?? []).length === 0 ? (
          <Vazio icone={Waypoints} titulo="Nenhuma solicitação" texto={central ? 'As solicitações das unidades da rede aparecem aqui.' : 'As solicitações enviadas pela unidade aparecem aqui.'} />
        ) : (
          <ul className="flex flex-col divide-y divide-fio">
            {(lista.data ?? []).map((s) => (
              <li key={s.id} className="py-2">
                <BotaoLinha variante="linha" aria-expanded={aberta === s.id}
                  className="flex-wrap items-center gap-2 rounded-controle border-0 px-1 py-0.5 hover:bg-campo"
                  onClick={() => setAberta(aberta === s.id ? null : s.id)}>
                  {aberta === s.id ? <ChevronDown className="size-4 text-tinta-sussurro" aria-hidden /> : <ChevronRight className="size-4 text-tinta-sussurro" aria-hidden />}
                  <span className="text-tinta-sussurro">nº {s.numero}</span>
                  <SeloPrioridade s={s} />
                  <span className="text-tinta-sussurro">{CARATER[s.carater]}</span>
                  <span className="font-medium text-tinta">{s.paciente.nome}{s.paciente_nao_identificado && ' (não identificado)'}{docMae(s.paciente.mae)}</span>
                  <span className="text-tinta-apoio">{resumoPedido(s)}</span>
                  {central && <span className="text-tinta-sussurro">de {s.origem.nome}</span>}
                  <SeloSla sla={s.sla} />
                  <Badge variant={s.status === 'cancelada' ? 'secondary' : 'info'} className="ml-auto">{STATUS[s.status]}</Badge>
                  <span className="text-tinta-sussurro">{fmtDataHora(s.criada_em)}</span>
                  <span className="text-rotulo text-acao">{aberta === s.id ? 'Fechar' : 'Ver detalhes'}</span>
                </BotaoLinha>
                {aberta === s.id && <Detalhe id={s.id} unidadeId={unidadeId} central={central} podeRegistrarExterno={podeRegistrarExterno} />}
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

function Detalhe({ id, unidadeId, central, podeRegistrarExterno }: { id: string; unidadeId: string; central: boolean; podeRegistrarExterno: boolean }) {
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
  const [motivo, setMotivo] = React.useState('')
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
  }
  const priorizar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_priorizar', { p_id: id, p_prioridade: novaPrioridade, p_motivo: motivoPrioridade.trim() })
      if (error) throw error
    },
    onSuccess: () => { setNovaPrioridade(''); setMotivoPrioridade(''); recarregar() },
  })
  const cancelar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_cancelar', { p_id: id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setMotivo(''); recarregar() },
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
  if (d.isLoading) return <Spinner />
  if (d.error || !d.data) return <MensagemErro texto={d.error ? (d.error as Error).message : 'Não encontrada.'} />
  const s = d.data
  const destino = s.destino_tipo === 'rede' ? s.destino_unidade?.nome : s.destino_tipo === 'externo' ? `${s.destino_externo} (fora da rede)` : 'A definir pela regulação'
  const cancelavel = !central && s.origem_pode_responder
    && ['rascunho', 'enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino', 'autorizada', 'agendada'].includes(s.status)
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-controle border border-fio bg-campo p-3">
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        <Linha rotulo="Pedido" valor={resumoPedido(s)} />
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
      {s.motivo_cancelamento && <p className="text-tinta-apoio">Cancelada ({s.cancelamento_origem}): {s.motivo_cancelamento}</p>}
      <BlocosDecisao s={s} />
      <BlocoDestino s={s} />
      <AcoesDestino s={s} aoFim={recarregar} nir={souNir && s.destino_unidade?.id === unidadeId} />
      {!central && <SaidaOrigem s={s} aoFim={recarregar} nir={souNir && s.origem.id === unidadeId} />}
      {central && podeRegistrarExterno && <DestinoExterno s={s} aoFim={recarregar} />}
      <PrazosDoPedido id={s.id} sla={s.sla} tempos={s.tempos ?? []} evolucoes={s.evolucoes ?? []}
        podeEvoluir={!central && !!s.pode_evoluir} aoFim={recarregar} />
      <AnexosRegulacao solicitacaoId={s.id} />
      {/* R3 (RT, 24/11/2026): a conversa da origem com o médico regulador */}
      <ConversaRegulacao solicitacaoId={s.id} aoEnviar={recarregar} />
      {/* lacuna 7 (T9): o documento de transferência da origem (origem, central, NIR e destino na rede) */}
      {(s.tipo === 'transferencia' || s.tipo === 'leito') && <LeituraTransferencia solicitacaoId={s.id} />}
      {!central && (s.origem_pode_responder || (souNir && s.origem.id === unidadeId)) && s.status === 'pendencia' && <ResponderPendencia s={s} aoFim={recarregar} />}
      {!central && s.origem_pode_responder && s.status === 'devolvida' && <Reenviar s={s} aoFim={recarregar} />}
      {central && podeRegistrarExterno && emDecisao(s.status) && <PainelDecisao s={s} centralId={unidadeId} aoFim={recarregar} />}
      <ul className="text-rotulo text-tinta-sussurro">
        {(s.eventos ?? []).map((e, i) => <li key={i}>{fmtDataHora(e.em)} · {e.evento.replace('_', ' ')} · {e.por ?? '—'}</li>)}
      </ul>
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
      {cancelavel && (
        <div className="flex flex-wrap items-end gap-2">
          <Campo id={`canc-${id}`} rotulo="Motivo do cancelamento" className="min-w-60 flex-1"><Input id={`canc-${id}`} className="h-8" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
          <Button size="sm" variant="destructive" onClick={() => cancelar.mutate()} disabled={cancelar.isPending || motivo.trim().length < 10}>Cancelar solicitação</Button>
        </div>
      )}
      <MensagemErro texto={(cancelar.error ?? externo.error ?? priorizar.error) ? ((cancelar.error ?? externo.error ?? priorizar.error) as Error).message : null} />
    </div>
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

function Fila({ centralId, souRegulador }: { centralId: string; souRegulador: boolean }) {
  const qc = useQueryClient()
  const [filtros, setFiltros] = React.useState<FiltrosFila>({})
  const [busca, setBusca] = React.useState('')
  const [aberta, setAberta] = React.useState<string | null>(null)
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
        </div>
        <MensagemErro texto={(fila.error ?? assumir.error ?? soltar.error) ? ((fila.error ?? assumir.error ?? soltar.error) as Error).message : null} />
        {fila.isLoading ? <Spinner /> : (r?.dados ?? []).length === 0 ? (
          <Vazio icone={Waypoints} titulo="Fila vazia" texto="Nenhuma solicitação com esses filtros." />
        ) : (
          <ul className="flex flex-col divide-y divide-fio">
            {r!.dados.map((s) => (
              <li key={s.id} className={`py-2 ${novos.has(s.id) ? 'rounded-controle bg-alerta-atencao/40 px-2' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <BotaoLinha variante="linha" aria-expanded={aberta === s.id} className="w-auto min-w-0 flex-1 flex-wrap items-center gap-2 rounded-controle border-0 px-2 py-1.5" onClick={() => setAberta(aberta === s.id ? null : s.id)}>
                    <SeloPrioridade s={s} />
                    {novos.has(s.id) && <Badge variant="warning">novo</Badge>}
                    <span className="font-semibold tabular-nums text-tinta">{formatarEspera(s.espera_segundos + decorrido)}</span>
                    <span className="font-medium text-tinta">{s.paciente.nome}{s.paciente_nao_identificado && ' (não identificado)'}{docMae(s.paciente.mae)}</span>
                    <span className="text-tinta-apoio">{resumoPedido(s)}</span>
                    {s.isolamento && <Badge variant="destructive">isolamento</Badge>}
                    <SeloSla sla={s.sla} />
                    {(s.vulnerabilidades ?? []).map((v) => <Badge key={v} variant="secondary">{VULNERABILIDADES[v]}</Badge>)}
                    <span className="text-tinta-sussurro">{CARATER[s.carater]} · de {s.origem.nome} · nº {s.numero}</span>
                    <ChevronDown className={cn('ml-auto size-4 shrink-0 text-tinta-sussurro', aberta === s.id && 'rotate-180')} aria-hidden />
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
                {aberta === s.id && <Detalhe id={s.id} unidadeId={centralId} central podeRegistrarExterno={souRegulador} />}
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
  const [verCapacidades, setVerCapacidades] = React.useState(false)
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
          <div className="flex flex-col gap-2 sm:col-span-3">
            <div className="flex flex-wrap gap-2">
              <Button size="xs" variant="outline" onClick={() => setVerMapa(!verMapa)}>{verMapa ? 'Esconder o mapa de vagas' : 'Ver o mapa de vagas'}</Button>
              {/* RT, 24/11/2026: o que as unidades reguladas têm, como consulta ao decidir o destino */}
              <Button size="xs" variant="outline" onClick={() => setVerCapacidades(!verCapacidades)}>
                {verCapacidades ? 'Esconder o que as unidades têm' : 'Ver o que as unidades têm'}
              </Button>
            </div>
            {verMapa && <MapaVagas unidadeId={centralId} compacto />}
            {verCapacidades && (
              <CapacidadesReguladas centralId={centralId} compacto
                pedido={{ tipo: s.tipo, tipo_leito: s.tipo_leito, especialidade: s.especialidade }}
                origemId={s.origem.id} aoEscolher={(id) => { setDestinoTipo('rede'); setDestinoUnidade(id) }} />
            )}
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
