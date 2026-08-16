import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

type IpInfo = { cidade: string; regiao: string; lat: number; lon: number }
type Clima = {
  temperatura: number
  umidade: number
  vento: number
  codigo: number
  descricao: string
  nascerSol: number
  porSol: number
  utcOffset: number
}

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
  u.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code'
  )
  u.searchParams.set('daily', 'sunrise,sunset')
  u.searchParams.set('timezone', 'auto')
  const r = await fetch(u.toString())
  if (!r.ok) throw new Error('Clima falhou')
  const j = await r.json()
  const c = j.current
  const toHora = (s: string) => {
    const h = new Date(s)
    return h.getHours() + h.getMinutes() / 60
  }
  return {
    temperatura: Math.round(c.temperature_2m),
    umidade: Math.round(c.relative_humidity_2m),
    vento: Math.round(c.wind_speed_10m),
    codigo: c.weather_code,
    descricao: CODIGO_CLIMA[c.weather_code] ?? '—',
    nascerSol: toHora(j.daily?.sunrise?.[0] ?? ''),
    porSol: toHora(j.daily?.sunset?.[0] ?? ''),
    utcOffset: j.utc_offset_seconds ?? 0,
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

function horaLocal(offset: number) {
  const agora = new Date(Date.now() + offset * 1000)
  return agora.getUTCHours() + agora.getUTCMinutes() / 60
}

// ── Cenário SVG: sol/lua em arco + céu conforme clima ────────────────────────
function Cenário({
  clima,
  offset,
}: {
  clima: Clima
  offset: number
}) {
  const hora = horaLocal(offset)
  const nascer = clima.nascerSol
  const por = clima.porSol
  const dia = hora >= nascer && hora <= por

  const durDia = Math.max(1, por - nascer)
  const durNoite = Math.max(1, 24 - (por - nascer))
  const progDia = Math.min(1, Math.max(0, (hora - nascer) / durDia))
  const progNoite = Math.min(1, Math.max(0, (hora - por) / durNoite))

  // Arco: y = horizonteY - sen(prog·π)·amplitude ; x da esquerda→direita no dia
  const W = 400
  const H = 130
  const horizonteY = 104
  const amp = 62
  const solX = W * progDia
  const solY = horizonteY - Math.sin(progDia * Math.PI) * amp
  // Lua percorre o arco do lado direito para o esquerdo durante a noite
  const luaX = W * (1 - progNoite)
  const luaY = horizonteY - Math.sin(progNoite * Math.PI) * amp

  const tempestade = clima.codigo >= 95
  const chuva = [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(clima.codigo)
  const garoa = [51, 53, 55].includes(clima.codigo)
  const neve = [71, 73, 75, 77].includes(clima.codigo)
  const nevoeiro = [45, 48].includes(clima.codigo)
  const nublado = clima.codigo >= 1 && clima.codigo <= 3
  const limpo = clima.codigo === 0

  const topo = dia ? '#3f8ef7' : '#0b1a3a'
  const meio = dia ? (nublado ? '#8fb9e8' : '#7ec8f5') : '#1b2a55'
  const baixo = dia ? (nublado ? '#c9d8e8' : '#bfe0ff') : '#2a2a5a'

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={topo} />
          <stop offset="55%" stopColor={meio} />
          <stop offset="100%" stopColor={baixo} />
        </linearGradient>
        <radialGradient id="solBrilho" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff8d0" />
          <stop offset="40%" stopColor="#ffe066" />
          <stop offset="100%" stopColor="rgba(255,224,102,0)" />
        </radialGradient>
        <radialGradient id="luaBrilho" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#e8ecff" />
          <stop offset="100%" stopColor="rgba(232,236,255,0)" />
        </radialGradient>
        <filter id="suave"><feGaussianBlur stdDeviation="1.5" /></filter>
      </defs>

      <rect width={W} height={H} fill="url(#ceu)" />

      {/* Estrelas (noite) */}
      {!dia &&
        [
          [40, 18], [90, 34], [150, 12], [210, 40], [260, 16],
          [320, 30], [370, 12], [120, 52], [350, 48], [55, 44],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.4" fill="#fff" opacity="0.8" />
        ))}

      {/* Sol / Lua no arco */}
      {dia ? (
        <>
          <circle cx={solX} cy={solY} r="26" fill="url(#solBrilho)" opacity="0.5" />
          <circle cx={solX} cy={solY} r="13" fill="#ffd94a" stroke="#f5b800" strokeWidth="1.5" filter="url(#suave)" />
        </>
      ) : (
        <>
          <circle cx={luaX} cy={luaY} r="24" fill="url(#luaBrilho)" opacity="0.4" />
          <circle cx={luaX} cy={luaY} r="11" fill="#f0f2ff" />
          <circle cx={luaX - 4} cy={luaY - 3} r="2.6" fill="#d8dcf5" />
          <circle cx={luaX + 3} cy={luaY + 4} r="2" fill="#d8dcf5" />
        </>
      )}

      {/* Nuvens */}
      {nublado && (
        <g fill="#eef2f6" opacity="0.9">
          <ellipse cx="90" cy="34" rx="46" ry="15" />
          <ellipse cx="130" cy="28" rx="32" ry="12" />
          <ellipse cx="300" cy="48" rx="52" ry="16" />
          <ellipse cx="345" cy="42" rx="30" ry="11" />
        </g>
      )}
      {limpo && (
        <g fill="#ffffff" opacity="0.85">
          <ellipse cx="310" cy="26" rx="38" ry="11" />
          <ellipse cx="340" cy="22" rx="24" ry="9" />
        </g>
      )}
      {tempestade && (
        <g>
          <g fill="#4a4f63">
            <ellipse cx="120" cy="44" rx="54" ry="18" />
            <ellipse cx="160" cy="38" rx="38" ry="14" />
            <ellipse cx="270" cy="50" rx="60" ry="18" />
          </g>
          <polygon points="205,58 192,84 202,84 194,104 216,76 205,76 213,58" fill="#ffd94a" filter="url(#suave)" />
        </g>
      )}

      {/* Chuva / garoa / neve */}
      {(chuva || neve) &&
        Array.from({ length: 14 }, (_, i) => {
          const x = (i * 31 + 18) % W
          const y = 60 + ((i * 37) % 40)
          const len = garoa ? 6 : 9
          return neve ? (
            <circle key={i} cx={x} cy={y + 14} r="2.4" fill="#fff" opacity="0.9" />
          ) : (
            <line key={i} x1={x} y1={y} x2={x - 2} y2={y + len} stroke="#bcd7ff" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
          )
        })}

      {/* Nevoeiro */}
      {nevoeiro && (
        <g fill="#e7eef7" opacity="0.75">
          <rect x="0" y="52" width={W} height="6" rx="3" />
          <rect x="10" y="66" width={W - 20} height="6" rx="3" />
          <rect x="0" y="80" width={W} height="6" rx="3" />
        </g>
      )}

      {/* Horizonte / chão */}
      <path
        d={`M0,${horizonteY} Q100,${horizonteY - 12} 200,${horizonteY} T400,${horizonteY} L400,${H} L0,${H} Z`}
        fill={dia ? '#3f8f4a' : '#12213a'}
      />
      <path
        d={`M0,${horizonteY} Q100,${horizonteY - 12} 200,${horizonteY} T400,${horizonteY}`}
        fill="none"
        stroke={dia ? '#7fd486' : '#1f3f6b'}
        strokeWidth="2"
      />
    </svg>
  )
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

  // Re-renderiza a cada minuto para o sol/lua acompanharem o horário
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  const carregando = ipLoading || (ip ? climaLoading : false)

  if (carregando) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-3xl bg-card">
        <span className="size-6 animate-pulse rounded-full border-2 border-sky-300 border-t-sky-600" />
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

  const eDia = horaLocal(clima.utcOffset) >= clima.nascerSol && horaLocal(clima.utcOffset) <= clima.porSol

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl shadow-md">
      {/* Cenário SVG ao fundo */}
      <div className="absolute inset-0">
        <Cenário clima={clima} offset={clima.utcOffset} />
      </div>

      {/* Painel de dados (fundo escuro translúcido p/ legibilidade) */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-4 pb-3 pt-10">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-white drop-shadow sm:text-base">
            {ip.cidade}
            {ip.regiao ? `, ${ip.regiao}` : ''}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/90 sm:text-xs">
            {eDia ? '☀️ Dia' : '🌙 Noite'} · {clima.descricao}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <div className="text-5xl leading-none font-extrabold text-white drop-shadow sm:text-6xl">
            {clima.temperatura}°
          </div>
          <div className="text-xs font-semibold text-white/90 sm:text-sm">{clima.descricao}</div>
        </div>
      </div>

      {/* Métricas inferiores */}
      <div className="absolute inset-x-3 bottom-12 flex items-center justify-center gap-4 rounded-xl bg-black/45 px-3 py-1.5 backdrop-blur-sm">
        <div className="flex items-center gap-1 text-[11px] font-bold text-white sm:text-xs">
          <span className="text-sky-300">💧</span> {clima.umidade}%
        </div>
        <div className="flex items-center gap-1 text-[11px] font-bold text-white sm:text-xs">
          <span className="text-emerald-300">🌫️</span> AQI {aqi ?? '—'}
        </div>
        <div className="flex items-center gap-1 text-[11px] font-bold text-white sm:text-xs">
          <span className="text-white/70">🌬️</span> {clima.vento} km/h
        </div>
      </div>
    </div>
  )
}
