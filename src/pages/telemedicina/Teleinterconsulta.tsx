import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MonitorSmartphone, Send } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { Chip, TituloPagina } from '@/components/monitor/Pagina'
import { BuscaPaciente, usePacientesDoPlantao } from '@/components/paciente/BuscaPacienteDoPlantao'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import { faltasDoConsentimento, TEXTO_TCLE_TELEMEDICINA, type FormaConsentimento } from '@/lib/tcleTelemedicina'
import { cn } from '@/lib/utils'

import Chamados from './Chamados'
import { COR_SITUACAO, ha, hhmm, PontoSituacao, ROTULO_SITUACAO, Secao, STATUS, useTeles, VazioLinha, type Situacao, type Tele } from './comum'

// Teleinterconsulta (fase 7, migration 20261001000003). O médico presencial
// solicita com a pergunta e o consentimento; o médico de telemedicina de
// plantão aceita, lê o prontuário e responde. Solicitação e parecer viram
// documentos numerados no prontuário. A conduta é de quem está com o paciente
// (Res. CFM 2.314/2022, art. 7º). Para a telemedicina esta é a "Minha fila"
// (P/index.html 5919); as outras telas dela estão em Telemedicina.tsx.

const CONSENTIMENTO = [
  { valor: 'obtido', rotulo: 'Paciente consentiu' },
  { valor: 'representante_legal', rotulo: 'Representante legal consentiu' },
  { valor: 'emergencia_sem_condicao', rotulo: 'Emergência médica (dispensa, art. 15)' },
]

// ── lado do médico presencial ───────────────────────────────────────────────
// Revisão do perfil Médico (RT 24/11/2026): faixa de disponibilidade sempre
// visível (M1), pedidos à esquerda e o pedido aberto à direita com a etapa
// (M2), paciente por busca, o que falta escrito embaixo do botão e urgência
// como escolha ao lado de Solicitar (M3).

/** O banco responde "Acesso negado." a quem não está no plantão (sem check-in). */
const semPlantao = (e: unknown) => !!e && /^Acesso negado/.test((e as Error).message ?? '')

function AvisoCheckin() {
  return (
    <span className="text-apoio text-tinta">
      Faça o check-in do plantão para pedir teleinterconsulta.{' '}
      <Link to="/plantao/check-in" className="font-medium text-acao underline-offset-2 hover:underline">Fazer check-in</Link>
    </span>
  )
}

function TelemedicinaDePlantao({ unidadeId, semCheckin }: { unidadeId: string; semCheckin: boolean }) {
  const q = useQuery({
    queryKey: ['telemedicina-na-unidade', unidadeId],
    refetchInterval: 30_000,
    retry: (n, e) => !semPlantao(e) && n < 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('telemedicina_na_unidade', { p_unidade: unidadeId })
      if (error) throw error
      return data ?? []
    },
  })
  const caixa = 'flex flex-wrap items-center gap-2 rounded-cartao border border-fio bg-superficie px-5 py-3 shadow-repouso'
  if (semCheckin || semPlantao(q.error)) return <div className={caixa} role="status"><AvisoCheckin /></div>
  if (q.error) {
    return (
      <div className={caixa} role="status">
        <span className="text-apoio text-tinta-apoio">Não foi possível ver quem está de plantão na telemedicina agora.</span>
        <Button size="sm" variant="outline" onClick={() => void q.refetch()}>Tentar de novo</Button>
      </div>
    )
  }
  if (!q.data) return <div className={caixa}><span className="text-apoio text-tinta-sussurro">Vendo quem está de plantão na telemedicina…</span></div>
  if (q.data.length === 0) {
    return (
      <div className={caixa} role="status">
        <span className="text-apoio font-semibold text-tinta">Ninguém de plantão agora.</span>
        <span className="text-apoio text-tinta-sussurro">O pedido fica na fila até um teleconsultor entrar.</span>
      </div>
    )
  }
  return (
    <div className={caixa} role="status">
      <span className="text-apoio font-semibold text-tinta">Teleconsultor de plantão:</span>
      {q.data.map((t) => (
        <span key={t.nome} className={cn('inline-flex items-center gap-[7px] rounded-capsula border py-1 pr-[11px] pl-[9px] text-apoio', COR_SITUACAO[t.situacao as Situacao['estado']] ?? '')}>
          <PontoSituacao estado={t.situacao as Situacao['estado']} />
          {t.nome}{t.crm ? ` · CRM ${t.crm}` : ''} · até {hhmm(t.ate)} · {ROTULO_SITUACAO[t.situacao as Situacao['estado']] ?? t.situacao}
        </span>
      ))}
    </div>
  )
}

