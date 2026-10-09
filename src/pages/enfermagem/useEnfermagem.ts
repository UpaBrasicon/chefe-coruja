// Peças comuns das telas da enfermagem: os setores da escala agora (a escala
// é a porta, ADR 0003), as pendências do turno (aprazamentos atrasados, do
// servidor) e os rótulos de tempo e idade.
import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { rotuloIdade } from '@/domain/idade'
import type { Database } from '@/types/database'

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

const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
export const idadeDe = (nasc: string | null | undefined) => (nasc ? rotuloIdade(nasc, hoje()) : '')
/** Adulto (14 anos completos ou mais, CLAUDE.md)? Sem data de nascimento: não se sabe (null). */
export function ehAdulto(nasc: string | null | undefined): boolean | null {
  if (!nasc) return null
  const [a, m, d] = nasc.slice(0, 10).split('-').map(Number)
  const [ha, hm, hd] = hoje().split('-').map(Number)
  const anos = ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0)
  return anos >= 14
}
export const hora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—'
export const quando = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
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
      const { data, error } = await supabase.rpc('setores_na_escala_agora')
      if (error) throw error
      return (Array.isArray(data) ? data : []) as string[]
    },
  })
}

/** Tipos de setor que contam como internação (fora da porta e da observação). */
export const TIPOS_INTERNACAO = ['internacao', 'uti', 'isolamento']

/** Setores da escala agora com o tipo, para saber se há internação entre eles. */
export function useTiposDaEscala() {
  const setores = useSetoresDaEscala()
  const meus = setores.data ?? []
  const tipos = useQuery({
    queryKey: ['setores-tipos', meus],
    enabled: meus.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('setores').select('id, tipo').in('id', meus)
      if (error) throw error
      return (data ?? []).map((s) => s.tipo as string)
    },
  })
  return {
    carregando: setores.isLoading || (meus.length > 0 && tipos.isLoading),
    tipos: tipos.data ?? [],
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

/** Contagem de atrasados por paciente. */
export function atrasadosPorPaciente(p: PendenciaEnfermagem[] | undefined) {
  const m = new Map<string, number>()
  for (const x of p ?? []) m.set(x.paciente_id, (m.get(x.paciente_id) ?? 0) + 1)
  return m
}
