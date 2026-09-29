import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'

// O sinal da rede (P/index.html ~33512, fita cinza sob a topbar). Um monitor
// que mostra número sem dizer de quando ele é está mentindo: no hospital o
// wi-fi cai no corredor e a tela fica exibindo a leitura de meia hora atrás
// com a mesma confiança da de agora. Três estados além de "conectado":
//   · sem sinal — navegador offline;
//   · dado velho — online, mas as leituras falham há mais de 2 minutos;
//   · atualizando — a pessoa pediu "Tentar de novo" e a busca está correndo.
// A falta de sinal é cinza, não âmbar: não é alarme clínico, é ausência.

export type Sinal =
  | { estado: 'conectado' }
  | { estado: 'atualizando' }
  | { estado: 'sem-sinal'; desde: Date; ultimaLeitura: Date | null; tentativa: string | null }
  | { estado: 'dado-velho'; idadeMin: number }

export const hm = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

const LEITURA_MIN_MS = 15_000

export function useSinal() {
  const qc = useQueryClient()
  const [online, setOnline] = useState(() => navigator.onLine)
  const [desde, setDesde] = useState<Date | null>(() => (navigator.onLine ? null : new Date()))
  const [atualizando, setAtualizando] = useState(false)
  const [tentativa, setTentativa] = useState<string | null>(null)
  const [agora, setAgora] = useState(() => Date.now())
  const [ultimaLeitura, setUltimaLeitura] = useState<number | null>(null)
  const [primeiraFalha, setPrimeiraFalha] = useState<number | null>(null)

  // Quando chega leitura boa, e desde quando as leituras falham. A hora da
  // leitura só é regravada a cada 15 s: o estado não precisa de mais precisão
  // e a casca não re-renderiza a cada consulta.
  useEffect(() => {
    const cache = qc.getQueryCache()
    return cache.subscribe((ev) => {
      if (ev.type !== 'updated') return
      if (ev.action.type === 'success') {
        const t = ev.query.state.dataUpdatedAt || Date.now()
        setUltimaLeitura((u) => (u === null || t - u > LEITURA_MIN_MS ? t : u))
        setPrimeiraFalha(null)
      } else if (ev.action.type === 'error') {
        setPrimeiraFalha((f) => f ?? Date.now())
      }
    })
  }, [qc])

  useEffect(() => {
    const on = () => {
      setOnline(true)
      setDesde(null)
      setTentativa(null)
    }
    const off = () => {
      setOnline(false)
      setDesde(new Date())
    }
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    const t = window.setInterval(() => setAgora(Date.now()), 30_000)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      window.clearInterval(t)
    }
  }, [])

  const tentar = useCallback(async () => {
    setAtualizando(true)
    try {
      await qc.refetchQueries({ type: 'active' })
    } finally {
      setAtualizando(false)
      if (!navigator.onLine) setTentativa(hm(new Date()))
    }
  }, [qc])

  let sinal: Sinal = { estado: 'conectado' }
  if (atualizando) sinal = { estado: 'atualizando' }
  else if (!online) {
    sinal = { estado: 'sem-sinal', desde: desde ?? new Date(agora), ultimaLeitura: ultimaLeitura ? new Date(ultimaLeitura) : null, tentativa }
  } else if (primeiraFalha !== null && agora - primeiraFalha > 120_000 && ultimaLeitura !== null) {
    sinal = { estado: 'dado-velho', idadeMin: Math.max(1, Math.round((agora - ultimaLeitura) / 60_000)) }
  }

  return { sinal, tentar }
}
