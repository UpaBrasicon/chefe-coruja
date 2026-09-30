import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Hourglass, Lock, MonitorSmartphone, Send, Video } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { TituloPagina } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtData } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import { Cartao, COR_SITUACAO, hhmm, Nota, PontoSituacao, ROTULO_SITUACAO, Secao, TopoTele, useTeles, VazioLinha, type Situacao } from './comum'

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
function TelemedicinaDePlantao({ unidadeId }: { unidadeId: string }) {
  const q = useQuery({
    queryKey: ['telemedicina-na-unidade', unidadeId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('telemedicina_na_unidade', { p_unidade: unidadeId })
      if (error) throw error
      return data ?? []
    },
  })
  if (!q.data) return null
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-cartao border border-fio bg-superficie px-5 py-3 shadow-repouso">
      <span className="text-apoio font-semibold text-tinta">Telemedicina de plantão agora</span>
      {q.data.length === 0 && <span className="text-apoio text-tinta-sussurro">ninguém escalado neste momento: o pedido fica na fila até alguém entrar.</span>}
      {q.data.map((t) => (
        <span key={t.nome} className={cn('inline-flex items-center gap-[7px] rounded-capsula border py-1 pr-[11px] pl-[9px] text-apoio', COR_SITUACAO[t.situacao as Situacao['estado']] ?? '')}>
          <PontoSituacao estado={t.situacao as Situacao['estado']} />
          {t.nome}{t.crm ? ` · CRM ${t.crm}` : ''} · {ROTULO_SITUACAO[t.situacao as Situacao['estado']] ?? t.situacao} · até {hhmm(t.ate)}
        </span>
      ))}
    </div>
  )
}

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
      <TelemedicinaDePlantao unidadeId={unidadeId} />
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

// ── lado do teleconsultor: Minha fila ───────────────────────────────────────
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
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['presenca-remota'] })
    void qc.invalidateQueries({ queryKey: ['situacao-tele'] })
  }
  const entrar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('registrar_checkin', { p_unidade: unidadeId })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
  const sair = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('registrar_checkout', { p_registro: id })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
  const p = presenca.data
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-cartao border border-fio bg-superficie px-5 py-3 text-apoio shadow-repouso">
      {p ? (
        <>
          <span className="text-tinta">Plantão remoto iniciado às {hhmm(p.checkin_em)}.</span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => sair.mutate(p.id)} disabled={sair.isPending}>Encerrar plantão remoto</Button>
        </>
      ) : (
        <>
          <span className="text-tinta-apoio">Registre o início do plantão remoto (check-in sem localização: telemedicina).</span>
          <Button size="sm" className="ml-auto" onClick={() => entrar.mutate()} disabled={entrar.isPending}>Iniciar plantão remoto</Button>
        </>
      )}
      {(entrar.error || sair.error) && <span className="basis-full text-critico">{((entrar.error ?? sair.error) as Error).message}</span>}
    </div>
  )
}

function MinhaFila({ unidadeId }: { unidadeId: string }) {
  const qc = useQueryClient()
  const teles = useTeles(unidadeId)
  const aceitar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('aceitar_teleinterconsulta', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teleinterconsultas'] })
      void qc.invalidateQueries({ queryKey: ['situacao-tele'] })
    },
  })
  const lista = teles.data ?? []
  const abertas = lista.filter((t) => t.status === 'aberta')
  const emAtendimento = lista.filter((t) => t.minha && t.status === 'em_atendimento').length

  return (
    <div className="flex flex-col gap-4">
      <PlantaoRemoto unidadeId={unidadeId} />
      {teles.error && <p className="text-apoio text-critico">{(teles.error as Error).message}</p>}
      {emAtendimento > 0 && (
        <Link to="/telemedicina/salas" className="flex items-center gap-2 rounded-cartao border border-critico/30 bg-alerta-critico px-5 py-3 text-apoio font-medium text-critico hover:opacity-90">
          <Video className="size-4" aria-hidden /> {emAtendimento === 1 ? 'Você tem 1 teleinterconsulta em atendimento' : `Você tem ${emAtendimento} teleinterconsultas em atendimento`} — responder em Salas em andamento
        </Link>
      )}
      <Secao titulo={`Fila da unidade (${abertas.length})`} extra="urgente primeiro, depois a mais antiga">
        {teles.isLoading && <Spinner />}
        {!teles.isLoading && abertas.length === 0 && <VazioLinha>Nenhum chamado esperando. Aparece aqui enquanto você está de plantão nesta unidade.</VazioLinha>}
        <ul className="flex flex-col gap-3">
          {abertas.map((t) => (
            <Cartao key={t.id} t={t}>
              <Button className="mt-2.5" size="sm" onClick={() => aceitar.mutate(t.id)} disabled={aceitar.isPending}><Video className="size-3.5" aria-hidden />Atender agora</Button>
            </Cartao>
          ))}
        </ul>
        {aceitar.error && <p className="text-apoio text-critico">{(aceitar.error as Error).message}</p>}
      </Secao>
      <Nota icone={<Lock />}>
        Você vê a fila da unidade só enquanto está de plantão nela. O prontuário do paciente abre depois de aceitar e fica aberto para leitura até 24 h depois do parecer; cada abertura vai para a trilha de auditoria.
      </Nota>
    </div>
  )
}

export default function Teleinterconsulta() {
  const { unidadeAtiva, papeisDaUnidade } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const consultor = papeisDaUnidade.includes('telemedicina') && !papeisDaUnidade.includes('plantonista')
  if (!unidadeId) return <Spinner />
  return (
    <div className="flex w-full max-w-4xl flex-col">
      {consultor ? (
        <TituloPagina icone={Hourglass} titulo="Minha fila"
          descricao="Chamados abertos pela unidade que estou cobrindo, urgentes primeiro. A conduta é de quem está com o paciente (Res. CFM 2.314/2022, art. 7º)."
          acoes={<TopoTele unidadeId={unidadeId} />} />
      ) : (
        <TituloPagina icone={MonitorSmartphone} titulo="Teleinterconsulta"
          descricao="Peça apoio ao médico de telemedicina de plantão. A conduta continua sendo sua." />
      )}
      {consultor ? <MinhaFila unidadeId={unidadeId} /> : <Solicitante unidadeId={unidadeId} />}
    </div>
  )
}