const ETAPAS: [Tele['status'], string][] = [['aberta', 'Aberto'], ['em_atendimento', 'Aceito'], ['respondida', 'Respondido']]

/** aberto → aceito → respondido, com a hora de cada passo já dado. */
function EtapasPedido({ t }: { t: Tele }) {
  if (t.status === 'cancelada') return <p className="text-apoio text-tinta-sussurro">Cancelado antes do aceite.</p>
  const atual = ETAPAS.findIndex(([k]) => k === t.status)
  const quando = [t.criada_em, t.aceita_em, t.respondida_em]
  return (
    <ol aria-label="Etapa do pedido" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-apoio">
      {ETAPAS.map(([k, r], i) => (
        <li key={k} className="flex items-center gap-2" aria-current={i === atual ? 'step' : undefined}>
          {i > 0 && <span aria-hidden className="text-tinta-sussurro">→</span>}
          <span aria-hidden className={cn('size-2 rounded-capsula', i <= atual ? 'bg-acao' : 'border border-fio-forte bg-superficie')} />
          <span className={i <= atual ? 'font-medium text-tinta' : 'text-tinta-sussurro'}>
            {r}{i <= atual && quando[i] ? ` · ${hhmm(quando[i])}` : ''}
          </span>
        </li>
      ))}
    </ol>
  )
}

function PedidoAberto({ t, cancelar, cancelando }: { t: Tele; cancelar: () => void; cancelando: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-cartao border border-fio bg-superficie px-5 py-4 shadow-repouso">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-corpo font-semibold text-tinta">{t.paciente_nome}</span>
        <span className="text-apoio text-tinta-sussurro">
          {[t.paciente_nascimento ? `nasc. ${fmtData(t.paciente_nascimento)}` : '', t.setor_nome ?? ''].filter(Boolean).join(' · ')}
        </span>
        {t.urgencia === 'urgente' && <span className="ml-auto text-apoio font-medium text-critico">Urgente</span>}
      </div>
      <EtapasPedido t={t} />
      <p className="text-rotulo text-tinta-sussurro">
        Pedido em {fmtDataHora(t.criada_em)}
        {t.documento_solicitacao_numero ? ` · documento nº ${t.documento_solicitacao_numero}` : ''}
        {t.consultor_nome ? ` · teleconsultor ${t.consultor_nome}` : ''}
      </p>
      <p className="rounded-controle bg-trilha/60 px-3 py-2 text-apoio text-tinta"><span className="font-medium">Pergunta: </span>{t.pergunta}</p>
      {t.resposta ? (
        <div className="rounded-controle border border-conforme/30 bg-alerta-conforme px-3 py-2 text-apoio">
          <div className="text-rotulo text-tinta-sussurro">
            Parecer em {t.respondida_em ? fmtDataHora(t.respondida_em) : ''}{t.documento_resposta_numero ? ` · documento nº ${t.documento_resposta_numero}` : ''}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-tinta">{t.resposta}</p>
          <p className="mt-1 text-rotulo text-tinta-sussurro">A conduta é do médico assistente presencial.</p>
        </div>
      ) : t.status === 'em_atendimento' ? (
        <p className="text-apoio text-tinta-apoio">O teleconsultor aceitou e está lendo o prontuário. O parecer aparece aqui.</p>
      ) : t.status === 'aberta' ? (
        <p className="text-apoio text-tinta-apoio">Esperando um teleconsultor aceitar ({ha(t.criada_em)}).</p>
      ) : null}
      {t.status === 'aberta' && (
        <div><Button size="sm" variant="outline" onClick={cancelar} disabled={cancelando}>Cancelar pedido</Button></div>
      )}
    </div>
  )
}

