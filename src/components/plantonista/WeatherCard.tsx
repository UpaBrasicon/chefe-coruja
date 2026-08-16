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
  u.searchParams.set('current', 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code')
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

const WEATHER_CSS = `
.wx-card {
  position: relative;
  height: 100%;
  width: 100%;
  padding: 20px;
  background:
    radial-gradient(178.94% 106.41% at 26.42% 106.41%, #FFF7B1 0%, rgba(255,255,255,0) 71.88%),
    #ffffff;
  box-shadow:
    0px 155px 62px rgba(0,0,0,0.01),
    0px 87px 52px rgba(0,0,0,0.05),
    0px 39px 39px rgba(0,0,0,0.09),
    0px 10px 21px rgba(0,0,0,0.1),
    0px 0px 0px rgba(0,0,0,0.1);
  border-radius: 23px;
  transition: all 0.8s cubic-bezier(0.15, 0.83, 0.66, 1);
  overflow: hidden;
}
.wx-card:hover { transform: scale(1.02); }
.wx-sky {
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: 23px;
  overflow: hidden;
}
.wx-sky svg { width: 100%; height: 100%; display: block; }
.wx-body {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.wx-header span:first-child {
  display: block;
  font-weight: 800;
  font-size: 15px;
  line-height: 135%;
  color: rgba(87,77,51,0.8);
  text-shadow: 0 0 8px rgba(255,255,255,0.7);
}
.wx-header span:last-child {
  display: block;
  font-weight: 700;
  font-size: 15px;
  line-height: 135%;
  color: rgba(87,77,51,0.5);
  text-shadow: 0 0 8px rgba(255,255,255,0.7);
}
.wx-temp {
  font-weight: 700;
  font-size: 64px;
  line-height: 77px;
  color: rgba(87,77,51,1);
  text-shadow: 0 0 10px rgba(255,255,255,0.8);
}
.wx-temp-scale {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(0,0,0,0.06);
  border-radius: 9px;
  padding: 7px 10px;
}
.wx-temp-scale span {
  font-weight: 700;
  font-size: 12px;
  line-height: 134.49%;
  color: rgba(87,77,51,0.7);
}
.wx-bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
}
.wx-temp-wrap { display: flex; align-items: flex-end; gap: 10px; }
.wx-sun {
  position: absolute;
  top: 8px;
  right: 16px;
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: linear-gradient(to right, #fcbb04, #fffc00);
  box-shadow: 0 0 40px 10px rgba(252, 187, 4, 0.55);
  z-index: 3;
}
.wx-sunshine {
  animation: wx-sunshines 2s infinite;
}
@keyframes wx-sunshines {
  0% { transform: scale(1); opacity: 0.5; }
  100% { transform: scale(1.5); opacity: 0; }
}
.wx-moon {
  position: absolute;
  top: 14px;
  right: 22px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffffff, #dfe4ff);
  box-shadow: 0 0 30px 8px rgba(220, 226, 255, 0.6);
  z-index: 3;
}
.wx-cloud {
  position: absolute;
  z-index: 3;
  animation: wx-clouds 8s ease-in-out infinite;
}
.wx-cloud-front { top: 34px; left: 4px; animation-duration: 8s; }
.wx-cloud-back { top: 70px; right: 8px; animation-duration: 12s; }
@keyframes wx-clouds {
  0% { transform: translateX(10px); }
  50% { transform: translateX(0px); }
  100% { transform: translateX(10px); }
}
.wx-cloud span { display: inline-block; background-color: #4c9beb; }
.wx-cloud .c1 { width: 45px; height: 45px; border-radius: 50% 50% 50% 0%; }
.wx-cloud .c2 { width: 65px; height: 65px; border-radius: 50% 50% 0% 50%; }
.wx-cloud .c3 { width: 50px; height: 50px; border-radius: 50% 50% 50% 0%; margin-left: -20px; }
.wx-cloud .c4 { width: 30px; height: 30px; border-radius: 50% 50% 0% 50%; }
.wx-metrics {
  position: relative;
  z-index: 4;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.wx-metrics span {
  font-weight: 700;
  font-size: 11px;
  color: rgba(87,77,51,0.75);
  background: rgba(255,255,255,0.65);
  padding: 3px 8px;
  border-radius: 20px;
}
`

// ── Cenário de fundo (céu conforme o clima) ─────────────────────────────────
function CéuSVG({ clima }: { clima: Clima }) {
  const hora = horaLocal(clima.utcOffset)
  const dia = hora >= clima.nascerSol && hora <= clima.porSol

  const tempestade = clima.codigo >= 95
  const chuva = [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(clima.codigo)
  const neve = [71, 73, 75, 77].includes(clima.codigo)
  const nevoeiro = [45, 48].includes(clima.codigo)
  const nublado = clima.codigo >= 1 && clima.codigo <= 3

  const topo = dia ? (nublado ? '#9fc3ea' : '#7ec8f5') : '#0f1f42'
  const baixo = dia ? (nublado ? '#d7e4f0' : '#cfe9ff') : '#22305e'

  return (
    <svg viewBox="0 0 400 235" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="wxceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={topo} />
          <stop offset="100%" stopColor={baixo} />
        </linearGradient>
      </defs>
      <rect width="400" height="235" fill="url(#wxceu)" />
      {nublado && (
        <g fill="#eef2f6" opacity="0.85">
          <ellipse cx="90" cy="60" rx="50" ry="16" />
          <ellipse cx="140" cy="52" rx="36" ry="13" />
          <ellipse cx="300" cy="80" rx="58" ry="17" />
        </g>
      )}
      {tempestade && (
        <g>
          <g fill="#4a4f63">
            <ellipse cx="120" cy="70" rx="58" ry="19" />
            <ellipse cx="165" cy="62" rx="40" ry="15" />
          </g>
          <polygon points="205,80 190,110 202,110 193,132 218,100 206,100 214,80" fill="#ffd94a" />
        </g>
      )}
      {(chuva || neve) &&
        Array.from({ length: 16 }, (_, i) => {
          const x = (i * 27 + 12) % 400
          const y = 90 + ((i * 41) % 70)
          return neve ? (
            <circle key={i} cx={x} cy={y} r="2.6" fill="#fff" opacity="0.9" />
          ) : (
            <line key={i} x1={x} y1={y} x2={x - 2} y2={y + 9} stroke="#bcd7ff" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
          )
        })}
      {nevoeiro && (
        <g fill="#e7eef7" opacity="0.7">
          <rect x="0" y="80" width="400" height="7" rx="3" />
          <rect x="10" y="98" width="380" height="7" rx="3" />
          <rect x="0" y="116" width="400" height="7" rx="3" />
        </g>
      )}
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

  const hora = horaLocal(clima.utcOffset)
  const dia = hora >= clima.nascerSol && hora <= clima.porSol

  return (
    <div className="h-full w-full">
      <style>{WEATHER_CSS}</style>
      <div className="wx-card">
        {/* Céu conforme o clima */}
        <div className="wx-sky">
          <CéuSVG clima={clima} />
        </div>

        {/* Sol / Lua */}
        {dia ? (
          <div className="wx-sun">
            <div className="wx-sunshine" style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'radial-gradient(circle, #fff8b0, transparent 70%)' }} />
          </div>
        ) : (
          <div className="wx-moon" />
        )}

        {/* Nuvens */}
        <div className="wx-cloud wx-cloud-front">
          <span className="c1" />
          <span className="c2" style={{ marginLeft: '-14px' }} />
        </div>
        <div className="wx-cloud wx-cloud-back">
          <span className="c3" />
          <span className="c4" />
        </div>

        {/* Conteúdo */}
        <div className="wx-body">
          <div className="wx-header">
            <span>
              {ip.cidade}
              {ip.regiao ? `, ${ip.regiao}` : ''}
            </span>
            <span>
              {dia ? '☀️ Dia' : '🌙 Noite'} · {clima.descricao}
            </span>
          </div>

          <div className="wx-bottom">
            <div className="wx-temp-wrap">
              <div className="wx-temp">{clima.temperatura}°</div>
              <div className="wx-temp-scale">
                <span>💧 {clima.umidade}%</span>
                <span>🌫️ AQI {aqi ?? '—'}</span>
                <span>🌬️ {clima.vento} km/h</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
