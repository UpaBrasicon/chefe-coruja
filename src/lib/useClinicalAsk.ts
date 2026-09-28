import { useCallback, useEffect, useRef, useState } from 'react'

import { supabase } from '@/lib/supabase'

// "Perguntar à IA" da Central: chama a Edge Function clinical-search (que
// confere o vínculo com a unidade, mascara dados e repassa o stream NDJSON da
// biblioteca no VPS). Nada da pergunta ou da resposta vai para localStorage.

export type Fonte = {
  n: number
  titulo: string
  editor: string
  ano: number
  secao: string
  pagina: number | null
  /** citação da ficha (corpus da Central): fonte com página */
  ref?: string | null
  url?: string | null
}

export type ToolHit = { id: string; nome: string; tipo: string; categoria: string; rota: string; score: number }

export type StatusIa = 'idle' | 'loading' | 'streaming' | 'done' | 'blocked' | 'error' | 'limite' | 'indisponivel'

type Evento =
  | { type: 'meta'; request_id: string; gate: boolean; ferramentas: ToolHit[]; fontes: Fonte[] }
  | { type: 'delta'; text: string }
  | { type: 'done'; citacoes_invalidas?: number[]; sem_citacao?: boolean }
  | { type: 'error'; text: string }

const URL_FUNCAO = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clinical-search`

async function cabecalhos() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    Authorization: `Bearer ${session?.access_token ?? ''}`,
    'Content-Type': 'application/json',
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  }
}

export type ResultadoBusca = { ferramentas: ToolHit[]; trechos: (Fonte & { preview: string })[] }

/** Busca semântica (sem IA gerando texto): sugere ferramentas por significado. */
export async function buscarSemantico(q: string, unidadeId: string, signal?: AbortSignal): Promise<ResultadoBusca | null> {
  try {
    const res = await fetch(URL_FUNCAO, {
      method: 'POST',
      headers: await cabecalhos(),
      body: JSON.stringify({ q, mode: 'search', unidade_id: unidadeId }),
      signal,
    })
    if (!res.ok) return null
    return (await res.json()) as ResultadoBusca
  } catch {
    return null
  }
}

export function useClinicalAsk(unidadeId?: string) {
  const [pergunta, setPergunta] = useState('')
  const [texto, setTexto] = useState('')
  const [fontes, setFontes] = useState<Fonte[]>([])
  const [ferramentas, setFerramentas] = useState<ToolHit[]>([])
  const [status, setStatus] = useState<StatusIa>('idle')
  const [alerta, setAlerta] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const controle = useRef<AbortController | null>(null)

  useEffect(() => () => controle.current?.abort(), [])

  const limpar = useCallback(() => {
    controle.current?.abort()
    setPergunta(''); setTexto(''); setFontes([]); setFerramentas([]); setAlerta(null); setRequestId(null)
    setStatus('idle')
  }, [])

  const ask = useCallback(async (q: string) => {
    if (!unidadeId) { setStatus('error'); return }
    controle.current?.abort()
    const ac = new AbortController()
    controle.current = ac
    setPergunta(q); setTexto(''); setFontes([]); setFerramentas([]); setAlerta(null); setRequestId(null)
    setStatus('loading')
    let res: Response
    try {
      res = await fetch(URL_FUNCAO, {
        method: 'POST',
        headers: await cabecalhos(),
        body: JSON.stringify({ q, mode: 'ask', unidade_id: unidadeId }),
        signal: ac.signal,
      })
    } catch {
      if (!ac.signal.aborted) setStatus('indisponivel')
      return
    }
    if (res.status === 429) { setStatus('limite'); return }
    if (res.status === 503) { setStatus('indisponivel'); return }
    if (!res.ok || !res.body) { setStatus('error'); return }
    setRequestId(res.headers.get('X-Request-Id'))
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    let bloqueado = false
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const linhas = buf.split('\n')
        buf = linhas.pop() ?? ''
        for (const l of linhas) {
          if (!l.trim()) continue
          let ev: Evento
          try { ev = JSON.parse(l) as Evento } catch { continue }
          if (ev.type === 'meta') {
            setRequestId((r) => r ?? ev.request_id)
            setFontes(ev.fontes ?? [])
            setFerramentas(ev.ferramentas ?? [])
            bloqueado = !ev.gate
            setStatus(ev.gate ? 'streaming' : 'blocked')
          } else if (ev.type === 'delta') {
            if (!bloqueado) setTexto((t) => t + ev.text)
          } else if (ev.type === 'error') {
            setStatus('indisponivel')
          } else if (ev.type === 'done') {
            if (ev.sem_citacao || ev.citacoes_invalidas?.length) setAlerta('Resposta com citação incompleta — confira as fontes.')
            if (!bloqueado) setStatus('done')
          }
        }
      }
    } catch {
      if (!ac.signal.aborted) setStatus('error')
    }
  }, [unidadeId])

  return { ask, limpar, pergunta, texto, fontes, ferramentas, status, alerta, requestId }
}
