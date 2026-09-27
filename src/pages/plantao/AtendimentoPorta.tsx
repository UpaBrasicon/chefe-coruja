import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ClipboardCheck, DoorOpen, FileText, Stethoscope } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { rotuloIdade } from '@/domain/idade'
import { rotulosPrioridade } from '@/domain/prioridade'
import { ALVO_MIN, CORES_RISCO, gravidade, NIVEL_RISCO, ordemMedica, type CorRisco } from '@/domain/risco'
import { faltandoVitais, paraNumeros, type Publico } from '@/domain/vitais'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { CamposVitais } from '@/components/clinico/CamposVitais'
import { BotaoChamar } from '@/components/porta/Chamada'
import { SepsePorta } from '@/components/internacao/LeitoAberto'
import { PrescricaoEstruturada } from '@/components/prescricao/PrescricaoEstruturada'
import { ExamesEAgravos } from '@/components/clinico/ExamesEAgravos'
import { useChamadasPorEpisodio } from '@/hooks/useChamadas'

// Atendimento médico no Pronto Socorro (Fase 2.4): fila médica (cor → 80+ →
// prioridade legal → espera), abrir o atendimento, SOAP, reclassificação
// (só o médico) e desfecho. Nada aqui sugere cor ou conduta (ADR 0007).

type EpFila = {
  id: string
  paciente_id: string
  setor_id: string
  cor_atual: CorRisco
  classificado_em: string
  chegada_em: string
  queixa: string
  publico: Publico | null
  prioridades_legais: string[]
  atendimento_iniciado_em: string | null
  paciente: { nome: string; nome_social: string | null; data_nascimento: string | null } | null
}

const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
const nomeDe = (e: EpFila) => e.paciente?.nome_social || e.paciente?.nome || 'Paciente'

