import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Search, Stethoscope } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { ehPediatrico, rotuloIdade } from '@/domain/idade'
import { ordemTriagem, rotulosPrioridade } from '@/domain/prioridade'
import { CORES_RISCO, NIVEL_RISCO, type CorRisco } from '@/domain/risco'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { PilulaRisco } from '@/components/clinico/PilulaRisco'

// Triagem (Fase 2.2): o enfermeiro afere os sinais vitais e faz a
// classificação de risco. O protocolo da unidade aparece como REFERÊNCIA — o
// discriminador mostra a cor que tem no protocolo, mas a cor do paciente é a
// que o enfermeiro escolhe; o sistema nunca pré-seleciona (ADR 0007).

type NaFila = {
  id: string
  setor_id: string
  chegada_em: string
  queixa: string
  prioridades_legais: string[]
  paciente: { nome: string; nome_social: string | null; data_nascimento: string | null; sexo: string | null } | null
}
type Fluxograma = { id: string; nome: string; publico: 'adulto' | 'pediatrico'; inclui: string | null; discriminadores: Partial<Record<CorRisco, [string, string][]>> }

const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// id do campo, rótulo, conceito no banco, unidade, obrigatório no adulto / na pediatria
const VITAIS = [
  { k: 'pressao-arterial-sistolica', rotulo: 'PA sistólica', un: 'mmHg', adulto: true, ped: false },
  { k: 'pressao-arterial-diastolica', rotulo: 'PA diastólica', un: 'mmHg', adulto: true, ped: false },
  { k: 'frequencia-cardiaca', rotulo: 'FC', un: 'bpm', adulto: true, ped: true },
  { k: 'frequencia-respiratoria', rotulo: 'FR', un: 'irpm', adulto: true, ped: true },
  { k: 'temperatura', rotulo: 'Temperatura', un: '°C', adulto: true, ped: true },
  { k: 'saturacao-o2', rotulo: 'SpO₂', un: '%', adulto: true, ped: true },
  { k: 'escala-dor', rotulo: 'Dor (0–10)', un: '', adulto: true, ped: true },
  { k: 'glicemia-capilar', rotulo: 'Glicemia capilar', un: 'mg/dL', adulto: false, ped: false },
  { k: 'peso', rotulo: 'Peso', un: 'kg', adulto: false, ped: false },
] as const

const COR_BOTAO: Record<CorRisco, string> = {
  vermelho: 'border-mts-vermelho text-mts-vermelho data-[on=true]:bg-mts-vermelho data-[on=true]:text-white',
  laranja: 'border-mts-laranja text-mts-laranja data-[on=true]:bg-mts-laranja data-[on=true]:text-white',
  amarelo: 'border-mts-amarelo text-mts-amarelo-texto data-[on=true]:bg-mts-amarelo',
  verde: 'border-mts-verde text-mts-verde data-[on=true]:bg-mts-verde data-[on=true]:text-white',
  azul: 'border-mts-azul text-mts-azul data-[on=true]:bg-mts-azul data-[on=true]:text-white',
}

