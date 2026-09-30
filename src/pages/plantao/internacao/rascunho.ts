import type { DadosPaciente } from '../shared/rascunho'
import { carregarEnvelope, hojeLocal, useRascunho as useRascunhoBase } from '../shared/rascunho'

export type { DadosPaciente } from '../shared/rascunho'

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

// O laudo de AIH e a ficha de admissão têm rascunho próprio, por paciente
// (LaudoAih.tsx e FichaAdmissao.tsx), como no protótipo.
export type Rascunho = {
  paciente: DadosPaciente
  prescricao: Prescricao
  evolucao: Evolucao
  exames: Exames
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
}

export function carregarRascunho(chave: string): Rascunho {
  const carregado = carregarEnvelope<Rascunho>(chave)
  if (!carregado) return RASCUNHO_INICIAL
  try {
    const parsed = carregado.dados as Partial<Rascunho>
    const r: Rascunho = {
      paciente: { ...RASCUNHO_INICIAL.paciente, ...(parsed.paciente ?? {}) },
      prescricao: { ...RASCUNHO_INICIAL.prescricao, ...(parsed.prescricao ?? {}) },
      evolucao: { ...RASCUNHO_INICIAL.evolucao, ...(parsed.evolucao ?? {}) },
      exames: { ...RASCUNHO_INICIAL.exames, ...(parsed.exames ?? {}) },
    }
    if (!r.paciente.dataAtual) r.paciente.dataAtual = hojeLocal()
    return r
  } catch {
    return RASCUNHO_INICIAL
  }
}

/** Autosave da Internação (localStorage por unidade + plantonista). */
export function useRascunho(unidadeId?: string, perfilId?: string) {
  return useRascunhoBase<Rascunho>('internacao', unidadeId, perfilId, carregarRascunho)
}
