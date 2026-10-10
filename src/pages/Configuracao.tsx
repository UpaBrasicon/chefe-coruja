import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight, Gauge, Loader2, MessageSquare, Settings2 } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { DetalhesAdmissao } from '@/pages/gestor/DetalhesAdmissao'
import { GradeAprazamento } from '@/pages/gestor/GradeAprazamento'
import { CnesUnidade } from '@/pages/gestor/CnesUnidade'
import { CriticasAih } from '@/pages/gestor/CriticasAih'
import { chaveLimites, useLimitesUnidade, type LimitesUnidade } from '@/pages/gestor/limites'

type UnidadeConfig = {
  id: string
  latitude: number | null
  longitude: number | null
  raio_metros: number
  canal_comunicacao: string
  whatsapp_numero: string | null
  nome: string
  cnes: string | null
  tipo: string
  municipio: string | null
  uf: string | null
}

const TIPO_UNIDADE: Record<string, string> = { hospital: 'Hospital', upa: 'UPA', pronto_socorro: 'Pronto-socorro', ubs: 'UBS', clinica: 'Clínica' }

type Setor = { id: string; nome: string }

type Remuneracao = {
  id: string
  setor_id: string | null
  turno: string | null
  valor: number
  setores: { nome: string } | null
}

export default function Configuracao({ embutido = false }: { embutido?: boolean } = {}) {
  const { unidadeAtiva, papeisDaUnidade } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const queryClient = useQueryClient()
  const ehGestor = papeisDaUnidade.includes('gestor')

  const { data: unidade, isLoading } = useQuery({
    queryKey: ['unidade-config', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('unidades').select('id, latitude, longitude, raio_metros, canal_comunicacao, whatsapp_numero, nome, cnes, tipo, municipio, uf').eq('id', unidadeId!).single()
      if (error) throw error
      return data as UnidadeConfig
    },
  })

  const limites = useLimitesUnidade(unidadeId)

  const { data: setores } = useQuery({
    queryKey: ['setores-config', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('setores').select('id, nome').eq('unidade_id', unidadeId!).eq('ativo', true).order('ordem')
      if (error) throw error
      return (data ?? []) as Setor[]
    },
  })

  const { data: remuneracoes } = useQuery({
    queryKey: ['remuneracoes-config', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remuneracoes_plantao')
        .select('id, setor_id, turno, valor, setores(nome)')
        .eq('unidade_id', unidadeId!)
        .eq('ativo', true)
      if (error) throw error
      return (data ?? []) as unknown as Remuneracao[]
    },
  })

  // novo valor
  const [novoSetor, setNovoSetor] = React.useState('')
  const [novoTurno, setNovoTurno] = React.useState('')
  const [novoValor, setNovoValor] = React.useState('')

  const [erro, setErro] = React.useState<string | null>(null)

  async function adicionarValor() {
    if (!unidadeId || !novoValor) return
    setErro(null)
    const { error } = await supabase.from('remuneracoes_plantao').insert({
      unidade_id: unidadeId,
      setor_id: novoSetor || null,
      turno: novoTurno || null,
      valor: Number(novoValor),
      criado_por: null,
    })
    if (error) {
      setErro(error.message)
      return
    }
    setNovoValor('')
    setNovoSetor('')
    setNovoTurno('')
    void queryClient.invalidateQueries({ queryKey: ['remuneracoes-config', unidadeId] })
  }

  async function removerValor(id: string) {
    if (!unidadeId) return
    const { error } = await supabase.from('remuneracoes_plantao').update({ ativo: false }).eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    void queryClient.invalidateQueries({ queryKey: ['remuneracoes-config', unidadeId] })
  }

  function brl(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  if (isLoading || !unidade) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {!embutido && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-sm text-tinta-sussurro">
            <Link to="/" className="transition-colors hover:text-tinta">
              Início
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="font-medium text-tinta">Configurações da Unidade</span>
          </div>
          <h1 className="text-titulo leading-[1.1] font-semibold tracking-[-0.02em] text-tinta">Configurações da Unidade</h1>
          <p className="text-sm text-tinta-sussurro">Comunicação, geolocalização do check-in, limites da unidade e valores de plantão.</p>
        </div>
      )}

      {erro && <div className="rounded-lg border border-critico/30 bg-critico/[0.08] p-3 text-sm text-critico">{erro}</div>}

      {/* Identificação (protótipo: nome, CNES e tipo); o cadastro é da rede, mas o CNES é do gestor (RT, 10/10/2026) */}
      <div className="grid gap-4 rounded-cartao border border-fio bg-superficie px-5 py-4 shadow-repouso sm:grid-cols-3">
        {ehGestor && unidadeId && <CnesUnidade key={`cnes-${unidadeId}`} unidadeId={unidadeId} atual={unidade.cnes} />}
        {[
          ['Nome da unidade', unidade.nome],
          ...(ehGestor ? [] : [['CNES', unidade.cnes ?? 'não informado']]),
          ['Tipo', TIPO_UNIDADE[unidade.tipo] ?? unidade.tipo],
        ].map(([r, v]) => (
          <div key={r} className="flex min-w-0 flex-col gap-[3px]">
            <span className="text-apoio font-medium text-grafite">{r}</span>
            <span className="text-corpo text-tinta">{v}</span>
          </div>
        ))}
        <span className="text-rotulo text-tinta-sussurro sm:col-span-3">
          {[unidade.municipio, unidade.uf].filter(Boolean).join(' / ')}
          {unidade.municipio ? ' · ' : ''}O cadastro da unidade é da administração da rede; o CNES é preenchido pelo gestor.
        </span>
      </div>

      <FormUnidade key={`unidade-${unidade.id}`} unidade={unidade} unidadeId={unidadeId} />

      {limites.data && (
        <FormLimites key={`limites-${unidadeId}`} inicial={limites.data} unidadeId={unidadeId} podeEditar={ehGestor} />
      )}

      {/* Fase 2, tarefa 2: grade de aprazamento sugerida à enfermagem */}
      {unidadeId && <GradeAprazamento unidadeId={unidadeId} podeEditar={ehGestor} />}
      {unidadeId && <CriticasAih unidadeId={unidadeId} podeEditar={ehGestor} />}

      {ehGestor && <DetalhesAdmissao />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="size-4 text-tinta-sussurro" />
            Valores de plantão (extrato)
          </CardTitle>
          <CardDescription>Configure o valor por setor e turno. Deixe em branco para aplicar a todos.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Setor</Label>
              <Select items={Object.fromEntries((setores ?? []).map((s) => [s.id, s.nome]))} value={novoSetor} onValueChange={(v) => setNovoSetor(v ?? '')}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  {(setores ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Turno</Label>
              <Select value={novoTurno} onValueChange={(v) => setNovoTurno(v ?? '')}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manha">Manhã</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                  <SelectItem value="noite">Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Valor</Label>
              <Input type="number" step="0.01" value={novoValor} onChange={(e) => setNovoValor(e.target.value)} placeholder="0.00" className="w-32" />
            </div>
            <Button onClick={adicionarValor} disabled={!novoValor}>
              Adicionar
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {(remuneracoes ?? []).length === 0 ? (
              <p className="text-sm text-tinta-sussurro">Nenhum valor configurado ainda.</p>
            ) : (
              (remuneracoes ?? []).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <div>
                    <span className="font-medium">
                      {r.setores?.nome ?? 'Todos os setores'}
                    </span>
                    <span className="ml-2 text-tinta-sussurro">
                      {r.turno ? { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }[r.turno as 'manha' | 'tarde' | 'noite'] ?? r.turno : 'Todos os turnos'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{brl(r.valor)}</span>
                    <Button variant="ghost" size="sm" onClick={() => removerValor(r.id)}>
                      Remover
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FormUnidade({ unidade, unidadeId }: { unidade: UnidadeConfig; unidadeId: string | undefined }) {
  const queryClient = useQueryClient()
  const [canal, setCanal] = React.useState(unidade.canal_comunicacao)
  const [whats, setWhats] = React.useState(unidade.whatsapp_numero ?? '')
  const [lat, setLat] = React.useState(unidade.latitude != null ? String(unidade.latitude) : '')
  const [lng, setLng] = React.useState(unidade.longitude != null ? String(unidade.longitude) : '')
  const [raio, setRaio] = React.useState(String(unidade.raio_metros))
  const [salvando, setSalvando] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)

  async function salvarUnidade() {
    if (!unidadeId) return
    setSalvando(true)
    setErro(null)
    setMsg(null)
    const { error } = await supabase
      .from('unidades')
      .update({
        canal_comunicacao: canal,
        whatsapp_numero: whats || null,
        latitude: lat ? Number(lat) : null,
        longitude: lng ? Number(lng) : null,
        raio_metros: Number(raio || 500),
      })
      .eq('id', unidadeId)
    setSalvando(false)
    if (error) {
      setErro(error.message)
      return
    }
    setMsg('Configurações salvas.')
    void queryClient.invalidateQueries({ queryKey: ['unidade-config', unidadeId] })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="size-4 text-tinta-sussurro" />
            Canal de comunicação
          </CardTitle>
          <CardDescription>
            Defina como os plantonistas falam com a gestão. WhatsApp abre conversa no aplicativo (sem custo de
            API); Chat usa o chat integrado.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Canal preferencial</Label>
              <Select value={canal} onValueChange={(v) => setCanal(v ?? 'chat')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chat">Chat integrado (sem custo)</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp (link direto)</SelectItem>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canal === 'whatsapp' && (
              <div className="flex flex-col gap-1.5">
                <Label>Número WhatsApp (com DDI + DDD)</Label>
                <Input value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="5511999999999" />
              </div>
            )}
          </div>
          {canal === 'whatsapp' && (
            <p className="text-xs text-tinta-sussurro">
              Exemplo: 5511999999999 (Brasil, SP). Os plantonistas verão um botão &quot;Falar no WhatsApp&quot;.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Geolocalização do check-in</CardTitle>
          <CardDescription>Usada para validar se o plantonista está na unidade ao registrar presença.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>Latitude</Label>
              <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-23.5505" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Longitude</Label>
              <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-46.6333" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Raio (metros)</Label>
              <Input type="number" value={raio} onChange={(e) => setRaio(e.target.value)} />
            </div>
          </div>
          {erro && <p className="text-sm text-critico">{erro}</p>}
          {msg && <p className="text-sm text-conforme">{msg}</p>}
          <div>
            <Button onClick={salvarUnidade} disabled={salvando}>
              {salvando ? <Loader2 className="animate-spin" /> : <Check />} Salvar unidade
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

// Limites da unidade (migration 20261012000001): descanso mínimo entre
// jornadas (opcional; a maioria dos contratos não é CLT), sobrecarga em 7
// dias, limite de atenção da ocupação e tolerância do check-in. Valem para o
// Olho de Gavião, o painel, o mapa de leitos e os indicadores.
function FormLimites({ inicial, unidadeId, podeEditar }: { inicial: LimitesUnidade; unidadeId: string | undefined; podeEditar: boolean }) {
  const queryClient = useQueryClient()
  const [descansoAtivo, setDescansoAtivo] = React.useState(inicial.descanso_ativo)
  const [descansoHoras, setDescansoHoras] = React.useState(String(inicial.descanso_horas))
  const [sobrecarga, setSobrecarga] = React.useState(String(inicial.sobrecarga_horas))
  const [ocupacao, setOcupacao] = React.useState(String(inicial.ocupacao_pct))
  const [tolerancia, setTolerancia] = React.useState(String(inicial.checkin_tolerancia_min))
  const [alvoTriagem, setAlvoTriagem] = React.useState(String(inicial.alvo_triagem_min))
  // alvos da classificação ao médico, por cor (Fase 1, tarefa 4; migration 20261029000003)
  const [alvosMedico, setAlvosMedico] = React.useState<Record<string, string>>(
    Object.fromEntries(Object.entries(inicial.alvos_medico).map(([c, v]) => [c, String(v)])))
  const [salvando, setSalvando] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)

  async function salvar() {
    if (!unidadeId) return
    setSalvando(true)
    setErro(null)
    setMsg(null)
    const { error } = await supabase.rpc('salvar_limites_unidade', {
      p_unidade: unidadeId,
      p_descanso_ativo: descansoAtivo,
      p_descanso_horas: Number(descansoHoras),
      p_sobrecarga_horas: Number(sobrecarga),
      p_ocupacao_pct: Number(ocupacao),
      p_checkin_tolerancia_min: Number(tolerancia),
    })
    // alvo da chegada à triagem (Fase 1, tarefa 3): RPC própria, migration 20261029000002
    const alvo = error ? null : await supabase.rpc('salvar_alvo_triagem', { p_unidade: unidadeId, p_minutos: Number(alvoTriagem) })
    const alvos = error || alvo?.error ? null : await supabase.rpc('salvar_alvos_medico', {
      p_unidade: unidadeId,
      p_alvos: Object.fromEntries(Object.entries(alvosMedico).map(([c, v]) => [c, Number(v)])),
    })
    setSalvando(false)
    if (error || alvo?.error || alvos?.error) {
      setErro((error ?? alvo?.error ?? alvos?.error)!.message)
      return
    }
    setMsg('Limites salvos.')
    void queryClient.invalidateQueries({ queryKey: ['espera-triagem', unidadeId] })
    void queryClient.invalidateQueries({ queryKey: ['espera-medico', unidadeId] })
    void queryClient.invalidateQueries({ queryKey: ['porta-agora', unidadeId] })
    void queryClient.invalidateQueries({ queryKey: chaveLimites(unidadeId) })
    void queryClient.invalidateQueries({ queryKey: ['panorama-gestor', unidadeId] })
  }

  const campo = (id: string, rotulo: string, valor: string, set: (v: string) => void, min: number, max: number, sufixo: string, ajuda: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="flex items-center gap-2">
        <Input id={id} type="number" inputMode="numeric" min={min} max={max} value={valor} disabled={!podeEditar}
          onChange={(e) => set(e.target.value)} className="w-24" />
        <span className="text-sm text-tinta-sussurro">{sufixo}</span>
      </div>
      <span className="text-xs text-tinta-sussurro">{ajuda}</span>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="size-4 text-tinta-sussurro" />
          Limites da unidade
        </CardTitle>
        <CardDescription>
          Usados pelo Olho de Gavião, pelo painel, pelo mapa de leitos e pelos indicadores.
          {!podeEditar && ' Só o gestor da unidade altera.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-lg border border-fio p-3">
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" checked={descansoAtivo} disabled={!podeEditar} onChange={(e) => setDescansoAtivo(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--color-acao)]" />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium text-tinta">Exigir descanso mínimo entre jornadas</span>
              <span className="text-xs text-tinta-sussurro">
                Deixe desligado quando os contratos não são CLT. Desligado, o Olho de Gavião não aponta descanso curto.
              </span>
            </span>
          </label>
          {descansoAtivo && campo('lim-descanso', 'Descanso mínimo', descansoHoras, setDescansoHoras, 1, 24, 'horas', 'Entre o fim de uma jornada e o início da seguinte. A CLT pede 11 horas.')}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {campo('lim-sobrecarga', 'Sobrecarga', sobrecarga, setSobrecarga, 12, 168, 'horas em 7 dias', 'Acima disso o profissional aparece no Olho de Gavião.')}
          {campo('lim-ocupacao', 'Limite de ocupação', ocupacao, setOcupacao, 50, 100, '% dos leitos', 'A partir daqui o setor fica em atenção.')}
          {campo('lim-tolerancia', 'Tolerância do check-in', tolerancia, setTolerancia, 0, 120, 'minutos', 'Depois do início do plantão. Passado esse prazo sem check-in, o acesso fica bloqueado até a pessoa fazer o check-in.')}
          {campo('lim-alvo-triagem', 'Alvo chegada → triagem', alvoTriagem, setAlvoTriagem, 1, 240, 'minutos', 'Da ficha na recepção até a classificação. Usado no indicador de espera da triagem.')}
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-fio p-3">
          <span className="text-sm font-medium text-tinta">Alvo da classificação ao médico, por cor</span>
          <span className="text-xs text-tinta-sussurro">
            Em minutos, da 1ª classificação até o médico abrir o atendimento. Vem do protocolo de classificação; mude só se a unidade adota outro tempo. Usado na tela Porta e nos Indicadores. 0 = imediato.
          </span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(['vermelho', 'laranja', 'amarelo', 'verde', 'azul'] as const).map((c) => (
              <div key={c} className="flex flex-col gap-1">
                <Label htmlFor={`alvo-${c}`} className="capitalize">{c}</Label>
                <Input id={`alvo-${c}`} type="number" inputMode="numeric" min={0} max={1440} value={alvosMedico[c] ?? ''} disabled={!podeEditar}
                  onChange={(e) => setAlvosMedico((a) => ({ ...a, [c]: e.target.value }))} className="w-24" />
              </div>
            ))}
          </div>
        </div>
        {erro && <p className="text-sm text-critico">{erro}</p>}
        {msg && <p className="text-sm text-conforme">{msg}</p>}
        {podeEditar && (
          <div>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 className="animate-spin" /> : <Check />} Salvar limites
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
