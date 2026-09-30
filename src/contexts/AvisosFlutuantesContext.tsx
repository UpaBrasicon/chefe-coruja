/* eslint-disable react-refresh/only-export-components */
import type { LucideIcon } from 'lucide-react'
import { ChevronRight, Megaphone } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

// A pilha de avisos (P/index.html .cc-toast-*): entra sob a topbar, do lado
// do sino, empilha do mais novo para o mais antigo e se recolhe sozinha.
// Nada aqui bloqueia a tela — é sinal, não interrupção. Cada item entra com
// atraso próprio (850 ms entre eles) e sai depois de ~4,6 s.

export type AvisoFlutuante = {
  tag: string
  titulo: string
  texto?: string
  /** "agora", "há 5 min", a data do aviso. */
  quando?: string
  /** Cor da tag e do ícone (hex). Padrão: teal da ação. */
  cor?: string
  icone?: LucideIcon
}

type Item = AvisoFlutuante & { id: number; saindo?: boolean }

type Ctx = { avisar: (itens: AvisoFlutuante | AvisoFlutuante[]) => void }

const AvisosContext = createContext<Ctx | null>(null)

export function useAvisosFlutuantes() {
  const ctx = useContext(AvisosContext)
  if (!ctx) throw new Error('useAvisosFlutuantes fora do AvisosFlutuantesProvider')
  return ctx
}

const INTERVALO_MS = 850
const VIDA_MS = 4600

export function AvisosFlutuantesProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<Item[]>([])
  const timers = useRef<number[]>([])
  const seq = useRef(0)

  const fechar = useCallback((id: number) => {
    setItens((xs) => xs.map((x) => (x.id === id ? { ...x, saindo: true } : x)))
    timers.current.push(window.setTimeout(() => setItens((xs) => xs.filter((x) => x.id !== id)), 280))
  }, [])

  const avisar = useCallback<Ctx['avisar']>((entrada) => {
    const lista = Array.isArray(entrada) ? entrada : [entrada]
    lista.forEach((it, i) => {
      timers.current.push(
        window.setTimeout(() => {
          seq.current += 1
          const id = seq.current
          setItens((xs) => [...xs, { ...it, id }])
          timers.current.push(window.setTimeout(() => fechar(id), VIDA_MS + i * 250))
        }, i * INTERVALO_MS),
      )
    })
  }, [fechar])

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  return (
    <AvisosContext.Provider value={{ avisar }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed top-[calc(var(--cc-topo)+10px)] right-5 z-30 flex w-[340px] max-w-[calc(100vw-40px)] flex-col-reverse gap-2.5 lg:right-7"
      >
        {itens.map((t) => {
          const cor = t.cor ?? '#0F766E'
          const Icone = t.icone ?? Megaphone
          return (
            <div
              key={t.id}
              className={
                'pointer-events-auto relative flex origin-top items-start gap-[11px] rounded-container border border-fio bg-superficie px-3.5 py-3 shadow-toast ' +
                (t.saindo ? 'animate-cc-toast-sai' : 'animate-cc-toast')
              }
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-controle-sm" style={{ color: cor, background: `${cor}14` }}>
                <Icone className="size-[15px]" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <div className="flex items-center gap-2">
                  <span className="text-rotulo font-semibold tracking-[0.05em] uppercase" style={{ color: cor }}>
                    {t.tag}
                  </span>
                  {t.quando && <span className="ml-auto text-rotulo text-tinta-sussurro">{t.quando}</span>}
                </div>
                <span className="text-apoio leading-[1.35] font-semibold tracking-[-0.005em] text-tinta">{t.titulo}</span>
                {t.texto && <span className="text-rotulo leading-[1.4] text-tinta-sussurro">{t.texto}</span>}
              </div>
              <button
                type="button"
                onClick={() => fechar(t.id)}
                aria-label="Dispensar aviso"
                className="-mt-0.5 -mr-[3px] grid size-4 shrink-0 place-items-center text-tinta-sussurro hover:text-acao"
              >
                <ChevronRight className="size-[13px]" aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </AvisosContext.Provider>
  )
}
