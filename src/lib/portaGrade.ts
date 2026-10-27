// Regras da grade de ações do gestor (P1; desenho B, escolhido pelo RT em
// 27/10/2026): o formato devolvido por porta_grade() e o texto e a situação de
// cada célula. Preto feito, verde pedido, vermelho atrasado; o atraso vem do
// banco, que só o marca onde a unidade tem alvo (decisões D3 e D4).
import type { CorRisco } from '@/domain/risco'

import { hora } from './formato.ts'

export type LinhaGrade = {
  episodio_id: string
  nome: string
  cor: CorRisco | null
  setor: string | null
  etapa: 'triagem' | 'atendimento'
  chegada_em: string
  no_ps_min: number
  no_ps_atrasado: boolean
  classificacao: { em: string | null; atrasada: boolean }
  chamada: { em: string | null; vezes: number; atrasada: boolean }
  atendimento: { em: string | null; atrasado: boolean }
  exames: { feitos: number; total: number; desde: string | null; atrasado: boolean }
  medicacao: { ultima_em: string | null; pendentes: number; desde: string | null; atrasada: boolean }
  reavaliacao: { feita_em: string | null; prevista_em: string | null; atrasada: boolean }
  desfecho: { tipo: string | null; em: string | null }
}
export type Grade = {
  gerado_em: string
  alvos: { classificacao: number | null; exame: number | null; medicacao: number | null; permanencia: number | null }
  pacientes: LinhaGrade[]
}

export type EstadoEtapa = 'feito' | 'pedido' | 'atrasado' | 'vazio'
export type Celula = { texto: string; estado: EstadoEtapa }

const VAZIO: Celula = { texto: '—', estado: 'vazio' }
const feito = (texto: string): Celula => ({ texto, estado: 'feito' })
const pendente = (texto: string, atrasado: boolean): Celula => ({ texto, estado: atrasado ? 'atrasado' : 'pedido' })

const ROTULO_DESFECHO: Record<string, string> = {
  alta: 'Alta', alta_apos_medicacao: 'Alta após medicação', alta_a_pedido: 'Alta a pedido', transferencia: 'Transferência',
  evasao: 'Evasão', obito: 'Óbito', observacao: 'Observação', internacao: 'Internação', cancelado: 'Cancelado',
}

export const ETAPAS_GRADE: { chave: string; rotulo: string; celula: (l: LinhaGrade) => Celula }[] = [
  {
    chave: 'classificacao', rotulo: 'Classificação',
    celula: (l) => (l.classificacao.em ? feito(hora(l.classificacao.em)) : l.etapa === 'triagem' ? pendente('falta', l.classificacao.atrasada) : VAZIO),
  },
  {
    // chamada repetida (D5): a hora da última e "2ª", "3ª"
    chave: 'chamada', rotulo: 'Chamada',
    celula: (l) => (l.chamada.em ? feito(hora(l.chamada.em) + (l.chamada.vezes > 1 ? ` · ${l.chamada.vezes}ª` : ''))
      : l.etapa === 'atendimento' ? pendente('falta', l.chamada.atrasada) : VAZIO),
  },
  {
    chave: 'atendimento', rotulo: 'Atendimento',
    celula: (l) => (l.atendimento.em ? feito(hora(l.atendimento.em)) : l.chamada.vezes > 0 ? pendente('falta', l.atendimento.atrasado) : VAZIO),
  },
  {
    chave: 'exames', rotulo: 'Exames',
    celula: (l) => {
      if (!l.exames.total) return VAZIO
      const t = `${l.exames.feitos} de ${l.exames.total}`
      return l.exames.feitos === l.exames.total ? feito(t) : pendente(t, l.exames.atrasado)
    },
  },
  {
    chave: 'medicacao', rotulo: 'Medicação',
    celula: (l) => (l.medicacao.pendentes
      ? pendente(`${l.medicacao.pendentes} pendente${l.medicacao.pendentes > 1 ? 's' : ''}`, l.medicacao.atrasada)
      : l.medicacao.ultima_em ? feito(hora(l.medicacao.ultima_em)) : VAZIO),
  },
  {
    // prevista: a hora marcada pelo médico; feita: a hora da última reavaliação
    chave: 'reavaliacao', rotulo: 'Reavaliação',
    celula: (l) => (l.reavaliacao.prevista_em ? pendente(hora(l.reavaliacao.prevista_em), l.reavaliacao.atrasada)
      : l.reavaliacao.feita_em ? feito(hora(l.reavaliacao.feita_em)) : VAZIO),
  },
  {
    chave: 'desfecho', rotulo: 'Desfecho',
    celula: (l) => (l.desfecho.tipo
      ? feito([ROTULO_DESFECHO[l.desfecho.tipo] ?? l.desfecho.tipo, l.desfecho.em ? hora(l.desfecho.em) : ''].filter(Boolean).join(' '))
      : VAZIO),
  },
]

/** Tem algum atraso na linha: o "No PS" ou alguma etapa. */
export const temAtraso = (l: LinhaGrade) => l.no_ps_atrasado || ETAPAS_GRADE.some((e) => e.celula(l).estado === 'atrasado')
