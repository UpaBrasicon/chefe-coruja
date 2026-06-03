import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useAvisos() {
  const { profissional } = useAuth()
  const [avisos, setAvisos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profissional?.id) return

    async function carregar() {
      const { data } = await supabase
        .from('avisos')
        .select('*')
        .eq('profissional_id', profissional.id)
        .order('criada_em', { ascending: false })
        .limit(50)
      setAvisos(data ?? [])
      setLoading(false)
    }

    carregar()

    // Real-time
    const channel = supabase
      .channel(`avisos-${profissional.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'avisos',
        filter: `profissional_id=eq.${profissional.id}`,
      }, () => carregar())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profissional?.id])

  const naoLidas = avisos.filter(a => !a.lida).length

  async function marcarLida(id) {
    setAvisos(prev => prev.map(a => a.id === id ? { ...a, lida: true } : a))
    await supabase.from('avisos').update({ lida: true }).eq('id', id)
  }

  async function marcarTodasLidas() {
    setAvisos(prev => prev.map(a => ({ ...a, lida: true })))
    await supabase.from('avisos')
      .update({ lida: true })
      .eq('profissional_id', profissional.id)
      .eq('lida', false)
  }

  async function excluir(id) {
    setAvisos(prev => prev.filter(a => a.id !== id))
    await supabase.from('avisos').delete().eq('id', id)
  }

  return { avisos, loading, naoLidas, marcarLida, marcarTodasLidas, excluir }
}
