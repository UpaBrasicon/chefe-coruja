import { useQuery } from '@tanstack/react-query'
import { Loader2, LogIn, LogOut, MapPin, Navigation } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

const TURNO_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

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

  const ativoHoje = React.useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10)
    return (presencas ?? []).find((p) => p.data === hoje && p.checkin_em && !p.checkout_em)
  }, [presencas])

  function obterPosicao(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocalização não suportada neste navegador.'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        (e) => reject(new Error(e.message ?? 'Não foi possível obter sua localização.'))
      )
    })
  }

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

  async function checkin() {
    if (!unidadeId) return
    setProcessando('in')
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
      const { data, error } = await supabase.rpc('registrar_checkin', {
        p_unidade: unidadeId,
        p_lat: lat ?? 0,
        p_lng: lng ?? 0,
        p_observacao: obs || undefined,
      })
      if (error) throw error
      setSucesso('Check-in realizado com sucesso.')
      setObs('')
      void refetch()
      if (typeof data === 'string') void data
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
        p_lat: lat ?? 0,
        p_lng: lng ?? 0,
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
          <h1 className="text-2xl font-semibold tracking-tight">Meu Plantão</h1>
          <p className="text-sm text-muted-foreground">
            Registre sua entrada (check-in) e saída (check-out) com geolocalização.
          </p>
        </div>
      )}

      {erro && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      {sucesso && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{sucesso}</div>}

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
            <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Badge variant="warning">Em expediente</Badge>
                <span>
                  {new Date(ativoHoje.data).toLocaleDateString('pt-BR')} · {TURNO_LABEL[ativoHoje.turno] ?? ativoHoje.turno}
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
              <div>
                <Button onClick={checkin} disabled={processando !== null}>
                  {processando === 'in' ? <Loader2 className="animate-spin" /> : <LogIn />} Check-in agora
                </Button>
              </div>
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
                      {new Date(p.data).toLocaleDateString('pt-BR')} · {TURNO_LABEL[p.turno] ?? p.turno}
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
