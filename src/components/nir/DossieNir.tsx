// Dossiê do paciente na Internação do NIR (modelo do RT, 25/11/2026).
//
// • Cabeçalho: leito, setor, médico de plantão no setor, internado há,
//   isolamento, nº e data do pedido, CID, situação, prioridade e tipo de leito.
// • Barra de ações: "Avisar médico" (NIR2), "Puxar exame do prontuário" (o
//   anexar do prontuário que já existe), "Atualizar evolução" do pedido (o NIR
//   também atualiza, decisão do RT de 25/11/2026: é a atualização do pedido,
//   autor = login, não a evolução médica do prontuário) e "Gerenciar remoção /
//   saída" quando há vaga com destino. A faixa do prazo repete as ações.
// • Abas: Pendências & resumo, Conversa com a central (mensagens prontas de 1
//   clique), Anexos & exames e Linha do tempo.
// • Remoção (NIR5): mostra o destino, a reserva e "Paciente saiu"
//   (regulacao_marcar_saida, que o NIR já pode). A alta por transferência,
//   que libera o leito, é do médico (dar_alta); "transporte acionado" ainda
//   não tem onde gravar (pergunta ao RT na nota de entrega).
// • Sem regulação: o resumo e "Abrir pedido de regulação" (o formulário que
//   já existe, com o paciente escolhido).
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Bell, FileText, PenLine, Plus, Truck } from 'lucide-react'
import * as React from 'react'

import { Chip, VazioLinha } from '@/components/monitor/Pagina'
import { AbasLinha } from '@/components/nir/AbasLinha'
import { AvisarMedico, type AlvoAviso } from '@/components/nir/AvisarMedico'
import { tomStatus, useAcoesPendencia, useRecarregarNir } from '@/components/nir/dadosNir'
import { CodigoLeito, EtiquetaIso } from '@/components/nir/Etiquetas'
import { EsperaDaCentral, ResponderPergunta } from '@/components/regulacao/AbaRegulacaoPaciente'
import { AnexosRegulacao, EscolherDocumento } from '@/components/regulacao/AnexosRegulacao'
import { AvisoPlantao, PlantaoOrigem } from '@/components/regulacao/AvisoPlantao'
import { ConversaRegulacao } from '@/components/regulacao/ConversaRegulacao'
import { BlocoDestino, SaidaOrigem, type PedidoDestino } from '@/components/regulacao/DestinoRegulacao'
import { AvisoEnviado, NovoPedidoPaciente, type PedidoEnviado } from '@/components/regulacao/NovaSolicitacao'
import { EvolucaoPedidoNir, type EvolucaoNir } from '@/components/nir/EvolucaoPedidoNir'
import { SeloSla } from '@/components/regulacao/SlaRegulacao'
import { ROTULO_DOCUMENTO } from '@/components/documento/documentos'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { rotuloIdade } from '@/domain/idade'
import { dataHora, dataIso, tempoDecorrido } from '@/lib/formato'
import { textoIsolamento } from '@/lib/isolamentoPedido'
import {
  MENSAGENS_PRONTAS, STATUS_PENDENCIA, STATUS_VAGA, horasSemEvolucao, pedidosAbertos, rotuloIsolamento, textoParaWhatsApp,
  type ContextoLeito, type MotivoPendencia, type PendenciaUnidade,
} from '@/lib/nirPainel'
import { CARATER, ISOLAMENTOS, PRIORIDADES, STATUS, TIPOS_LEITO, TRANSPORTES, prioridadeEfetiva, resumoPedido, type Sla, type StatusRegulacao } from '@/lib/regulacao'
import { montarLinhaDoTempo, temposComAtual, type EventoPedido, type TempoStatus } from '@/lib/regulacaoLinhaTempo'
import { esperaAOrigem, type PacienteRegulacao, type PedidoResumo } from '@/lib/regulacaoPaciente'
import { supabase } from '@/lib/supabase'
import { usePlantaoOrigem } from '@/components/regulacao/usePlantaoOrigem'
import { cn } from '@/lib/utils'
import { tempoSemEvolucao } from '@/lib/tempoSemEvolucao'

