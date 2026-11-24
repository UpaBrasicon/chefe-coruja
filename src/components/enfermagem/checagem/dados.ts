// Leitura da checagem (Fase 4.6), comum à tela Checagem e à aba "Agora" da
// gaveta Cuidados (CK0, revisão do perfil Enfermeiro, RT 24/11/2026): a mesma
// fila_checagem e as mesmas consultas por item; na gaveta, filtradas pelo
// paciente. As chaves de cache são as de sempre, então abrir uma não refaz a
// outra.
import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { Alteracao } from '@/lib/alteracaoPrescricao'
import type { SugestaoItem } from '@/lib/aprazamento'
import type { ChecagemHorario } from '@/lib/atraso'
import type { Liberacao } from '@/lib/duplaChecagem'
import { supabase } from '@/lib/supabase'

export type LinhaChecagem = {
  paciente_id: string; paciente_nome: string; local: string | null; item_id: string; tipo: string; descricao: string
  dose: string | null; via: string | null; posologia: string | null; se_necessario: boolean; horarios: string[] | null
  diluicao_texto: string | null; vasoativo: boolean; ultima_situacao: string | null; ultima_em: string | null
  ultima_por: string | null; ultima_horario: string | null
  /** Última checagem de cada horário aprazado nas últimas 24 h (fila_checagem), com o atraso gravado (lacuna 9). */
  por_horario: Record<string, ChecagemHorario> | null
  prescrito_em: string | null
  /** Lacuna 6: validade do item, estado do servidor e o pedido de renovação. */
  valida_ate: string | null; validade: string | null; renovacao_pedida_em: string | null
}

/** Dose atrasada de um item (atrasos_de_dose, últimas 24 h). */
export type DoseAtrasada = {
  id: string; item_id: string; horario: string; previsto_em: string; origem: 'janela' | 'checagem'
  ciente_em: string | null; ciente_por: string | null; feito_em: string | null; atraso_min: number | null
  motivo_atraso: string | null; motivo_atraso_texto: string | null; omitida: boolean
}

/** O que cada item traz das outras leituras (liberação, aprazamento, alteração e atrasos). */
export type ContextoItens = {
  liberacao: Map<string, Liberacao> | undefined
  apraz: Map<string, SugestaoItem> | undefined
  alteracoes: Map<string, Alteracao> | undefined
  atrasos: Map<string, DoseAtrasada[]> | undefined
}

/** A fila da checagem do plantão; com `pacienteId`, só os itens dele (a gaveta). */
export function useChecagem(pacienteId?: string) {
  const qc = useQueryClient()
  const fila = useQuery({
    queryKey: ['fila-checagem'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fila_checagem')
      if (error) throw error
      return (data ?? []) as LinhaChecagem[]
    },
  })
  const linhas = (fila.data ?? []).filter((l) => !pacienteId || l.paciente_id === pacienteId)
  const ids = linhas.map((l) => l.item_id)
  const chave = ids.join(',')
  // alta vigilância e controlado: quais itens exigem liberação da farmácia e quem liberou
  const liberacao = useQuery({
    queryKey: ['liberacao-farmacia', chave],
    enabled: ids.length > 0,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('liberacao_farmacia', { p_itens: ids })
      if (error) throw error
      return new Map(((data ?? []) as unknown as Liberacao[]).map((e) => [e.item_id, e]))
    },
  })
  // sugestão de horários pela grade da unidade e o último aprazamento de cada item
  const apraz = useQuery({
    queryKey: ['sugestoes-aprazamento', chave],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('sugestoes_aprazamento', { p_itens: ids })
      if (error) throw error
      return new Map(((data ?? []) as unknown as SugestaoItem[]).map((e) => [e.item_id, e]))
    },
  })
  // item alterado pelo médico (Fase 2, tarefa 6): o que mudou e o motivo
  const alteracoes = useQuery({
    queryKey: ['alteracoes-itens', chave],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('alteracoes_de_itens', { p_itens: ids })
      if (error) throw error
      return new Map(((data ?? []) as unknown as Alteracao[]).map((e) => [e.item_id, e]))
    },
  })
  // lacuna 9: doses atrasadas das últimas 24 h, com a ciência do enfermeiro
  const atrasos = useQuery({
    queryKey: ['atrasos-de-dose', chave],
    enabled: ids.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('atrasos_de_dose', { p_itens: ids })
      if (error) throw error
      const m = new Map<string, DoseAtrasada[]>()
      for (const d of (data ?? []) as unknown as DoseAtrasada[]) m.set(d.item_id, [...(m.get(d.item_id) ?? []), d])
      return m
    },
  })
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['fila-checagem'] })
    void qc.invalidateQueries({ queryKey: ['atrasos-de-dose'] })
    void qc.invalidateQueries({ queryKey: ['liberacao-farmacia'] })
    void qc.invalidateQueries({ queryKey: ['sugestoes-aprazamento'] })
    void qc.invalidateQueries({ queryKey: ['alteracoes-itens'] })
    void qc.invalidateQueries({ queryKey: ['enfermagem-pendencias'] })
  }
  const ctx: ContextoItens = { liberacao: liberacao.data, apraz: apraz.data, alteracoes: alteracoes.data, atrasos: atrasos.data }
  return { carregando: fila.isLoading, erro: fila.error, linhas, ctx, recarregar }
}
