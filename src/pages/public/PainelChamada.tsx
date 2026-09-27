import { Bird, Volume2 } from 'lucide-react'
import * as React from 'react'
import { useParams } from 'react-router-dom'

import { supabase } from '@/lib/supabase'

// Painel de chamada da TV (Fase 2.3). Abre SEM login, pelo link da porta que a
// Recepção gera. Mostra só nome (social, se houver), sala e hora — nada de
// prontuário, idade, cor ou queixa. Gerar um link novo derruba este.

type Chamada = { id: string; nome: string; sala: string; em: string }
type Painel = { porta: string; unidade: string; servidor: string; chamadas: Chamada[] }

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

function falar(texto: string) {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(texto)
  u.lang = 'pt-BR'
  u.rate = 0.9
  window.speechSynthesis.speak(u)
}

function bip() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.setValueAtTime(0.25, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.6)
  } catch {
    // sem áudio: segue só com a tela
  }
}

export default function PainelChamada() {
  const { token } = useParams()
  const [painel, setPainel] = React.useState<Painel | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [som, setSom] = React.useState(false)
  const [agora, setAgora] = React.useState(() => new Date())
  const ultima = React.useRef<string | null>(null)
  const somRef = React.useRef(som)
  React.useEffect(() => {
    somRef.current = som
  }, [som])

  React.useEffect(() => {
    document.title = 'Painel de chamada'
    let vivo = true
    async function ler() {
      const { data, error } = await supabase.rpc('painel_chamadas', { p_token: token ?? '' })
      if (!vivo) return
      if (error) {
        setErro(error.message.includes('PAINEL_INVALIDO') ? 'Este link de painel não vale mais. Peça um novo à Recepção.' : 'Sem conexão com o servidor. Tentando de novo…')
        return
      }
      setErro(null)
      const p = data as unknown as Painel
      setPainel(p)
      const nova = p.chamadas[0]
      if (nova && nova.id !== ultima.current) {
        const primeiraLeitura = ultima.current === null
        ultima.current = nova.id
        if (!primeiraLeitura && somRef.current) {
          bip()
          window.setTimeout(() => falar(`${nova.nome}. ${nova.sala}.`), 700)
        }
      }
    }
    void ler()
    const t = window.setInterval(() => void ler(), 3000)
    const r = window.setInterval(() => setAgora(new Date()), 15_000)
    return () => {
      vivo = false
      window.clearInterval(t)
      window.clearInterval(r)
    }
  }, [token])

  const [atual, ...resto] = painel?.chamadas ?? []
  // repetir a chamada de alguém não enche a lista: uma linha por pessoa e sala
  const anteriores = resto.filter(
    (c, i) => !(c.nome === atual?.nome && c.sala === atual?.sala) && resto.findIndex((x) => x.nome === c.nome && x.sala === c.sala) === i
  )

  return (
    <div className="flex min-h-dvh flex-col bg-[#134E4A] text-white">
      <header className="flex items-center justify-between gap-4 px-8 py-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[10px] bg-white/10"><Bird className="size-5" /></span>
          <div className="leading-tight">
            <div className="text-[17px] font-semibold">{painel?.unidade ?? 'Chefe Coruja'}</div>
            <div className="text-[15px] text-white/70">{painel?.porta ?? 'Painel de chamada'}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {!som && (
            <button type="button" onClick={() => { setSom(true); falar('Som ativado.') }} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[15px] font-medium text-[#134E4A]">
              <Volume2 className="size-4" /> Ativar som
            </button>
          )}
          <span className="text-[42px] font-semibold tabular-nums">
            {agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
        {erro && <p className="text-[24px] text-amber-200">{erro}</p>}
        {!erro && atual && (
          <>
            <span className="text-[24px] uppercase tracking-[0.08em] text-white/70">Chamando</span>
            <span className="max-w-[20ch] text-[clamp(48px,8vw,112px)] font-semibold leading-none tracking-[-0.03em]">{atual.nome}</span>
            <span className="rounded-full bg-white px-8 py-3 text-[clamp(28px,4vw,56px)] font-semibold text-[#134E4A]">{atual.sala}</span>
          </>
        )}
        {!erro && painel && !atual && <span className="text-[24px] text-white/70">Aguarde ser chamado pelo nome.</span>}
      </main>

      {anteriores.length > 0 && (
        <footer className="border-t border-white/15 px-8 py-5">
          <div className="mb-2 text-[13px] uppercase tracking-[0.08em] text-white/60">Chamadas anteriores</div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {anteriores.slice(0, 6).map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-3 rounded-[12px] bg-white/10 px-4 py-2">
                <span className="truncate text-[17px] font-medium">{c.nome}</span>
                <span className="shrink-0 text-[15px] text-white/75">{c.sala} · {hora(c.em)}</span>
              </li>
            ))}
          </ul>
        </footer>
      )}
    </div>
  )
}
