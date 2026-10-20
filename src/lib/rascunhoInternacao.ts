import type { DadosPaciente } from '@/lib/rascunho'

export type { DadosPaciente } from '@/lib/rascunho'

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
