import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MonitorSmartphone, Send } from 'lucide-react'
import * as React from 'react'

import { TituloPagina } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtData } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import { faltasDoConsentimento, TEXTO_TCLE_TELEMEDICINA, type FormaConsentimento } from '@/lib/tcleTelemedicina'
import { cn } from '@/lib/utils'

import Chamados from './Chamados'
import { Cartao, COR_SITUACAO, hhmm, PontoSituacao, ROTULO_SITUACAO, useTeles, type Situacao } from './comum'

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
  // LG8, M1: termo de telemedicina e a forma de concordância (Res. CFM 2.314/2022, art. 15)
  const [forma, setForma] = React.useState<FormaConsentimento | ''>('')
  const [testemunha, setTestemunha] = React.useState('')
  const [representante, setRepresentante] = React.useState('')
  const [justificativa, setJustificativa] = React.useState('')
  const [urgente, setUrgente] = React.useState(false)
  const emergencia = consentimento === 'emergencia_sem_condicao'
  const faltas = faltasDoConsentimento({ consentimento, forma, testemunha, representante, justificativa })

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
      const { error } = await supabase.rpc('solicitar_teleinterconsulta_com_termo', {
        p_paciente: paciente, p_pergunta: pergunta.trim(), p_consentimento: consentimento,
        p_forma: emergencia ? 'emergencia' : forma || 'assinatura_papel',
        p_testemunha: forma === 'verbal_testemunha' ? testemunha.trim() : undefined,
        p_representante: consentimento === 'representante_legal' ? representante.trim() : undefined,
        p_justificativa: emergencia ? justificativa.trim() : undefined,
        p_urgencia: urgente ? 'urgente' : 'rotina',
      })
      if (error) throw error
    },
    onSuccess: () => {
      setPergunta(''); setConsentimento(''); setUrgente(false); setPaciente('')
      setForma(''); setTestemunha(''); setRepresentante(''); setJustificativa('')
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

  const pode = paciente && pergunta.trim().length >= 10 && faltas.length === 0
  const minhas = (teles.data ?? []).filter((t) => t.minha)

  return (
    <div className="flex flex-col gap-4">
      <TelemedicinaDePlantao unidadeId={unidadeId} />
      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">Nova teleinterconsulta</CardTitle>
          <CardDescription>Só aparecem os pacientes dos setores do seu plantão. A solicitação entra no prontuário como documento numerado.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pac">Paciente</Label>
            <CampoSelecao id="pac" className="text-corpo" value={paciente} onChange={(e) => setPaciente(e.target.value)}>
              <option value="">{pacientes.isLoading ? 'Carregando…' : 'Escolha o paciente'}</option>
              {(pacientes.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nome}{p.data_nascimento ? ` · nasc. ${fmtData(p.data_nascimento)}` : ''}</option>
              ))}
            </CampoSelecao>
          </div>
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
          <label className="flex items-center gap-2 text-apoio">
            <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} /> Urgente
          </label>
          <div className="flex items-center gap-2">
            <Button onClick={() => solicitar.mutate()} disabled={!pode || solicitar.isPending}
              title={faltas.length ? `Falta: ${faltas.join(' · ')}` : undefined}><Send className="size-4" />Solicitar</Button>
            {solicitar.error && <span className="text-apoio text-critico">{(solicitar.error as Error).message}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-corpo">Minhas teleinterconsultas (7 dias)</CardTitle></CardHeader>
        <CardContent>
          {teles.isLoading && <Spinner />}
          {teles.error && <p className="text-apoio text-critico">{(teles.error as Error).message}</p>}
          {!teles.isLoading && minhas.length === 0 && <p className="text-apoio text-tinta-sussurro">Nenhuma.</p>}
          <ul className="flex flex-col gap-3">
            {minhas.map((t) => (
              <Cartao key={t.id} t={t}>
                {t.status === 'aberta' && (
                  <Button className="mt-2" size="sm" variant="outline" onClick={() => cancelar.mutate(t.id)} disabled={cancelar.isPending}>Cancelar</Button>
                )}
              </Cartao>
            ))}
          </ul>
        </CardContent>
      </Card>
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
      <TituloPagina icone={MonitorSmartphone} titulo="Teleinterconsulta"
        descricao="Peça apoio ao médico de telemedicina de plantão. A conduta continua sendo sua." />
      <Solicitante unidadeId={unidadeId} />
    </div>
  )
}
