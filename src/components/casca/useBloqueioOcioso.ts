import { useCallback, useEffect, useRef, useState } from 'react'

// Bloqueio de tela (decisão do usuário em 29/09/2026: não deixar o sistema
// aberto para outra pessoa mexer). O computador do posto é compartilhado e o
// plantonista levanta no meio da evolução. Três camadas, para todos os papéis:
//   · 10 min sem mouse nem teclado → a tela bloqueia: o conteúdo some (fundo
//     opaco, não desfoque — desfoque ainda deixa ler nome de paciente) e só a
//     senha da própria pessoa desbloqueia;
//   · 30 min sem uso (20 bloqueada) → a sessão acaba;
//   · "Bloquear tela" no menu do usuário, para quem sai da frente do micro.
// O desbloqueio refaz o login com a senha; se a unidade exige segundo fator,
// o portão dele volta a pedir o código (ADR 0010: todo login novo).

export const BLOQUEIO_MS = 10 * 60_000
export const ENCERRA_MS = 30 * 60_000
const EVENTOS = ['pointerdown', 'pointermove', 'keydown', 'input', 'scroll', 'touchstart', 'wheel'] as const

export function useBloqueioOcioso(ativo: boolean, onEncerrar: () => void) {
  const [bloqueada, setBloqueada] = useState(false)
  const ultimaAtividade = useRef(0)

  const bloquear = useCallback(() => setBloqueada(true), [])
  const desbloquear = useCallback(() => {
    ultimaAtividade.current = Date.now()
    setBloqueada(false)
  }, [])

  useEffect(() => {
    if (!ativo) return
    ultimaAtividade.current = Date.now()
    const aoAgir = () => {
      // bloqueada, mexer não conta: só a senha devolve a tela
      if (!document.querySelector('[data-cc-bloqueio]')) ultimaAtividade.current = Date.now()
    }
    EVENTOS.forEach((ev) => window.addEventListener(ev, aoAgir, { passive: true }))
    const t = window.setInterval(() => {
      const parado = Date.now() - ultimaAtividade.current
      if (parado >= ENCERRA_MS) onEncerrar()
      else if (parado >= BLOQUEIO_MS) setBloqueada(true)
    }, 15_000)
    return () => {
      EVENTOS.forEach((ev) => window.removeEventListener(ev, aoAgir))
      window.clearInterval(t)
    }
  }, [ativo, onEncerrar])

  return { bloqueada, bloquear, desbloquear }
}
