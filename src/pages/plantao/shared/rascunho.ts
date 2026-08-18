import { useCallback, useEffect, useRef, useState } from 'react'

/** TTL de rascunhos clínicos no navegador (LGPD — computador compartilhado de UPA). */
const TTL_RASCUNHO_MS = 12 * 60 * 60 * 1000 // 12 horas

const PREFIXO_RASCUNHO = 'cc:rascunho:'

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
  setor_id?: string | null
  paciente_id?: string | null
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

/** Remove TODAS as chaves de rascunho clínico do navegador (chamado no logout — LGPD). */
export function limparTodosRascunhos() {
  try {
    const chaves: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i)
      if (chave && chave.startsWith(PREFIXO_RASCUNHO)) chaves.push(chave)
    }
    for (const chave of chaves) localStorage.removeItem(chave)
  } catch {
    // armazenamento indisponível — ignora silenciosamente
  }
}

type EnvelopeRascunho<T> = { v: 1; salvoEm: number; dados: T }

/** Salva o rascunho com envelope + timestamp (para TTL). */
function salvarEnvelope<T>(chave: string, dados: T) {
  const envelope: EnvelopeRascunho<T> = { v: 1, salvoEm: Date.now(), dados }
  localStorage.setItem(chave, JSON.stringify(envelope))
}

/** Carrega o rascunho; se expirado (TTL de 12h) ou no formato antigo (sem envelope),
 * remove a chave e retorna `null` para o caller decidir o estado inicial. */
export function carregarEnvelope<T>(chave: string): { dados: T } | null {
  try {
    const raw = localStorage.getItem(chave)
    if (!raw) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      // rascunho corrompido — trata como expirado
      localStorage.removeItem(chave)
      return null
    }
    // Formato antigo (antes do envelope): não tem `v` — trata como expirado
    if (typeof parsed !== 'object' || parsed === null || !('v' in parsed)) {
      localStorage.removeItem(chave)
      return null
    }
    const env = parsed as EnvelopeRascunho<T>
    if (Date.now() - env.salvoEm > TTL_RASCUNHO_MS) {
      localStorage.removeItem(chave)
      return null
    }
    return { dados: env.dados }
  } catch {
    return null
  }
}

/**
 * Autosave genérico em memória (localStorage) com debounce — sem cliques.
 * `load` restaura o rascunho da chave; o valor é salvo automaticamente a cada mudança.
 * Rascunhos expiram após 12 horas (TTL) e são removidos no logout.
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
        salvarEnvelope(chave, dados)
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
