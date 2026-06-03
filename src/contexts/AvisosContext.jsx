import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const AvisosContext = createContext(null)

export function AvisosProvider({ children }) {
  const { profissional } = useAuth()
  const [avisos, setAvisos]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profissional?.id) return

    async function processarDatasFixas() {
      const chave = `datas_fixas_${profissional.id}_${new Date().toDateString()}`
      if (sessionStorage.getItem(chave)) return
      sessionStorage.setItem(chave, '1')
      await supabase.rpc('fn_processar_datas_fixas')
    }

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
    processarDatasFixas()

    const channel = supabase
      .channel(`avisos-${profissional.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avisos', filter: `profissional_id=eq.${profissional.id}` },
        () => carregar())
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
    await supabase.from('avisos').update({ lida: true }).eq('profissional_id', profissional.id).eq('lida', false)
  }

  async function excluir(id) {
    setAvisos(prev => prev.filter(a => a.id !== id))
    await supabase.from('avisos').delete().eq('id', id)
  }

  return (
    <AvisosContext.Provider value={{ avisos, loading, naoLidas, marcarLida, marcarTodasLidas, excluir }}>
      {children}
    </AvisosContext.Provider>
  )
}

export function useAvisos() {
  return useContext(AvisosContext)
}
