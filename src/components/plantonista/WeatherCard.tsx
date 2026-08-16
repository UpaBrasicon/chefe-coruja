import { useQuery } from '@tanstack/react-query'
import { Cloud, Droplets, Gauge, Loader2, Thermometer, Wind } from 'lucide-react'

type IpInfo = { cidade: string; regiao: string; lat: number; lon: number }
type Clima = { temperatura: number; umidade: number; vento: number; codigo: number; descricao: string }

async function localizarPorIp(): Promise<IpInfo> {
  const r = await fetch('https://ipwho.is/')
  if (!r.ok) throw new Error('IP falhou')
  const j = await r.json()
  if (!j.success || !j.latitude || !j.longitude) throw new Error('IP sem dados')
  const nomeCidade = j.city && j.city !== 'Unknown' ? j.city : j.region || 'Sua cidade'
  return { cidade: String(nomeCidade), regiao: String(j.region_code ?? ''), lat: j.latitude, lon: j.longitude }
}

const CODIGO_CLIMA: Record<number, string> = {
  0: 'Céu limpo',
  1: 'Parcialmente nublado',
  2: 'Nublado',
  3: 'Encoberto',
  45: 'Nevoeiro',
  48: 'Nevoeiro com gelo',
  51: 'Garoa leve',
  53: 'Garoa',
  55: 'Garoa forte',
  61: 'Chuva leve',
  63: 'Chuva',
  65: 'Chuva forte',
  71: 'Neve leve',
  73: 'Neve',
  75: 'Neve forte',
  80: 'Pancadas de chuva',
  81: 'Pancadas de chuva forte',
  82: 'Pancadas violentas',
  95: 'Tempestade',
}

async function buscarClima(lat: number, lon: number): Promise<Clima> {
  const u = new URL('https://api.open-meteo.com/v1/forecast')
  u.searchParams.set('latitude', String(lat))
  u.searchParams.set('longitude', String(lon))
  u.searchParams.set('current', 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code')
  u.searchParams.set('timezone', 'auto')
  const r = await fetch(u.toString())
  if (!r.ok) throw new Error('Clima falhou')
  const j = await r.json()
  const c = j.current
  return {
    temperatura: Math.round(c.temperature_2m),
    umidade: Math.round(c.relative_humidity_2m),
    vento: Math.round(c.wind_speed_10m),
    codigo: c.weather_code,
    descricao: CODIGO_CLIMA[c.weather_code] ?? '—',
  }
}

async function buscarQualidadeAr(lat: number, lon: number): Promise<number> {
  const u = new URL('https://air-quality-api.open-meteo.com/v1/air-quality')
  u.searchParams.set('latitude', String(lat))
  u.searchParams.set('longitude', String(lon))
  u.searchParams.set('current', 'us_aqi')
  const r = await fetch(u.toString())
  if (!r.ok) throw new Error('AQI falhou')
  const j = await r.json()
  const aqi = j.current?.us_aqi
  return typeof aqi === 'number' ? Math.round(aqi) : 0
}

function rotuloAQI(aqi: number) {
  if (aqi <= 50) return 'Boa'
  if (aqi <= 100) return 'Moderada'
  if (aqi <= 150) return 'Sensível'
  if (aqi <= 200) return 'Ruim'
  return 'Muito ruim'
}

export function WeatherCard() {
  const { data: ip, isLoading: ipLoading } = useQuery({
    queryKey: ['ip-localizacao'],
    queryFn: localizarPorIp,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })

  const { data: clima, isLoading: climaLoading } = useQuery({
    queryKey: ['clima', ip?.lat, ip?.lon],
    enabled: !!ip,
    queryFn: () => buscarClima(ip!.lat, ip!.lon),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

  const { data: aqi } = useQuery({
    queryKey: ['aqi', ip?.lat, ip?.lon],
    enabled: !!ip,
    queryFn: () => buscarQualidadeAr(ip!.lat, ip!.lon),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

  const carregando = ipLoading || (ip ? climaLoading : false)

  if (carregando) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-3xl bg-card">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!ip || !clima) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-3xl bg-card px-6 text-center text-sm text-muted-foreground">
        Não foi possível identificar sua localização.
      </div>
    )
  }

  return (
    <div className="group relative h-full w-full">
      {/* Camada traseira (expande no hover) */}
      <div className="absolute inset-0 rounded-3xl bg-white shadow-sm transition-all duration-400 ease-in-out group-hover:-translate-y-1.5">
        <div className="flex h-full items-end justify-center pb-4">
          <div className="grid w-full grid-cols-3 gap-1 px-4 text-center">
            <div className="flex flex-col items-center gap-0.5">
              <Droplets className="size-4 text-sky-500" />
              <span className="text-sm font-bold">{clima.umidade}%</span>
              <span className="text-[10px] text-muted-foreground">Umidade</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Gauge className="size-4 text-emerald-600" />
              <span className="text-sm font-bold">{aqi ?? '—'}</span>
              <span className="text-[10px] text-muted-foreground">{aqi ? rotuloAQI(aqi) : 'AQI'}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Thermometer className="size-4 text-orange-500" />
              <span className="text-sm font-bold">{clima.temperatura}°</span>
              <span className="text-[10px] text-muted-foreground">Sensação</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card principal */}
      <div className="absolute inset-x-2 bottom-2 top-2 flex flex-col justify-between rounded-2xl bg-white px-5 py-4 shadow-md transition-colors duration-300 group-hover:bg-[#FFE87C]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-foreground">
              {ip.cidade}
              {ip.regiao ? `, ${ip.regiao}` : ''}
            </div>
            <div className="text-[11px] text-muted-foreground">{clima.descricao}</div>
          </div>
          <Cloud className="size-8 shrink-0 text-sky-500" />
        </div>

        <div className="flex items-end justify-between gap-2">
          <div className="text-4xl leading-none font-extrabold text-foreground">{clima.temperatura}°C</div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Wind className="size-3.5" /> {clima.vento} km/h
          </div>
        </div>
      </div>

      {/* Rodapé verde */}
      <div className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-b-2xl bg-lime-500 px-5 py-1 text-[11px] font-bold text-white transition-colors duration-300 group-hover:bg-lime-600">
        Clima agora · {ip.cidade}
      </div>
    </div>
  )
}
