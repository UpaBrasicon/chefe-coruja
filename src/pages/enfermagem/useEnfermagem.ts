// Peças comuns das telas da enfermagem: os setores da escala agora (a escala
// é a porta, ADR 0003), as pendências do turno (aprazamentos atrasados, do
// servidor) e os rótulos de tempo e idade.
import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { ativasPorPaciente, selosDaContencao, type ContencaoAtiva } from '@/lib/contencao'
import { SEM_PENDENCIA, type PendenciasPaciente } from '@/lib/pendenciasEnfermagem'
import { resumoValidade } from '@/lib/validadePrescricao'
import { setoresNaEscalaAgora } from '@/lib/rpcCasca'
import { useUnidade } from '@/contexts/UnidadeContext'
import { rotuloIdade } from '@/domain/idade'
import type { Database } from '@/types/database'
import { dataIso, diaMesHora, hora as horaFmt } from '@/lib/formato'

type Fn = Database['public']['Functions']
export type LeitoEnfermagem = Fn['enfermagem_leitos']['Returns'][number]
export type PendenciaEnfermagem = Fn['enfermagem_pendencias']['Returns'][number]
export type PassagemEnfermagem = Omit<Fn['passagens_enfermagem_do_plantao']['Returns'][number], 'pendencias' | 'leitos'> & {
  pendencias: { paciente_id: string; nome: string; local: string | null; descricao: string; horario: string; previsto_em: string }[]
  leitos: {
    paciente_id: string; nome: string; local: string | null; texto: string
    pendencias: { descricao: string; horario: string; previsto_em: string }[]
  }[]
}

const hoje = () => dataIso()
export const idadeDe = (nasc: string | null | undefined) => (nasc ? rotuloIdade(nasc, hoje()) : '')
/** Adulto (14 anos completos ou mais, CLAUDE.md)? Sem data de nascimento: não se sabe (null). */
export function ehAdulto(nasc: string | null | undefined): boolean | null {
  if (!nasc) return null
  const [a, m, d] = nasc.slice(0, 10).split('-').map(Number)
  const [ha, hm, hd] = hoje().split('-').map(Number)
  const anos = ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0)
  return anos >= 14
}
export const hora = (iso: string | null | undefined) => (iso ? horaFmt(iso) : '—')
export const quando = (iso: string | null | undefined) => (iso ? diaMesHora(iso) : '—')
export const msgErro = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

/** Pílula de estado (cápsula de 12px, 600). */
export const PILULA = 'inline-flex items-center gap-1 self-start rounded-capsula px-2.5 py-[3px] text-rotulo font-semibold whitespace-nowrap'

/** "45 min", "3h20", "4 dias". */
export function duracao(desde: string | null | undefined, agora: number) {
  if (!desde) return ''
  const min = Math.max(0, Math.round((agora - Date.parse(desde)) / 60_000))
  if (min < 60) return `${min} min`
  if (min < 48 * 60) return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
  return `${Math.floor(min / 1440)} dias`
}

/** Relógio da tela: anda sozinho, sem recarregar nada. */
export function useAgora(intervalo = 30_000) {
  const [agora, setAgora] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), intervalo)
    return () => window.clearInterval(t)
  }, [intervalo])
  return agora
}

/** Setores em que estou escalado agora (a mesma chave da fila médica). */
export function useSetoresDaEscala() {
  const { unidadeAtiva } = useUnidade()
  return useQuery({
    queryKey: ['setores-na-escala', unidadeAtiva?.unidade_id],
    enabled: !!unidadeAtiva,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await setoresNaEscalaAgora()
      if (error) throw error
      return (Array.isArray(data) ? data : []) as string[]
    },
  })
}

/** Tipos de setor que contam como internação (fora da porta e da observação). */
export const TIPOS_INTERNACAO = ['internacao', 'uti', 'isolamento']

export type SetorDaEscala = { id: string; nome: string; tipo: string }

/**
 * Setores da escala agora com o nome e o tipo. TE3 (RT 24/11/2026): o
 * Pronto-Socorro da enfermagem fica com os setores de porta e observação; a
 * Internação, com os de internação (TIPOS_INTERNACAO).
 */
export function useSetoresComTipo() {
  const setores = useSetoresDaEscala()
  const meus = setores.data ?? []
  const q = useQuery({
    queryKey: ['setores-da-escala-tipos', meus],
    enabled: meus.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('setores').select('id, nome, tipo').in('id', meus).order('nome')
      if (error) throw error
      return (data ?? []) as SetorDaEscala[]
    },
  })
  const lista = q.data ?? []
  return {
    carregando: setores.isLoading || (meus.length > 0 && q.isLoading),
    erro: setores.error ?? q.error,
    /** a escala agora tem algum setor (antes de saber os tipos) */
    naEscala: meus.length > 0,
    internacao: lista.filter((s) => TIPOS_INTERNACAO.includes(s.tipo)),
    porta: lista.filter((s) => !TIPOS_INTERNACAO.includes(s.tipo)),
  }
}

