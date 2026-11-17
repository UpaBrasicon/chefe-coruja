import * as React from 'react'

/** Verdadeiro enquanto a janela tiver no máximo `px` de largura (celular e tablet abaixo de 1024). */
export function useLarguraAte(px: number) {
  const consulta = `(max-width: ${px}px)`
  const [casa, setCasa] = React.useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches)
  React.useEffect(() => {
    const mq = window.matchMedia(consulta)
    const on = () => setCasa(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [consulta])
  return casa
}
