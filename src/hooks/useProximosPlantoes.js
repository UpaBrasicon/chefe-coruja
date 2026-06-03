import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useProximosPlantoes() {
  const { profissional } = useAuth()
  const [proximos, setProximos]   = useState([])
  const [totalMes, setTotalMes]   = useState(0)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!profissional?.id) return

    async function carregar() {
      const hoje     = new Date().toISOString().split('T')[0]
      const ano      = new Date().getFullYear()
      const mes      = new Date().getMonth()
      const inicioMes = new Date(ano, mes, 1).toISOString().split('T')[0]
      const fimMes    = new Date(ano, mes + 1, 0).toISOString().split('T')[0]

      const [{ data }, { count }] = await Promise.all([
        supabase
          .from('plantoes')
          .select('id, data, setores(nome), tipos_turno(nome, hora_inicio, hora_fim)')
          .eq('profissional_id', profissional.id)
          .gte('data', hoje)
          .order('data', { ascending: true })
          .limit(3),
        supabase
          .from('plantoes')
          .select('id', { count: 'exact', head: true })
          .eq('profissional_id', profissional.id)
          .gte('data', inicioMes)
          .lte('data', fimMes),
      ])

      setProximos(data ?? [])
      setTotalMes(count ?? 0)
      setLoading(false)
    }

    carregar()
  }, [profissional?.id])

  return { proximos, totalMes, loading }
}
