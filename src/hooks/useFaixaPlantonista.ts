import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Turno } from '@/domain/plantao'

// Dados da faixa do plantonista. Tudo lido pela RLS do próprio usuário: o que
// ele não enxerga não entra na conta — a faixa nunca mostra mais do que o
// plantonista tem direito de ver.

export type DadosFaixa = {
  agoraServidor: Date
  turno: Turno | null
  /** Janela do plantão em curso, lida da escala (null = sem plantão agora). */
  janela: { inicio: Date; fim: Date } | null
  setores: string[]
  pacientes: number
  leitos: number
  /** Minutos da permanência mais longa em observação que o plantonista vê; null = ninguém. */
  maiorObservacaoMin: number | null
}

export function useFaixaPlantonista(unidadeId?: string) {
  return useQuery({
    queryKey: ['faixa-plantonista', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<DadosFaixa> => {
      const [hora, turno, setoresRpc, plantao] = await Promise.all([
        supabase.rpc('horario_servidor'),
        supabase.rpc('turno_atual'),
        supabase.rpc('setores_na_escala_agora'),
        supabase.rpc('meu_plantao_agora'),
      ])
      if (hora.error) throw hora.error
      const agoraServidor = new Date(hora.data as string)
      const setores = Array.isArray(setoresRpc.data)
        ? (setoresRpc.data as unknown[]).filter((x): x is string => typeof x === 'string')
        : []

      let pacientes = 0
      let leitos = 0
      if (setores.length) {
        const [p, l] = await Promise.all([
          supabase.from('pacientes').select('id', { count: 'exact', head: true }).eq('ativo', true).in('setor_id', setores),
          supabase.from('leitos').select('id', { count: 'exact', head: true }).eq('ativo', true).in('setor_id', setores),
        ])
        pacientes = p.count ?? 0
        leitos = l.count ?? 0
      }

      const obs = await supabase
        .from('internacoes')
        .select('data_admissao, data_entrada_setor')
        .eq('unidade_id', unidadeId!)
        .eq('status', 'em_observacao')
      let maiorObservacaoMin: number | null = null
      for (const r of obs.data ?? []) {
        const desde = new Date((r.data_entrada_setor ?? r.data_admissao) as string)
        const min = Math.round((agoraServidor.getTime() - desde.getTime()) / 60_000)
        if (Number.isFinite(min)) maiorObservacaoMin = Math.max(maiorObservacaoMin ?? 0, min)
      }

      const t = turno.data as string | null
      const p = plantao.data?.[0]
      return {
        agoraServidor,
        janela: p ? { inicio: new Date(p.inicio), fim: new Date(p.fim) } : null,
        turno: t === 'manha' || t === 'tarde' || t === 'noite' ? t : null,
        setores,
        pacientes,
        leitos,
        maiorObservacaoMin,
      }
    },
  })
}