type Detalhe = PedidoDestino & {
  status: StatusRegulacao; sla: Sla | null
  eventos?: EventoPedido[]
  tempos?: TempoStatus[]
  evolucoes?: EvolucaoNir[]; pode_evoluir?: boolean
  quadro_clinico?: string | null; cid_descricao?: string | null; isolamento_tipo?: string | null
  /** B-04 (RT, 25/11/2026): todos os tipos do pedido; vazio ou ausente = só o principal */
  isolamento_tipos?: string[] | null
  vulnerabilidades?: string[] | null; medico_assistente?: string | null; solicitante?: string | null
}

const TOM_PRIORIDADE: Record<string, 'destructive' | 'warning' | 'info' | 'secondary'> = {
  critico: 'destructive', atencao: 'warning', info: 'info', neutro: 'secondary',
}

type Aba = 'pendencias' | 'conversa' | 'anexos' | 'tempo'



type PropsDossie = {
  unidadeId: string; linha: PacienteRegulacao; pend: PendenciaUnidade[]; contexto: ContextoLeito; agora: number
  /** O "Novo pedido" do topo pediu o formulário para este paciente; muda a cada clique. */
  abrirNovo?: number
  voltar: () => void
}

/**
 * Decisão do RT de 25/11/2026 (NIR por setor, migration 20270426000026): para o
 * NIR, "de plantão" conta o setor da escala ativa. O dossiê é de um paciente:
 * pergunta com ele e vale para tudo o que está dentro (avisar médico, evolução,
 * pendências, puxar exame, conversa, saída e o pedido novo deste paciente).
 */
export function DossieNir(props: PropsDossie) {
  // o motivo da página (pela unidade) já está no aviso do topo
  const { motivo: motivoDaUnidade } = usePlantaoOrigem()
  return (
    <PlantaoOrigem unidadeId={props.unidadeId} pacienteId={props.linha.paciente.id}>
      <DossieDoPaciente {...props} motivoDaUnidade={motivoDaUnidade} />
    </PlantaoOrigem>
  )
}