function Classificar({ ep, onFim }: { ep: NaFila; onFim: () => void }) {
  const { unidadeAtiva } = useUnidade()
  const queryClient = useQueryClient()
  const nasc = ep.paciente?.data_nascimento ?? null
  const idadePed = nasc ? rotuloIdade(nasc, hoje()) : null
  // pediatria até 13a 11m 29d, pela data de chegada (CLAUDE.md)
  const pediatricoPelaIdade = nasc ? ehPediatrico(nasc, new Date(ep.chegada_em).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })) : null
  const [publicoManual, setPublicoManual] = React.useState<'adulto' | 'pediatrico' | null>(null)
  const publico = pediatricoPelaIdade === null ? publicoManual : pediatricoPelaIdade ? 'pediatrico' : 'adulto'

  const { data: fluxos } = useQuery({
    queryKey: ['protocolo-fluxogramas', unidadeAtiva?.unidade_id],
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protocolo_fluxogramas')
        .select('id, nome, publico, inclui, discriminadores')
        .order('ordem')
      if (error) throw error
      return (data ?? []) as unknown as Fluxograma[]
    },
  })

  const [busca, setBusca] = React.useState('')
  const [fluxoId, setFluxoId] = React.useState<string | null>(null)
  const [disc, setDisc] = React.useState<{ texto: string; cor: CorRisco } | null>(null)
  const [cor, setCor] = React.useState<CorRisco | null>(null)
  const [vitais, setVitais] = React.useState<Record<string, string>>({})
  const [aval, setAval] = React.useState({ avdi: '', glasgow: '', tempo_sintomas: '', comorbidades: '', medicacoes: '', spo2_condicao: 'ar ambiente' })

  const doPublico = (fluxos ?? []).filter((f) => f.publico === publico)
  const filtrados = busca.trim()
    ? doPublico.filter((f) => semAcento(`${f.nome} ${f.inclui ?? ''}`).includes(semAcento(busca)))
    : doPublico
  const fluxo = doPublico.find((f) => f.id === fluxoId)

  const faltando = VITAIS.filter((v) => (publico === 'pediatrico' ? v.ped : v.adulto) && !(vitais[v.k] ?? '').trim())

  const salvar = useMutation({
    mutationFn: async () => {
      const sinais = Object.fromEntries(
        Object.entries(vitais)
          .filter(([, v]) => v.trim() !== '')
          .map(([k, v]) => {
            const n = Number(v.replace(',', '.'))
            if (Number.isNaN(n)) throw new Error(`Valor inválido em ${VITAIS.find((x) => x.k === k)?.rotulo}`)
            return [k, n]
          })
      )
      const { error } = await supabase.rpc('classificar_risco', {
        p_episodio: ep.id,
        p_cor: cor!,
        p_sinais: sinais,
        p_fluxograma: fluxo?.id,
        p_discriminador: disc?.texto,
        p_avaliacao: Object.fromEntries(Object.entries(aval).filter(([, v]) => v.trim() !== '')),
        p_publico: publico ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['triagem-fila'] })
      onFim()
    },
  })

  const pronto = !!publico && !!fluxo && !!disc && !!cor && faltando.length === 0

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" className="self-start" onClick={onFim}><ArrowLeft /> Voltar à fila</Button>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{ep.paciente?.nome_social || ep.paciente?.nome}</CardTitle>
          <CardDescription>
            {idadePed ?? 'Idade não informada'} · chegou {hora(ep.chegada_em)} · queixa: {ep.queixa}
          </CardDescription>
          {ep.prioridades_legais.length > 0 && (
            <div className="flex flex-wrap gap-1">{rotulosPrioridade(ep.prioridades_legais).map((r) => <Badge key={r} variant="outline">{r}</Badge>)}</div>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {pediatricoPelaIdade === null && (
            <div className="flex flex-col gap-1.5">
              <Label>Sem data de nascimento: qual protocolo?</Label>
              <div className="flex gap-2">
                {(['adulto', 'pediatrico'] as const).map((p) => (
                  <Button key={p} size="sm" variant={publicoManual === p ? 'default' : 'outline'} onClick={() => { setPublicoManual(p); setFluxoId(null); setDisc(null) }}>
                    {p === 'adulto' ? 'Adulto' : 'Pediatria'}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* sinais vitais */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-tinta">Sinais vitais {publico === 'pediatrico' && <span className="font-normal text-muted-foreground">· na pediatria a PA é opcional</span>}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {VITAIS.map((v) => {
                const obrig = publico === 'pediatrico' ? v.ped : v.adulto
                return (
                  <div key={v.k} className="flex flex-col gap-1">
                    <Label htmlFor={`v-${v.k}`}>{v.rotulo}{obrig ? ' *' : ''}</Label>
                    <Input id={`v-${v.k}`} inputMode="decimal" placeholder={v.un} value={vitais[v.k] ?? ''} onChange={(e) => setVitais((s) => ({ ...s, [v.k]: e.target.value }))} />
                  </div>
                )
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="a-spo2">SpO₂ medida em</Label>
                <Input id="a-spo2" value={aval.spo2_condicao} onChange={(e) => setAval((a) => ({ ...a, spo2_condicao: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="a-avdi">AVDI</Label>
                <select id="a-avdi" className="h-9 rounded-controle border border-fio bg-superficie px-2 text-sm" value={aval.avdi} onChange={(e) => setAval((a) => ({ ...a, avdi: e.target.value }))}>
                  <option value="">—</option>
                  <option value="A">A — alerta</option>
                  <option value="V">V — responde à voz</option>
                  <option value="D">D — responde à dor</option>
                  <option value="I">I — irresponsivo</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="a-gcs">Glasgow</Label>
                <Input id="a-gcs" inputMode="numeric" value={aval.glasgow} onChange={(e) => setAval((a) => ({ ...a, glasgow: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="a-tempo">Tempo dos sintomas</Label>
                <Input id="a-tempo" value={aval.tempo_sintomas} onChange={(e) => setAval((a) => ({ ...a, tempo_sintomas: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="a-com">Comorbidades</Label>
                <Input id="a-com" value={aval.comorbidades} onChange={(e) => setAval((a) => ({ ...a, comorbidades: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="a-med">Medicações em uso</Label>
                <Input id="a-med" value={aval.medicacoes} onChange={(e) => setAval((a) => ({ ...a, medicacoes: e.target.value }))} />
              </div>
            </div>
          </section>

          {/* protocolo como referência */}
          {publico && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-tinta">Protocolo da unidade · {publico === 'pediatrico' ? 'Pediatria' : 'Adulto'}</h3>
              {!fluxo ? (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input aria-label="Buscar fluxograma" className="pl-8" placeholder="Buscar fluxograma (ex.: dor torácica, febre)" value={busca} onChange={(e) => setBusca(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {filtrados.map((f) => (
                      <button key={f.id} type="button" onClick={() => { setFluxoId(f.id); setDisc(null) }} className="rounded-controle border border-fio px-3 py-2 text-left text-sm hover:border-acao">
                        <span className="font-medium text-tinta">{f.nome}</span>
                        {f.inclui && <span className="block text-xs text-muted-foreground">{f.inclui}</span>}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-tinta">{fluxo.nome}</span>
                    <Button size="sm" variant="ghost" onClick={() => { setFluxoId(null); setDisc(null) }}>Trocar fluxograma</Button>
                  </div>
                  {CORES_RISCO.filter((c) => fluxo.discriminadores[c]?.length).map((c) => (
                    <div key={c} className="flex flex-col gap-1">
                      <PilulaRisco cor={c} className="self-start" />
                      {fluxo.discriminadores[c]!.map(([texto, desc]) => (
                        <button
                          key={texto}
                          type="button"
                          onClick={() => setDisc({ texto, cor: c })}
                          className={cn('rounded-controle border px-3 py-1.5 text-left text-sm', disc?.texto === texto ? 'border-acao bg-acao/5' : 'border-fio hover:border-acao')}
                        >
                          <span className="text-tinta">{texto}</span>
                          {desc && <span className="block text-xs text-muted-foreground">{desc}</span>}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {disc && (
                <p className="text-sm text-tinta-apoio">
                  Referência do protocolo: <strong className="capitalize">{disc.cor}</strong>. A prioridade é decisão do enfermeiro.
                </p>
              )}
            </section>
          )}

          {/* a cor — nunca pré-selecionada */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-tinta">Classificação de risco *</h3>
            <div className="flex flex-wrap gap-2">
              {CORES_RISCO.map((c) => (
                <button
                  key={c}
                  type="button"
                  data-on={cor === c}
                  onClick={() => setCor(c)}
                  className={cn('min-w-[110px] rounded-capsula border-2 px-3 py-1.5 text-sm font-semibold capitalize', COR_BOTAO[c])}
                >
                  {c}
                  <span className="block text-[11px] font-normal">{NIVEL_RISCO[c]}</span>
                </button>
              ))}
            </div>
          </section>

          {faltando.length > 0 && <p className="text-xs text-muted-foreground">Faltam: {faltando.map((v) => v.rotulo).join(', ')}.</p>}
          {salvar.error && <p className="text-sm text-destructive">{(salvar.error as Error).message}</p>}
          <div className="flex justify-end">
            <Button disabled={!pronto || salvar.isPending} onClick={() => salvar.mutate()}>
              {salvar.isPending ? <Spinner className="size-4" /> : <Stethoscope />} Registrar classificação
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function Triagem() {
  const { unidadeAtiva } = useUnidade()
  const [atual, setAtual] = React.useState<NaFila | null>(null)

  const fila = useQuery({
    queryKey: ['triagem-fila', unidadeAtiva?.unidade_id],
    enabled: !!unidadeAtiva,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data: ids, error: e1 } = await supabase.rpc('setores_na_escala_agora')
      if (e1) throw e1
      const setores = (Array.isArray(ids) ? ids : []) as string[]
      if (setores.length === 0) return []
      const { data, error } = await supabase
        .from('episodios')
        .select('id, setor_id, chegada_em, queixa, prioridades_legais, paciente:pacientes(nome, nome_social, data_nascimento, sexo)')
        .in('setor_id', setores)
        .eq('etapa', 'triagem')
      if (error) throw error
      return ((data ?? []) as unknown as NaFila[]).sort(ordemTriagem)
    },
  })

  if (atual) return <Classificar ep={atual} onFim={() => setAtual(null)} />

  return (
    <>
      <TituloPagina icone={Stethoscope} titulo="Triagem" descricao="Sinais vitais e classificação de risco. O protocolo é referência; a cor é sua." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aguardando triagem</CardTitle>
          <CardDescription>80+ primeiro, depois as demais prioridades legais, depois a chegada.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {fila.isLoading && <Spinner />}
          {fila.error && <p className="text-sm text-destructive">{(fila.error as Error).message}</p>}
          {fila.data?.length === 0 && <Vazio icone={Stethoscope} titulo="Ninguém aguardando triagem" />}
          {fila.data?.map((e, i) => (
            <button key={e.id} type="button" onClick={() => setAtual(e)} className="flex items-start gap-3 rounded-controle border border-fio p-3 text-left hover:border-acao">
              <span className="w-5 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-tinta">{e.paciente?.nome_social || e.paciente?.nome}</span>
                <span className="block text-xs text-muted-foreground">
                  {e.paciente?.data_nascimento ? rotuloIdade(e.paciente.data_nascimento, hoje()) : 'idade não informada'} · chegou {hora(e.chegada_em)} · {e.queixa}
                </span>
                {e.prioridades_legais.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">{rotulosPrioridade(e.prioridades_legais).map((r) => <Badge key={r} variant="outline">{r}</Badge>)}</span>
                )}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>
    </>
  )
}
