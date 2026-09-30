import { Bird, Volume2 } from 'lucide-react'
import * as React from 'react'
import { useParams } from 'react-router-dom'

import { supabase } from '@/lib/supabase'

// Painel de chamada da TV (Fase 2.3; porte, onda 8: P/Painel de Chamada.dc.html).
// Abre SEM login, pelo link da porta que a Recepção gera. Mostra só nome
// (social, se houver), sala, hora, a vez da chamada e quem chamou — nada de
// prontuário, idade, cor ou queixa. Gerar um link novo derruba este.
// À esquerda, a propaganda da unidade em rodízio (cadastrada pelo gestor);
// chamada nova ocupa a tela toda por 9 segundos, com aviso sonoro e voz.

type Chamada = { id: string; nome: string; sala: string; em: string; vez: number; quem: string | null }
type Arte = { id: string; caminho: string; titulo: string }
type Painel = {
  porta: string
  unidade: string
  servidor: string
  chamadas: Chamada[]
  propaganda?: { rotulo: string; segundos: number; itens: Arte[] }
}

const DESTAQUE_MS = 9000
const FUNDO = '#0B1F1D'

const hora = (iso: string | number | Date) =>
  new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

let ctxAudio: AudioContext | null = null
function audio() {
  try {
    ctxAudio ??= new AudioContext()
    return ctxAudio
  } catch {
    return null
  }
}

/** Dois toques (880 e 660 Hz), como no protótipo. */
function bip() {
  const ctx = audio()
  if (!ctx) return
  ;[0, 0.28].forEach((t, i) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = i ? 660 : 880
    g.gain.setValueAtTime(0.0001, ctx.currentTime + t)
    g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.26)
    o.connect(g).connect(ctx.destination)
    o.start(ctx.currentTime + t)
    o.stop(ctx.currentTime + t + 0.3)
  })
}