/** Setores da escala agora com o tipo, para saber se há internação entre eles. */
export function useTiposDaEscala() {
  const s = useSetoresComTipo()
  return { carregando: s.carregando, tipos: [...s.internacao, ...s.porta].map((x) => x.tipo) }
}

/**
 * As pendências do plantão por paciente (PS1, IN3): aprazamentos atrasados,
 * validade da prescrição e contenção ativa. Fugulin e Dini entram pela tela
 * da Internação, que lê a classificação de hoje.
 */
export function usePendenciasPorPaciente(agora: number) {
  const pendencias = usePendenciasEnfermagem()
  const atrasados = atrasadosPorPaciente(pendencias.data)
  const contencoes = useContencoesAtivas()
  const validade = useValidadePorPaciente(agora)
  return (pacienteId: string, extra?: Partial<PendenciasPaciente>): PendenciasPaciente => {
    const v = validade.get(pacienteId)
    const c = contencoes.get(pacienteId)
    const selo = c ? selosDaContencao(c)[0] : undefined
    return {
      ...SEM_PENDENCIA,
      vencidos: v?.vencidos ?? 0,
      vencendo: v?.vencendo ?? 0,
      atrasados: atrasados.get(pacienteId) ?? 0,
      contencao: c ? { texto: selo?.texto ?? 'Em contenção mecânica', critico: selo?.tom === 'critico' } : null,
      ...extra,
    }
  }
}

/** Aprazamentos atrasados dos pacientes dos setores da escala. */
export function usePendenciasEnfermagem() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  return useQuery({
    queryKey: ['enfermagem-pendencias', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('enfermagem_pendencias', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as PendenciaEnfermagem[]
    },
  })
}

/** Contenções ativas dos pacientes que eu acompanho (lacuna 4), por paciente. */
export function useContencoesAtivas() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const q = useQuery({
    queryKey: ['contencoes-ativas', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('contencoes_ativas', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as unknown as ContencaoAtiva[]
    },
  })
  return ativasPorPaciente(q.data)
}

/**
 * Validade da prescrição por paciente (lacuna 6): itens vencidos e vencendo,
 * da fila da Checagem (a mesma leitura e o mesmo cache).
 */
export function useValidadePorPaciente(agora: number) {
  const q = useQuery({
    queryKey: ['fila-checagem'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fila_checagem')
      if (error) throw error
      return data ?? []
    },
  })
  const porPaciente = new Map<string, { tipo: string; valida_ate: string | null; validade: string | null }[]>()
  for (const l of (q.data ?? []) as { paciente_id: string; tipo: string; valida_ate: string | null; validade: string | null }[]) {
    porPaciente.set(l.paciente_id, [...(porPaciente.get(l.paciente_id) ?? []), l])
  }
  return new Map([...porPaciente].map(([id, itens]) => [id, resumoValidade(itens, agora)]))
}

export type SituacaoLeito = Fn['situacao_leitos']['Returns'][number]

// lacuna 5 (O5): o leito do óbito segue ocupado, com o corpo, até a liberação
export const situacaoDoLeito = (l: { status: string; motivo: string | null }) => (l.status === 'ocupado' && l.motivo === 'aguardando_corpo' ? 'aguardando_corpo' : l.status)
/** Leito sem paciente na lista da enfermagem: livre, reservado, em higienização, bloqueado ou com o corpo. */
export const leitoSemPaciente = (l: SituacaoLeito) => l.status !== 'ocupado' || situacaoDoLeito(l) === 'aguardando_corpo'

/** A situação dos leitos da unidade (situacao_leitos), a mesma chave em todas as telas. */
export function useSituacaoLeitos(unidadeId: string | undefined, ativo = true) {
  return useQuery({
    queryKey: ['situacao-leitos', unidadeId],
    enabled: !!unidadeId && ativo,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('situacao_leitos', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as SituacaoLeito[]
    },
  })
}

/** Contagem de atrasados por paciente. */
export function atrasadosPorPaciente(p: PendenciaEnfermagem[] | undefined) {
  const m = new Map<string, number>()
  for (const x of p ?? []) m.set(x.paciente_id, (m.get(x.paciente_id) ?? 0) + 1)
  return m
}