function DossieDoPaciente({ unidadeId, linha, pend, contexto, agora, abrirNovo, voltar, motivoDaUnidade }: PropsDossie & { motivoDaUnidade: string | null }) {
  const abertos = pedidosAbertos(linha)
  const [pedidoId, setPedidoId] = React.useState<string | null>(abertos[0]?.id ?? null)
  const p = abertos.find((x) => x.id === pedidoId) ?? abertos[0] ?? null
  const [novo, setNovo] = React.useState(!!abrirNovo)
  const [novoVisto, setNovoVisto] = React.useState(abrirNovo)
  if (abrirNovo !== novoVisto) { setNovoVisto(abrirNovo); if (abrirNovo) setNovo(true) }
  const [enviado, setEnviado] = React.useState<PedidoEnviado | null>(null)
  const recarregar = useRecarregarNir(unidadeId)
  // B-07 (RT, 25/11/2026): fora do plantão os botões desligam; o motivo aqui é o deste paciente
  const { motivo: foraDoPlantao } = usePlantaoOrigem()
  const desligado = { disabled: !!foraDoPlantao, title: foraDoPlantao ?? undefined }
  const idade =linha.paciente.nascimento ? rotuloIdade(linha.paciente.nascimento, dataIso()) : null
  const medicos = contexto.medicos.map((m) => m.nome).join(', ')

  const topo = (
    <header className="flex flex-col gap-1 border-b border-fio px-4 pt-2.5 pb-2">
      <Button size="xs" variant="outline" className="self-start lg:hidden" onClick={voltar}><ArrowLeft /> Voltar aos leitos</Button>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-rotulo text-tinta-apoio">
        <CodigoLeito>{linha.leito ?? (linha.internacao ? 'Sem leito' : 'Porta')}</CodigoLeito>
        {linha.setor && <span>{linha.setor.nome}</span>}
        <span aria-hidden>·</span>
        <span>Médico: <b className="font-semibold text-tinta">{medicos || 'sem escala no setor'}</b></span>
        {linha.internacao && <><span aria-hidden>·</span><span className="font-mono">Internado {tempoDecorrido(linha.internacao.admissao, agora)}</span></>}
        <EtiquetaIso tipos={contexto.isolamento} />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h3 className="text-secao font-semibold text-tinta">{linha.paciente.nome}</h3>
        <span className="font-mono text-rotulo text-tinta-sussurro">{[idade, contexto.sexo].filter(Boolean).join(' · ')}</span>
        {p && <span className="ml-auto font-mono text-rotulo text-tinta-sussurro">nº {p.numero} · {dataHora(p.criada_em)}</span>}
      </div>
      {p && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-rotulo font-semibold text-tinta">{p.cid}</span>
          <Badge variant={STATUS_VAGA.includes(p.status) ? 'success' : esperaAOrigem(p) ? 'info' : 'default'}>{STATUS[p.status]}</Badge>
          <Badge variant={TOM_PRIORIDADE[PRIORIDADES[prioridadeEfetiva(p)].tom]}>{PRIORIDADES[prioridadeEfetiva(p)].rotulo}</Badge>
          <Badge variant="outline">{resumoPedido(p)}</Badge>
          <SeloSla sla={p.sla} />
          {abertos.length > 1 && (
            <span role="radiogroup" aria-label="Pedido" className="ml-auto flex gap-1">
              {abertos.map((x) => (
                <Button key={x.id} size="xs" role="radio" aria-checked={x.id === p.id} variant={x.id === p.id ? 'default' : 'outline'}
                  onClick={() => setPedidoId(x.id)}>nº {x.numero}</Button>
              ))}
            </span>
          )}
        </div>
      )}
    </header>
  )
  // o aviso do paciente (setor fora do plantão) só quando não é o mesmo do topo da página
  const cabecalho = foraDoPlantao && foraDoPlantao !== motivoDaUnidade
    ? <>{topo}<div className="px-4 pt-2"><AvisoPlantao texto={foraDoPlantao} /></div></>
    : topo

  if (novo) {
    return (
      <div className="flex flex-col">
        {/* o formulário mostra o aviso dele, com este paciente */}
        {topo}
        <div className="p-4">
          <NovoPedidoPaciente pacienteId={linha.paciente.id} unidadeId={unidadeId} aoFechar={() => setNovo(false)}
            aoEnviar={(r) => { setNovo(false); setEnviado(r); setPedidoId(r.id); recarregar(r.id) }} />
        </div>
      </div>
    )
  }

  if (!p) {
    return (
      <div className="flex flex-col">
        {cabecalho}
        <div className="flex flex-col gap-3 p-4">
          {enviado && <AvisoEnviado enviada={enviado} onde="Ele aparece aqui quando a lista atualizar." />}
          <Resumo>
            <Item rotulo="Leito / setor">{linha.leito ?? '—'}{linha.setor ? ` · ${linha.setor.nome}` : ''}</Item>
            <Item rotulo="Internação">{linha.internacao ? `desde ${dataHora(linha.internacao.admissao)}` : '—'}</Item>
            <Item rotulo="Isolamento">{rotuloIsolamento(contexto.isolamento)?.replace('Isolamento: ', '') ?? 'precaução padrão'}</Item>
          </Resumo>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-controle border border-fio bg-campo px-3 py-2">
            <span className="font-medium text-tinta">Sem pedido de regulação em aberto</span>
            <Button size="sm" {...desligado} onClick={() => { setEnviado(null); setNovo(true) }}><Plus /> Abrir pedido de regulação</Button>
          </div>
        </div>
      </div>
    )
  }

  return <PedidoNir key={p.id} unidadeId={unidadeId} linha={linha} p={p} pend={pend} agora={agora} cabecalho={cabecalho} enviado={enviado}
    novoPedido={() => { setEnviado(null); setNovo(true) }} />
}

