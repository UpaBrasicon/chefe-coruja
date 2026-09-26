/* eslint-disable react-refresh/only-export-components */
import { Undo2 } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

// A régua de desfazer (03-estado-e-transicoes.md §2): toda ação consequente
// mostra por 8 segundos o que foi feito e um botão Desfazer (Ctrl+Z).
// Regra do handoff: não invente um desfazer que não desfaz — quem chama
// `fazer` passa a função que reverte de verdade (no servidor, se tocou nele).

const JANELA_MS = 8000

type Acao = { id: number; rotulo: string; desfazer: () => void | Promise<void> }

type Ctx = { fazer: (rotulo: string, desfazer: Acao['desfazer']) => void }

const DesfazerContext = createContext<Ctx | null>(null)

export function useDesfazer() {
  const ctx = useContext(DesfazerContext)
  if (!ctx) throw new Error('useDesfazer fora do DesfazerProvider')
  return ctx
}

function digitando(alvo: EventTarget | null) {
  const el = alvo as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

export function DesfazerProvider({ children }: { children: ReactNode }) {
  const [acao, setAcao] = useState<Acao | null>(null)
  const [desfazendo, setDesfazendo] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const seq = useRef(0)

  const fazer = useCallback<Ctx['fazer']>((rotulo, desfazer) => {
    window.clearTimeout(timer.current)
    seq.current += 1
    const id = seq.current
    setAcao({ id, rotulo, desfazer })
    timer.current = window.setTimeout(() => setAcao((a) => (a?.id === id ? null : a)), JANELA_MS)
  }, [])

  const executar = useCallback(async () => {
    if (!acao || desfazendo) return
    window.clearTimeout(timer.current)
    setDesfazendo(true)
    try {
      await acao.desfazer()
    } finally {
      setDesfazendo(false)
      setAcao(null)
    }
  }, [acao, desfazendo])

  useEffect(() => {
    if (!acao) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && !digitando(e.target)) {
        e.preventDefault()
        void executar()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [acao, executar])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <DesfazerContext.Provider value={{ fazer }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[84px] z-[45] flex justify-center px-4 md:bottom-6">
        {acao && (
          <div
            key={acao.id}
            className="pointer-events-auto relative flex w-full max-w-[460px] items-center gap-3 overflow-hidden rounded-container bg-tinta py-3 pr-3 pl-4 text-apoio text-white shadow-desfazer animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <span className="min-w-0 flex-1">{acao.rotulo}</span>
            <button
              type="button"
              onClick={() => void executar()}
              disabled={desfazendo}
              className="flex items-center gap-1.5 rounded-controle-sm px-2.5 py-1.5 font-medium text-[#99D6CE] hover:bg-white/10 disabled:opacity-60"
            >
              <Undo2 className="size-4" aria-hidden />
              Desfazer
              <kbd className="ml-1 hidden rounded-[5px] border border-white/20 px-1 font-mono text-[11px] text-white/70 sm:inline">Ctrl Z</kbd>
            </button>
            {/* a régua: esvazia em 8 s */}
            <span
              aria-hidden
              className="absolute bottom-0 left-0 h-[3px] w-full origin-left bg-[#99D6CE] motion-safe:animate-[cc-regua_8s_linear_forwards]"
            />
          </div>
        )}
      </div>
      <style>{'@keyframes cc-regua { from { transform: scaleX(1) } to { transform: scaleX(0) } }'}</style>
    </DesfazerContext.Provider>
  )
}