function Solicitante({ unidadeId }: { unidadeId: string }) {
  const qc = useQueryClient()
  const teles = useTeles(unidadeId)
  const [paciente, setPaciente] = React.useState<string | null>(null)
  const [pergunta, setPergunta] = React.useState('')
  const [consentimento, setConsentimento] = React.useState('')
  // LG8, M1: termo de telemedicina e a forma de concordância (Res. CFM 2.314/2022, art. 15)
  const [forma, setForma] = React.useState<FormaConsentimento | ''>('')
  const [testemunha, setTestemunha] = React.useState('')
  const [representante, setRepresentante] = React.useState('')
  const [justificativa, setJustificativa] = React.useState('')
  const [urgente, setUrgente] = React.useState(false)
  const [abertoId, setAbertoId] = React.useState<string | null>(null)
  const emergencia = consentimento === 'emergencia_sem_condicao'
  const semCheckin = semPlantao(teles.error)

  // pacientes que o banco deixa ver: os dos setores do plantão em curso
  const pacientes = usePacientesDoPlantao(unidadeId)

  const solicitar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('solicitar_teleinterconsulta_com_termo', {
        p_paciente: paciente!, p_pergunta: pergunta.trim(), p_consentimento: consentimento,
        p_forma: emergencia ? 'emergencia' : forma || 'assinatura_papel',
        p_testemunha: forma === 'verbal_testemunha' ? testemunha.trim() : undefined,
        p_representante: consentimento === 'representante_legal' ? representante.trim() : undefined,
        p_justificativa: emergencia ? justificativa.trim() : undefined,
        p_urgencia: urgente ? 'urgente' : 'rotina',
      })
      if (error) throw error
    },
    onSuccess: () => {
      setPergunta(''); setConsentimento(''); setUrgente(false); setPaciente(null)
      setForma(''); setTestemunha(''); setRepresentante(''); setJustificativa('')
      setAbertoId(null)
      void qc.invalidateQueries({ queryKey: ['teleinterconsultas'] })
    },
  })
  const cancelar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('cancelar_teleinterconsulta', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['teleinterconsultas'] }),
  })

  const faltas = [
    ...(semCheckin ? ['o check-in do plantão'] : []),
    ...(paciente ? [] : ['o paciente']),
    ...(pergunta.trim().length >= 10 ? [] : ['a pergunta (10 caracteres ou mais)']),
    ...faltasDoConsentimento({ consentimento, forma, testemunha, representante, justificativa }),
  ]
  const pode = faltas.length === 0
  const minhas = (teles.data ?? []).filter((t) => t.minha)
  const aberto = minhas.find((t) => t.id === abertoId) ?? minhas[0] ?? null

  return (
    <div className="flex flex-col gap-4">
      <TelemedicinaDePlantao unidadeId={unidadeId} semCheckin={semCheckin} />
      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">Nova teleinterconsulta</CardTitle>
          <CardDescription>A solicitação entra no prontuário como documento numerado.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <BuscaPaciente id="tele-pac" pacientes={pacientes.data ?? []} carregando={pacientes.isLoading}
            escolhido={paciente} onEscolher={setPaciente}
            vazio={semCheckin ? 'Os pacientes aparecem depois do check-in do plantão.' : 'Nenhum paciente nos setores do seu plantão agora.'} />
          <div className="grid gap-1.5">
            <Label htmlFor="perg">Pergunta ao teleconsultor</Label>
            <Textarea id="perg" rows={3} value={pergunta} onChange={(e) => setPergunta(e.target.value)} placeholder="O que você precisa decidir, com o contexto que o teleconsultor não vê." />
          </div>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-apoio font-medium">Consentimento (Res. CFM 2.314/2022, art. 15)</legend>
            <div className="flex flex-wrap gap-2">
              {CONSENTIMENTO.map((c) => (
                <Button key={c.valor} type="button" size="sm" variant={consentimento === c.valor ? 'default' : 'outline'} onClick={() => setConsentimento(c.valor)}>{c.rotulo}</Button>
              ))}
            </div>
          </fieldset>
          {consentimento && !emergencia && (
            <div className="grid gap-2.5 rounded-controle border border-fio bg-campo p-3">
              <p className="text-apoio font-semibold text-tinta">Termo para ler ao {consentimento === 'representante_legal' ? 'representante' : 'paciente'}</p>
              <div className="flex flex-col gap-1.5 text-apoio text-tinta">
                {TEXTO_TCLE_TELEMEDICINA.map((f) => <p key={f}>{f}</p>)}
              </div>
              {consentimento === 'representante_legal' && (
                <div className="grid gap-1.5">
                  <Label htmlFor="rep">Representante legal (nome e vínculo)</Label>
                  <Input id="rep" value={representante} onChange={(e) => setRepresentante(e.target.value)} placeholder="Ex.: Ana Souza, mãe" />
                </div>
              )}
              <fieldset className="grid gap-1.5">
                <legend className="mb-1 text-apoio font-medium">Como concordou</legend>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={forma === 'assinatura_papel' ? 'default' : 'outline'} onClick={() => setForma('assinatura_papel')}>Assinou o termo impresso</Button>
                  <Button type="button" size="sm" variant={forma === 'verbal_testemunha' ? 'default' : 'outline'} onClick={() => setForma('verbal_testemunha')}>Verbal, com testemunha</Button>
                </div>
              </fieldset>
              {forma === 'verbal_testemunha' && (
                <div className="grid gap-1.5">
                  <Label htmlFor="test">Testemunha da equipe (nome)</Label>
                  <Input id="test" value={testemunha} onChange={(e) => setTestemunha(e.target.value)} placeholder="Ex.: Enf. Maria da Silva" />
                </div>
              )}
              <p className="text-rotulo text-tinta-sussurro">O termo entra no prontuário como documento numerado, ligado a esta solicitação.</p>
            </div>
          )}
          {emergencia && (
            <div className="grid gap-1.5">
              <Label htmlFor="just">Por que não houve consentimento</Label>
              <Textarea id="just" rows={2} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Ex.: paciente inconsciente e sem acompanhante na chegada" />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Prioridade" className="flex gap-1.5">
              <Chip radio ativo={!urgente} onClick={() => setUrgente(false)}>Rotina</Chip>
              <Chip radio tom="critico" ativo={urgente} onClick={() => setUrgente(true)}>Urgente</Chip>
            </div>
            <Button onClick={() => solicitar.mutate()} disabled={!pode || solicitar.isPending}><Send className="size-4" />Solicitar</Button>
          </div>
          {faltas.length > 0 && <p className="text-apoio text-tinta-sussurro">Falta: {faltas.join(' · ')}.</p>}
          {solicitar.error && <p role="alert" className="text-apoio text-critico">{(solicitar.error as Error).message}</p>}
        </CardContent>
      </Card>

      <Secao titulo="Meus pedidos" extra="7 dias">
        {semCheckin ? (
          <VazioLinha>Seus pedidos aparecem aqui depois do check-in do plantão.</VazioLinha>
        ) : teles.error ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-apoio text-critico">Não foi possível carregar seus pedidos.</span>
            <Button size="sm" variant="outline" onClick={() => void teles.refetch()}>Tentar de novo</Button>
          </div>
        ) : teles.isLoading ? (
          <Spinner />
        ) : minhas.length === 0 ? (
          <VazioLinha>Nenhum pedido nos últimos 7 dias.</VazioLinha>
        ) : (
          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start">
            <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
              {minhas.map((t) => (
                <li key={t.id}>
                  <BotaoLinha variante="linha" aria-current={aberto?.id === t.id ? 'true' : undefined}
                    className={cn('flex-col gap-0.5', aberto?.id === t.id && 'bg-alerta-marca')} onClick={() => setAbertoId(t.id)}>
                    <span className="flex w-full items-baseline gap-2">
                      <span className="min-w-0 truncate text-controle font-medium text-tinta">{t.paciente_nome}</span>
                      {t.urgencia === 'urgente' && <span className="text-rotulo font-medium text-critico">urgente</span>}
                      <span className="ml-auto shrink-0 text-rotulo text-tinta-sussurro tabular-nums">{fmtDataHora(t.criada_em)}</span>
                    </span>
                    <span className="text-apoio text-tinta-apoio">{STATUS[t.status].rotulo}</span>
                  </BotaoLinha>
                </li>
              ))}
            </ul>
            {aberto && <PedidoAberto key={aberto.id} t={aberto} cancelar={() => cancelar.mutate(aberto.id)} cancelando={cancelar.isPending} />}
          </div>
        )}
        {cancelar.error && <p role="alert" className="text-apoio text-critico">{(cancelar.error as Error).message}</p>}
      </Secao>
    </div>
  )
}

// ── lado do teleconsultor: os Chamados (Chamados.tsx) ───────────────────────
// Revisão do perfil Telemedicina (CH1, RT 24/11/2026): a tela segue o perfil em
// uso ("Trocar perfil"), não a lista de papéis. Antes, quem tinha os dois papéis
// caía sempre no pedido, mesmo no perfil Telemedicina.
export default function Teleinterconsulta() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  if (!unidadeId) return <Spinner />
  if (papelAtivo === 'telemedicina') return <Chamados unidadeId={unidadeId} />
  return (
    <div className="flex w-full max-w-4xl flex-col">
      <TituloPagina icone={MonitorSmartphone} titulo="Telemedicina"
        descricao="Peça uma teleinterconsulta ao médico de telemedicina de plantão. A conduta continua sendo sua." />
      <Solicitante unidadeId={unidadeId} />
    </div>
  )
}
