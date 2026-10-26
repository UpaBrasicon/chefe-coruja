import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { gravarSala, lerSala, type NaFila } from './comum'

// Sala da triagem (escolhida uma vez, guardada no aparelho) e a última chamada
// de cada ficha. Separado da tabela da fila (Fila.tsx) para a barra da sala
// ficar acima das abas da triagem (revisão visual 3.4).

export type SalaTriagem = { id: string; nome: string; setor_id: string; setor: { nome: string } | null }
export type UltimaChamada = { numero: number; sala: string; em: string }

function useSalasTriagem(setores: string[]) {
  return useQuery({
    queryKey: ['salas-triagem', setores.join(',')],
    enabled: setores.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salas')
        .select('id, nome, setor_id, setor:setores(nome)')
        .in('setor_id', setores)
        .eq('tipo', 'triagem')
        .eq('ativo', true)
        .order('ordem')
      if (error) throw error
      return (data ?? []) as unknown as SalaTriagem[]
    },
  })
}

/** Última chamada de cada episódio na triagem (últimas 24 h). */
function useChamadasTriagem(setores: string[]) {
  return useQuery({
    queryKey: ['triagem-chamadas', setores.join(',')],
    enabled: setores.length > 0,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chamadas')
        .select('episodio_id, numero, criado_em, sala:salas(nome)')
        .in('setor_id', setores)
        .eq('etapa', 'triagem')
        .gte('criado_em', new Date(Date.now() - 24 * 3600_000).toISOString())
      if (error) throw error
      const mapa = new Map<string, UltimaChamada>()
      for (const c of (data ?? []) as unknown as { episodio_id: string; numero: number; criado_em: string; sala: { nome: string } | null }[]) {
        const atual = mapa.get(c.episodio_id)
        if (!atual || c.numero > atual.numero) mapa.set(c.episodio_id, { numero: c.numero, sala: c.sala?.nome ?? '', em: c.criado_em })
      }
      return mapa
    },
  })
}

/** Sala, chamadas e escolha da sala da fila da triagem (a sala fica no aparelho). */
export function useSalaTriagem(fila: NaFila[]) {
  const setores = React.useMemo(() => [...new Set(fila.map((e) => e.setor_id))], [fila])
  const salas = useSalasTriagem(setores)
  const chamadas = useChamadasTriagem(setores)
  const [escolhidas, setEscolhidas] = React.useState<Record<string, string>>({})
  // a sala guardada no aparelho vale enquanto existir nesta porta
  const salaDoSetor = (setor: string) => {
    const doSetor = (salas.data ?? []).filter((s) => s.setor_id === setor)
    const id = escolhidas[setor] ?? lerSala(setor)
    return doSetor.find((s) => s.id === id)?.id
  }
  const escolher = (setor: string, sala: string) => {
    gravarSala(setor, sala)
    setEscolhidas((m) => ({ ...m, [setor]: sala }))
  }
  const escolhidasAgora = Object.fromEntries(setores.map((s) => [s, salaDoSetor(s) ?? '']))
  return { setores, salas: salas.data, escolhidas: escolhidasAgora, escolher, chamadas: chamadas.data, salaDoSetor }
}

export type SalaTriagemCtx = ReturnType<typeof useSalaTriagem>

