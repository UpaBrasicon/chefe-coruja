/* eslint-disable react-refresh/only-export-components */
import { Undo2 } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

// A régua de desfazer (03-estado-e-transicoes.md §2): toda ação consequente
// mostra por 8 segundos o que foi feito e um botão Desfazer (Ctrl+Z).
// Regra do handoff: não invente um desfazer que não desfaz — quem chama
// `fazer` passa a função que reverte de verdade (no servidor, se tocou nele).

const JANELA_MS = 8000

type Acao = { id: number; rotulo: string; desfazer: () => void | Promise<void>; desfeito?: boolean }

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
    const id = acao.id
    try {
      await acao.desfazer()
      // "— desfeito" fica 1,6 s na barra: a confirmação de que voltou.
      setAcao((a) => (a?.id === id ? { ...a, desfeito: true } : a))
      timer.current = window.setTimeout(() => setAcao((a) => (a?.id === id ? null : a)), 1600)
    } catch {
      setAcao(null)
    } finally {
      setDesfazendo(false)
    }
  }, [acao, desfazendo])

  useEffect(() => {
    if (!acao || acao.desfeito) return
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
            className="pointer-events-auto relative flex w-full max-w-[460px] items-center gap-3.5 overflow-hidden rounded-container bg-tinta py-3 pr-3.5 pl-4 text-controle text-white shadow-desfazer animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <Undo2 className="size-4 shrink-0 text-desfazer-regua" aria-hidden />
            <span className="min-w-0 flex-1 leading-[1.4]">
              {acao.rotulo}
              {acao.desfeito && ' — desfeito'}
            </span>
            {!acao.desfeito && (
              <button
                type="button"
                onClick={() => void executar()}
                disabled={desfazendo}
                className="ml-1.5 flex items-center gap-2 px-0.5 py-1 font-semibold whitespace-nowrap text-white hover:text-desfazer-regua disabled:opacity-60"
              >
                Desfazer
                <kbd className="cc-tecla hidden border-grafite! bg-grafite! text-fio-forte! sm:inline-flex">ctrl Z</kbd>
              </button>
            )}
            {/* a régua: esvazia em 8 s — ela É a janela, não um enfeite */}
            {!acao.desfeito && (
              <span
                aria-hidden
                className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-desfazer-regua motion-safe:animate-[cc-regua_8s_linear_forwards]"
              />
            )}
          </div>
        )}
      </div>
      <style>{'@keyframes cc-regua { from { transform: scaleX(1) } to { transform: scaleX(0) } }'}</style>
    </DesfazerContext.Provider>
  )
}
