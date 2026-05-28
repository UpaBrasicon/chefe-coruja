import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useDesistenciasAbertas() {
  const { profissional } = useAuth()
  const [count, setCount] = useState(0)

  const buscar = useCallback(async () => {
    const { count: c } = await supabase
      .from('desistencias')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'aguardando_candidato')
    setCount(c ?? 0)
  }, [])

  useEffect(() => {
    buscar()
    const interval = setInterval(buscar, 30000)
    return () => clearInterval(interval)
  }, [buscar])

  return { count, refetch: buscar }
}
