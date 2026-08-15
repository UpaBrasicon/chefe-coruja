import { useCallback, useEffect, useRef, useState } from 'react'

export type DadosPaciente = {
  nome: string
  nascimento: string
  dataAtual: string
  idade: string
  peso: string
  alergias: string
  dieta: string
  leito: string
  diagnostico: string
}

export const DIETAS = ['Dieta livre', 'Dieta branda', 'Dieta líquida', 'Dieta zero (jejum)', 'Dieta para diabético', 'Dieta hipossódica', 'Outra']

export function hojeLocal() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function fmtData(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function idadeTexto(nascimento: string, dataAtual: string) {
  if (!nascimento || !dataAtual) return ''
  const partes = nascimento.split('/')
  if (partes.length !== 3) return ''
  const dn = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]))
  const da = new Date(dataAtual)
  if (isNaN(dn.getTime()) || isNaN(da.getTime())) return ''
  let anos = da.getFullYear() - dn.getFullYear()
  let meses = da.getMonth() - dn.getMonth()
  if (meses < 0 || (meses === 0 && da.getDate() < dn.getDate())) {
    anos--
    meses += 12
  }
  if (da.getDate() < dn.getDate()) meses--
  if (anos > 0) return `${anos} anos`
  if (meses > 0) return `${meses} meses`
  const dias = Math.floor((da.getTime() - dn.getTime()) / (1000 * 3600 * 24))
  return `${Math.max(0, dias)} dias`
}

export function novaChave(namespace: string, unidadeId?: string, perfilId?: string) {
  return `cc:rascunho:${namespace}:${perfilId ?? 'anon'}:${unidadeId ?? 'novo'}`
}

/**
 * Autosave genérico em memória (localStorage) com debounce — sem cliques.
 * `load` restaura o rascunho da chave; o valor é salvo automaticamente a cada mudança.
 */
export function useRascunho<T>(
  namespace: string,
  unidadeId: string | undefined,
  perfilId: string | undefined,
  load: (chave: string) => T
) {
  const chave = novaChave(namespace, unidadeId, perfilId)
  const [estado, setEstado] = useState<{ chave: string; dados: T }>(() => ({
    chave,
    dados: load(chave),
  }))
  const [salvoEm, setSalvoEm] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (estado.chave !== chave) {
    setEstado({ chave, dados: load(chave) })
  }

  const dados = estado.dados

  const atualizar = useCallback((novo: Partial<T>) => {
    setEstado((prev) => ({ ...prev, dados: { ...prev.dados, ...novo } }))
  }, [])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(chave, JSON.stringify(dados))
        setSalvoEm(new Date().toLocaleTimeString('pt-BR'))
      } catch {
        // armazenamento indisponível — ignora silenciosamente
      }
    }, 500)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [dados, chave])

  const limpar = useCallback(() => {
    try {
      localStorage.removeItem(chave)
    } catch {
      // ignora
    }
    setEstado({ chave, dados: load(chave) })
  }, [chave, load])

  return { dados, atualizar, salvoEm, limpar, chave }
}
