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
// • Modelo do RT (25/11/2026, RG1–RG8): na central, a fila em duas colunas com
//   o dossiê (src/components/regulacao/ConsoleRegulador.tsx e
//   DossieRegulador.tsx), vagas compatíveis, isolamento com situação e agente,
//   aba Por município / origem e os indicadores da fila
//   (migration 20270425000020).
// Migration 20261107000001_regulacao_solicitacao.sql; src/lib/regulacao.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Send, Waypoints, X } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { AnexosRegulacao } from '@/components/regulacao/AnexosRegulacao'
import { ROTULO_DOCUMENTO } from '@/components/documento/documentos'
import { ConversaRegulacao } from '@/components/regulacao/ConversaRegulacao'
import { PacientesRegulacao } from '@/components/regulacao/PacientesRegulacao'
import { Campo, CampoTerminologia, NovaSolicitacao, type InicialSolicitacao, type Paciente, type PedidoEnviado } from '@/components/regulacao/NovaSolicitacao'
import { useCriterios } from '@/components/regulacao/useCriterios'
import { LeituraTransferencia } from '@/components/transferencia/DocumentoTransferencia'
import { IndicadoresRegulacao } from '@/components/regulacao/IndicadoresRegulacao'
import { AcoesDestino, BlocoDestino, DestinoExterno, RecebidosDestino, SaidaOrigem, type PedidoDestino } from '@/components/regulacao/DestinoRegulacao'
import { MapaVagas, OfertaSetores } from '@/components/regulacao/MapaVagas'
import { AbasConsole, AtualizadoEm, ConsoleOrigem, ConsoleRegulador, IndicadoresFila, PorMunicipio } from '@/components/regulacao/ConsoleRegulador'
import type { ConversaSlot, ControleDecisao } from '@/components/regulacao/DossieRegulador'
import type { LeitosTipo } from '@/lib/regulacaoFila'
import { useFilaCentral, useVagasCentral } from '@/components/regulacao/useRegulacaoCentral'
import { FormEvolucao, PainelSla, PrazosCentral, PrioridadeCalma, SeloSla, type Evolucao } from '@/components/regulacao/SlaRegulacao'
import { LinhaDoTempoPedido } from '@/components/regulacao/LinhaDoTempoPedido'
import { DialogoMotivo, ListaComPainel, MenuAcoesPedido } from '@/components/regulacao/PainelPedido'
import { RegulamentacaoCentrais } from '@/components/regulacao/RegulamentacaoCentrais'
import { CapacidadesReguladas } from '@/components/regulacao/CapacidadesReguladas'
import { Abas, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { textoIsolamento } from '@/lib/isolamentoPedido'
import {
  CARATER, INTERNACAO_PSIQUIATRICA, ISOLAMENTOS, PRIORIDADES, STATUS, TIPOS_LEITO, TRANSPORTES,
  MOTIVOS_NEGACAO, VULNERABILIDADES, dataHoraLocalParaIso, emDecisao,
  prioridadeEfetiva, resumoPedido,
  type Carater, type DestinoTipo, type Prioridade, type StatusRegulacao, type TipoSolicitacao,
  type MotivoNegacao, type Sla, type Vulnerabilidade,
} from '@/lib/regulacao'
import { esperandoDecisao, montarLinhaDoTempo } from '@/lib/regulacaoLinhaTempo'
import type { Conversa } from '@/lib/regulacaoPaciente'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
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
  /** B-04 (RT, 25/11/2026): todos os tipos do pedido; vazio ou ausente = só o principal */
  isolamento_tipos?: string[] | null
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


// RN vinculado à mãe: a regulação o identifica pelo CNS/CPF da mãe (Portão 2, tarefa 5)
const docMae = (m?: { nome: string; cns: string | null; cpf: string | null } | null) =>
  m ? ` · mãe: ${m.nome}${m.cns ? ` · CNS ${m.cns}` : m.cpf ? ` · CPF ${m.cpf}` : ' · sem documento'}` : ''

/**
 * Abas do quadro (MR2 = A, RT 24/11/2026). Na origem: Esperando decisão (com o
 * prazo), Enviados (o resto, sem repetir os que esperam), Recebidos da central
 * e Mapa de vagas. Na central: Esperando decisão (a fila), Mapa de vagas e
 * Prazos e critérios. Indicadores para a central e o gestor; Pacientes por
 * setor para o gestor da unidade.
 */
type AbaQuadro = 'esperando' | 'enviados' | 'recebidos' | 'mapa' | 'pacientes' | 'municipios' | 'config' | 'indicadores'

export default function Regulacao() {
  const { unidadeAtiva, papeisDaUnidade, papelAtivo, ehSuperAdmin } = useUnidade()
  // RT, 24/11/2026: no perfil Administrador a página é só a regulamentação das
  // centrais (src/components/regulacao/RegulamentacaoCentrais.tsx)
  const modoAdmin = papelAtivo === 'admin'
  const unidadeId = modoAdmin ? '' : unidadeAtiva?.unidade_id ?? ''
  const souGestorDaUnidade = papeisDaUnidade.includes('gestor')
  // Revisão do perfil Médico (RT 24/11/2026, M1): a configuração (centrais,
  // setores ofertados, serviços do mapa) fica com o admin e o gestor. No perfil
  // em foco Médico o mapa é só consulta, mesmo para quem também é gestor.
  const focoConfig = papelAtivo === 'admin' || papelAtivo === 'gestor'
  const [aba, setAba] = React.useState<AbaQuadro>('esperando')
  // RD1: o pedido aberto fica no painel ao lado da lista
  const [aberto, setAberto] = React.useState<string | null>(null)
  const trocarAba = (a: AbaQuadro) => { setAba(a); setAberto(null) }
  // MR2: no perfil regulador, "Nova solicitação" é um botão no topo; nos outros
  // perfis o formulário continua aberto de saída, como antes
  const [novaAberta, setNovaAberta] = React.useState(papelAtivo !== 'regulador')
  const fecharNova = () => setNovaAberta(false)
  const abrirEnviada = (r: PedidoEnviado) => { setAba('esperando'); setAberto(r.id) }
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
  const comIndicadores = !!c && (c.sou_central || (!!c.central && souGestorDaUnidade))
  const origem = !!c && !c.sou_central && !!c.central && c.pode_solicitar
  const contas = useContasQuadro(unidadeId, !!c && (c.sou_central || origem), origem)
  // RG7/RG8 (modelo do RT, 25/11/2026): contagens da central e "Atualizado hh:mm"
  const central = useContasCentral(unidadeId, !!c?.sou_central)
  const [filtroMunicipio, setFiltroMunicipio] = React.useState('')
  const abas: [AbaQuadro, string, number | undefined][] = !c ? [] : c.sou_central ? [
    ['esperando', 'Fila de regulação', central.fila], ['mapa', 'Mapa de vagas', central.livres],
    ['municipios', 'Por município / origem', central.municipios], ['config', 'Prazos e critérios', undefined],
  ] : origem ? [
    ['esperando', 'Esperando decisão', contas.esperando], ['enviados', 'Enviados', contas.enviados], ['recebidos', 'Recebidos da central', contas.recebidos],
    // gestor da unidade (RT, 24/11/2026): o mapa e os internados por setor, com o que está pendente e o que o regulador pergunta
    ...(souGestorDaUnidade ? [['mapa', 'Mapa de vagas', undefined], ['pacientes', 'Pacientes por setor', undefined]] as [AbaQuadro, string, undefined][] : []),
  ] : []
  if (comIndicadores) abas.push(['indicadores', 'Indicadores', undefined])
  const abaVale = abas.some(([k]) => k === aba) ? aba : 'esperando'
  // Modelo do RT ("manter a ideia inicial", 25/11/2026): a central e o perfil
  // Médico regulador numa unidade de origem usam o console — abas no topo,
  // largura cheia, fila densa e dossiê.
  const consoleRegulador = !!c && (c.sou_central || (origem && papelAtivo === 'regulador'))
  const abasConsole = abas.map(([chave, rotulo, n]) => ({
    chave, rotulo, contagem: c?.sou_central && chave === 'mapa' ? central.livresTexto : n,
  }))
  const decisaoOrigem = (id: string, ctrl: ControleDecisao, aoFim: () => void) => (
    <DecisaoOrigem key={ctrl.chave} id={id} unidadeId={unidadeId} ctrl={ctrl} aoFim={aoFim} />
  )
  // o detalhe é o mesmo nas abas; muda só o lado de quem vê
  const painel = (id: string) => (
    <Detalhe key={id} id={id} unidadeId={unidadeId} central={!!c?.sou_central} podeRegistrarExterno={!!c?.sou_central && !!c?.sou_regulador}
      aoFechar={() => setAberto(null)} />
  )
  const comPainel = (lista: React.ReactNode) => (
    <ListaComPainel lista={lista} aberto={aberto} painel={painel} aoFechar={() => setAberto(null)} rotulo="Pedido de regulação aberto" />
  )
  if (modoAdmin) return <RegulamentacaoCentrais superAdmin={ehSuperAdmin} />
  return (
    // fichas calmas (M3 da revisão do Médico e unslop do regulador): a página e o painel
    <div className={cn('flex w-full flex-col gap-4 [&_[data-slot=badge]]:tracking-normal [&_[data-slot=badge]]:normal-case',
      consoleRegulador ? 'gap-3' : aberto ? 'max-w-7xl' : 'max-w-5xl')}>
      {!consoleRegulador && <TituloPagina icone={Waypoints} titulo="Regulação"
        descricao={c?.sou_central
          ? `Solicitações recebidas pela ${c.central?.nome ?? 'Central de Regulação'}.`
          : `Pedidos de consulta, exame, leito ou transferência para a ${c?.central?.nome ?? 'Central de Regulação da rede'}.`}
        acoes={origem && !novaAberta && !inicial ? <Button onClick={() => setNovaAberta(true)}><Plus /> Nova solicitação</Button> : undefined} />}
      {c?.sou_super_admin && focoConfig && <Centrais />}
      {!unidadeId ? null : ctx.isLoading ? <Spinner /> : ctx.error ? <MensagemErro texto={(ctx.error as Error).message} /> : !c ? null
        : !c.sou_central && !c.central ? (
          <Vazio icone={Waypoints} titulo="A rede ainda não tem Central de Regulação"
            texto="A administração da plataforma define a central da organização. Até lá, não há para onde enviar." />
        ) : !c.sou_central && !c.pode_solicitar ? (
          <Vazio icone={Waypoints} titulo="Sem acesso à regulação nesta unidade" texto="Solicitam o médico e o gestor da unidade; quem regula é a central da rede." />
        ) : (
          <>
            {/* MR2: os três passos do RG1; "Voltar" fecha a nova solicitação (fica aberta quando veio da consulta da UBS) */}
            {origem && (novaAberta || inicial) && (
              <NovaSolicitacao key={inicial?.paciente.id ?? 'nova'} unidadeId={unidadeId} ctx={c} aoEnviar={abrirEnviada} aoFechar={inicial ? undefined : fecharNova} emPassos inicial={inicial} />
            )}
            {consoleRegulador ? (
              <AbasConsole abas={abasConsole} valor={abaVale} onChange={trocarAba}
                direita={<>
                  <AtualizadoEm em={c.sou_central ? central.atualizadoEm : contas.atualizadoEm} />
                  {origem && !novaAberta && !inicial && <Button size="sm" onClick={() => setNovaAberta(true)}><Plus /> Nova solicitação</Button>}
                </>} />
            ) : <Abas abas={abas} valor={abaVale} onChange={trocarAba} rotulo="Regulação" className="mb-0" />}
            {abaVale === 'indicadores' ? (
              <>
                <IndicadoresRegulacao unidadeId={unidadeId} unidades={c.sou_central ? c.unidades_rede : []} />
                {c.sou_central && <IndicadoresFila centralId={unidadeId} />}
              </>
            ) : abaVale === 'pacientes' ? (
              <PacientesRegulacao unidadeId={unidadeId} modo="gestor" />
            ) : abaVale === 'municipios' ? (
              <PorMunicipio centralId={unidadeId} aoFiltrar={(m) => { setFiltroMunicipio(m); trocarAba('esperando') }} />
            ) : abaVale === 'mapa' ? (
              <>
                <MapaVagas unidadeId={unidadeId} consulta={!c.sou_central && !focoConfig} />
                {c.sou_central && <CapacidadesReguladas centralId={unidadeId} />}
                {!c.sou_central && focoConfig && <OfertaSetores unidadeId={unidadeId} />}
              </>
            ) : abaVale === 'config' ? (
              <>
                <PrazosCentral unidadeId={unidadeId} editavel />
                <Criterios unidadeId={unidadeId} editavel />
              </>
            ) : c.sou_central ? (
              <ConsoleRegulador key={filtroMunicipio} centralId={unidadeId} souRegulador={c.sou_regulador} selecionado={aberto} aoSelecionar={setAberto}
                municipioInicial={filtroMunicipio || undefined}
                conversa={CONVERSA_CENTRAL}
                decisao={(id, ctrl, aoFim) => <DecisaoCentral id={id} centralId={unidadeId} podeDecidir={c.sou_regulador} ctrl={ctrl} aoFim={aoFim} />} />
            ) : consoleRegulador && (abaVale === 'esperando' || abaVale === 'enviados' || abaVale === 'recebidos') ? (
              <ConsoleOrigem unidadeId={unidadeId} aba={abaVale} selecionado={aberto} aoSelecionar={setAberto} decisao={decisaoOrigem} conversa={CONVERSA_CENTRAL} />
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
    atualizadoEm: Math.max(sla.dataUpdatedAt, lista.dataUpdatedAt),
  }
}

/** Central: pedidos na fila, livres no mapa e municípios de origem (mesmas chaves de cache das abas). */
function useContasCentral(centralId: string, ativo: boolean) {
  const { fila, itens, atualizadoEm } = useFilaCentral(ativo ? centralId : '')
  const vagas = useVagasCentral(centralId, ativo)
  const soma = (f: (l: LeitosTipo) => number) => (vagas.data?.unidades ?? []).reduce((t, u) => t + u.leitos.reduce((a, l) => a + f(l), 0), 0)
  return {
    fila: fila.data ? itens.length : undefined,
    livres: vagas.data ? soma((l) => l.livre) : undefined,
    // "N · N iso · N p.neg" na aba do mapa (modelo do RT)
    livresTexto: vagas.data ? `${soma((l) => l.livre)} · ${soma((l) => l.livre_isolamento ?? 0)} iso · ${soma((l) => l.livre_pressao_negativa ?? 0)} p.neg` : undefined,
    municipios: fila.data ? new Set(itens.map((s) => s.municipio ?? '')).size : undefined,
    atualizadoEm,
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
  // as mensagens aparecem inteiras na conversa, logo acima: o evento "mensagem" sai da linha do tempo
  const linhaDoTempo = montarLinhaDoTempo({ eventos: s.eventos ?? [], evolucoes: s.evolucoes ?? [], mensagens: [], rotulosDocumento: ROTULO_DOCUMENTO })
  return (
    <article aria-label={`Pedido nº ${s.numero}`} className="flex flex-col text-apoio [&_[data-slot=badge]]:tracking-normal [&_[data-slot=badge]]:normal-case">
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
          {s.isolamento && <Linha rotulo="Isolamento" valor={textoIsolamento(s) ?? (s.isolamento_tipo ? ISOLAMENTOS[s.isolamento_tipo] : 'sim')} />}
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
        {/* R3 (RT, 24/11/2026): a conversa da origem com o médico regulador, junto da linha do tempo; as mensagens ficam nela, inteiras */}
        <ConversaRegulacao solicitacaoId={s.id} aoEnviar={recarregar} />
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
      <PrioridadeCalma p={ef} />
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

// ── conversa no dossiê (R3 + modelo do RT, 25/11/2026) ───────────────────────
function useContagemConversa(solicitacaoId: string): number | undefined {
  const q = useQuery({
    queryKey: ['regulacao-conversa', solicitacaoId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_conversa', { p_solicitacao: solicitacaoId })
      if (error) throw error
      return data as unknown as Conversa
    },
  })
  return q.data?.mensagens.length
}

/** A conversa com a origem no dossiê; "Cobrar na conversa" manda a mensagem pronta como pedido (RG7). */
const CONVERSA_CENTRAL: ConversaSlot = {
  Painel: ({ solicitacaoId, aoEnviar }) => <ConversaRegulacao solicitacaoId={solicitacaoId} aoEnviar={aoEnviar} />,
  useContagem: useContagemConversa,
  cobrar: async (solicitacaoId, texto) => {
    const { error } = await supabase.rpc('regulacao_conversa_enviar', { p_solicitacao: solicitacaoId, p_texto: texto, p_intencao: 'pedido' })
    if (error) throw error
  },
}

// ── decisão no dossiê do regulador (modelo do RT, 25/11/2026) ─────────────────
/**
 * O que a central decide e registra no dossiê: a decisão (com a ação vinda do
 * menu ou de "Reservar vaga"), o destino, o destino de fora e a regulação
 * externa. Os mesmos blocos do detalhe; nenhuma regra nova.
 */
function DecisaoCentral({ id, centralId, podeDecidir, ctrl, aoFim }: {
  id: string; centralId: string; podeDecidir: boolean; ctrl: ControleDecisao; aoFim: () => void
}) {
  const d = useQuery({
    queryKey: ['regulacao-detalhe', id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_detalhe', { p_id: id })
      if (error) throw error
      return data as unknown as Solicitacao
    },
  })
  const s = d.data
  if (!s) return null
  return (
    <>
      {s.motivo_cancelamento && <p className="text-tinta-apoio">Cancelada ({s.cancelamento_origem}): {s.motivo_cancelamento}</p>}
      <BlocosDecisao s={s} />
      {podeDecidir && emDecisao(s.status) && (
        <PainelDecisao key={ctrl.chave} s={s} centralId={centralId} aoFim={aoFim} acaoInicial={ctrl.acao === 'cancelar' ? null : ctrl.acao} destinoInicial={ctrl.destinoUnidade} />
      )}
      <BlocoDestino s={s} />
      {podeDecidir && <DestinoExterno s={s} aoFim={aoFim} />}
      {podeDecidir && <RegistroExterno s={s} aoFim={aoFim} />}
    </>
  )
}

/**
 * O que a origem (ou o destino, nos recebidos) faz no dossiê: as mesmas peças
 * do detalhe — responder à pendência, corrigir e reenviar, o destino, a saída
 * e o aceite do destino — e o cancelamento com motivo pelo menu "…".
 */
function DecisaoOrigem({ id, unidadeId, ctrl, aoFim }: { id: string; unidadeId: string; ctrl: ControleDecisao; aoFim: () => void }) {
  const { papeisDaUnidade } = useUnidade()
  const souNir = papeisDaUnidade.includes('nir')
  const d = useQuery({
    queryKey: ['regulacao-detalhe', id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_detalhe', { p_id: id })
      if (error) throw error
      return data as unknown as Solicitacao
    },
  })
  const [cancelando, setCancelando] = React.useState(ctrl.acao === 'cancelar')
  const cancelar = useMutation({
    mutationFn: async (motivo: string) => {
      const { error } = await supabase.rpc('regulacao_cancelar', { p_id: id, p_motivo: motivo })
      if (error) throw error
    },
    onSuccess: () => { setCancelando(false); aoFim() },
  })
  const s = d.data
  if (!s) return null
  const origemDaqui = s.origem.id === unidadeId
  return (
    <>
      {s.motivo_cancelamento && <p className="text-tinta-apoio">Cancelada ({s.cancelamento_origem}): {s.motivo_cancelamento}</p>}
      <BlocosDecisao s={s} />
      {(s.origem_pode_responder || (souNir && origemDaqui)) && s.status === 'pendencia' && <ResponderPendencia s={s} aoFim={aoFim} />}
      {s.origem_pode_responder && s.status === 'devolvida' && <Reenviar s={s} aoFim={aoFim} />}
      <BlocoDestino s={s} />
      <AcoesDestino s={s} aoFim={aoFim} nir={souNir && s.destino_unidade?.id === unidadeId} />
      {origemDaqui && <SaidaOrigem s={s} aoFim={aoFim} nir={souNir} />}
      <DialogoMotivo aberto={cancelando} aoFechar={() => { setCancelando(false); cancelar.reset() }}
        titulo={`Cancelar a solicitação nº ${s.numero}`}
        rotulo="Motivo do cancelamento" confirmar="Cancelar solicitação" ocupado={cancelar.isPending} erro={cancelar.error}
        aoConfirmar={(m) => cancelar.mutate(m)} />
    </>
  )
}

/** Regulação externa (SISREG, e-SUS Regulação…): sistema, protocolo e a prioridade como veio. */
function RegistroExterno({ s, aoFim }: { s: Solicitacao; aoFim: () => void }) {
  const [sistema, setSistema] = React.useState('')
  const [protocolo, setProtocolo] = React.useState('')
  const [prioridadeCentral, setPrioridadeCentral] = React.useState('')
  const externo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_registrar_externo', {
        p_id: s.id, p_sistema: sistema.trim(), p_protocolo: protocolo.trim(), p_prioridade_central: prioridadeCentral.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: aoFim,
  })
  return (
    <details className="rounded-controle border border-fio px-3 py-2">
      <summary className="cursor-pointer text-tinta">
        Regulação externa{s.externo_protocolo ? `: ${s.externo_sistema} · ${s.externo_protocolo}` : ''}
      </summary>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <Campo id={`ext-sis-${s.id}`} rotulo="Sistema externo"><Input id={`ext-sis-${s.id}`} className="h-8" placeholder="SISREG, e-SUS Regulação, GERINT…" value={sistema} onChange={(e) => setSistema(e.target.value)} /></Campo>
        <Campo id={`ext-prot-${s.id}`} rotulo="Nº do protocolo"><Input id={`ext-prot-${s.id}`} className="h-8" value={protocolo} onChange={(e) => setProtocolo(e.target.value)} /></Campo>
        <Campo id={`ext-pri-${s.id}`} rotulo="Prioridade da central (como veio)"><Input id={`ext-pri-${s.id}`} className="h-8" placeholder="ex.: Vermelho (P0)" value={prioridadeCentral} onChange={(e) => setPrioridadeCentral(e.target.value)} /></Campo>
        <Button size="sm" variant="outline" onClick={() => externo.mutate()} disabled={externo.isPending || sistema.trim().length < 2 || protocolo.trim().length < 3}>Registrar</Button>
      </div>
      <MensagemErro texto={externo.error ? (externo.error as Error).message : null} />
    </details>
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
function PainelDecisao({ s, centralId, aoFim, acaoInicial = null, destinoInicial }: {
  s: Solicitacao; centralId: string; aoFim: () => void
  /** modelo do RT (25/11/2026): o dossiê abre a decisão já na ação; "Reservar vaga" já com a unidade */
  acaoInicial?: Acao | null; destinoInicial?: string
}) {
  const ctx = useQuery({
    queryKey: ['regulacao-contexto', centralId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_contexto', { p_unidade: centralId })
      if (error) throw error
      return data as unknown as Contexto
    },
  })
  const [acao, setAcao] = React.useState<Acao | null>(acaoInicial)
  const [destinoTipo, setDestinoTipo] = React.useState<'rede' | 'externo'>(destinoInicial ? 'rede' : s.destino_tipo === 'externo' ? 'externo' : 'rede')
  const [destinoUnidade, setDestinoUnidade] = React.useState(destinoInicial ?? s.destino_unidade?.id ?? '')
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