function falar(texto: string) {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(texto)
  u.lang = 'pt-BR'
  u.rate = 0.9
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

const urlArte = (caminho: string) => supabase.storage.from('painel').getPublicUrl(caminho).data.publicUrl

export default function PainelChamada() {
  const { token } = useParams()
  const [painel, setPainel] = React.useState<Painel | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [som, setSom] = React.useState(false)
  const [agora, setAgora] = React.useState(() => Date.now())
  const [destaqueAte, setDestaqueAte] = React.useState(0)
  const [arte, setArte] = React.useState(0)
  const fixoAte = React.useRef(0)
  const ultima = React.useRef<string | null>(null)
  const leu = React.useRef(false)
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
      // a primeira leitura só marca onde está (abrir a TV não anuncia ninguém)
      if (!leu.current) {
        leu.current = true
        ultima.current = nova?.id ?? null
        return
      }
      // chamada nova OU a mesma pessoa chamada de novo (cada chamada é uma linha)
      if (nova && nova.id !== ultima.current) {
        ultima.current = nova.id
        setDestaqueAte(Date.now() + DESTAQUE_MS)
        if (somRef.current) {
          bip()
          window.setTimeout(() => falar(`${nova.nome}. ${nova.sala}.`), 700)
        }
      }
    }
    void ler()
    const t = window.setInterval(() => void ler(), 3000)
    const r = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => {
      vivo = false
      window.clearInterval(t)
      window.clearInterval(r)
    }
  }, [token])

  // rodízio da propaganda: avança a cada N segundos, a não ser que alguém
  // tenha escolhido uma arte pelos pontos (fica 60 s)
  const artes = painel?.propaganda?.itens ?? []
  const segundos = Math.max(4, painel?.propaganda?.segundos ?? 12)
  const nArtes = artes.length
  React.useEffect(() => {
    if (nArtes < 2) return
    const t = window.setInterval(() => {
      if (Date.now() < fixoAte.current) return
      setArte((a) => (a + 1) % nArtes)
    }, segundos * 1000)
    return () => window.clearInterval(t)
  }, [nArtes, segundos])
  const arteAtual = nArtes ? arte % nArtes : 0

  const [atual, ...resto] = painel?.chamadas ?? []
  // repetir a chamada de alguém não enche a lista: uma linha por pessoa e sala
  const anteriores = resto.filter(
    (c, i) => !(c.nome === atual?.nome && c.sala === atual?.sala) && resto.findIndex((x) => x.nome === c.nome && x.sala === c.sala) === i,
  )
  const rotuloAtual = atual && atual.vez > 1 ? 'Chamando novamente' : 'Chamando agora'
  const destaque = !!atual && agora < destaqueAte

  function ativarSom() {
    void audio()?.resume()
    setSom(true)
    falar('Som ativado.')
  }

  const cabecalho = (
    <header className="flex items-center justify-between gap-6 border-b border-[#134E4A] px-[2.4vw] py-[1.8vh]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-[4.4vh] shrink-0 place-items-center rounded-[1vh] bg-white/10"><Bird className="size-[2.4vh]" aria-hidden /></span>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[2.4vh] font-semibold tracking-[-0.01em]">{painel?.unidade ?? 'Chefe Coruja'}</div>
          <div className="truncate text-[1.8vh] text-[#99F6E4]">{painel?.porta ?? 'Painel de chamada'}</div>
        </div>
      </div>
      <div className="flex items-center gap-5">
        {!som && (
          <button type="button" onClick={ativarSom} className="flex items-center gap-2 rounded-full bg-[#F8FAFC] px-[2.2vh] py-[1vh] text-[1.8vh] font-semibold text-[#0B1F1D]">
            <Volume2 className="size-[2vh]" aria-hidden /> Ativar som
          </button>
        )}
        <span className="text-[3.4vh] font-semibold tabular-nums">{hora(agora)}</span>
      </div>
    </header>
  )

  const blocoAtual = (
    <div className="flex flex-col gap-[1.6vh] border-b border-[#0F766E] bg-[#134E4A] px-[2vw] py-[2.8vh]" aria-live="polite">
      <span className="text-[2vh] font-semibold tracking-[0.08em] text-[#99F6E4] uppercase">{rotuloAtual}</span>
      {atual ? (
        <div className="flex flex-col gap-[1.4vh]">
          <span className="text-[5.2vh] leading-[1.05] font-bold tracking-[-0.015em] text-balance">{atual.nome}</span>
          <span className="text-[4.6vh] leading-none font-bold text-[#5EEAD4]">{atual.sala}</span>
          {atual.quem && <span className="text-[2.2vh] text-[#CCFBF1]">{atual.quem}</span>}
        </div>
      ) : (
        <span className="text-[3vh] text-pretty text-[#CCFBF1]">Aguarde ser chamado pelo nome.</span>
      )}
    </div>
  )

  const listaAnteriores = (
    <div className="flex min-h-0 flex-col gap-[0.4vh] overflow-hidden px-[2vw] py-[2.2vh]">
      <span className="mb-[0.6vh] text-[1.8vh] font-semibold tracking-[0.08em] text-[#99F6E4] uppercase">Últimas chamadas</span>
      {anteriores.slice(0, 5).map((c) => (
        <div key={c.id} className="flex flex-col gap-[0.4vh] border-b border-[#134E4A] py-[1.3vh]">
          <span className="text-[2.8vh] leading-[1.15] font-semibold text-balance">{c.nome}</span>
          <span className="text-[2.1vh] font-semibold text-[#5EEAD4]">
            {c.sala} <span className="font-normal text-[#99F6E4]">· {hora(c.em)}</span>
          </span>
        </div>
      ))}
      {anteriores.length === 0 && <span className="py-[1.3vh] text-[2.1vh] text-[#99F6E4]/80">Nenhuma chamada anterior.</span>}
    </div>
  )

  return (
    <div className="relative grid h-dvh grid-rows-[auto_minmax(0,1fr)] overflow-hidden text-[#F8FAFC]" style={{ background: FUNDO }}>
      {cabecalho}

      {erro ? (
        <main className="grid place-items-center px-8 text-center">
          <p className="text-[3vh] text-amber-200">{erro}</p>
        </main>
      ) : nArtes > 0 ? (
        <main className="grid min-h-0 grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
          <section className="flex min-h-0 min-w-0 flex-col gap-[1.2vh] py-[2.4vh] pr-[1.6vw] pl-[2.4vw]" aria-label="Informes da unidade">
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-[1.2vh] bg-[#0F2E2B]">
              {artes.map((a, i) => (
                <img
                  key={a.id}
                  src={urlArte(a.caminho)}
                  alt={i === arteAtual ? a.titulo : ''}
                  aria-hidden={i !== arteAtual}
                  className="absolute inset-0 size-full object-contain transition-opacity duration-700"
                  style={{ opacity: i === arteAtual ? 1 : 0 }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[1.7vh] font-semibold tracking-[0.08em] text-[#99F6E4] uppercase">{painel?.propaganda?.rotulo}</span>
              {nArtes > 1 && (
                <div className="flex gap-[0.8vh]">
                  {artes.map((a, i) => (
                    <button
                      key={a.id}
                      type="button"
                      title={`Mostrar ${a.titulo}`}
                      aria-label={`Mostrar ${a.titulo}`}
                      onClick={() => { fixoAte.current = Date.now() + 60_000; setArte(i) }}
                      className="size-[1.6vh] rounded-full"
                      style={{ background: i === arteAtual ? '#5EEAD4' : '#1F5F59' }}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
          <aside className="flex min-h-0 min-w-0 flex-col border-l border-[#134E4A]">
            {blocoAtual}
            {listaAnteriores}
          </aside>
        </main>
      ) : (
        // sem propaganda cadastrada: as chamadas ocupam a tela
        <main className="grid min-h-0 grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col justify-center">{blocoAtual}</div>
          <aside className="flex min-h-0 min-w-0 flex-col border-l border-[#134E4A]">{listaAnteriores}</aside>
        </main>
      )}

      {destaque && atual && !erro && (
        <div className="absolute inset-0 z-10 flex flex-col justify-center gap-[4vh] bg-[#0F766E] px-[6vw] py-[6vh]" role="alert">
          <span className="text-[3.2vh] font-semibold tracking-[0.1em] text-[#CCFBF1] uppercase">{rotuloAtual}</span>
          <span className="text-[11vh] leading-none font-bold tracking-[-0.02em] text-balance">{atual.nome}</span>
          <div className="flex flex-wrap items-baseline gap-[3vw]">
            <span className="rounded-[1.4vh] px-[2.6vh] py-[1.4vh] text-[9vh] leading-none font-bold text-white" style={{ background: FUNDO }}>{atual.sala}</span>
            {atual.quem && <span className="text-[3.4vh] text-[#F0FDFA]">{atual.quem}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
