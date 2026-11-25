// ─────────────────────────────────────────────────────────────────────────────
// Dossiê do pedido para o médico regulador (RG1, RG3–RG5 e RG7 do modelo do
// RT, 25/11/2026): cabeçalho fixo com prioridade, situação, nº, tipo de leito e
// mandado judicial; faixa do prazo da evolução ("Cobrar na conversa"); faixa
// do isolamento com as precauções da fonte; a grade do pedido; o quadro
// clínico com a versão da evolução; as vagas compatíveis; e as abas Conversa /
// Anexos / Linha do tempo. Reaproveita os componentes da regulação; as regras
// ficam no banco (RPCs de sempre e as da migration 20270425000020).
//
// A decisão (autorizar, pendência, devolver, negar), o destino e a regulação
// externa vêm de quem monta a página (`decisao`), para não repetir o painel
// de decisão. A conversa com a origem também (`conversa`): onde ela existe, a
// aba aparece e "Cobrar na conversa" envia a mensagem pronta pela RPC dela.
//
// Revisão unslop (RT, 25/11/2026):
// • RC3: ordem quadro → isolamento → vagas compatíveis → decisão; os botões
//   da decisão ficam fixos no pé do dossiê (Autorizar como ação principal; a
//   pergunta, a devolução e a negação como secundárias). "Reservar vaga" abre
//   a mesma autorização com a unidade. Ações do cabeçalho numa linha.
// • RC6: o isolamento aparece uma vez (a faixa); solicitante e médico
//   assistente, um nome só quando é a mesma pessoa.
// • RC7: sinais vitais com rótulos legíveis; os valores, crus, como vieram.
// • RO2: na origem, a pergunta da central ainda sem resposta fica no topo,
//   com "Responder", que leva ao campo da resposta.
// • RO3: a situação e o agente do isolamento vêm do pedido
//   (regulacao_detalhe, migration 20270426000044), iguais na central e na origem.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FileText, X } from 'lucide-react'
import * as React from 'react'

import { ROTULO_DOCUMENTO } from '@/components/documento/documentos'
import { AnexosRegulacao } from '@/components/regulacao/AnexosRegulacao'
import { AvisoPlantao } from '@/components/regulacao/AvisoPlantao'
import { EditarIsolamento, FaixaIsolamento } from '@/components/regulacao/IsolamentoRegulacao'
import { ContextoPlantaoOrigem, useMotivoPlantaoOrigem } from '@/components/regulacao/usePlantaoOrigem'
import { LinhaDoTempoPedido } from '@/components/regulacao/LinhaDoTempoPedido'
import { MatchVagas } from '@/components/regulacao/MatchVagas'
import { MenuAcoesPedido, type AcaoMenu } from '@/components/regulacao/PainelPedido'
import { FormEvolucao, type Evolucao } from '@/components/regulacao/SlaRegulacao'
import { LeituraTransferencia } from '@/components/transferencia/DocumentoTransferencia'
import { Abas } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { fmtDataHora } from '@/lib/datas'
import { tiposDoIsolamento } from '@/lib/isolamentoPedido'
import {
  CARATER, PRIORIDADES, STATUS, TIPOS_LEITO, VULNERABILIDADES, emDecisao, formatarEspera, prioridadeEfetiva, textoSolicitante,
  type Carater, type Prioridade, type Sla, type SituacaoIsolamento, type StatusRegulacao, type TipoSolicitacao, type Vulnerabilidade,
} from '@/lib/regulacao'
import { horasSemEvolucao, mensagemCobrarEvolucao, nivelEvolucao } from '@/lib/regulacaoFila'
import { montarLinhaDoTempo } from '@/lib/regulacaoLinhaTempo'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { tempoSemEvolucao } from '@/lib/tempoSemEvolucao'
import { rotularSinaisVitais } from '@/lib/vitaisLegiveis'