function Espera({ desde, cor, agora }: { desde: string; cor: CorRisco; agora: number }) {
  const min = Math.max(0, Math.round((agora - Date.parse(desde)) / 60_000))
  const acima = min > ALVO_MIN[cor]
  return (
    <span className={cn('text-xs tabular-nums', acima ? 'font-semibold text-critico' : 'text-muted-foreground')}>
      espera {min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} min`} · alvo {ALVO_MIN[cor]} min
    </span>
  )
}

const DESFECHOS = [
  { valor: 'alta', rotulo: 'Alta médica' },
  { valor: 'alta_apos_medicacao', rotulo: 'Alta após medicação' },
  { valor: 'observacao', rotulo: 'Observação (box)' },
  { valor: 'internacao', rotulo: 'Internação' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'alta_a_pedido', rotulo: 'Alta a pedido' },
  { valor: 'evasao', rotulo: 'Evasão' },
  { valor: 'obito', rotulo: 'Óbito' },
] as const
type Desfecho = (typeof DESFECHOS)[number]['valor']
const PEDE_RELATO: Desfecho[] = ['evasao', 'alta_a_pedido', 'obito']

type Classificacao = { id: string; cor: CorRisco; fluxograma_nome: string | null; discriminador: string | null; discriminador_cor: string | null; reclassificacao: boolean; motivo: string | null; justificativa: string | null; criado_em: string; autor_papel: string }
type Soap = { id: string; subjetivo: string | null; objetivo: string | null; avaliacao: string | null; cid: string | null; plano: string | null; criado_em: string }
type Documento = { id: string; numero: string | null; tipo_documento: string; created_at: string; emitido_em: string | null; estado: string; sem_conexao: boolean; versao: number }
const NOME_DOC: Record<string, string> = {
  atestado: 'Atestado', receita: 'Receita', encaminhamento: 'Encaminhamento', pedido_exames: 'Pedido de exames',
  boletim_emergencia: 'Boletim de emergência', laudo_aih: 'Laudo de AIH', sumario_alta: 'Sumário de alta',
}
const EMITIR = [
  { slug: 'receituario-medico', rotulo: 'Receita' },
  { slug: 'atestado-medico', rotulo: 'Atestado' },
  { slug: 'encaminhamento', rotulo: 'Encaminhamento' },
  { slug: 'pedido-exames', rotulo: 'Pedido de exames' },
]
type Vital = { aferido_em: string; valor_num: number | null; conceito: { nome: string; unidade_padrao: string | null } | null }

function Atendimento({ ep, onFim }: { ep: EpFila; onFim: () => void }) {
  const queryClient = useQueryClient()
  // abrir o atendimento = marcar médico e hora + abrir o prontuário (servidor)
  const abrir = useQuery({
    queryKey: ['iniciar-atendimento', ep.id],
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const { error } = await supabase.rpc('iniciar_atendimento', { p_episodio: ep.id })
      if (error) throw error
      return true
    },
  })
  const aberto = abrir.isSuccess

  const dados = useQuery({
    queryKey: ['atendimento', ep.id],
    enabled: aberto,
    queryFn: async () => {
      const [c, s, v, d] = await Promise.all([
        supabase.from('classificacoes_risco').select('id, cor, fluxograma_nome, discriminador, discriminador_cor, reclassificacao, motivo, justificativa, criado_em, autor_papel').eq('episodio_id', ep.id).order('criado_em'),
        supabase.from('atendimento_registros').select('id, subjetivo, objetivo, avaliacao, cid, plano, criado_em').eq('episodio_id', ep.id).order('criado_em'),
        supabase.from('observacao').select('aferido_em, valor_num, conceito:conceito(nome, unidade_padrao)').eq('episodio_id', ep.id).order('aferido_em', { ascending: false }),
        supabase.from('documentos_clinicos').select('id, numero, tipo_documento, created_at, emitido_em, estado, sem_conexao, versao').eq('episodio_id', ep.id).order('created_at'),
      ])
      for (const r of [c, s, v, d]) if (r.error) throw r.error
      return {
        classificacoes: (c.data ?? []) as unknown as Classificacao[],
        soaps: (s.data ?? []) as unknown as Soap[],
        vitais: (v.data ?? []) as unknown as Vital[],
        documentos: (d.data ?? []) as unknown as Documento[],
      }
    },
  })
  const recarregar = () => {
    void queryClient.invalidateQueries({ queryKey: ['atendimento', ep.id] })
    void queryClient.invalidateQueries({ queryKey: ['fila-medica'] })
  }

  // SOAP
  const [soap, setSoap] = React.useState({ s: '', o: '', a: '', cid: '', p: '' })
  const salvarSoap = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('registrar_soap', {
        p_episodio: ep.id, p_subjetivo: soap.s, p_objetivo: soap.o, p_avaliacao: soap.a, p_plano: soap.p, p_cid: soap.cid || undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setSoap({ s: '', o: '', a: '', cid: '', p: '' })
      recarregar()
    },
  })

  // reclassificação (só o médico)
  const [reclass, setReclass] = React.useState(false)
  const [novaCor, setNovaCor] = React.useState<CorRisco | null>(null)
  const [vitais, setVitais] = React.useState<Record<string, string>>({})
  const [motivo, setMotivo] = React.useState('')
  const [justif, setJustif] = React.useState('')
  const baixando = !!novaCor && gravidade(novaCor) > gravidade(ep.cor_atual)
  const salvarReclass = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('classificar_risco', {
        p_episodio: ep.id, p_cor: novaCor!, p_sinais: paraNumeros(vitais), p_motivo: motivo, p_justificativa: justif || undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setReclass(false)
      recarregar()
    },
  })

  // desfecho
  const [desfecho, setDesfecho] = React.useState<Desfecho | null>(null)
  const [relato, setRelato] = React.useState('')
  const [destino, setDestino] = React.useState('')
  const [horaObito, setHoraObito] = React.useState('')
  const [numeroDo, setNumeroDo] = React.useState('')
  const [setorInternacao, setSetorInternacao] = React.useState('')
  const [leitoInternacao, setLeitoInternacao] = React.useState('')
  const { unidadeAtiva: unidadeDoDesfecho } = useUnidade()
  const destinosInternacao = useQuery({
    queryKey: ['destinos-internacao', unidadeDoDesfecho?.unidade_id],
    enabled: desfecho === 'internacao' && !!unidadeDoDesfecho,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('setores')
        .select('id, nome, leitos(id, identificador, status, ativo)')
        .eq('unidade_id', unidadeDoDesfecho!.unidade_id)
        .eq('ativo', true)
        .in('tipo', ['internacao', 'uti', 'isolamento'])
        .order('ordem')
      if (error) throw error
      return data ?? []
    },
  })
  const leitosLivres = (destinosInternacao.data ?? [])
    .find((x) => x.id === setorInternacao)?.leitos.filter((l) => l.ativo && l.status === 'livre') ?? []
  const salvarDesfecho = useMutation({
    mutationFn: async () => {
      const detalhes: Record<string, string> = {}
      if (desfecho === 'transferencia') detalhes.destino = destino
      if (desfecho === 'obito') {
        detalhes.hora_obito = horaObito ? new Date(horaObito).toISOString() : ''
        detalhes.numero_do = numeroDo
      }
      if (desfecho === 'internacao') {
        detalhes.setor_id = setorInternacao
        if (leitoInternacao) detalhes.leito_id = leitoInternacao
      }
      const { error } = await supabase.rpc('registrar_desfecho', {
        p_episodio: ep.id, p_desfecho: desfecho!, p_relato: relato || undefined, p_detalhes: detalhes,
      })
      if (error) throw error
    },
    onSuccess: () => {
      recarregar()
      onFim()
    },
  })

  const ultimaCls = dados.data?.classificacoes.at(-1)
  const vitaisRecentes = new Map<string, Vital>()
  for (const v of dados.data?.vitais ?? []) if (v.conceito && !vitaisRecentes.has(v.conceito.nome)) vitaisRecentes.set(v.conceito.nome, v)

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" className="self-start" onClick={onFim}><ArrowLeft /> Voltar à fila</Button>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <PilulaRisco cor={ultimaCls?.cor ?? ep.cor_atual} detalhe />
            <CardTitle className="text-base">{nomeDe(ep)}</CardTitle>
          </div>
          <CardDescription>
            {ep.paciente?.data_nascimento ? rotuloIdade(ep.paciente.data_nascimento, hoje()) : 'idade não informada'}
            {ep.publico === 'pediatrico' && ' · pediatria'} · chegou {hora(ep.chegada_em)} · queixa: {ep.queixa}
          </CardDescription>
          {ep.prioridades_legais.length > 0 && (
            <div className="flex flex-wrap gap-1">{rotulosPrioridade(ep.prioridades_legais).map((r) => <Badge key={r} variant="outline">{r}</Badge>)}</div>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {abrir.isPending && <Spinner />}
          {abrir.error && <p className="text-sm text-destructive">{(abrir.error as Error).message}</p>}
          {dados.data && (
            <>
              <section className="flex flex-col gap-1 text-sm">
                <h3 className="font-semibold text-tinta">Triagem</h3>
                {dados.data.classificacoes.map((c) => (
                  <div key={c.id} className="text-tinta-apoio">
                    <PilulaRisco cor={c.cor} className="mr-2" />
                    {c.reclassificacao ? `Reclassificado pelo médico: ${c.motivo}` : `${c.fluxograma_nome} · ${c.discriminador}`}
                    {c.justificativa && ` · justificativa: ${c.justificativa}`}
                    <span className="text-xs text-muted-foreground"> · {hora(c.criado_em)}</span>
                  </div>
                ))}
                {vitaisRecentes.size > 0 && (
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-tinta-apoio">
                    {[...vitaisRecentes.values()].map((v) => (
                      <span key={v.conceito!.nome}>
                        {v.conceito!.nome.replace(/-/g, ' ')}: <strong className="tabular-nums">{v.valor_num}</strong> {v.conceito!.unidade_padrao ?? ''}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {dados.data.soaps.length > 0 && (
                <section className="flex flex-col gap-2 text-sm">
                  <h3 className="font-semibold text-tinta">Registros do atendimento</h3>
                  {dados.data.soaps.map((s) => (
                    <div key={s.id} className="rounded-controle border border-fio p-2 text-tinta-apoio">
                      <div className="text-xs text-muted-foreground">{hora(s.criado_em)}{s.cid && ` · CID ${s.cid}`}</div>
                      {s.subjetivo && <p><strong>S</strong> {s.subjetivo}</p>}
                      {s.objetivo && <p><strong>O</strong> {s.objetivo}</p>}
                      {s.avaliacao && <p><strong>A</strong> {s.avaliacao}</p>}
                      {s.plano && <p><strong>P</strong> {s.plano}</p>}
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {aberto && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base"><FileText className="mr-1 inline size-4" />SOAP</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {([['s', 'Subjetivo'], ['o', 'Objetivo'], ['a', 'Avaliação'], ['p', 'Plano']] as const).map(([k, r]) => (
                <div key={k} className="flex flex-col gap-1">
                  <Label htmlFor={`soap-${k}`}>{r}</Label>
                  <Textarea id={`soap-${k}`} rows={2} value={soap[k]} onChange={(e) => setSoap((x) => ({ ...x, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="flex flex-col gap-1 sm:max-w-40">
                <Label htmlFor="soap-cid">CID-10</Label>
                <Input id="soap-cid" placeholder="Ex.: J45.9" value={soap.cid} onChange={(e) => setSoap((x) => ({ ...x, cid: e.target.value.toUpperCase() }))} />
              </div>
              {salvarSoap.error && <p className="text-sm text-destructive">{(salvarSoap.error as Error).message}</p>}
              <Button className="justify-self-end" disabled={salvarSoap.isPending || !Object.entries(soap).some(([k, v]) => k !== 'cid' && v.trim())} onClick={() => salvarSoap.mutate()}>
                <ClipboardCheck /> Registrar
              </Button>
            </CardContent>
          </Card>

          {ep.publico === 'pediatrico' && (
            <Card>
              <CardContent className="pt-4">
                <SepsePorta pacienteId={ep.paciente_id} />
              </CardContent>
            </Card>
          )}

          {/* Prescrição da porta (Fase 4.4): a mesma da internação; a checagem da
              enfermagem alimenta a "alta após medicação" (Fase 4.6) */}
          <Card>
            <CardHeader><CardTitle className="text-base">Exames e agravos</CardTitle></CardHeader>
            <CardContent><ExamesEAgravos pacienteId={ep.paciente_id} medico /></CardContent>
          </Card>

          <PrescricaoEstruturada pacienteId={ep.paciente_id}
            paciente={{ nome: nomeDe(ep), dataAtual: hoje(), diagnostico: ep.queixa }} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base"><FileText className="mr-1 inline size-4" />Documentos do episódio</CardTitle>
              <CardDescription>Cada emissão é gravada no episódio com número próprio antes de ir para o papel. Sem conexão, sai a folha provisória.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {(dados.data?.documentos ?? []).length === 0 && <p className="text-muted-foreground">Nenhum documento emitido neste episódio.</p>}
              {(dados.data?.documentos ?? []).map((d) => (
                <div key={d.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-fio pb-1 last:border-0">
                  <span className="text-tinta">
                    {NOME_DOC[d.tipo_documento] ?? d.tipo_documento}
                    {d.versao > 1 && ` (versão ${d.versao})`}
                    {d.estado === 'retificado' && <span className="text-muted-foreground"> · retificado</span>}
                    {d.sem_conexao && <Badge variant="outline" className="ml-2">sem conexão</Badge>}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">nº {d.numero ?? '—'} · {hora(d.emitido_em ?? d.created_at)}</span>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {EMITIR.map((x) => (
                  <Button key={x.slug} size="sm" variant="outline" render={<Link to={`/plantao/atendimento-porta/${x.slug}?paciente=${ep.paciente_id}`} />}>
                    {x.rotulo}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reclassificar</CardTitle>
              <CardDescription>Só o médico reclassifica: motivo, sinais vitais novos e, para baixar a prioridade, justificativa.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!reclass ? (
                <Button variant="outline" className="self-start" onClick={() => setReclass(true)}>Reclassificar</Button>
              ) : (
                <>
                  <CamposVitais publico={ep.publico} valores={vitais} onChange={(k, v) => setVitais((s) => ({ ...s, [k]: v }))} prefixo="rv" />
                  <div className="flex flex-wrap gap-2">
                    {CORES_RISCO.map((c) => (
                      <Button key={c} size="sm" variant={novaCor === c ? 'default' : 'outline'} onClick={() => setNovaCor(c)} className="capitalize">
                        {c} · {NIVEL_RISCO[c]}
                      </Button>
                    ))}
                  </div>
                  <Input aria-label="Motivo" placeholder="Motivo (mínimo de 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  {baixando && <Input aria-label="Justificativa" placeholder="Justificativa para baixar a prioridade (mínimo de 20 letras)" value={justif} onChange={(e) => setJustif(e.target.value)} />}
                  {salvarReclass.error && <p className="text-sm text-destructive">{(salvarReclass.error as Error).message}</p>}
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setReclass(false)}>Cancelar</Button>
                    <Button
                      disabled={!novaCor || motivo.trim().length < 10 || (baixando && justif.trim().length < 20) || faltandoVitais(vitais, ep.publico).length > 0 || salvarReclass.isPending}
                      onClick={() => salvarReclass.mutate()}
                    >
                      Registrar reclassificação
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base"><DoorOpen className="mr-1 inline size-4" />Desfecho</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {DESFECHOS.map((d) => (
                  <Button key={d.valor} size="sm" variant={desfecho === d.valor ? 'default' : 'outline'} onClick={() => setDesfecho(d.valor)}>{d.rotulo}</Button>
                ))}
              </div>
              {desfecho === 'transferencia' && <Input aria-label="Destino" placeholder="Destino da transferência" value={destino} onChange={(e) => setDestino(e.target.value)} />}
              {desfecho === 'obito' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1"><Label htmlFor="d-hora">Hora do óbito</Label><Input id="d-hora" type="datetime-local" value={horaObito} onChange={(e) => setHoraObito(e.target.value)} /></div>
                  <div className="flex flex-col gap-1"><Label htmlFor="d-do">Nº da Declaração de Óbito</Label><Input id="d-do" value={numeroDo} onChange={(e) => setNumeroDo(e.target.value)} /></div>
                </div>
              )}
              {desfecho && PEDE_RELATO.includes(desfecho) && (
                <Textarea aria-label="Relato" rows={2} placeholder="Descreva o ocorrido (mínimo de 15 letras)" value={relato} onChange={(e) => setRelato(e.target.value)} />
              )}
              {desfecho === 'observacao' && (
                <p className="text-xs text-muted-foreground">O paciente vai para o primeiro box livre da Observação, com prazo de 6 horas para a conduta (alta ou internação). Sem box livre, fica na Observação aguardando box.</p>
              )}
              {desfecho === 'internacao' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="int-setor">Setor de internação</Label>
                    <select id="int-setor" className="h-8 rounded-controle border border-fio bg-background px-2 text-sm" value={setorInternacao}
                      onChange={(e) => { setSetorInternacao(e.target.value); setLeitoInternacao('') }}>
                      <option value="">Escolha…</option>
                      {(destinosInternacao.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="int-leito">Leito (opcional)</Label>
                    <select id="int-leito" className="h-8 rounded-controle border border-fio bg-background px-2 text-sm" value={leitoInternacao}
                      onChange={(e) => setLeitoInternacao(e.target.value)} disabled={!setorInternacao}>
                      <option value="">Definir depois</option>
                      {leitosLivres.map((l) => <option key={l.id} value={l.id}>{l.identificador}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {salvarDesfecho.error && <p className="text-sm text-destructive">{(salvarDesfecho.error as Error).message}</p>}
              <Button className="self-end" disabled={!desfecho || (desfecho === 'internacao' && !setorInternacao) || salvarDesfecho.isPending} onClick={() => salvarDesfecho.mutate()}>Registrar desfecho</Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export default function AtendimentoPorta() {
  const { unidadeAtiva } = useUnidade()
  const [atual, setAtual] = React.useState<EpFila | null>(null)
  // relógio da tela: a espera anda sozinha, sem recarregar a fila
  const [agora, setAgora] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  const fila = useQuery({
    queryKey: ['fila-medica', unidadeAtiva?.unidade_id],
    enabled: !!unidadeAtiva,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data: ids, error: e1 } = await supabase.rpc('setores_na_escala_agora')
      if (e1) throw e1
      const setores = (Array.isArray(ids) ? ids : []) as string[]
      if (setores.length === 0) return []
      const { data, error } = await supabase
        .from('episodios')
        .select('id, paciente_id, setor_id, cor_atual, classificado_em, chegada_em, queixa, publico, prioridades_legais, atendimento_iniciado_em, paciente:pacientes(nome, nome_social, data_nascimento)')
        .in('setor_id', setores)
        .eq('etapa', 'atendimento')
      if (error) throw error
      return ((data ?? []) as unknown as EpFila[]).sort(ordemMedica)
    },
  })
  const setoresDaFila = [...new Set((fila.data ?? []).map((e) => e.setor_id))]
  const chamadas = useChamadasPorEpisodio(setoresDaFila, 'atendimento')

  if (atual) return <Atendimento ep={atual} onFim={() => setAtual(null)} />

  return (
    <>
      <TituloPagina icone={Stethoscope} titulo="Atendimento" descricao="Fila médica da porta: a cor manda; 80+ e prioridade legal só desempatam dentro da mesma cor." />
      <Card>
        <CardContent className="flex flex-col gap-2 pt-4">
          {fila.isLoading && <Spinner />}
          {fila.error && <p className="text-sm text-destructive">{(fila.error as Error).message}</p>}
          {fila.data?.length === 0 && <Vazio icone={Stethoscope} titulo="Ninguém aguardando atendimento" />}
          {fila.data?.map((e, i) => (
            <div key={e.id} className="flex flex-col gap-2 rounded-controle border border-fio p-3">
              <div className="flex items-start gap-3">
                <span className="w-5 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{i + 1}</span>
                <PilulaRisco cor={e.cor_atual} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-tinta">{nomeDe(e)}{e.atendimento_iniciado_em && <Badge variant="outline" className="ml-2">em atendimento</Badge>}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.paciente?.data_nascimento ? rotuloIdade(e.paciente.data_nascimento, hoje()) : 'idade não informada'} · {e.queixa}
                  </div>
                  {!e.atendimento_iniciado_em && <Espera desde={e.classificado_em} cor={e.cor_atual} agora={agora} />}
                  {e.prioridades_legais.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">{rotulosPrioridade(e.prioridades_legais).map((r) => <Badge key={r} variant="outline">{r}</Badge>)}</div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pl-8">
                <BotaoChamar episodioId={e.id} setorId={e.setor_id} etapa="atendimento" chamadas={chamadas.data?.get(e.id) ?? 0} />
                <Button size="sm" onClick={() => setAtual(e)}>{e.atendimento_iniciado_em ? 'Continuar atendimento' : 'Abrir atendimento'}</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  )
}