/** Grade compacta de 3 colunas com rótulos pequenos em caixa. */
function Resumo({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-controle border border-fio bg-campo px-3 py-2.5 sm:grid-cols-3">{children}</dl>
}

function Item({ rotulo, children, className }: { rotulo: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <dt className="text-rotulo font-semibold tracking-wide text-tinta-sussurro uppercase">{rotulo}</dt>
      <dd className="text-tinta">{children}</dd>
    </div>
  )
}

function PedidoNir({ unidadeId, linha, p, pend, agora, cabecalho, enviado, novoPedido }: {
  unidadeId: string; linha: PacienteRegulacao; p: PedidoResumo; pend: PendenciaUnidade[]; agora: number; cabecalho: React.ReactNode
  enviado: PedidoEnviado | null; novoPedido: () => void
}) {
  const qc = useQueryClient()
  const recarregar = useRecarregarNir(unidadeId)
  // B-07 (RT, 25/11/2026): fora do plantão, o aviso fica no topo da página e os botões desligam
  const { motivo: foraDoPlantao } = usePlantaoOrigem()
  const desligado = { disabled: !!foraDoPlantao, title: foraDoPlantao ?? undefined }
  const d = useQuery({
    queryKey: ['regulacao-detalhe', p.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_detalhe', { p_id: p.id })
      if (error) throw error
      return data as unknown as Detalhe
    },
  })
  const anexos = useQuery({
    queryKey: ['regulacao-anexos', p.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_anexos', { p_solicitacao: p.id })
      if (error) throw error
      return data as unknown as { anexos: unknown[] }
    },
  })
  const s = d.data
  const [aba, setAba] = React.useState<Aba>(esperaAOrigem(p) ? 'conversa' : 'pendencias')
  const [remocao, setRemocao] = React.useState(false)
  const [puxar, setPuxar] = React.useState(false)
  const [aviso, setAviso] = React.useState<{ alvo: AlvoAviso; motivo?: MotivoPendencia } | null>(null)
  const [pedirEvolucao, setPedirEvolucao] = React.useState(0)
  const [rascunho, setRascunho] = React.useState<{ texto: string; vez: number } | null>(null)
  const doPedido = pend.filter((x) => x.solicitacao_id === p.id)
  const abertas = doPedido.filter((x) => x.status !== 'resolvida')
  const vaga = STATUS_VAGA.includes(p.status)
  const podeEvoluir = !!s?.pode_evoluir
  const alvo: AlvoAviso = { solicitacaoId: p.id, numero: p.numero, leito: linha.leito, setor: linha.setor, paciente: linha.paciente.nome }
  const avisar = (motivo?: MotivoPendencia) => setAviso({ alvo, motivo })
  const evoluir = () => { setAba('pendencias'); setPedirEvolucao((n) => n + 1) }
  const h = horasSemEvolucao(p, agora)
  const recarregarTudo = () => { recarregar(p.id); void qc.invalidateQueries({ queryKey: ['regulacao-anexos', p.id] }) }

  // faixa do prazo: o que pede ação agora
  let faixa: React.ReactNode = null
  if (vaga) {
    faixa = (
      <Faixa tom="sucesso" titulo={`Vaga: ${p.destino ?? 'destino a confirmar'}`}
        texto={p.status === 'em_transito' ? 'Paciente saiu da origem' : p.transporte ? TRANSPORTES[p.transporte] ?? p.transporte : 'Transporte a acionar'}>
        <Button size="xs" onClick={() => setRemocao(!remocao)} aria-expanded={remocao}><Truck /> Gerenciar remoção / saída</Button>
      </Faixa>
    )
  } else if (esperaAOrigem(p)) {
    faixa = (
      <Faixa tom="info" titulo="A central espera a unidade" texto={p.sla?.pendencia ? `responder até ${dataHora(p.sla.pendencia.vence_em)}` : null}>
        <Button size="xs" onClick={() => setPuxar(true)}><FileText /> Puxar exame do prontuário</Button>
        <Button size="xs" variant="outline" {...desligado} onClick={() => avisar('duvida')}><Bell /> Avisar médico</Button>
      </Faixa>
    )
  } else if (p.sla?.evolucao?.atrasada) {
    const risco = p.sla.evolucao.risco_cancelamento
    faixa = (
      <Faixa tom={risco ? 'critico' : 'atencao'} titulo={`${tempoSemEvolucao(h)} sem evolução${risco ? ': risco de cancelamento' : ' (vencida)'}`}
        texto={`última em ${dataHora(p.sla.evolucao.ultima_em)} · prazo de ${p.sla.evolucao.prazo_h} h`}>
        <Button size="xs" variant={podeEvoluir ? 'outline' : 'default'} {...desligado} onClick={() => avisar('evolucao')}><Bell /> Avisar médico</Button>
        {podeEvoluir && <Button size="xs" {...desligado} onClick={evoluir}><PenLine /> Atualizar evolução</Button>}
      </Faixa>
    )
  }

  const eventos = s?.eventos ?? []
  const linhaDoTempo = s ? montarLinhaDoTempo({ eventos, evolucoes: s.evolucoes ?? [], rotulosDocumento: ROTULO_DOCUMENTO }) : []

  return (
    <div className="flex flex-col">
      {cabecalho}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-fio bg-campo px-4 py-1.5">
        <Button size="xs" variant="outline" {...desligado} onClick={() => avisar(p.sla?.evolucao?.atrasada ? 'evolucao' : undefined)}><Bell /> Avisar médico</Button>
        <Button size="xs" variant="outline" onClick={() => setPuxar(true)}><FileText /> Puxar exame do prontuário</Button>
        {podeEvoluir && <Button size="xs" variant="outline" {...desligado} onClick={evoluir}><PenLine /> Atualizar evolução</Button>}
        {vaga && <Button size="xs" onClick={() => setRemocao(!remocao)} aria-expanded={remocao}><Truck /> Gerenciar remoção / saída</Button>}
        <Button size="xs" variant="outline" className="ml-auto" {...desligado} onClick={novoPedido}><Plus /> Novo pedido</Button>
      </div>
      {faixa}
      {remocao && vaga && (
        <section aria-label="Remoção e saída" className="flex flex-col gap-1.5 border-b border-fio bg-alerta-conforme px-4 py-2">
          {!s ? <Spinner /> : (
            <>
              <BlocoDestino s={s} />
              <SaidaOrigem s={s} nir aoFim={() => recarregar(p.id)} />
              {s.status === 'em_transito' && s.saida_em && (
                <p className="text-tinta">Saída registrada em {dataHora(s.saida_em)}{s.saida_por ? ` por ${s.saida_por}` : ''}.</p>
              )}
              <p className="text-rotulo text-tinta-apoio">A alta por transferência, que libera o leito, é do médico.</p>
            </>
          )}
        </section>
      )}
      {enviado && <div className="px-4 pt-2"><AvisoEnviado enviada={enviado} onde="Ele está aberto aqui." /></div>}
      <AbasLinha rotulo="Dossiê do pedido" tamanho="compacto" className="border-b border-fio px-2.5" valor={aba} onChange={setAba} abas={[
        { valor: 'pendencias', rotulo: 'Pendências & resumo', contagem: abertas.length },
        { valor: 'conversa', rotulo: 'Conversa com a central', contagem: p.conversa.total },
        { valor: 'anexos', rotulo: 'Anexos & exames', contagem: anexos.data?.anexos.length },
        { valor: 'tempo', rotulo: 'Linha do tempo', contagem: linhaDoTempo.length },
      ]} />
      <div className="flex flex-col gap-3 px-4 py-3">
        {d.error && <MensagemErro texto={(d.error as Error).message} />}
        {aba === 'pendencias' && (
          <>
            {esperaAOrigem(p) && <div className="rounded-controle border border-fio"><EsperaDaCentral p={p} /></div>}
            {p.status === 'pendencia' && <ResponderPergunta id={p.id} aoFim={() => recarregar(p.id)} />}
            <ListaPendencias pend={doPedido} aoMudar={() => recarregar(p.id)} />
            <section aria-label="Resumo da regulação" className="flex flex-col gap-1.5">
              <h3 className="text-rotulo font-semibold tracking-wide text-tinta-apoio uppercase">Resumo da regulação</h3>
              <Resumo>
                <Item rotulo="Procedimento" className="col-span-2"><span className="font-mono text-rotulo">{p.procedimento ?? ''}</span> {p.procedimento_nome ?? resumoPedido(p)}</Item>
                <Item rotulo="Caráter">{CARATER[p.carater]}</Item>
                <Item rotulo="Tipo de leito">{p.tipo_leito ? TIPOS_LEITO[p.tipo_leito] ?? p.tipo_leito : '—'}</Item>
                <Item rotulo="Destino">{p.destino ?? 'a definir'}</Item>
                <Item rotulo="Transporte">{p.transporte ? TRANSPORTES[p.transporte] ?? p.transporte : '—'}</Item>
                <Item rotulo="Isolamento">{s?.isolamento_tipo ? textoIsolamento(s) ?? ISOLAMENTOS[s.isolamento_tipo] ?? s.isolamento_tipo : 'precaução padrão'}</Item>
                <Item rotulo="Solicitante">{s?.solicitante ?? '—'}</Item>
                <Item rotulo="Médico assistente">{s?.medico_assistente ?? '—'}</Item>
                {s?.quadro_clinico && (
                  <Item rotulo="Quadro clínico do pedido" className="col-span-2 border-t border-fio pt-2 sm:col-span-3"><span className="whitespace-pre-wrap">{s.quadro_clinico}</span></Item>
                )}
              </Resumo>
            </section>
            {d.isLoading ? <Spinner /> : s && (
              <EvolucaoPedidoNir id={p.id} sla={s.sla} status={s.status} tempos={temposComAtual(s.tempos ?? [], s.status)} evolucoes={s.evolucoes ?? []}
                podeEvoluir={podeEvoluir} aoFim={() => recarregar(p.id)} pedirEvolucao={pedirEvolucao} />
            )}
          </>
        )}
        {aba === 'conversa' && (
          <>
            <div role="group" aria-label="Mensagens prontas" className="flex flex-wrap items-center gap-1.5">
              <span className="text-rotulo text-tinta-sussurro">Prontas:</span>
              {MENSAGENS_PRONTAS.map((m) => (
                <Button key={m.rotulo} size="xs" variant="outline" aria-pressed={rascunho?.texto === m.texto}
                  onClick={() => setRascunho((r) => ({ texto: m.texto, vez: (r?.vez ?? 0) + 1 }))}>{m.rotulo}</Button>
              ))}
            </div>
            <ConversaRegulacao solicitacaoId={p.id} rascunho={rascunho} aoEnviar={() => { setRascunho(null); recarregar(p.id) }} />
          </>
        )}
        {aba === 'anexos' && <AnexosRegulacao solicitacaoId={p.id} />}
        {aba === 'tempo' && (
          linhaDoTempo.length === 0 ? <VazioLinha>Nada registrado ainda.</VazioLinha> : (
            <ol aria-label="Linha do tempo do pedido" className="flex flex-col gap-2 border-l-2 border-fio pl-3">
              {linhaDoTempo.map((x) => (
                <li key={x.chave} className="flex flex-col">
                  <span className="text-tinta first-letter:uppercase">{x.titulo}</span>
                  {x.texto && <span className="whitespace-pre-wrap text-tinta-apoio">{x.texto}</span>}
                  <span className="text-rotulo text-tinta-sussurro">{dataHora(x.em)} · {x.por ?? '—'}</span>
                </li>
              ))}
            </ol>
          )
        )}
      </div>
      <AvisarMedico unidadeId={unidadeId} alvo={aviso?.alvo ?? null} motivoInicial={aviso?.motivo} aoFechar={() => setAviso(null)}
        aoSalvar={(id) => { recarregar(id); setAba('pendencias') }} />
      <PuxarDoProntuario aberto={puxar} p={p} linha={linha} examesAbertos={abertas.filter((x) => x.motivo === 'exame')}
        aoFechar={() => setPuxar(false)} aoFim={recarregarTudo} />
    </div>
  )
}

function Faixa({ tom, titulo, texto, children }: { tom: 'sucesso' | 'info' | 'atencao' | 'critico'; titulo: string; texto?: string | null; children: React.ReactNode }) {
  return (
    <div role="status" className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-4 py-1.5', {
      sucesso: 'border-conforme/30 bg-alerta-conforme', info: 'border-suprimento/30 bg-alerta-marca',
      atencao: 'border-atencao/30 bg-alerta-atencao', critico: 'border-critico/30 bg-alerta-critico',
    }[tom])}>
      <b className={cn('font-semibold', { sucesso: 'text-conforme', info: 'text-suprimento', atencao: 'text-atencao', critico: 'text-critico' }[tom])}>{titulo}</b>
      {texto && <span className="font-mono text-rotulo text-tinta-apoio">· {texto}</span>}
      <span className="ml-auto flex flex-wrap gap-1.5">{children}</span>
    </div>
  )
}