/** Campos do regulacao_detalhe que o dossiê lê. */
export type PedidoDossie = {
  id: string; numero: number; status: StatusRegulacao; tipo: TipoSolicitacao; carater: Carater; modalidade: string
  prioridade: Prioridade; prioridade_regulador: Prioridade | null; prioridade_regulador_motivo: string | null
  vulnerabilidades: Vulnerabilidade[] | null
  procedimento: string; procedimento_nome: string | null; especialidade: string | null
  tipo_leito: string | null; isolamento: boolean; isolamento_tipo: string | null
  /** B-04 (RT, 25/11/2026): todos os tipos do pedido; vazio ou ausente = só o principal */
  isolamento_tipos?: string[] | null
  isolamento_situacao?: string | null; isolamento_agente?: string | null
  destino_tipo: 'rede' | 'externo' | 'a_definir'; destino_unidade: { id: string; nome: string } | null; destino_externo: string | null
  cid: string; cid_descricao: string | null
  quadro_clinico: string; sinais_vitais: string | null; hipotese: string | null
  paciente: { id: string; nome: string; nascimento: string | null; sexo: string | null }
  paciente_nao_identificado: boolean
  origem: { id: string; nome: string }; cnes_solicitante: string
  solicitante: string | null; solicitante_papel: string; medico_assistente: string | null
  eventos?: { evento: string; por: string | null; em: string; detalhes: Record<string, unknown> | null }[]
  sla: Sla | null
  tempos?: { status: StatusRegulacao; segundos: number; vezes: number; atual: boolean }[]
  evolucoes?: Evolucao[]; pode_evoluir?: boolean
  /** quem pede pode responder, cancelar e mudar o isolamento */
  origem_pode_responder?: boolean
  pendencia_pergunta?: string | null; pendencia_em?: string | null; pendencia_por?: string | null; pendencia_resposta?: string | null
}

/** A evolução mais recente pela data (o banco manda da mais nova para a mais antiga; não depende da ordem). */
function maisRecente(evolucoes: Evolucao[]): Evolucao | null {
  return evolucoes.reduce<Evolucao | null>((a, e) => (!a || Date.parse(e.em) > Date.parse(a.em) ? e : a), null)
}

/** O que a fila sabe do pedido e o detalhe não traz. */
export type ContextoFila = {
  espera_segundos: number; assumida_por: string | null; assumida_por_mim: boolean
  municipio?: string | null; situacao?: string | null; agente?: string | null
  origem_coord?: { latitude: number | null; longitude: number | null } | null
}

/** Na central: autorizar, negar, devolver, pendência. Na origem: cancelar (menu "…"). */
export type AcaoDecisao = 'autorizar' | 'negar' | 'devolver' | 'pendencia' | 'cancelar'
export type ControleDecisao = { acao: AcaoDecisao | null; destinoUnidade?: string; chave: number }

/** A conversa com a origem, de quem monta a página (onde existe). */
export type ConversaSlot = {
  Painel: (p: { solicitacaoId: string; aoEnviar: () => void }) => React.ReactNode
  useContagem: (solicitacaoId: string) => number | undefined
  cobrar: (solicitacaoId: string, texto: string) => Promise<void>
}

const TOM_PRIORIDADE = { critico: 'bg-critico', atencao: 'bg-atencao', info: 'bg-acao', neutro: 'bg-tinta-sussurro' } as const

/** Prioridade como ponto de cor e texto (sem ficha). */
export function PontoPrioridade({ p }: { p: Prioridade }) {
  const pr = PRIORIDADES[p]
  return (
    <span className="inline-flex items-center gap-1.5 text-tinta" title={pr.descricao}>
      <span aria-hidden className={cn('size-2 shrink-0 rounded-capsula', TOM_PRIORIDADE[pr.tom])} />{pr.rotulo}
    </span>
  )
}

