import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profissional, setProfissional] = useState(null)
  const [loading, setLoading] = useState(true)

  async function carregarPerfil(authUser) {
    if (!authUser) {
      setProfissional(null)
      return
    }
    const { data, error } = await supabase
      .from('profissionais')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .single()

    if (error) {
      console.error('Erro ao carregar perfil:', error.message)
      setProfissional(null)
    } else {
      setProfissional(data)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      carregarPerfil(authUser).finally(() => setLoading(false))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      carregarPerfil(authUser)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfissional(null)
  }

  return (
    <AuthContext.Provider value={{ user, profissional, loading, signOut, carregarPerfil }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
