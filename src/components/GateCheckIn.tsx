import { useQuery } from '@tanstack/react-query'
import { Loader2, LogIn, LogOut, MapPin, Navigation } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

/**
 * GATE DE CHECK-IN OBRIGATÓRIO (regra de ouro).
 *
 * Renderizado pelo AppShell para plantonista que ESTÁ de plantão (relógio do
 * servidor — na_escala_agora ou tem_acesso_atendimento) mas ainda NÃO fez
 * check-in hoje. Bloqueia a progressão com um overlay escuro full-screen
 * (mesma linguagem do drawer de chat, mas modal e intransponível), mostra o
 * mapa da unidade + posição do plantonista, e só libera o sistema após o
 * check-in. Quem NÃO está de plantão cai no ForaDoExpediente (não chega aqui).
 *
 * O check-in em si é feito pelo RPC registrar_checkin (server-side), que
 * revalida a escala e calcula se está dentro do raio configurado pelo gestor.
 */
type PresencaRow = {
  id: string
  data: string
  turno: string
  checkin_em: string | null
  checkout_em: string | null
  checkin_dentro: boolean | null
  observacao: string | null
}

export function GateCheckIn() {
  const { unidadeAtiva } = useUnidade()
  const { perfil, signOut } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id

  const [entrando, setEntrando] = React.useState(true) // animação de entrada
  const [visivel, setVisivel] = React.useState(false) // controla fade/scale
  const [pos, setPos] = React.useState<{ lat: number; lng: number } | null>(null)
  const [geoMsg, setGeoMsg] = React.useState<string | null>(null)
  const [processando, setProcessando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const [relogio, setRelogio] = React.useState(new Date())

  // Relógio em tempo real (o gate mostra a hora do check-in)
  React.useEffect(() => {
    const t = setInterval(() => setRelogio(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Animação de entrada: fade + scale suave
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setVisivel(true))
    const timer = setTimeout(() => setEntrando(false), 450)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [])

  const { data: unidade } = useQuery({
    queryKey: ['unidade-geo-gate', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unidades')
        .select('latitude, longitude, raio_metros, nome')
        .eq('id', unidadeId!)
        .single()
      if (error) throw error
      return data as { latitude: number | null; longitude: number | null; raio_metros: number; nome: string }
    },
  })

  // Presença ATIVA (o gate some quando há check-in sem checkout).
  // Sem filtro de data: usa o relógio do servidor via registrar_checkin
  // (ON CONFLICT por dia/turno), então o "ativo" é o registro mais recente
  // com check-in e sem check-out — robusto a fuso do navegador.
  const { data: presencaHoje, refetch } = useQuery({
    queryKey: ['gate-checkin-ativo', unidadeId, perfil?.id],
    enabled: !!unidadeId && !!perfil,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('presenca_plantonista')
        .select('id, data, turno, checkin_em, checkout_em, checkin_dentro, observacao')
        .eq('unidade_id', unidadeId!)
        .eq('perfil_id', perfil!.id)
        .order('checkin_em', { ascending: false })
        .maybeSingle()
      if (error) throw error
      return data as PresencaRow | null
    },
    refetchInterval: 15_000,
  })

  const ativo: PresencaRow | null =
    presencaHoje && presencaHoje.checkin_em && !presencaHoje.checkout_em ? presencaHoje : null

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

  async function fazerCheckin() {
    if (!unidadeId) return
    setProcessando(true)
    setErro(null)
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
      const { error } = await supabase.rpc('registrar_checkin', {
        p_unidade: unidadeId,
        p_lat: lat ?? 0,
        p_lng: lng ?? 0,
        p_observacao: undefined,
      })
      if (error) throw error
      void refetch()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setProcessando(false)
    }
  }

  async function fazerCheckout() {
    if (!unidadeId || !ativo) return
    setProcessando(true)
    setErro(null)
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
        p_registro: ativo.id,
        p_lat: lat ?? 0,
        p_lng: lng ?? 0,
      })
      if (error) throw error
      void refetch()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setProcessando(false)
    }
  }

  async function sair() {
    await signOut()
    window.location.href = '/login'
  }

  // Mapa OSM: centro = unidade (se configurada) senão posição do plantonista.
  const latMapa = unidade?.latitude ?? pos?.lat
  const lngMapa = unidade?.longitude ?? pos?.lng
  const marcador = pos ? `&markers=${pos.lat.toFixed(5)},${pos.lng.toFixed(5)},label:P` : ''
  const mapaUrl = latMapa != null && lngMapa != null
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${(lngMapa - 0.008).toFixed(5)}%2C${(latMapa - 0.005).toFixed(5)}%2C${(lngMapa + 0.008).toFixed(5)}%2C${(latMapa + 0.005).toFixed(5)}&layer=mapnik&marker=${latMapa.toFixed(5)}%2C${lngMapa.toFixed(5)}${marcador}`
    : null

  const horaBrasil = relogio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dataBrasil = relogio.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md transition-opacity duration-300"
      style={{ opacity: visivel ? 1 : 0 }}
    >
      <div
        className={`w-full max-w-2xl ${entrando ? 'scale-95' : 'scale-100'} transition-all duration-300 ease-out`}
      >
        {/* Cabeçalho — quem está fazendo check-in */}
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-white backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
              <MapPin className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{unidade?.nome ?? unidadeAtiva?.unidade.nome}</p>
              <p className="truncate text-xs text-white/70">
                {dataBrasil} · <span className="font-mono">{horaBrasil}</span>
              </p>
            </div>
          </div>
          <button
            onClick={sair}
            className="rounded-lg px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Sair
          </button>
        </div>

        {/* Card principal */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-card shadow-2xl">
          {/* Mapa */}
          <div className="relative h-56 w-full bg-muted">
            {mapaUrl ? (
              <iframe
                title="Mapa da unidade"
                src={mapaUrl}
                className="h-full w-full border-0"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Navigation className="mr-2 size-4" />
                Unidade sem geolocalização configurada
              </div>
            )}
            {pos && (
              <div className="absolute bottom-3 left-3 rounded-lg bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur">
                Sua posição: {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
              </div>
            )}
            {unidade?.latitude != null && (
              <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur">
                Raio da unidade: {unidade.raio_metros}m
              </div>
            )}
          </div>

          {/* Corpo */}
          <div className="flex flex-col gap-4 p-6">
            {erro && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>
            )}

            {ativo ? (
              <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success">Em expediente</Badge>
                  {ativo.checkin_dentro === true && <Badge variant="success">Dentro do raio</Badge>}
                  {ativo.checkin_dentro === false && <Badge variant="destructive">Fora do raio</Badge>}
                </div>
                <p className="text-sm text-emerald-900">
                  Check-in às{' '}
                  <span className="font-mono font-semibold">
                    {ativo.checkin_em ? new Date(ativo.checkin_em).toLocaleTimeString('pt-BR') : '-'}
                  </span>
                  . Você já pode acessar o sistema.
                </p>
                <div>
                  <Button variant="outline" onClick={fazerCheckout} disabled={processando}>
                    {processando ? <Loader2 className="animate-spin" /> : <LogOut />} Check-out
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Faça seu check-in</h2>
                  <p className="text-sm text-muted-foreground">
                    Confirme sua presença no plantão de hoje. O sistema registra o horário exato e valida
                    sua localização contra o raio configurado pela unidade.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={localizar} disabled={processando}>
                    <Navigation /> Capturar localização
                  </Button>
                  {pos && <Badge variant="success">{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</Badge>}
                </div>
                {geoMsg && <p className="text-xs text-muted-foreground">{geoMsg}</p>}

                <Button size="lg" className="w-full" onClick={fazerCheckin} disabled={processando}>
                  {processando ? <Loader2 className="animate-spin" /> : <LogIn />} Fazer check-in agora
                </Button>
              </div>
            )}
          </div>
        </div>

        {!ativo && (
          <p className="mt-4 text-center text-xs text-white/60">
            {pos ? 'Sua localização será registrada junto ao check-in.' : 'Dica: capture sua localização para validar o raio da unidade.'}
          </p>
        )}
      </div>

      {/* Bloqueio total do fundo — nada abaixo é clicável */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
    </div>
  )
}