function Item({ rotulo, children, className }: { rotulo: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', className)}>
      <dt className="text-rotulo text-tinta-sussurro">{rotulo}</dt>
      <dd className="text-tinta [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

const idade = (nasc: string | null) => {
  if (!nasc) return null
  const [a, m, d] = nasc.split('-').map(Number)
  const h = new Date()
  return h.getFullYear() - a - (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d) ? 1 : 0)
}

function useSemContagem(id: string): number | undefined { void id; return undefined }

type AbaDossie = 'conversa' | 'anexos' | 'linha'

export function DossieRegulador({ id, lado = 'central', unidadeId, centralId, souRegulador, fila, decisao, conversa, aoVoltar, aoFechar }: {
  id: string
  /** central: decide e reserva; origem (perfil Médico regulador numa unidade que pede): as ações da origem, sem decidir nem reservar */
  lado?: 'central' | 'origem'
  /** unidade de quem vê, no lado da origem */
  unidadeId?: string
  centralId: string; souRegulador: boolean; fila: ContextoFila | null
  decisao: (id: string, ctrl: ControleDecisao, aoFim: () => void) => React.ReactNode
  conversa?: ConversaSlot
  /** celular: volta à fila */
  aoVoltar?: () => void
  aoFechar?: () => void
}) {
  const qc = useQueryClient()
  const d = useQuery({
    queryKey: ['regulacao-detalhe', id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_detalhe', { p_id: id })
      if (error) throw error
      return data as unknown as PedidoDossie
    },
  })
  const anexos = useQuery({
    queryKey: ['regulacao-anexos', id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_anexos', { p_solicitacao: id })
      if (error) throw error
      return data as unknown as { anexos: unknown[] }
    },
  })
  const useContagem = conversa?.useContagem ?? useSemContagem
  const nConversa = useContagem(id)
  const [aba, setAba] = React.useState<AbaDossie>(conversa ? 'conversa' : 'anexos')
  const [painel, setPainel] = React.useState<'isolamento' | 'prioridade' | 'evolucao' | null>(null)
  const [ctrl, setCtrl] = React.useState<ControleDecisao>({ acao: null, chave: 0 })
  const [verDocumento, setVerDocumento] = React.useState(false)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const decisaoRef = React.useRef<HTMLDivElement>(null)
  const [agora] = React.useState(() => Date.now())

  const recarregar = () => {
    const u = lado === 'central' ? centralId : unidadeId ?? ''
    for (const k of [['regulacao-detalhe', id], ['regulacao-fila', u], ['regulacao-fila-extras', u], ['regulacao-sla', u], ['regulacao-lista', u],
      ['regulacao-destino', u], ['regulacao-vagas-compativeis', u], ['regulacao-anexos', id], ['nota-regulacao']]) void qc.invalidateQueries({ queryKey: k })
  }
  const abrirDecisao = (acao: AcaoDecisao, destinoUnidade?: string) => {
    setCtrl((c) => ({ acao, destinoUnidade, chave: c.chave + 1 }))
    requestAnimationFrame(() => decisaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const assumir = useMutation({
    mutationFn: async (rpc: 'regulacao_assumir' | 'regulacao_soltar') => {
      const { error } = await supabase.rpc(rpc, { p_id: id })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  const cobrar = useMutation({
    mutationFn: async (texto: string) => { await conversa!.cobrar(id, texto) },
    onSuccess: () => { setAviso('Cobrança enviada na conversa.'); setAba('conversa'); recarregar() },
  })
  // B-07 (RT, 25/11/2026): no lado da origem, fora do plantão o servidor recusa as ações do médico e do NIR;
  // o dossiê avisa antes, com a frase do servidor, e desliga os botões. Na central nada muda.
  const foraDoPlantao = useMotivoPlantaoOrigem(unidadeId, d.data?.paciente.id,
    lado === 'origem' && !!unidadeId && d.data?.origem.id === unidadeId)
  const desligado = { disabled: !!foraDoPlantao, title: foraDoPlantao ?? undefined }

  if (d.isLoading) return <div className="p-4"><EsqueletoLinhas linhas={6} rotulo="Carregando o pedido…" /></div>
  if (d.error || !d.data) return <div className="p-4"><MensagemErro texto={d.error ? (d.error as Error).message : 'Não encontrado.'} /></div>
  const s = d.data
  const ef = prioridadeEfetiva(s)
  const judicial = (s.vulnerabilidades ?? []).includes('judicializado')
  const nivel = nivelEvolucao(s.sla)
  const horas = horasSemEvolucao(s.sla, agora)
  const aberto = emDecisao(s.status) || s.status === 'devolvida'
  const decide = souRegulador && emDecisao(s.status) && !(fila?.assumida_por && !fila.assumida_por_mim)
  const evolucoes = s.evolucoes ?? []
  const ultima = maisRecente(evolucoes)
  const situacao = s.isolamento_situacao ?? fila?.situacao ?? null
  const agente = s.isolamento_agente ?? fila?.agente ?? null
  const linha = montarLinhaDoTempo({ eventos: s.eventos ?? [], evolucoes, rotulosDocumento: ROTULO_DOCUMENTO })
  const destino = s.destino_tipo === 'rede' ? s.destino_unidade?.nome : s.destino_tipo === 'externo' ? `${s.destino_externo} (fora da rede)` : 'A definir pela regulação'
  const leitoOuTransf = s.tipo === 'leito' || s.tipo === 'transferencia'
  const anos = idade(s.paciente.nascimento)
  const central = lado === 'central'
  const souOrigem = !central && !!unidadeId && s.origem.id === unidadeId
  const origemResponde = souOrigem && !!s.origem_pode_responder
  const cancelavel = origemResponde
    && ['rascunho', 'enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino', 'autorizada', 'agendada'].includes(s.status)
  // isolamento: o regulador da central ou quem pede (a RPC confere)
  const mudaIsolamento = aberto && ((central && souRegulador) || origemResponde)
  // RO2: a pergunta da central sem resposta, no topo do dossiê da origem
  const perguntaAberta = !central && s.status === 'pendencia' && !!s.pendencia_pergunta && !s.pendencia_resposta
  const responder = () => {
    decisaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    requestAnimationFrame(() => (document.getElementById(`resp-${s.id}`) as HTMLTextAreaElement | null)?.focus({ preventScroll: true }))
  }
  const solicitante = textoSolicitante(s.solicitante, s.medico_assistente)
  // RC3: os botões da decisão no pé; o "…" fica com o resto
  const pe: [AcaoDecisao, string][] = decide ? [
    ['autorizar', 'Autorizar'],
    ...(s.status !== 'pendencia' ? [['pendencia', 'Pergunta à origem'] as [AcaoDecisao, string]] : []),
    ['devolver', 'Devolver à origem'], ['negar', 'Negar'],
  ] : []

  const menu: AcaoMenu[] = [
    ...(souRegulador && aberto ? [{ chave: 'prioridade', rotulo: 'Reclassificar prioridade', onSelecionar: () => setPainel('prioridade') }] : []),
    ...(mudaIsolamento ? [{ chave: 'isolamento', rotulo: s.isolamento ? 'Alterar isolamento' : 'Definir isolamento', desligado: foraDoPlantao, onSelecionar: () => setPainel('isolamento') }] : []),
    ...(fila?.assumida_por_mim ? [{ chave: 'soltar', rotulo: 'Devolver à fila (deixar de assumir)', onSelecionar: () => assumir.mutate('regulacao_soltar') }] : []),
    ...(cancelavel ? [{ chave: 'cancelar', rotulo: 'Cancelar solicitação', perigo: true, desligado: foraDoPlantao, onSelecionar: () => abrirDecisao('cancelar') }] : []),
  ]
  const abas: [AbaDossie, string, number | undefined][] = [
    ...(conversa ? [['conversa', 'Conversa', nConversa] as [AbaDossie, string, number | undefined]] : []),
    ['anexos', 'Anexos', anexos.data?.anexos.length], ['linha', 'Linha do tempo', linha.length],
  ]

  return (
    <ContextoPlantaoOrigem.Provider value={foraDoPlantao}>
    <article aria-label={`Pedido nº ${s.numero}`} className="flex flex-col text-apoio">
      <header className="sticky top-0 z-10 flex flex-col gap-2 border-b border-fio bg-superficie px-4 py-3">
        {aoVoltar && (
          <Button size="xs" variant="outline" className="self-start lg:hidden" onClick={aoVoltar}><ArrowLeft /> Voltar à fila</Button>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <PontoPrioridade p={ef} />
          <Badge variant={s.status === 'pendencia' ? 'warning' : 'info'}>{STATUS[s.status]}</Badge>
          <span className="text-tinta-apoio">Pedido nº {s.numero}</span>
          {s.tipo_leito && <Badge variant="secondary">{TIPOS_LEITO[s.tipo_leito] ?? s.tipo_leito}</Badge>}
          {judicial && <Badge variant="destructive">Mandado judicial</Badge>}
          {aoFechar && <Button size="icon-sm" variant="ghost" aria-label="Fechar o pedido" className="ml-auto hidden lg:inline-flex" onClick={aoFechar}><X /></Button>}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-corpo font-semibold text-tinta">
            {s.paciente.nome}{s.paciente_nao_identificado && ' (não identificado)'}
            {(anos != null || s.paciente.sexo) && <span className="ml-1 font-normal text-tinta-sussurro">({[anos != null ? `${anos} a` : '', s.paciente.sexo].filter(Boolean).join(' · ')})</span>}
          </h3>
          {fila && <span className="text-tinta-apoio">Na fila: <b className="text-tinta">{formatarEspera(fila.espera_segundos)}</b></span>}
          {fila?.assumida_por && <span className="text-tinta-sussurro">{fila.assumida_por_mim ? 'com você' : `com ${fila.assumida_por}`}</span>}
        </div>
        <span className="text-tinta-apoio">{[fila?.municipio, s.origem.nome].filter(Boolean).join(' · ')} <span className="text-tinta-sussurro">(CNES {s.cnes_solicitante})</span></span>
        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {souRegulador && emDecisao(s.status) && fila && !fila.assumida_por && (
            <Button size="xs" className="shrink-0" onClick={() => assumir.mutate('regulacao_assumir')} disabled={assumir.isPending}>Assumir</Button>
          )}
          {central && conversa && s.sla?.evolucao && aberto && (
            <Button size="xs" className="shrink-0" variant={nivel === 'em_dia' ? 'outline' : 'default'} disabled={cobrar.isPending}
              onClick={() => cobrar.mutate(mensagemCobrarEvolucao(s, Date.now()))}>Cobrar evolução</Button>
          )}
          {s.pode_evoluir && <Button size="xs" className="shrink-0" variant="outline" {...desligado} onClick={() => setPainel('evolucao')}>Atualizar evolução</Button>}
          {leitoOuTransf && (
            <Button size="xs" className="shrink-0" variant="outline" aria-expanded={verDocumento} title="Documento de transferência" onClick={() => setVerDocumento((v) => !v)}><FileText /> Documento</Button>
          )}
          <MenuAcoesPedido itens={menu} />
        </div>
      </header>

      <div className="flex flex-col gap-3 p-4">
        <MensagemErro texto={(assumir.error ?? cobrar.error) ? ((assumir.error ?? cobrar.error) as Error).message : null} />
        {aviso && <p role="status" className="text-sucesso">{aviso}</p>}
        <AvisoPlantao texto={foraDoPlantao} />
        {perguntaAberta && (
          <section aria-label="Pergunta da central" className="flex flex-wrap items-start gap-2 rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2">
            <p className="min-w-0 flex-1 text-tinta">
              <b>A central perguntou</b>
              <span className="text-tinta-apoio"> ({s.pendencia_por ?? '—'}{s.pendencia_em ? `, ${fmtDataHora(s.pendencia_em)}` : ''})</span>: {s.pendencia_pergunta}
            </p>
            {origemResponde && <Button size="xs" {...desligado} onClick={responder}>Responder</Button>}
          </section>
        )}
        {nivel !== 'em_dia' && s.sla?.evolucao && (
          <div className={cn('flex flex-wrap items-center gap-2 rounded-controle border px-3 py-2',
            nivel === 'risco' ? 'border-critico/40 bg-alerta-critico' : 'border-atencao/40 bg-alerta-atencao')}>
            <span className="text-tinta">
              <b className="tabular-nums">{tempoSemEvolucao(horas)}</b> sem evolução: {nivel === 'risco'
                ? `prazo de cancelamento da central (${s.sla.evolucao.limite_h} h)`
                : `evolução vencida (prazo da central: ${s.sla.evolucao.prazo_h} h)`}
            </span>
            <span className="ml-auto flex gap-1.5">
              {central && conversa && aberto && (
                <Button size="xs" variant="outline" disabled={cobrar.isPending} onClick={() => cobrar.mutate(mensagemCobrarEvolucao(s, Date.now()))}>Cobrar na conversa</Button>
              )}
              {s.pode_evoluir && <Button size="xs" {...desligado} onClick={() => setPainel('evolucao')}>Atualizar evolução</Button>}
            </span>
          </div>
        )}
        {s.isolamento && s.isolamento_tipo && (
          <FaixaIsolamento tipo={s.isolamento_tipo} tipos={tiposDoIsolamento(s)} situacao={situacao} agente={agente}
            acao={mudaIsolamento ? <Button size="xs" variant="outline" {...desligado} onClick={() => setPainel('isolamento')}>Alterar isolamento</Button> : undefined} />
        )}
        {painel === 'isolamento' && (
          <EditarIsolamento solicitacaoId={s.id} aoCancelar={() => setPainel(null)} aoFim={() => { setPainel(null); recarregar() }}
            inicial={{ tipo: s.isolamento ? s.isolamento_tipo ?? '' : '', situacao: (situacao ?? '') as SituacaoIsolamento | '', agente: agente ?? '' }} />
        )}
        {painel === 'prioridade' && <Reclassificar s={s} aoFim={() => { setPainel(null); recarregar() }} aoCancelar={() => setPainel(null)} />}
        {painel === 'evolucao' && <FormEvolucao id={s.id} aoFim={() => { setPainel(null); recarregar() }} aoVoltar={() => setPainel(null)} />}
        {verDocumento && <LeituraTransferencia key={s.id} solicitacaoId={s.id} />}

        <dl className="grid gap-x-4 gap-y-2.5 sm:grid-cols-3">
          <Item rotulo="Procedimento (SIGTAP)" className="sm:col-span-2">{s.procedimento} {s.procedimento_nome ?? ''}</Item>
          <Item rotulo="Caráter">{CARATER[s.carater]}{s.modalidade ? ` · ${s.modalidade}` : ''}</Item>
          <Item rotulo="Prioridade">
            {PRIORIDADES[ef].rotulo}
            {s.prioridade_regulador && s.prioridade_regulador !== s.prioridade && <span className="block text-rotulo text-tinta-sussurro">proposta: {PRIORIDADES[s.prioridade].rotulo}</span>}
          </Item>
          <Item rotulo="Vulnerabilidade">{(s.vulnerabilidades ?? []).map((v) => VULNERABILIDADES[v]).join(', ') || 'Nenhuma'}</Item>
          <Item rotulo="Leito solicitado">{s.tipo_leito ? TIPOS_LEITO[s.tipo_leito] ?? s.tipo_leito : '—'}</Item>
          <Item rotulo="CID-10" className="sm:col-span-2">{s.cid} {s.cid_descricao ?? ''}</Item>
          <Item rotulo="Destino" className="sm:col-span-2">{destino}</Item>
          <Item rotulo="Origem (CNES)">{s.origem.nome} · {s.cnes_solicitante}</Item>
          {!s.isolamento && <Item rotulo="Isolamento">Precaução padrão</Item>}
          <Item rotulo={solicitante.rotulo} className="sm:col-span-3">{solicitante.texto}</Item>
        </dl>

        <section aria-label="Quadro clínico" className="flex flex-col gap-1 rounded-controle border border-fio bg-campo px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium text-tinta">Quadro clínico</span>
            <span className="text-rotulo text-tinta-sussurro">Evolução v{evolucoes.length + 1}</span>
          </div>
          <p className="whitespace-pre-wrap text-tinta">{s.quadro_clinico}</p>
          {s.sinais_vitais && <p className="text-tinta-apoio">Sinais vitais: {rotularSinaisVitais(s.sinais_vitais)}</p>}
          {s.hipotese && <p className="text-tinta-apoio">Hipótese: {s.hipotese}</p>}
          {ultima && (
            <div className="mt-1 border-t border-fio pt-1">
              <span className="text-rotulo text-tinta-sussurro">Última evolução · {ultima.autor ?? '—'} · {fmtDataHora(ultima.em)}</span>
              <p className="whitespace-pre-wrap text-tinta">{ultima.texto}</p>
              {ultima.sinais_vitais && <p className="text-tinta-apoio">Sinais vitais: {rotularSinaisVitais(ultima.sinais_vitais)}</p>}
            </div>
          )}
        </section>

        {central && leitoOuTransf && aberto && (
          <MatchVagas centralId={centralId} podeReservar={decide} aoReservar={(u) => abrirDecisao('autorizar', u)}
            pedido={{ tipo_leito: s.tipo_leito, isolamento_tipo: s.isolamento ? s.isolamento_tipo : null, isolamento_tipos: s.isolamento ? s.isolamento_tipos : null, origem_id: s.origem.id, origem: fila?.origem_coord }} />
        )}

        <div ref={decisaoRef} className="flex scroll-mt-28 flex-col gap-3">{decisao(s.id, ctrl, recarregar)}</div>

        <Abas abas={abas} valor={abas.some(([k]) => k === aba) ? aba : abas[0][0]} onChange={setAba} rotulo="Do pedido" className="mb-0" />
        {aba === 'conversa' && conversa ? <conversa.Painel solicitacaoId={s.id} aoEnviar={recarregar} />
          : aba === 'anexos' ? <AnexosRegulacao solicitacaoId={s.id} />
          : <LinhaDoTempoPedido itens={linha} tempos={s.tempos ?? []} statusAtual={s.status} />}
      </div>
      {pe.length > 0 && (
        <footer aria-label="Decisão da central" className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t border-fio bg-superficie px-4 py-2">
          {pe.map(([a, rotulo], i) => (
            <Button key={a} size="sm" variant={i === 0 ? 'default' : 'outline'} aria-pressed={ctrl.acao === a}
              className={cn(a === 'negar' && 'text-critico hover:text-critico', i === 1 && 'ml-auto')} onClick={() => abrirDecisao(a)}>{rotulo}</Button>
          ))}
        </footer>
      )}
    </article>
    </ContextoPlantaoOrigem.Provider>
  )
}

function Reclassificar({ s, aoFim, aoCancelar }: { s: PedidoDossie; aoFim: () => void; aoCancelar: () => void }) {
  const [p, setP] = React.useState<Prioridade | ''>('')
  const [motivo, setMotivo] = React.useState('')
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_priorizar', { p_id: s.id, p_prioridade: p, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: aoFim,
  })
  return (
    <div className="flex flex-col gap-2 rounded-controle border border-fio bg-superficie p-3">
      <span className="font-medium text-tinta">Reclassificar prioridade</span>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`rcl-${s.id}`} className="text-rotulo">Nova prioridade</Label>
          <CampoSelecao id={`rcl-${s.id}`} tamanho="compacto" value={p} onChange={(e) => setP(e.target.value as Prioridade | '')}>
            <option value="">Escolha…</option>
            {(['emergencia', 'urgencia', 'prioritaria', 'eletiva'] as Prioridade[]).map((k) => <option key={k} value={k}>{PRIORIDADES[k].rotulo}</option>)}
          </CampoSelecao>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label htmlFor={`rcl-m-${s.id}`} className="text-rotulo">Motivo (fica no histórico e a origem vê)</Label>
          <Input id={`rcl-m-${s.id}`} className="h-8" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
      </div>
      <MensagemErro texto={salvar.error ? (salvar.error as Error).message : null} />
      <div className="flex flex-wrap gap-2">
        <Button size="xs" onClick={() => salvar.mutate()} disabled={salvar.isPending || !p || motivo.trim().length < 10}>Confirmar</Button>
        <Button size="xs" variant="outline" onClick={aoCancelar}>Cancelar</Button>
      </div>
    </div>
  )
}
