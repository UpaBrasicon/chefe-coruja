import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, MonitorSmartphone, Send } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { TituloPagina } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'

// Teleinterconsulta (fase 7, migration 20261001000003). O médico presencial
// solicita com a pergunta e o consentimento; o médico de telemedicina de
// plantão aceita, lê o prontuário e responde. Solicitação e parecer viram
// documentos numerados no prontuário. A conduta é de quem está com o paciente
// (Res. CFM 2.314/2022, art. 7º).

type Tele = {
  id: string
  paciente_id: string
  paciente_nome: string
  paciente_nascimento: string | null
  setor_nome: string | null
  solicitante_nome: string
  consultor_nome: string | null
  pergunta: string
  urgencia: 'rotina' | 'urgente'
  consentimento: string
  status: 'aberta' | 'em_atendimento' | 'respondida' | 'cancelada'
  criada_em: string
  aceita_em: string | null
  resposta: string | null
  respondida_em: string | null
  documento_solicitacao_numero: string | null
  documento_resposta_numero: string | null
  minha: boolean
}

const STATUS: Record<Tele['status'], { rotulo: string; variante: 'warning' | 'info' | 'success' | 'secondary' }> = {
  aberta: { rotulo: 'Aguardando teleconsultor', variante: 'warning' },
  em_atendimento: { rotulo: 'Em atendimento', variante: 'info' },
  respondida: { rotulo: 'Respondida', variante: 'success' },
  cancelada: { rotulo: 'Cancelada', variante: 'secondary' },
}
const CONSENTIMENTO = [
  { valor: 'obtido', rotulo: 'Paciente consentiu' },
  { valor: 'representante_legal', rotulo: 'Representante legal consentiu' },
  { valor: 'emergencia_sem_condicao', rotulo: 'Emergência médica (dispensa, art. 15)' },
]

function useTeles(unidadeId?: string) {
  return useQuery({
    queryKey: ['teleinterconsultas', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('teleinterconsultas_da_unidade', { p_unidade: unidadeId!, p_dias: 7 })
      if (error) throw error
      return (data ?? []) as Tele[]
    },
  })
}

function Cartao({ t, children }: { t: Tele; children?: React.ReactNode }) {
  return (
    <li className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{t.paciente_nome}</span>
        {t.paciente_nascimento && <span className="text-tinta-sussurro">nasc. {fmtData(t.paciente_nascimento)}</span>}
        {t.setor_nome && <span className="text-tinta-sussurro">· {t.setor_nome}</span>}
        <Badge variant={STATUS[t.status].variante}>{STATUS[t.status].rotulo}</Badge>
        {t.urgencia === 'urgente' && <Badge variant="destructive">urgente</Badge>}
      </div>
      <div className="mt-0.5 text-xs text-tinta-sussurro">
        Solicitada por {t.solicitante_nome} em {fmtDataHora(t.criada_em)}
        {t.documento_solicitacao_numero ? ` · documento nº ${t.documento_solicitacao_numero}` : ''}
        {t.consultor_nome ? ` · teleconsultor ${t.consultor_nome}` : ''}
      </div>
      <p className="mt-2 rounded bg-trilha/60 p-2 text-sm"><span className="font-medium">Pergunta: </span>{t.pergunta}</p>
      {t.resposta && (
        <div className="mt-2 rounded border border-conforme/30 bg-conforme/[0.05] p-2 text-sm">
          <div className="text-xs text-tinta-sussurro">
            Parecer em {t.respondida_em ? fmtDataHora(t.respondida_em) : ''}{t.documento_resposta_numero ? ` · documento nº ${t.documento_resposta_numero}` : ''}
          </div>
          <p className="mt-1 whitespace-pre-wrap">{t.resposta}</p>
          <p className="mt-1 text-xs text-tinta-sussurro">A conduta é do médico assistente presencial.</p>
        </div>
      )}
      {children}
    </li>
  )
}

