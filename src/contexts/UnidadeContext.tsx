import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ORDEM_PAPEL } from '@/lib/constants'
import type { Papel, TipoUnidade } from '@/types/database'
import { useAuth } from '@/contexts/AuthContext'

export type VinculoComUnidade = {
  id: string
  papel: Papel
  unidade_id: string
  unidade: {
    id: string
    nome: string
    tipo: TipoUnidade
    organizacao_id: string
  }
}

interface UnidadeContextValue {
  status: 'carregando' | 'pendente' | 'ok'
  vinculos: VinculoComUnidade[]
  /** Papéis do usuário **na unidade ativa** — é o que a navegação deve usar. */
  papeisDaUnidade: Papel[]
  unidades: VinculoComUnidade[]
  unidadeAtiva: VinculoComUnidade | null
  setUnidadeAtivaId: (id: string) => void
  papelAtivo: Papel | null
  ehAdmin: boolean
  ehGestor: boolean
  ehPlantonista: boolean
  ehSuperAdmin: boolean
  reload: () => void
}

const STORAGE_KEY = 'chefe-coruja:unidade-ativa'

const UnidadeContext = React.createContext<UnidadeContextValue | null>(null)

export function UnidadeProvider({ children }: { children: React.ReactNode }) {
  const { perfil } = useAuth()

  const {
    data: vinculos,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['vinculos', perfil?.id],
    enabled: !!perfil,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vinculos')
        .select('id, papel, unidade_id, unidades(id, nome, tipo, organizacao_id)')
        .eq('perfil_id', perfil!.id)
        .eq('ativo', true)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []).map((v) => ({
        id: v.id,
        papel: v.papel,
        unidade_id: v.unidade_id,
        unidade: v.unidades as VinculoComUnidade['unidade'],
      }))
    },
  })

  const { data: isSuper } = useQuery({
    queryKey: ['super_admin', perfil?.id],
    enabled: !!perfil,
    queryFn: async () => {
      const { data } = await supabase
        .from('super_admins')
        .select('perfil_id')
        .eq('perfil_id', perfil!.id)
        .maybeSingle()
      return !!data
    },
  })

  const unidades = React.useMemo(
    () =>
      (vinculos ?? []).filter(
        (v, i, arr) => arr.findIndex((x) => x.unidade_id === v.unidade_id) === i
      ),
    [vinculos]
  )

  const [unidadeAtivaId, setUnidadeAtivaIdState] = React.useState<string | null>(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
  )

  const unidadeAtiva =
    unidades.find((u) => u.unidade_id === unidadeAtivaId) ?? unidades[0] ?? null

  React.useEffect(() => {
    if (!unidadeAtiva) return
    window.localStorage.setItem(STORAGE_KEY, unidadeAtiva.unidade_id)
  }, [unidadeAtiva])

  // Papéis restritos à unidade ativa. Antes as flags eram globais (qualquer
  // vínculo), o que fazia um usuário plantonista na unidade A e gestor na B ver
  // o menu dos dois papéis nas duas unidades.
  const papeisDaUnidade = React.useMemo<Papel[]>(() => {
    const doVinculo = (vinculos ?? []).filter((v) => v.unidade_id === unidadeAtiva?.unidade_id)
    return [...new Set(doVinculo.map((v) => v.papel))].sort(
      (a, b) => ORDEM_PAPEL[a] - ORDEM_PAPEL[b]
    )
  }, [vinculos, unidadeAtiva?.unidade_id])

  const papelAtivo = papeisDaUnidade[0] ?? null

  const ehAdmin = papeisDaUnidade.includes('admin')
  const ehGestor = papeisDaUnidade.includes('gestor')
  const ehPlantonista = papeisDaUnidade.includes('plantonista')

  const status: UnidadeContextValue['status'] = !perfil
    ? 'carregando'
    : isLoading
      ? 'carregando'
      : unidades.length === 0
        ? 'pendente'
        : 'ok'

  const value = React.useMemo<UnidadeContextValue>(
    () => ({
      status,
      vinculos: vinculos ?? [],
      papeisDaUnidade,
      unidades,
      unidadeAtiva,
      setUnidadeAtivaId: (id) => setUnidadeAtivaIdState(id),
      papelAtivo,
      ehAdmin,
      ehGestor,
      ehPlantonista,
      ehSuperAdmin: !!isSuper,
      reload: () => void refetch(),
    }),
    [
      status,
      vinculos,
      papeisDaUnidade,
      unidades,
      unidadeAtiva,
      papelAtivo,
      ehAdmin,
      ehGestor,
      ehPlantonista,
      isSuper,
      refetch,
    ]
  )

  return <UnidadeContext.Provider value={value}>{children}</UnidadeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUnidade() {
  const ctx = React.useContext(UnidadeContext)
  if (!ctx) throw new Error('useUnidade deve ser usado dentro de <UnidadeProvider>')
  return ctx
}
