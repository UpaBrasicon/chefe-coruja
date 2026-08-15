import { useCallback, useState } from 'react'

const FAV_KEY = 'chefe-coruja:favoritos'
const RECENT_KEY = 'chefe-coruja:recentes'

function ler(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function gravar(key: string, valor: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(valor))
  } catch {
    // ignore
  }
}

export function useFavoritos() {
  const [favoritos, setFavoritos] = useState<string[]>(() => ler(FAV_KEY))

  const alternarFavorito = useCallback((slug: string) => {
    setFavoritos((prev) => {
      const novo = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
      gravar(FAV_KEY, novo)
      return novo
    })
  }, [])

  return { favoritos, alternarFavorito }
}

export function registrarRecente(slug: string) {
  const atual = ler(RECENT_KEY)
  const novo = [slug, ...atual.filter((s) => s !== slug)].slice(0, 8)
  gravar(RECENT_KEY, novo)
}

export function useRecentes() {
  const [recentes, setRecentes] = useState<string[]>(() => ler(RECENT_KEY))
  return { recentes, setRecentes }
}
