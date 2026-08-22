import { useCallback, useState } from 'react'

const FAV_KEY = 'chefe-coruja:favoritos'
const RECENT_KEY = 'chefe-coruja:recentes'

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

/**
 * Entradas gravadas antes da correção eram só o slug. Aqui elas são
 * promovidas para `secao/slug` usando a primeira seção que contém o slug —
 * o usuário não perde os favoritos ao atualizar.
 */
function migrar(lista: string[], chavesConhecidas: string[]): string[] {
  const migrada = lista.map((item) =>
    item.includes('/') ? item : (chavesConhecidas.find((c) => c.endsWith(`/${item}`)) ?? item)
  )
  return migrada.filter((item, i) => migrada.indexOf(item) === i)
}

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

export function useFavoritos(chavesConhecidas: string[] = []) {
  const [favoritos, setFavoritos] = useState<string[]>(() => {
    const atual = ler(FAV_KEY)
    const migrado = migrar(atual, chavesConhecidas)
    if (migrado.join('|') !== atual.join('|')) gravar(FAV_KEY, migrado)
    return migrado
  })

  const alternarFavorito = useCallback((chave: string) => {
    setFavoritos((prev) => {
      const novo = prev.includes(chave) ? prev.filter((c) => c !== chave) : [...prev, chave]
      gravar(FAV_KEY, novo)
      return novo
    })
  }, [])

  return { favoritos, alternarFavorito }
}

export function registrarRecente(chave: string) {
  const atual = ler(RECENT_KEY)
  const novo = [chave, ...atual.filter((c) => c !== chave)].slice(0, 8)
  gravar(RECENT_KEY, novo)
}

export function useRecentes(chavesConhecidas: string[] = []) {
  const [recentes, setRecentes] = useState<string[]>(() => {
    const atual = ler(RECENT_KEY)
    const migrado = migrar(atual, chavesConhecidas)
    if (migrado.join('|') !== atual.join('|')) gravar(RECENT_KEY, migrado)
    return migrado
  })
  return { recentes, setRecentes }
}
