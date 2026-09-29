import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { manterConectadoVencido, supabase } from '@/lib/supabase'
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

// Canal entre abas do mesmo navegador: quem sai numa aba sai em todas.
const CANAL_SESSAO = 'cc-sessao'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [perfil, setPerfil] = React.useState<Perfis['Row'] | null>(null)
  const [loading, setLoading] = React.useState(true)
  const queryClient = useQueryClient()

  // Encerramento local: rascunhos clínicos do navegador e todo dado lido do
  // banco que ficou na memória (cache do react-query) saem junto com o token.
  const encerrarLocal = React.useCallback(async () => {
    // LGPD: computador compartilhado de UPA — dado de paciente não fica.
    limparTodosRascunhos()
    queryClient.clear()
    await supabase.auth.signOut({ scope: 'local' })
  }, [queryClient])

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

  // "Manter conectado" vale 12 horas; passou, a sessão acaba na carga.
  React.useEffect(() => {
    if (manterConectadoVencido()) void encerrarLocal()
  }, [encerrarLocal])

  // Saiu em outra aba: sai aqui também.
  React.useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const canal = new BroadcastChannel(CANAL_SESSAO)
    canal.onmessage = (ev) => {
      if (ev.data === 'sair') void encerrarLocal()
    }
    return () => canal.close()
  }, [encerrarLocal])

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
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            const canal = new BroadcastChannel(CANAL_SESSAO)
            canal.postMessage('sair')
            canal.close()
          }
        } catch {
          /* sem canal: as outras abas saem quando o token vencer */
        }
        limparTodosRascunhos()
        queryClient.clear()
        // escopo local: revoga no servidor o refresh token DESTA sessão (o
        // celular do médico continua logado); o global derrubaria todos.
        await supabase.auth.signOut({ scope: 'local' })
      },
    }),
    [perfil, loading, queryClient]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