/** Pendências da unidade neste pedido: reenviar o aviso, copiar a cobrança (sem o nome) e marcar resolvida. */
function ListaPendencias({ pend, aoMudar }: { pend: PendenciaUnidade[]; aoMudar: () => void }) {
  const abertas = pend.filter((x) => x.status !== 'resolvida').length
  return (
    <section aria-label="Pendências da unidade" className="flex flex-col gap-1.5">
      <h3 className="flex items-baseline justify-between text-rotulo font-semibold tracking-wide text-tinta-apoio uppercase">
        Pendências (central ↔ médico ↔ NIR) <span className="font-mono font-normal normal-case">{abertas === 1 ? '1 aberta' : `${abertas} abertas`}</span>
      </h3>
      {pend.length === 0 ? <VazioLinha className="py-1">Nenhuma pendência neste pedido.</VazioLinha> : (
        <ul className="flex flex-col divide-y divide-fio rounded-controle border border-fio bg-superficie">
          {pend.map((x) => <LinhaPendencia key={x.id} x={x} aoMudar={aoMudar} />)}
        </ul>
      )}
    </section>
  )
}

function LinhaPendencia({ x, aoMudar }: { x: PendenciaUnidade; aoMudar: () => void }) {
  const { reavisar, resolver, erro } = useAcoesPendencia(aoMudar)
  const plantao = usePlantaoOrigem(reavisar.error, resolver.error)
  const [copiado, setCopiado] = React.useState(false)
  const aberta = x.status !== 'resolvida'
  return (
    <li className={cn('flex items-center gap-2 px-3 py-1.5', !aberta && 'opacity-70')}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-tinta" title={x.titulo}>{x.titulo}</span>
        <span className="flex flex-wrap items-center gap-1 text-rotulo text-tinta-sussurro">
          <Badge variant={x.dono === 'medico' ? 'warning' : 'info'}>Dono: {x.dono === 'medico' ? 'Médico' : 'NIR'}</Badge>
          <Badge variant={tomStatus(x.status)}>{STATUS_PENDENCIA[x.status]}{x.status === 'medico_avisado' && x.avisado_em ? ` · ${tempoDecorrido(x.avisado_em).replace(/^há /, '')}` : ''}</Badge>
          {x.urgencia === 'alta' && <Badge variant="destructive">Urgente</Badge>}
          {x.responsaveis.length > 0 && <span>{x.responsaveis.map((r) => r.nome).join(', ')}</span>}
          <span className="font-mono">· {dataHora(x.criada_em)}</span>
          {x.avisos > 1 && <span>· {x.avisos} avisos</span>}
          {!aberta && <span>· resolvida por {x.resolvida_por ?? '—'}{x.resolvida_em ? `, ${dataHora(x.resolvida_em)}` : ''}</span>}
        </span>
        <AvisoPlantao texto={plantao.recusa} className="mt-1" />
        {erro && !plantao.recusa && <MensagemErro texto={erro.message} />}
      </span>
      {aberta && (
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          {x.dono === 'medico' && <Button size="xs" variant="outline" disabled={reavisar.isPending || !!plantao.motivo} title={plantao.motivo ?? undefined} onClick={() => reavisar.mutate(x.id)}>Reenviar aviso</Button>}
          <Button size="xs" variant="outline"
            onClick={() => navigator.clipboard.writeText(textoParaWhatsApp({ leito: x.leito, numero: x.numero, setor: x.setor?.nome ?? null, pendencia: x.titulo,
              medico: x.responsaveis.map((r) => r.nome).join(', ') || null })).then(() => setCopiado(true), () => setCopiado(false))}>
            {copiado ? 'Copiado' : 'Copiar cobrança'}
          </Button>
          <Button size="xs" disabled={resolver.isPending || !!plantao.motivo} title={plantao.motivo ?? undefined} onClick={() => resolver.mutate(x.id)}>Marcar resolvida</Button>
        </span>
      )}
    </li>
  )
}

