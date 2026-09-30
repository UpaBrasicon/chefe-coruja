import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// Favoritos e contagem de uso das ferramentas da Central, POR PERFIL, no banco
// (migration 20261010000001: tabela ferramenta_uso e RPCs). Antes ficavam no
// localStorage do aparelho; a lista antiga é levada para o banco uma vez e o
// armazenamento local é apagado.

const FAV_KEY_ANTIGA = 'chefe-coruja:favoritos'
const RECENT_KEY_ANTIGA = 'chefe-coruja:recentes'
const CHAVE_CACHE = 'minhas-ferramentas'

/**
 * Chave de identificação de uma ferramenta.
 *
 * Precisa incluir a seção: existem slugs repetidos entre seções
 * (`controle-glicemico` e `nefropatia-contraste` estão em `calculadoras`
 * e em `protocolos`). Chavear só pelo slug fazia favoritar um marcar os dois.
 */
export function chaveFerramenta(secao: string, slug: string) {
  return `${secao}/${slug}`
}

export type UsoFerramenta = { chave: string; favorita: boolean; usos: number; ultimo_uso_em: string | null; favoritada_em: string | null }

/** Lê e apaga a lista antiga do aparelho (só slug ou `secao/slug`). */
function tirarListaAntiga(chavesConhecidas: string[]): string[] {
  try {
    const raw = window.localStorage.getItem(FAV_KEY_ANTIGA)
    window.localStorage.removeItem(FAV_KEY_ANTIGA)
    window.localStorage.removeItem(RECENT_KEY_ANTIGA)
    const arr: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(arr)) return []
    const chaves = arr
      .filter((x): x is string => typeof x === 'string')
      .map((item) => (item.includes('/') ? item : (chavesConhecidas.find((c) => c.endsWith(`/${item}`)) ?? '')))
      .filter((c) => chavesConhecidas.includes(c))
    return [...new Set(chaves)]
  } catch {
    return []
  }
}

export function useFavoritos(chavesConhecidas: string[] = []) {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const chave = [CHAVE_CACHE, perfil?.id]

  const consulta = useQuery({
    queryKey: chave,
    enabled: !!perfil,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('minhas_ferramentas')
      if (error) throw error
      return (data ?? []) as UsoFerramenta[]
    },
  })

  // Uma vez por aparelho: favoritos do localStorage antigo vão para o banco.
  const importou = useRef(false)
  useEffect(() => {
    if (importou.current || !perfil || !consulta.isSuccess) return
    importou.current = true
    const antigas = tirarListaAntiga(chavesConhecidas).filter((c) => !consulta.data.some((u) => u.chave === c && u.favorita))
    if (!antigas.length) return
    void Promise.all(antigas.map((c) => supabase.rpc('marcar_favorito_ferramenta', { p_chave: c, p_favorita: true })))
      .then(() => qc.invalidateQueries({ queryKey: [CHAVE_CACHE] }))
  }, [perfil, consulta.isSuccess, consulta.data, chavesConhecidas, qc])

  const marcar = useMutation({
    mutationFn: async ({ c, favorita }: { c: string; favorita: boolean }) => {
      const { error } = await supabase.rpc('marcar_favorito_ferramenta', { p_chave: c, p_favorita: favorita })
      if (error) throw error
    },
    onMutate: async ({ c, favorita }) => {
      await qc.cancelQueries({ queryKey: chave })
      const antes = qc.getQueryData<UsoFerramenta[]>(chave)
      qc.setQueryData<UsoFerramenta[]>(chave, (lista = []) =>
        lista.some((u) => u.chave === c)
          ? lista.map((u) => (u.chave === c ? { ...u, favorita } : u))
          : [...lista, { chave: c, favorita, usos: 0, ultimo_uso_em: null, favoritada_em: null }],
      )
      return { antes }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(chave, ctx?.antes),
    onSettled: () => void qc.invalidateQueries({ queryKey: [CHAVE_CACHE] }),
  })

  const lista = useMemo(() => consulta.data ?? [], [consulta.data])
  const favoritos = useMemo(
    () => lista.filter((u) => u.favorita).sort((a, b) => (a.favoritada_em ?? '').localeCompare(b.favoritada_em ?? '')).map((u) => u.chave),
    [lista],
  )
  const usos = useMemo(() => Object.fromEntries(lista.map((u) => [u.chave, u.usos])) as Record<string, number>, [lista])
  const alternarFavorito = useCallback(
    (c: string) => marcar.mutate({ c, favorita: !favoritos.includes(c) }),
    [marcar, favoritos],
  )

  return { favoritos, usos, lista, alternarFavorito, carregando: consulta.isLoading, erro: consulta.error ?? marcar.error }
}

/** Conta uma abertura da ferramenta (uma por montagem da tela, mesmo no StrictMode). */
export function useRegistrarUso(chave: string | null) {
  const qc = useQueryClient()
  const ultima = useRef<string | null>(null)
  useEffect(() => {
    if (!chave || ultima.current === chave) return
    ultima.current = chave
    void supabase.rpc('registrar_uso_ferramenta', { p_chave: chave }).then(({ error }) => {
      if (!error) void qc.invalidateQueries({ queryKey: [CHAVE_CACHE] })
    })
  }, [chave, qc])
}
