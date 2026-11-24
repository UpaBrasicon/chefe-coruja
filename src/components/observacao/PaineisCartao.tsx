// ─────────────────────────────────────────────────────────────────────────────
// Painéis que abrem embaixo do box (protótipo, index.html 3612–3693):
// reavaliar às, desfecho da observação, protocolo e passagem de plantão.
// Toda regra mora no servidor (migration 20261004000007); aqui só se pede.
// ─────────────────────────────────────────────────────────────────────────────
import { useQueries, useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import * as React from 'react'

import { SeletorMotivoEvasao } from '@/components/porta/MotivoEvasao'
import type { MotivoEvasao } from '@/lib/evasao'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { faixaEtaria, publicosDeProtocolo, type FaixaEtaria } from '@/domain/idade'
import { dataIso } from '@/lib/formato'
import { DOCS_INICIAL, type EstadoDocs } from '@/lib/documentosAlta'
import { horaMais } from '@/lib/observacaoLista'
import { agruparTravas } from '@/lib/travasAlta'
import { CartaoAtestado, ReceitaAlta } from '@/components/documentos/AtestadoReceita'
import { useEmissaoAtestadoReceita } from '@/components/documentos/emissaoAtestadoReceita'
import { BlocoPacote } from '@/components/internacao/caderno/Alta'
import { GrupoTrava } from '@/components/internacao/caderno/PassosAlta'
import { useDiagnosticos } from '@/components/internacao/caderno/diagnosticos'
import type { Acao as AcaoLeito, Internacao, Pacote } from '@/components/internacao/caderno/comum'
import { CampoTerminologia } from '@/components/regulacao/NovaSolicitacao'
import { PassagensDoPlantao } from '@/components/internacao/PassagensDoPlantao'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { DESFECHOS, RELATO_DESFECHO, hhmm, rpc, type Acao, type Desfecho, type LinhaObservacao } from './modelo'
import { Chip } from '@/components/monitor/Pagina'
import { Estado, type TomEstado } from '@/components/porta/Estado'
import { RegulacaoDaAlta } from '@/components/regulacao/RegulacaoDaAlta'
import { PainelTransferencia } from '@/components/transferencia/DocumentoTransferencia'
import { DadosObito } from '@/components/obito/DadosObito'
import { useAgora } from '@/hooks/useAgora'
import { detalhesObito, obitoVazio, regrasObito } from '@/lib/obito'
import { detalhesDaTransferencia, type RegulacaoDoHistorico } from '@/lib/regulacaoAlta'

export function Painel({ titulo, children, erro }: { titulo?: React.ReactNode; children: React.ReactNode; erro?: string | null }) {
  return (
    <div className="mx-5 mb-3.5 flex flex-col gap-2.5 rounded-container border border-fio bg-campo px-3.5 py-3">
      {titulo && <span className="text-apoio font-semibold text-grafite">{titulo}</span>}
      {children}
      {erro && <span className="text-apoio text-critico">{erro}</span>}
    </div>
  )
}

/** Opção em cápsula, como os chips do protótipo. */
export function Opcao({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Chip ativo={ativa} onClick={onClick}>
      {children}
    </Chip>
  )
}

/** Hora "HH:MM" de hoje; se já passou, o dia seguinte (reavaliação) ou o anterior (óbito). */
function horaDoDia(hm: string, sentido: 'futuro' | 'passado') {
  const [h, m] = hm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  if (sentido === 'futuro' && d.getTime() < Date.now()) d.setDate(d.getDate() + 1)
  if (sentido === 'passado' && d.getTime() > Date.now() + 60_000) d.setDate(d.getDate() - 1)
  return d.toISOString()
}

// ── reavaliar às ────────────────────────────────────────────────────────────
export function PainelReavaliar({ linha, acao, fechar, erro }: { linha: Pick<LinhaObservacao, 'internacao_id'>; acao: Acao; fechar: () => void; erro: string | null }) {
  const [hora, setHora] = React.useState('')
  const agora = useAgora()
  return (
    <Painel erro={erro}>
      {/* OO1 (RT, 24/11/2026): atalhos, e a hora final escrita */}
      <div role="group" aria-label="Atalhos da reavaliação" className="flex flex-wrap items-center gap-1.5">
        {([['+30 min', 30], ['+1 h', 60], ['+2 h', 120]] as const).map(([r, m]) => (
          <Opcao key={r} ativa={hora === horaMais(agora, m)} onClick={() => setHora(horaMais(agora, m))}>{r}</Opcao>
        ))}
        {hora && <span className="text-apoio text-tinta-apoio">reavaliar às {hora}</span>}
      </div>
      <div className="flex flex-wrap items-end gap-2.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`reav-${linha.internacao_id}`}>Reavaliar às</Label>
          <Input id={`reav-${linha.internacao_id}`} type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="w-[130px]" />
        </div>
        <Button size="sm" disabled={!hora}
          onClick={() => void acao(() => rpc('observacao_reavaliar', { p_internacao: linha.internacao_id, p_quando: horaDoDia(hora, 'futuro') })).then((ok) => ok && fechar())}>
          Colocar em reavaliação
        </Button>
        <Button size="sm" variant="outline" onClick={fechar}>Cancelar</Button>
      </div>
    </Painel>
  )
}

// ── desfecho da observação ──────────────────────────────────────────────────
// Só usa a internação e o paciente: abre também em "Observações que você abriu".
// OO2 (RT, 24/11/2026), igual ao AL1/AL3 da Internação: o tipo de saída
// primeiro; as pendências agrupadas com ação; o CID por busca, sugerido da
// lista de problemas; na alta para casa, receita, atestado e orientações no
// mesmo passo; na internação, os setores com os leitos livres e, sem nenhum,
// "Pedir leito na regulação". A chamada continua finalizar_observacao.
const PARA_CASA: Desfecho[] = ['alta_medica', 'alta_apos_medicacao', 'alta_a_pedido']

/** Receita, atestado e orientações da alta para casa, no mesmo passo do desfecho. */
function DocumentosParaCasa({ linha, cid }: { linha: Pick<LinhaObservacao, 'internacao_id' | 'paciente_id'> & { nome?: string | null; data_nascimento?: string | null }; cid: string }) {
  const [estado, setEstado] = React.useState<EstadoDocs>(DOCS_INICIAL)
  const [aberto, setAberto] = React.useState<'' | 'receita' | 'atestado' | 'orientacoes'>('')
  const nascimento = linha.data_nascimento ? linha.data_nascimento.slice(0, 10) : null
  const { erro, emitirAtestado, emitirReceita } = useEmissaoAtestadoReceita({
    pacienteId: linha.paciente_id, nome: linha.nome ?? '', nascimento, ondePreencherCid: 'escolha o CID de alta acima', estado, setEstado,
  })
  const pacotes = useQuery({
    queryKey: ['pacotes-alta', linha.internacao_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('pacotes_alta').select('id, situacao, criado_em, expira_em, tentativas').eq('internacao_id', linha.internacao_id).order('criado_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as Pacote[]
    },
  })
  const acaoPacote: AcaoLeito = <T,>(fn: () => Promise<T>) => fn().then((r) => { void pacotes.refetch(); return r }).catch(() => null)
  const parte = (id: typeof aberto, titulo: string, conteudo: React.ReactNode) => (
    <div className="flex flex-col gap-2">
      <Button size="sm" variant="outline" className="self-start" aria-expanded={aberto === id} onClick={() => setAberto(aberto === id ? '' : id)}>
        <ChevronDown className={cn('transition-transform', aberto === id && 'rotate-180')} aria-hidden /> {titulo}
      </Button>
      {aberto === id && conteudo}
    </div>
  )
  return (
    <div className="flex flex-col gap-2 rounded-controle border border-fio bg-superficie p-3">
      <span className="text-apoio font-semibold text-grafite">Para casa</span>
      {erro && <span role="alert" className="text-apoio text-critico">{erro}</span>}
      {parte('receita', 'Receita para casa', (
        <ReceitaAlta titulo="Receita para casa" faixa={faixaEtaria(nascimento, dataIso())} estado={estado} setEstado={setEstado} onEmitir={() => void emitirReceita()} />
      ))}
      {parte('atestado', 'Atestado', <CartaoAtestado estado={estado} setEstado={setEstado} cid={cid} onEmitir={() => void emitirAtestado(cid)} />)}
      {parte('orientacoes', 'Orientações', (
        <BlocoPacote i={{ id: linha.internacao_id } as Internacao} pacienteId={linha.paciente_id} pacienteNome={linha.nome ?? ''}
          lista={pacotes.data ?? []} podeGerar acao={acaoPacote} />
      ))}
    </div>
  )
}

export function PainelDesfecho({ linha, unidadeId, acao, fechar, erro, irRegulacao }: {
  linha: Pick<LinhaObservacao, 'internacao_id' | 'paciente_id'> & { nome?: string | null; data_nascimento?: string | null }
  unidadeId: string; acao: Acao; fechar: () => void; erro: string | null
  /** OO2: sem leito livre, "Pedir leito na regulação" leva à regulação do paciente */
  irRegulacao?: () => void
}) {
  const [desfecho, setDesfecho] = React.useState<Desfecho | ''>('')
  // o CID escolhido pelo médico; undefined = ainda não mexeu (vale a sugestão da lista de problemas)
  const [cidEscolhido, setCidEscolhido] = React.useState<{ codigo: string; rotulo: string } | null | undefined>(undefined)
  const [destino, setDestino] = React.useState('')
  // S4 (A01 P2-2): a regulação desta transferência (undefined = ainda não escolhida)
  const [regulacao, setRegulacao] = React.useState<RegulacaoDoHistorico | null | undefined>(undefined)
  // lacuna 7 (T5): a transferência só sai com o documento de transferência emitido
  const [docTransferencia, setDocTransferencia] = React.useState(false)
  // lacuna 5 (O1): os mesmos dados do óbito da porta e da internação
  const [obito, setObito] = React.useState(() => obitoVazio())
  const agora = useAgora()
  const [relato, setRelato] = React.useState('')
  const [motivoEvasao, setMotivoEvasao] = React.useState<MotivoEvasao | null>(null) // Fase 1, tarefa 6
  const [setor, setSetor] = React.useState('')
  const [leito, setLeito] = React.useState('')
  const [falta, setFalta] = React.useState<string | null>(null)

  // OO2: o CID sugerido da lista de problemas (o principal vigente); o médico confirma ou troca
  const diagnosticos = useDiagnosticos(linha.internacao_id)
  const principal = (diagnosticos.data ?? []).find((d) => !d.encerrado_em && d.tipo === 'primario')
  const sugestao = principal ? { codigo: principal.cid, rotulo: `${principal.cid}${principal.descricao ? ` ${principal.descricao}` : ''}` } : null
  const cidAtual = cidEscolhido === undefined ? sugestao : cidEscolhido
  const cid = cidAtual?.codigo ?? ''
  const cidRotulo = cidAtual?.rotulo ?? ''
  const cidSugerido = cidEscolhido === undefined && !!sugestao

  const impeditivos = useQuery({
    queryKey: ['impeditivos', linha.internacao_id],
    queryFn: async () => (await rpc('impeditivos_alta', { p_internacao: linha.internacao_id })) as { tipo: string; descricao: string; id?: string }[] | null,
  })
  const grupos = agruparTravas(impeditivos.data ?? [])

  const setores = useQuery({
    queryKey: ['setores-internacao', unidadeId],
    enabled: desfecho === 'internacao',
    queryFn: async () => (await rpc('setores_internacao', { p_unidade: unidadeId })) as { id: string; nome: string }[],
  })
  // OO2: os leitos livres (e reservados para este paciente) de cada setor
  const livres = useQueries({
    queries: (setores.data ?? []).map((s) => ({
      queryKey: ['leitos-livres', s.id, linha.paciente_id],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('leitos_para_ocupar', { p_setor: s.id, p_paciente: linha.paciente_id })
        if (error) throw error
        return (data ?? []).map((l) => ({ id: l.id, identificador: l.reservado ? `${l.identificador} (reservado)` : l.identificador }))
      },
    })),
  })
  const leitosDo = (id: string) => livres[(setores.data ?? []).findIndex((s) => s.id === id)]?.data ?? []
  const nenhumLivre = !!setores.data && setores.data.length > 0 && livres.every((q) => q.isSuccess && (q.data ?? []).length === 0)

  const pedeRelato = desfecho ? RELATO_DESFECHO[desfecho] : undefined
  const ehAlta = !!desfecho && desfecho !== 'internacao'

  function confirmar() {
    if (!desfecho) return setFalta('Escolha o tipo de saída.')
    if (ehAlta && desfecho !== 'evasao' && cid.trim().length < 3) return setFalta('Informe o CID de alta.')
    if (desfecho === 'transferencia' && !regulacao && destino.trim().length < 3) return setFalta('Informe o serviço de destino.')
    if (desfecho === 'transferencia' && !docTransferencia) return setFalta('Emita o documento de transferência antes de transferir.')
    if (desfecho === 'evasao' && !motivoEvasao) return setFalta('Escolha o motivo da evasão.')
    if (desfecho === 'obito') {
      const falta = regrasObito(obito, { agora: Date.now() }).find((r) => !r.ok)
      if (falta) return setFalta(`Óbito: ${falta.texto}.`)
    }
    if (desfecho === 'internacao' && !setor) return setFalta('Escolha o setor de internação.')
    if (pedeRelato && relato.trim().length < 15) return setFalta(`${pedeRelato}: escreva ao menos 15 caracteres.`)
    setFalta(null)
    const detalhes: Record<string, unknown> = {}
    if (desfecho === 'transferencia') Object.assign(detalhes, detalhesDaTransferencia(regulacao ?? null, destino))
    if (desfecho === 'evasao' && motivoEvasao) detalhes.motivo_evasao = motivoEvasao
    if (desfecho === 'obito') Object.assign(detalhes, detalhesObito(obito))
    if (desfecho === 'internacao') { detalhes.setor_id = setor; if (leito) detalhes.leito_id = leito }
    void acao(() => rpc('finalizar_observacao', {
      p_internacao: linha.internacao_id, p_desfecho: desfecho, p_cid: ehAlta ? cid.trim() || null : null,
      p_relato: relato.trim() || null, p_detalhes: detalhes,
    })).then((ok) => ok && fechar())
  }

  return (
    <Painel titulo="Tipo de saída" erro={falta ?? erro}>
      <div role="radiogroup" aria-label="Tipo de saída" className="flex flex-wrap gap-[7px]">
        {DESFECHOS.map(([k, r]) => <Opcao key={k} ativa={desfecho === k} onClick={() => { setDesfecho(k); setFalta(null) }}>{r}</Opcao>)}
      </div>

      {grupos.length > 0 && (
        <div className="flex flex-col gap-1 rounded-controle border border-atencao/40 bg-superficie px-3 py-2">
          <span className="text-apoio font-semibold text-tinta">Pendências</span>
          <ul className="flex flex-col">{grupos.map((g) => <GrupoTrava key={g.chave} g={g} pacienteId={linha.paciente_id} />)}</ul>
          {(desfecho === 'obito' || desfecho === 'transferencia') && (
            <span className="text-rotulo text-tinta-apoio">No óbito e na transferência, o que está em aberto é cancelado com o motivo; agravo suspeito precisa da notificação antes.</span>
          )}
        </div>
      )}

      {desfecho === 'evasao' && <SeletorMotivoEvasao valor={motivoEvasao} onChange={(v) => { setMotivoEvasao(v); setFalta(null) }} />}
      {desfecho === 'internacao' && (
        <div className="flex flex-col gap-2">
          <span className="text-apoio font-medium text-grafite">Setor de internação</span>
          <div role="radiogroup" aria-label="Setor de internação" className="flex flex-wrap gap-1.5">
            {(setores.data ?? []).map((s) => {
              const n = leitosDo(s.id).length
              return <Opcao key={s.id} ativa={setor === s.id} onClick={() => { setSetor(s.id); setLeito('') }}>{s.nome} · {n ? `${n} livre${n === 1 ? '' : 's'}` : 'sem leito livre'}</Opcao>
            })}
            {setores.isLoading && <span className="text-apoio text-tinta-sussurro">Carregando os setores…</span>}
          </div>
          {nenhumLivre && (
            <div className="flex flex-wrap items-center gap-2 text-apoio text-atencao">
              Nenhum setor com leito livre agora.
              {irRegulacao && <Button size="sm" variant="outline" onClick={irRegulacao}>Pedir leito na regulação</Button>}
            </div>
          )}
          {setor && leitosDo(setor).length > 0 && (
            <div role="radiogroup" aria-label="Leito" className="flex flex-wrap items-center gap-1.5">
              <span className="text-apoio text-tinta-apoio">Leito:</span>
              {leitosDo(setor).map((l) => <Opcao key={l.id} ativa={leito === l.id} onClick={() => setLeito(leito === l.id ? '' : l.id)}>{l.identificador}</Opcao>)}
              <span className="text-rotulo text-tinta-sussurro">(opcional: sem escolher, entra sem leito)</span>
            </div>
          )}
          <span className="text-apoio text-tinta-apoio">O box é liberado e o paciente passa ao setor escolhido; o laudo de AIH é feito no paciente, em Mais.</span>
        </div>
      )}
      {ehAlta && (
        <div className="flex max-w-[460px] flex-col gap-1">
          <CampoTerminologia tipo="cid10" escolhido={cidRotulo}
            rotulo={<>CID de alta{desfecho === 'evasao' ? ' · opcional' : ''}{cidSugerido && <span className="ml-1.5 text-rotulo font-normal text-atencao">· sugerido da lista de problemas, confira</span>}</>}
            onEscolher={(c, r) => setCidEscolhido({ codigo: c, rotulo: r })} onLimpar={() => setCidEscolhido(null)} />
        </div>
      )}
      {desfecho && PARA_CASA.includes(desfecho) && <DocumentosParaCasa linha={linha} cid={cid} />}
      {desfecho === 'transferencia' && (
        <RegulacaoDaAlta pacienteId={linha.paciente_id} valor={regulacao} aoEscolher={setRegulacao} />
      )}
      {desfecho === 'transferencia' && !regulacao && (
        <div className="flex max-w-[420px] flex-col gap-1.5">
          <Label htmlFor={`dest-${linha.internacao_id}`}>Serviço de destino</Label>
          <Input id={`dest-${linha.internacao_id}`} value={destino} onChange={(e) => setDestino(e.target.value)} />
        </div>
      )}
      {desfecho === 'transferencia' && <PainelTransferencia pacienteId={linha.paciente_id} aoMudar={setDocTransferencia} />}
      {desfecho === 'obito' && (
        <DadosObito id={`ob-${linha.internacao_id}`} valor={obito} onChange={(v) => { setObito(v); setFalta(null) }} agora={agora} />
      )}
      {pedeRelato && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rel-${linha.internacao_id}`}>{pedeRelato}</Label>
          <Textarea id={`rel-${linha.internacao_id}`} rows={2} value={relato} onChange={(e) => setRelato(e.target.value)} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={confirmar} disabled={desfecho === 'transferencia' && !docTransferencia}>Confirmar desfecho</Button>
        <Button size="sm" variant="outline" onClick={fechar}>Cancelar</Button>
      </div>
    </Painel>
  )
}

// ── protocolo ───────────────────────────────────────────────────────────────
type ItemCatalogo = { sigla: string; nome: string; publico: string; fonte: string }

export function PainelEscolherProtocolo({ linha, faixa, acao, fechar, erro }: {
  linha: LinhaObservacao; faixa: FaixaEtaria; acao: Acao; fechar: () => void; erro: string | null
}) {
  const catalogo = useQuery({
    queryKey: ['protocolos-observacao'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('protocolos_observacao').select('sigla, nome, publico, fonte').eq('ativo', true).order('sigla')
      if (error) throw error
      return (data ?? []) as ItemCatalogo[]
    },
  })
  // sem data de nascimento, só os de público "todos" (nem adulto nem pediátrico)
  const publicos = publicosDeProtocolo(faixa)
  // OO3 (RT, 24/11/2026): busca, e uma linha com quantos há e quem cadastra
  const [busca, setBusca] = React.useState('')
  const termo = busca.trim().toLowerCase()
  const daIdade = (catalogo.data ?? []).filter((p) => publicos.includes(p.publico))
  const opcoes = daIdade.filter((p) => !termo || `${p.sigla} ${p.nome}`.toLowerCase().includes(termo))
  return (
    <Painel titulo="Inserir no protocolo" erro={erro}>
      {catalogo.data && (
        <span className="text-rotulo text-tinta-sussurro">
          {daIdade.length} {daIdade.length === 1 ? 'protocolo' : 'protocolos'} com fonte na unidade para esta idade · quem cadastra: Gestor › Protocolos
        </span>
      )}
      {daIdade.length > 3 && (
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar protocolo pela sigla ou pelo nome" aria-label="Buscar protocolo" />
      )}
      <div className="flex flex-wrap gap-[7px]">
        {opcoes.map((p) => (
          <Opcao key={p.sigla} ativa={false} onClick={() => void acao(() => rpc('observacao_iniciar_protocolo', { p_internacao: linha.internacao_id, p_sigla: p.sigla }))}>
            {p.sigla} · {p.nome}
          </Opcao>
        ))}
        {catalogo.data && opcoes.length === 0 && <span className="text-apoio text-tinta-sussurro">Nenhum protocolo com fonte para esta idade.</span>}
      </div>
      {faixa === 'desconhecida' && (
        <span className="text-apoio text-atencao">Cadastre a data de nascimento: sem ela, só aparecem os protocolos que valem para qualquer idade.</span>
      )}
      <span className="text-rotulo text-tinta-sussurro">Só entram protocolos cuja sequência tem fonte declarada.</span>
      <Button size="sm" variant="outline" className="self-start" onClick={fechar}>Cancelar</Button>
    </Painel>
  )
}

export function PainelProtocoloAberto({ linha, acao, fechar, erro }: { linha: LinhaObservacao; acao: Acao; fechar: () => void; erro: string | null }) {
  const pr = linha.protocolo!
  const [motivo, setMotivo] = React.useState('')
  const [falta, setFalta] = React.useState<string | null>(null)
  const ultima = pr.etapa_atual >= pr.etapas.length - 1
  return (
    <Painel titulo={`${pr.sigla} · ${pr.nome}`} erro={falta ?? erro}>
      <ol className="flex flex-col gap-1">
        {pr.etapas.map((e, i) => {
          const feita = pr.historico.find((h) => h.etapa === i)
          return (
            <li key={i} className={cn('text-apoio', i < pr.etapa_atual ? 'text-conforme' : i === pr.etapa_atual ? 'font-semibold text-tinta' : 'text-tinta-sussurro')}>
              <span className={cn(i < pr.etapa_atual && 'line-through')}>{i + 1}. {e.texto}</span>
              {e.referencia && <span className="font-normal text-tinta-sussurro"> · {e.referencia}</span>}
              {feita && <span className="font-normal text-tinta-sussurro"> · feita às {hhmm(feita.em)}{feita.por ? ` por ${feita.por}` : ''}</span>}
            </li>
          )
        })}
      </ol>
      <span className="text-rotulo text-tinta-sussurro">
        Etapas de processo, sem dose. Fonte: {pr.fonte} Iniciado às {hhmm(pr.iniciado_em)}{pr.iniciado_por ? ` por ${pr.iniciado_por}` : ''}.
      </span>
      <Input value={motivo} onChange={(e) => { setMotivo(e.target.value); setFalta(null) }} placeholder="Para encerrar: justificativa, mínimo 15 caracteres" aria-label="Justificativa de encerramento" />
      <div className="flex flex-wrap gap-2">
        {!ultima && (
          <Button size="sm" onClick={() => void acao(() => rpc('observacao_avancar_protocolo', { p_protocolo: pr.id }))}>Avançar etapa</Button>
        )}
        <Button size="sm" variant="destructive" className="text-critico"
          onClick={() => {
            if (motivo.trim().length < 15) return setFalta('Para encerrar o protocolo, justifique com ao menos 15 caracteres.')
            void acao(() => rpc('observacao_encerrar_protocolo', { p_protocolo: pr.id, p_motivo: motivo.trim() })).then((ok) => ok && fechar())
          }}>
          Encerrar protocolo
        </Button>
        <Button size="sm" variant="outline" onClick={fechar}>Fechar</Button>
      </div>
    </Painel>
  )
}

// ── passagem de plantão ─────────────────────────────────────────────────────
const TOM_PASSAGEM: Record<'aguardando' | 'aceita' | 'recusada', TomEstado> = {
  aguardando: 'ambar',
  aceita: 'verde',
  recusada: 'vermelho',
}

/** O que o box mostra da passagem: estado, resumo, e a ação de quem recebe ou de quem passou. */
export function BlocoPassagemBox({ linha }: { linha: LinhaObservacao }) {
  const ps = linha.passagem!
  const rotulo = ps.situacao === 'aceita'
    ? `Aceita às ${hhmm(ps.respondida_em)}${ps.para_nome ? ` · ${ps.para_nome}` : ''}`
    : ps.situacao === 'recusada' ? `Recusada · "${ps.motivo_recusa ?? ''}"` : `Aguardando aceite${ps.para_nome ? ` de ${ps.para_nome}` : ''}`
  return (
    <Painel>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-apoio font-semibold text-grafite">Passagem de plantão</span>
        <Estado tom={TOM_PASSAGEM[ps.situacao]}>{rotulo}</Estado>
      </div>
      <p className="rounded-controle border border-fio bg-superficie px-[11px] py-2 text-controle whitespace-pre-wrap text-tinta">{ps.resumo}</p>
      {ps.situacao === 'aguardando' && <PassagensDoPlantao pacienteId={linha.paciente_id} />}
      <span className="text-rotulo text-tinta-sussurro">
        Enviada às {hhmm(ps.enviada_em)}{ps.de_nome ? ` por ${ps.de_nome}` : ''}
        {ps.situacao === 'recusada' ? ' · o box volta para quem passou: corrija o resumo e reenvie' : ps.situacao === 'aguardando' ? ' · check-out de quem passou bloqueado até o aceite' : ''}
      </span>
    </Painel>
  )
}

/** Enviar a passagem deste box: para quem está na escala do setor agora ou nas próximas 12 h. */
export function PainelPassar({ linha, acao, fechar, erro }: { linha: LinhaObservacao; acao: Acao; fechar: () => void; erro: string | null }) {
  const [para, setPara] = React.useState('')
  const [resumo, setResumo] = React.useState(() => [linha.queixa, linha.reavaliar_em ? `reavaliar às ${hhmm(linha.reavaliar_em)}` : null].filter(Boolean).join(' · '))
  const colegas = useQuery({
    queryKey: ['colegas-passagem', linha.internacao_id],
    queryFn: async () => (await rpc('colegas_para_passagem', { p_internacao: linha.internacao_id })) as { perfil_id: string; nome: string; inicio: string }[],
  })
  return (
    <Painel titulo="Passar plantão" erro={erro}>
      <Select items={Object.fromEntries((colegas.data ?? []).map((c) => [c.perfil_id, `${c.nome} · a partir de ${hhmm(c.inicio)}`]))} value={para || null} onValueChange={(x) => setPara(x ?? '')}>
        <SelectTrigger className="w-full max-w-[420px]"><SelectValue placeholder={colegas.isLoading ? 'Carregando a escala…' : 'Para quem (escala do setor, agora ou nas próximas 12h)'} /></SelectTrigger>
        <SelectContent>
          {(colegas.data ?? []).map((c) => <SelectItem key={c.perfil_id} value={c.perfil_id}>{c.nome} · a partir de {hhmm(c.inicio)}</SelectItem>)}
        </SelectContent>
      </Select>
      {colegas.data && colegas.data.length === 0 && <span className="text-apoio text-atencao">Ninguém na escala deste setor agora nem nas próximas 12 horas.</span>}
      <Textarea rows={2} value={resumo} onChange={(e) => setResumo(e.target.value)} aria-label="Resumo da passagem"
        placeholder="O que o próximo profissional precisa saber deste box (mínimo de 15 letras)" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!para || resumo.trim().length < 15}
          onClick={() => void acao(() => rpc('enviar_passagem', { p_internacao: linha.internacao_id, p_para: para, p_resumo: resumo })).then((ok) => ok && fechar())}>
          Enviar passagem
        </Button>
        <Button size="sm" variant="outline" onClick={fechar}>Cancelar</Button>
      </div>
    </Painel>
  )
}
