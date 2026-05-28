import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useTrocasPendentes() {
  const { profissional } = useAuth()
  const [count, setCount] = useState(0)

  const buscar = useCallback(async () => {
    if (!profissional?.id) return
    const { count: c } = await supabase
      .from('trocas')
      .select('*', { count: 'exact', head: true })
      .eq('para_profissional_id', profissional.id)
      .eq('status', 'pendente')
    setCount(c ?? 0)
  }, [profissional?.id])

  useEffect(() => {
    buscar()
    const interval = setInterval(buscar, 30000)
    return () => clearInterval(interval)
  }, [buscar])

  return { count, refetch: buscar }
}
