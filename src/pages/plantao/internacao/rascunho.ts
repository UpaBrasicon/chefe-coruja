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

export type Prescricao = {
  marcados: string[]
  obs: string
}

export type Evolucao = {
  tipo: 'admissao' | 'evolucao'
  texto: string
}

export type Exames = {
  texto: string
}

export type Aih = {
  campo1: string
  campo2: string
  campo3: string
  campo4: string
  campo5: string
  campo6: string
  campo7: string
  campo8: string
  campo9: string
  campo10: string
  campo10_1: string
  campo11: string
  campo12: string
  campo13: string
  campo14: string
  campo15: string
  campo16: string
  campo17: string
  campo18: string
  campo19: string
  campo20: string
  campo21: string
  campo22: string
  campo23: string
  campo24: string
  campo25: string
  campo26: string
  campo27: string
  campo28: string
  campo29: string
  campo30: string
  campo31: string
  campo32: string
  campo33: string
  campo34: string
  campo35: string
  campo46: string
  campo47: string
  campo50: string
  campo51: string
  campo52: string
}

export type Rascunho = {
  paciente: DadosPaciente
  prescricao: Prescricao
  evolucao: Evolucao
  exames: Exames
  aih: Aih
}

export const RASCUNHO_INICIAL: Rascunho = {
  paciente: {
    nome: '',
    nascimento: '',
    dataAtual: '',
    idade: '',
    peso: '',
    alergias: '',
    dieta: 'Dieta livre',
    leito: '',
    diagnostico: '',
  },
  prescricao: {
    marcados: [],
    obs: '',
  },
  evolucao: {
    tipo: 'admissao',
    texto: '',
  },
  exames: {
    texto: '',
  },
  aih: {
    campo1: 'UPA BRASICON',
    campo2: '',
    campo3: '',
    campo4: '',
    campo5: '',
    campo6: '',
    campo7: '',
    campo8: '',
    campo9: '',
    campo10: '',
    campo10_1: '',
    campo11: '',
    campo12: '',
    campo13: '',
    campo14: '',
    campo15: '',
    campo16: '',
    campo17: '',
    campo18: '',
    campo19: '',
    campo20: '',
    campo21: '',
    campo22: '',
    campo23: '',
    campo24: '',
    campo25: '',
    campo26: '',
    campo27: '',
    campo28: '',
    campo29: '',
    campo30: 'URGÊNCIA',
    campo31: '',
    campo32: '',
    campo33: '',
    campo34: '',
    campo35: '',
    campo46: '',
    campo47: '',
    campo50: '',
    campo51: '',
    campo52: '',
  },
}

function hojeLocal() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function novaChave(unidadeId?: string, perfilId?: string) {
  return `cc:rascunho:${perfilId ?? 'anon'}:${unidadeId ?? 'novo'}`
}

export function carregarRascunho(chave: string): Rascunho {
  try {
    const raw = localStorage.getItem(chave)
    if (!raw) return RASCUNHO_INICIAL
    const parsed = JSON.parse(raw) as Partial<Rascunho>
    const r: Rascunho = {
      paciente: { ...RASCUNHO_INICIAL.paciente, ...(parsed.paciente ?? {}) },
      prescricao: { ...RASCUNHO_INICIAL.prescricao, ...(parsed.prescricao ?? {}) },
      evolucao: { ...RASCUNHO_INICIAL.evolucao, ...(parsed.evolucao ?? {}) },
      exames: { ...RASCUNHO_INICIAL.exames, ...(parsed.exames ?? {}) },
      aih: { ...RASCUNHO_INICIAL.aih, ...(parsed.aih ?? {}) },
    }
    if (!r.paciente.dataAtual) r.paciente.dataAtual = hojeLocal()
    return r
  } catch {
    return RASCUNHO_INICIAL
  }
}

/**
 * Autosave em memória (localStorage) com debounce — sem cliques.
 * Persiste por unidade + plantonista (ou anônimo).
 */
export function useRascunho(unidadeId?: string, perfilId?: string) {
  const chave = novaChave(unidadeId, perfilId)
  const [estado, setEstado] = useState<{ chave: string; dados: Rascunho }>(() => ({
    chave,
    dados: carregarRascunho(chave),
  }))
  const [salvoEm, setSalvoEm] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (estado.chave !== chave) {
    setEstado({ chave, dados: carregarRascunho(chave) })
  }

  const dados = estado.dados

  const atualizar = useCallback((novo: Partial<Rascunho>) => {
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
    setEstado({ chave, dados: RASCUNHO_INICIAL })
  }, [chave])

  return { dados, atualizar, salvoEm, limpar, chave }
}
