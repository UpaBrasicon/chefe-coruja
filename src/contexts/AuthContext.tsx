import * as React from 'react'
import { supabase } from '@/lib/supabase'
import { limparTodosRascunhos } from '@/pages/plantao/shared/rascunho'
import type { Perfis } from '@/types/database'

interface AuthContextValue {
  perfil: Perfis['Row'] | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, nomeCompleto: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [perfil, setPerfil] = React.useState<Perfis['Row'] | null>(null)
  const [loading, setLoading] = React.useState(true)

  const loadPerfil = React.useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    setPerfil(data ?? null)
    setLoading(false)
    if (error) console.error('Erro ao carregar perfil:', error)
  }, [])

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void loadPerfil(data.session.user.id)
      else setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void loadPerfil(session.user.id)
      else {
        setPerfil(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadPerfil])

  const value = React.useMemo<AuthContextValue>(
    () => ({
      perfil,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error?.message ?? null }
      },
      signUp: async (email, password, nomeCompleto) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nome_completo: nomeCompleto } },
        })
        return { error: error?.message ?? null }
      },
      signOut: async () => {
        // LGPD: remove rascunhos clínicos do navegador ANTES de encerrar a sessão
        // (computador compartilhado de UPA — dados de paciente não podem ficar).
        limparTodosRascunhos()
        await supabase.auth.signOut()
      },
    }),
    [perfil, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
