import { useEffect, useState } from 'react'

/**
 * Item 04 do kit de desempenho: devolve o valor só depois que ele parou de
 * mudar por `ms` milissegundos. Nas buscas, a consulta ao banco usa o valor
 * adiado e sai uma vez quando a pessoa para de digitar, não a cada tecla.
 */
export function useValorAdiado<T>(valor: T, ms = 300): T {
  const [adiado, setAdiado] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setAdiado(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return adiado
}
