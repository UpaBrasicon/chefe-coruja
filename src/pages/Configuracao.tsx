import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight, Loader2, MessageSquare, Settings2 } from 'lucide-react'
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

type UnidadeConfig = {
  id: string
  latitude: number | null
  longitude: number | null
  raio_metros: number
  canal_comunicacao: string
  whatsapp_numero: string | null
  nome: string
}

type Setor = { id: string; nome: string }

type Remuneracao = {
  id: string
  setor_id: string | null
  turno: string | null
  valor: number
  setores: { nome: string } | null
}

export default function Configuracao({ embutido = false }: { embutido?: boolean } = {}) {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const queryClient = useQueryClient()

  const { data: unidade, isLoading } = useQuery({
    queryKey: ['unidade-config', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('unidades').select('id, latitude, longitude, raio_metros, canal_comunicacao, whatsapp_numero, nome').eq('id', unidadeId!).single()
      if (error) throw error
      return data as UnidadeConfig
    },
  })

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
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Link to="/" className="transition-colors hover:text-foreground">
              Início
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="font-medium text-foreground">Configurações da Unidade</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Configurações da Unidade</h1>
          <p className="text-sm text-muted-foreground">Comunicação, geolocalização do check-in e valores de plantão.</p>
        </div>
      )}

      {erro && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

      <FormUnidade key={unidade.id} unidade={unidade} unidadeId={unidadeId} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="size-4 text-muted-foreground" />
            Valores de plantão (extrato)
          </CardTitle>
          <CardDescription>Configure o valor por setor e turno. Deixe em branco para aplicar a todos.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Setor</Label>
              <Select value={novoSetor} onValueChange={(v) => setNovoSetor(v ?? '')}>
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
              <p className="text-sm text-muted-foreground">Nenhum valor configurado ainda.</p>
            ) : (
              (remuneracoes ?? []).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <div>
                    <span className="font-medium">
                      {r.setores?.nome ?? 'Todos os setores'}
                    </span>
                    <span className="ml-2 text-muted-foreground">
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
            <MessageSquare className="size-4 text-muted-foreground" />
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
            <p className="text-xs text-muted-foreground">
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
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          {msg && <p className="text-sm text-emerald-700">{msg}</p>}
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
