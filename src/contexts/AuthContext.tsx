import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apagarTokenLocal, manterConectadoVencido, supabase } from '@/lib/supabase'
import { ehFalhaDeRede } from '@/lib/offline/sessaoSemRede'
import { apagarSessaoLocal, perfilSemConexao } from '@/lib/offline/sessaoLocal'
import { situacaoSemConexao } from '@/lib/offline/relogio'
import { limparTodosRascunhos } from '@/lib/rascunho'
import { definirChave } from '@/lib/cofreLocal'
import { aplicarTema, ehTema, type Tema } from '@/lib/tema'
import type { Perfis } from '@/types/database'

interface AuthContextValue {
  perfil: Perfis['Row'] | null
  loading: boolean
  /** captchaToken: token do Turnstile (obrigatório quando o CAPTCHA do Auth está ligado) */
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, nomeCompleto: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  /** Grava o tema da pessoa no perfil e aplica na tela (guia do padrão, 1.4). */
  definirTema: (tema: Tema) => Promise<{ error: string | null }>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

// Canal entre abas do mesmo navegador: quem sai numa aba sai em todas.
const CANAL_SESSAO = 'cc-sessao'

// D1 (recarga sem conexão, parte 1): sair apaga o token do navegador mesmo sem
// rede, e de novo 5 s depois, para o caso de uma renovação que já estava em
// curso regravar a sessão. Um login novo nesse meio-tempo cancela a segunda.
let saiuEm = 0
function sairDoAparelho() {
  apagarTokenLocal()
  saiuEm = Date.now()
  const marca = saiuEm
  window.setTimeout(() => { if (saiuEm === marca) apagarTokenLocal() }, 5000)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [perfil, setPerfil] = React.useState<Perfis['Row'] | null>(null)
  const [loading, setLoading] = React.useState(true)
  const queryClient = useQueryClient()

  // Encerramento local: rascunhos clínicos do navegador e todo dado lido do
  // banco que ficou na memória (cache do react-query) saem junto com o token.
  const encerrarLocal = React.useCallback(async () => {
    // LGPD: computador compartilhado de UPA — dado de paciente não fica.
    limparTodosRascunhos()
    apagarSessaoLocal()
    definirChave(null) // a chave do servidor morre junto com a sessão (gatilho em auth.sessions)
    queryClient.clear()
    try { await supabase.auth.signOut({ scope: 'local' }) } finally { sairDoAparelho() }
  }, [queryClient])

  const loadPerfil = React.useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    // sem rede (parte 2 da recarga sem conexão): o perfil guardado nesta aba,
    // da mesma pessoa, enquanto a regra de 2 h e 20 min deixar (N3)
    const perfilLido = data ?? (error && ehFalhaDeRede(error)
      ? perfilSemConexao<Perfis['Row']>(userId, situacaoSemConexao().pode)
      : null)
    setPerfil(perfilLido)
    if (perfilLido && ehTema(perfilLido.tema)) aplicarTema(perfilLido.tema)
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
    supabase.auth.getSession().then(({ data, error }) => {
      if (data.session) void loadPerfil(data.session.user.id)
      else if (ehFalhaDeRede(error)) {
        // D3: o token não pôde ser renovado por falta de rede. Não é sessão
        // encerrada: rascunhos cifrados e a chave desta aba ficam, e a casca
        // abre com o perfil guardado nesta aba se a regra deixar (parte 2, N3).
        setPerfil(perfilSemConexao<Perfis['Row']>(null, situacaoSemConexao().pode))
        setLoading(false)
      } else {
        // Sem sessão (aba fechada sem "Sair", sessão vencida): rascunho clínico
        // que ficou no navegador não tem mais dono — sai agora.
        limparTodosRascunhos()
        apagarSessaoLocal()
        definirChave(null)
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento, session) => {
      if (evento === 'SIGNED_IN') saiuEm = 0
      if (session) void loadPerfil(session.user.id)
      else if (evento === 'SIGNED_OUT') {
        // INITIAL_SESSION sem sessão quem decide é o getSession acima (pode
        // ser só falta de rede, com o perfil guardado nesta aba)
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
      signIn: async (email, password, captchaToken) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } })
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
        apagarSessaoLocal()
        definirChave(null)
        queryClient.clear()
        // escopo local: revoga no servidor o refresh token DESTA sessão (o
        // celular do médico continua logado); o global derrubaria todos.
        // sem rede o supabase-js não apaga o token: apaga aqui (D1, computador compartilhado)
        try { await supabase.auth.signOut({ scope: 'local' }) } finally { sairDoAparelho() }
      },
      definirTema: async (tema) => {
        aplicarTema(tema)
        if (!perfil) return { error: null }
        const { error } = await supabase.from('perfis').update({ tema }).eq('id', perfil.id)
        if (error) return { error: 'Não foi possível guardar o tema no seu perfil. Ele vale só neste aparelho.' }
        setPerfil({ ...perfil, tema })
        return { error: null }
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
