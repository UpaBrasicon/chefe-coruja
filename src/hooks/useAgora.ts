import * as React from 'react'

/** Relógio da tela: anda sozinho, sem recarregar nada. */
export function useAgora(intervalo = 30_000) {
  const [agora, setAgora] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), intervalo)
    return () => window.clearInterval(t)
  }, [intervalo])
  return agora
}