/**
 * "Puxar exame do prontuário": os documentos já emitidos no prontuário, para
 * anexar ao pedido (o anexar do prontuário que já existe). Com pendência de
 * exame aberta, anexar pode resolvê-la junto (autor e hora do login).
 */
function PuxarDoProntuario({ aberto, p, linha, examesAbertos, aoFechar, aoFim }: {
  aberto: boolean; p: PedidoResumo; linha: PacienteRegulacao; examesAbertos: PendenciaUnidade[]; aoFechar: () => void; aoFim: () => void
}) {
  const [resolver, setResolver] = React.useState(true)
  const [erro, setErro] = React.useState<string | null>(null)
  // B-07: fora do plantão o anexo segue valendo; resolver a pendência junto, não
  const { motivo: foraDoPlantao } = usePlantaoOrigem()
  async function depois() {
    setErro(null)
    if (resolver && !foraDoPlantao) {
      for (const x of examesAbertos) {
        const { error } = await supabase.rpc('regulacao_pendencia_unidade_resolver', { p_id: x.id, p_nota: 'Exame anexado do prontuário' })
        if (error) { setErro(error.message); break }
      }
    }
    aoFim()
    aoFechar()
  }
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) aoFechar() }}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Puxar exame do prontuário</DialogTitle>
          <DialogDescription>{linha.leito ?? 'Sem leito'} · {linha.paciente.nome} · Regulação nº {p.numero}. Clique no documento para anexar ao pedido.</DialogDescription>
        </DialogHeader>
        {examesAbertos.length > 0 && (
          <Chip variante="opcao" ativo={resolver && !foraDoPlantao} desabilitado={!!foraDoPlantao} titulo={foraDoPlantao ?? undefined} onClick={() => setResolver(!resolver)}>
            Resolver a pendência de exame aberta ({examesAbertos.length})
          </Chip>
        )}
        {aberto && <EscolherDocumento solicitacaoId={p.id} aoFim={() => void depois()} />}
        <MensagemErro texto={erro} />
      </DialogContent>
    </Dialog>
  )
}

