import { useEffect, useState } from 'react'

// Ctrl+K alterna; "/" fora de campo de texto abre.
function digitando(alvo: EventTarget | null) {
  const el = alvo as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

export function usePaleta() {
  const [aberta, setAberta] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setAberta((v) => !v)
      } else if (e.key === '/' && !digitando(e.target)) {
        e.preventDefault()
        setAberta(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return { aberta, setAberta }
}


