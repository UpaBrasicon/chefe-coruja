import { useQuery } from '@tanstack/react-query'
import { Loader2, LogIn, LogOut, MapPin, Navigation } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { obterPosicao } from '@/lib/geolocalizacao'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

const TURNO_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', madrugada: 'Madrugada' }

// 'AAAA-MM-DD' é data civil, não instante: new Date() a lê como meia-noite UTC
// e, em Brasília, ela vira o dia anterior.
const dataCivil = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

type PresencaRow = {
  id: string
  data: string
  turno: string
  checkin_em: string | null
  checkout_em: string | null
  checkin_dentro: boolean | null
  checkout_dentro: boolean | null
  escala_plantao_id: string | null
}

type UnidadeComGeo = {
  latitude: number | null
  longitude: number | null
  raio_metros: number
  nome: string
}

export default function MeuPlantao({ embutido = false }: { embutido?: boolean } = {}) {
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id

  const [obs, setObs] = React.useState('')
  const [pos, setPos] = React.useState<{ lat: number; lng: number } | null>(null)
  const [geoMsg, setGeoMsg] = React.useState<string | null>(null)
  const [processando, setProcessando] = React.useState<'in' | 'out' | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [sucesso, setSucesso] = React.useState<string | null>(null)

  const { data: unidade } = useQuery({
    queryKey: ['unidade-geo', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unidades')
        .select('latitude, longitude, raio_metros, nome')
        .eq('id', unidadeId!)
        .single()
      if (error) throw error
      return data as UnidadeComGeo
    },
  })

  const { data: presencas, isLoading, refetch } = useQuery({
    queryKey: ['minhas-presencas', unidadeId, perfil?.id],
    enabled: !!unidadeId && !!perfil,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('presenca_plantonista')
        .select('id, data, turno, checkin_em, checkout_em, checkin_dentro, checkout_dentro, escala_plantao_id')
        .eq('unidade_id', unidadeId!)
        .eq('perfil_id', perfil!.id)
        .order('data', { ascending: false })
        .limit(15)
      if (error) throw error
      return (data ?? []) as PresencaRow[]
    },
    refetchInterval: 30_000,
  })

  // O ativo é o último check-in sem check-out — não "o de hoje pelo relógio
  // do aparelho": a noite que atravessa a meia-noite é registrada na data em
  // que o plantão começou (ADR 0003).
  const ativoHoje = React.useMemo(
    () => (presencas ?? []).find((p) => p.checkin_em && !p.checkout_em),
    [presencas],
  )

  // Fora do raio: 1ª recusa pede nova tentativa; da 2ª em diante pergunta se
  // o GPS está com problema e aceita justificativa (decisão de 26/09/2026).
  const [recusas, setRecusas] = React.useState(0)
  const [recusa, setRecusa] = React.useState<string | null>(null)
  const [justificativa, setJustificativa] = React.useState('')

  async function localizar() {
    setGeoMsg(null)
    setErro(null)
    try {
      const p = await obterPosicao()
      setPos(p)
      setGeoMsg(`Localização capturada: ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`)
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function checkin(comJustificativa = false) {
    if (!unidadeId) return
    setProcessando('in')
    setErro(null)
    setSucesso(null)
    try {
      // Sempre uma leitura nova de GPS: a tentativa seguinte precisa medir de novo.
      let lat: number | null = null
      let lng: number | null = null
      try {
        const p = await obterPosicao()
        lat = p.lat
        lng = p.lng
        setPos(p)
      } catch {
        // Sem localização vai vazio — nunca (0, 0), que o servidor leria como
        // uma posição real no meio do oceano.
      }
      const { error } = await supabase.rpc('registrar_checkin', {
        p_unidade: unidadeId,
        p_lat: lat ?? undefined,
        p_lng: lng ?? undefined,
        p_observacao: obs || undefined,
        p_justificativa: comJustificativa ? justificativa.trim() : undefined,
      })
      if (error) {
        const m = error.message
        if (m.startsWith('CHECKIN_FORA_DO_RAIO') || m.startsWith('CHECKIN_SEM_LOCALIZACAO')) {
          setRecusas((n) => n + 1)
          setRecusa(m.replace(/^CHECKIN_[A-Z_]+:\s*/, ''))
          return
        }
        throw new Error(m.replace(/^CHECKIN_[A-Z_]+:\s*/, ''))
      }
      setSucesso(comJustificativa ? 'Check-in registrado com a justificativa. O gestor verá o motivo.' : 'Check-in realizado com sucesso.')
      setObs('')
      setRecusa(null)
      setRecusas(0)
      setJustificativa('')
      void refetch()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setProcessando(null)
    }
  }

  async function checkout() {
    if (!unidadeId || !ativoHoje) return
    setProcessando('out')
    setErro(null)
    setSucesso(null)
    try {
      let lat: number | null = pos?.lat ?? null
      let lng: number | null = pos?.lng ?? null
      if (lat == null || lng == null) {
        try {
          const p = await obterPosicao()
          lat = p.lat
          lng = p.lng
        } catch {
          lat = null
          lng = null
        }
      }
      const { error } = await supabase.rpc('registrar_checkout', {
        p_registro: ativoHoje.id,
        p_lat: lat ?? undefined,
        p_lng: lng ?? undefined,
      })
      if (error) throw error
      setSucesso('Check-out realizado com sucesso.')
      void refetch()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setProcessando(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {!embutido && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Link to="/" className="transition-colors hover:text-foreground">
              Início
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium text-foreground">Meu Plantão</span>
          </div>
          <h1 className="text-titulo leading-[1.1] font-semibold tracking-[-0.02em] text-tinta">Meu Plantão</h1>
          <p className="text-sm text-muted-foreground">
            Registre sua entrada (check-in) e saída (check-out) com geolocalização.
          </p>
        </div>
      )}

      {erro && <div className="rounded-lg border border-critico/30 bg-critico/[0.08] p-3 text-sm text-critico">{erro}</div>}
      {sucesso && <div className="rounded-lg border border-conforme/30 bg-conforme/[0.08] p-3 text-sm text-conforme">{sucesso}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-4 text-muted-foreground" />
            {unidade?.nome ?? 'Unidade'}
          </CardTitle>
          <CardDescription>
            {unidade?.latitude != null
              ? `Geolocalização configurada (raio de ${unidade.raio_metros}m).`
              : 'Esta unidade ainda não configurou geolocalização — o registro será feito sem validação de local.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={localizar}>
              <Navigation /> Capturar localização
            </Button>
            {pos && (
              <Badge variant="success">
                {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
              </Badge>
            )}
          </div>
          {geoMsg && <p className="text-xs text-muted-foreground">{geoMsg}</p>}

          {ativoHoje ? (
            <div className="flex flex-col gap-3 rounded-lg border border-atencao/30 bg-atencao/[0.08] p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Badge variant="warning">Em expediente</Badge>
                <span>
                  {dataCivil(ativoHoje.data)} · {TURNO_LABEL[ativoHoje.turno] ?? ativoHoje.turno}
                </span>
                {ativoHoje.checkin_dentro === true && <Badge variant="success">Dentro do raio</Badge>}
                {ativoHoje.checkin_dentro === false && <Badge variant="destructive">Fora do raio</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                Check-in: {ativoHoje.checkin_em ? new Date(ativoHoje.checkin_em).toLocaleString('pt-BR') : '-'}
              </div>
              <div>
                <Button onClick={checkout} disabled={processando !== null}>
                  {processando === 'out' ? <Loader2 className="animate-spin" /> : <LogOut />} Check-out
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Textarea
                placeholder="Observação (opcional)"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                className="min-h-[70px]"
              />
              {recusa && recusas < 2 && (
                <div role="alert" className="rounded-controle bg-atencao/[0.08] p-3 text-apoio text-atencao">
                  <p className="font-medium">Check-in não registrado: {recusa}</p>
                  <p className="mt-0.5 text-tinta-apoio">Confira se você já está na unidade e tente de novo, de preferência perto de uma janela ou em área aberta.</p>
                </div>
              )}
              {recusa && recusas >= 2 ? (
                <div className="flex flex-col gap-2 rounded-controle border border-fio bg-campo p-3">
                  <p className="text-apoio font-medium text-tinta">O GPS está com problema?</p>
                  <p className="text-apoio text-tinta-sussurro">
                    Duas tentativas deram “{recusa}”. Se você está na unidade e o GPS está errado, registre o check-in com uma justificativa. Ela fica visível para o gestor.
                  </p>
                  <Textarea
                    placeholder="Ex.: o GPS do celular está marcando outro bairro"
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    className="min-h-[70px]"
                    aria-label="Justificativa do check-in"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => checkin(true)} disabled={processando !== null || justificativa.trim().length < 10}>
                      {processando === 'in' ? <Loader2 className="animate-spin" /> : <LogIn />} Registrar com justificativa
                    </Button>
                    <Button variant="outline" onClick={() => checkin(false)} disabled={processando !== null}>
                      Tentar de novo
                    </Button>
                  </div>
                  {justificativa.trim().length > 0 && justificativa.trim().length < 10 && (
                    <p className="text-rotulo text-tinta-sussurro">Escreva pelo menos 10 caracteres.</p>
                  )}
                </div>
              ) : (
                <div>
                  <Button onClick={() => checkin(false)} disabled={processando !== null}>
                    {processando === 'in' ? <Loader2 className="animate-spin" /> : <LogIn />} {recusa ? 'Tentar de novo' : 'Check-in agora'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registros recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-20 items-center justify-center">
              <Spinner />
            </div>
          ) : (presencas ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro de presença ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(presencas ?? []).map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {dataCivil(p.data)} · {TURNO_LABEL[p.turno] ?? p.turno}
                    </span>
                    {p.checkin_dentro === false && <Badge variant="destructive">Fora do raio</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.checkin_em ? new Date(p.checkin_em).toLocaleTimeString('pt-BR') : '-'} →{' '}
                    {p.checkout_em ? new Date(p.checkout_em).toLocaleTimeString('pt-BR') : 'em andamento'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