// ── lado do médico presencial ───────────────────────────────────────────────
function Solicitante({ unidadeId }: { unidadeId: string }) {
  const qc = useQueryClient()
  const teles = useTeles(unidadeId)
  const [paciente, setPaciente] = React.useState('')
  const [pergunta, setPergunta] = React.useState('')
  const [consentimento, setConsentimento] = React.useState('')
  const [urgente, setUrgente] = React.useState(false)

  // pacientes que o banco deixa ver: os dos setores do plantão em curso
  const pacientes = useQuery({
    queryKey: ['pacientes-do-plantao', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('id, nome, data_nascimento, setor_id').eq('unidade_id', unidadeId)
        .eq('ativo', true).not('setor_id', 'is', null).order('nome')
      if (error) throw error
      return data ?? []
    },
  })

  const solicitar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('solicitar_teleinterconsulta', {
        p_paciente: paciente, p_pergunta: pergunta.trim(), p_consentimento: consentimento, p_urgencia: urgente ? 'urgente' : 'rotina',
      })
      if (error) throw error
    },
    onSuccess: () => {
      setPergunta(''); setConsentimento(''); setUrgente(false); setPaciente('')
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

  const pode = paciente && pergunta.trim().length >= 10 && consentimento
  const minhas = (teles.data ?? []).filter((t) => t.minha)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova teleinterconsulta</CardTitle>
          <CardDescription>Só aparecem os pacientes dos setores do seu plantão. A solicitação entra no prontuário como documento numerado.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pac">Paciente</Label>
            <select id="pac" className="h-9 rounded-controle border border-fio bg-campo px-2 text-corpo" value={paciente} onChange={(e) => setPaciente(e.target.value)}>
              <option value="">{pacientes.isLoading ? 'Carregando…' : 'Escolha o paciente'}</option>
              {(pacientes.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nome}{p.data_nascimento ? ` · nasc. ${fmtData(p.data_nascimento)}` : ''}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="perg">Pergunta ao teleconsultor</Label>
            <Textarea id="perg" rows={3} value={pergunta} onChange={(e) => setPergunta(e.target.value)} placeholder="O que você precisa decidir, com o contexto que o teleconsultor não vê." />
          </div>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-sm font-medium">Consentimento (Res. CFM 2.314/2022, art. 15)</legend>
            <div className="flex flex-wrap gap-2">
              {CONSENTIMENTO.map((c) => (
                <Button key={c.valor} type="button" size="sm" variant={consentimento === c.valor ? 'default' : 'outline'} onClick={() => setConsentimento(c.valor)}>{c.rotulo}</Button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} /> Urgente
          </label>
          <div className="flex items-center gap-2">
            <Button onClick={() => solicitar.mutate()} disabled={!pode || solicitar.isPending}><Send className="size-4" />Solicitar</Button>
            {solicitar.error && <span className="text-sm text-critico">{(solicitar.error as Error).message}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Minhas teleinterconsultas (7 dias)</CardTitle></CardHeader>
        <CardContent>
          {teles.isLoading && <Spinner />}
          {teles.error && <p className="text-sm text-critico">{(teles.error as Error).message}</p>}
          {!teles.isLoading && minhas.length === 0 && <p className="text-sm text-tinta-sussurro">Nenhuma.</p>}
          <ul className="flex flex-col gap-3">
            {minhas.map((t) => (
              <Cartao key={t.id} t={t}>
                {t.status === 'aberta' && (
                  <Button className="mt-2" size="sm" variant="ghost" onClick={() => cancelar.mutate(t.id)} disabled={cancelar.isPending}>Cancelar</Button>
                )}
              </Cartao>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

// ── lado do teleconsultor ───────────────────────────────────────────────────
function PlantaoRemoto({ unidadeId }: { unidadeId: string }) {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const presenca = useQuery({
    queryKey: ['presenca-remota', unidadeId, perfil?.id],
    enabled: !!perfil,
    queryFn: async () => {
      const { data, error } = await supabase.from('presenca_plantonista').select('id, checkin_em, checkout_em')
        .eq('unidade_id', unidadeId).eq('perfil_id', perfil!.id).not('checkin_em', 'is', null).is('checkout_em', null)
        .order('checkin_em', { ascending: false }).limit(1)
      if (error) throw error
      return data?.[0] ?? null
    },
  })
  const entrar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('registrar_checkin', { p_unidade: unidadeId })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['presenca-remota'] }),
  })
  const sair = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('registrar_checkout', { p_registro: id })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['presenca-remota'] }),
  })
  const p = presenca.data
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
      {p ? (
        <>
          <span>Plantão remoto iniciado às {new Date(p.checkin_em!).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', timeStyle: 'short' })}.</span>
          <Button size="sm" variant="outline" onClick={() => sair.mutate(p.id)} disabled={sair.isPending}>Encerrar plantão remoto</Button>
        </>
      ) : (
        <>
          <span>Registre o início do plantão remoto (check-in sem localização: telemedicina).</span>
          <Button size="sm" onClick={() => entrar.mutate()} disabled={entrar.isPending}>Iniciar plantão remoto</Button>
        </>
      )}
      {(entrar.error || sair.error) && <span className="text-critico">{((entrar.error ?? sair.error) as Error).message}</span>}
    </div>
  )
}

function Consultor({ unidadeId }: { unidadeId: string }) {
  const qc = useQueryClient()
  const teles = useTeles(unidadeId)
  const [respostas, setRespostas] = React.useState<Record<string, string>>({})
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['teleinterconsultas'] })

  const aceitar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('aceitar_teleinterconsulta', { p_id: id })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
  const responder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('responder_teleinterconsulta', { p_id: id, p_resposta: (respostas[id] ?? '').trim() })
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  const lista = teles.data ?? []
  const abertas = lista.filter((t) => t.status === 'aberta')
  const minhas = lista.filter((t) => t.minha && t.status === 'em_atendimento')
  const feitas = lista.filter((t) => t.minha && t.status === 'respondida')

  return (
    <div className="flex flex-col gap-4">
      <PlantaoRemoto unidadeId={unidadeId} />
      {teles.error && <p className="text-sm text-critico">{(teles.error as Error).message}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Em atendimento por você ({minhas.length})</CardTitle>
          <CardDescription>Você lê o prontuário deste paciente até 24 h depois de responder. O parecer entra no prontuário como documento numerado seu.</CardDescription>
        </CardHeader>
        <CardContent>
          {minhas.length === 0 && <p className="text-sm text-tinta-sussurro">Nenhuma.</p>}
          <ul className="flex flex-col gap-3">
            {minhas.map((t) => (
              <Cartao key={t.id} t={t}>
                <div className="mt-2 grid gap-2">
                  <Button size="sm" variant="outline" className="w-fit" render={<Link to={`/prontuarios/${t.paciente_id}`} />}><BookOpen className="size-4" />Ler prontuário</Button>
                  <Textarea rows={4} placeholder="Parecer: hipóteses, o que sugere e em que condição reavaliar." value={respostas[t.id] ?? ''}
                    onChange={(e) => setRespostas((r) => ({ ...r, [t.id]: e.target.value }))} />
                  <Button size="sm" className="w-fit" onClick={() => responder.mutate(t.id)} disabled={responder.isPending || (respostas[t.id]?.trim().length ?? 0) < 20}>
                    <Send className="size-4" />Enviar parecer
                  </Button>
                </div>
              </Cartao>
            ))}
          </ul>
          {responder.error && <p className="mt-2 text-sm text-critico">{(responder.error as Error).message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fila da unidade ({abertas.length})</CardTitle>
          <CardDescription>Aparece enquanto você está de plantão nesta unidade. Aceitar abre a leitura do prontuário do paciente.</CardDescription>
        </CardHeader>
        <CardContent>
          {teles.isLoading && <Spinner />}
          {!teles.isLoading && abertas.length === 0 && <p className="text-sm text-tinta-sussurro">Nenhuma teleinterconsulta aguardando.</p>}
          <ul className="flex flex-col gap-3">
            {abertas.map((t) => (
              <Cartao key={t.id} t={t}>
                <Button className="mt-2" size="sm" onClick={() => aceitar.mutate(t.id)} disabled={aceitar.isPending}>Aceitar</Button>
              </Cartao>
            ))}
          </ul>
          {aceitar.error && <p className="mt-2 text-sm text-critico">{(aceitar.error as Error).message}</p>}
        </CardContent>
      </Card>

      {feitas.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Respondidas por você (7 dias)</CardTitle></CardHeader>
          <CardContent><ul className="flex flex-col gap-3">{feitas.map((t) => <Cartao key={t.id} t={t} />)}</ul></CardContent>
        </Card>
      )}
    </div>
  )
}

export default function Teleinterconsulta() {
  const { unidadeAtiva, papeisDaUnidade } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const consultor = papeisDaUnidade.includes('telemedicina') && !papeisDaUnidade.includes('plantonista')
  if (!unidadeId) return <Spinner />
  return (
    <div className="flex w-full max-w-4xl flex-col gap-4">
      <TituloPagina
        icone={MonitorSmartphone}
        titulo="Teleinterconsulta"
        descricao={consultor
          ? 'Apoio ao médico presencial. A conduta é de quem está com o paciente (Res. CFM 2.314/2022, art. 7º).'
          : 'Peça apoio ao médico de telemedicina de plantão. A conduta continua sendo sua.'}
      />
      {consultor ? <Consultor unidadeId={unidadeId} /> : <Solicitante unidadeId={unidadeId} />}
    </div>
  )
}
