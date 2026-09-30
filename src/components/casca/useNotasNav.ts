import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { MinhaNotificacao, Papel } from '@/types/database'
import { avaliarUnidade, type ChamadoTecnico, type UnidadeRede } from '@/pages/admin/dadosAdmin'

import type { ChaveNota } from './navegacao'

// As notas numéricas da navegação (P/index.html: `estiloNota`, âmbar sobre
// #F59E0B1F): quantas pendências moram em cada tela. Cada contagem só roda
// para o papel que tem aquele item, e as chaves de cache são as mesmas das
// telas, então abrir a tela não refaz a consulta.

export function useNotasNav(unidadeId: string | undefined, papel: Papel | null): Partial<Record<ChaveNota, number>> {
  const ativo = !!unidadeId

  const avisos = useQuery({
    queryKey: ['minhas-notificacoes', unidadeId],
    enabled: ativo && papel === 'plantonista',
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('minhas_notificacoes', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as MinhaNotificacao[]
    },
  })

  const triagem = useQuery({
    queryKey: ['nota-fila-triagem', unidadeId],
    enabled: ativo && (papel === 'enfermeiro' || papel === 'recepcao'),
    refetchInterval: 20_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('episodios')
        .select('id', { count: 'exact', head: true })
        .eq('unidade_id', unidadeId!)
        .eq('etapa', 'triagem')
      if (error) throw error
      return count ?? 0
    },
  })

  const farmacia = useQuery({
    queryKey: ['nota-fila-validacao', unidadeId],
    enabled: ativo && papel === 'farmaceutico',
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fila_validacao', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []).length
    },
  })

  const pedidos = useQuery({
    queryKey: ['painel-gestor', unidadeId],
    enabled: ativo && papel === 'gestor',
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('painel_gestor', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as { pedidos_acesso_pendentes?: number; presenca?: { em_expediente?: number } }
    },
  })

  const tele = useQuery({
    queryKey: ['nota-tele', unidadeId],
    enabled: ativo && (papel === 'telemedicina' || papel === 'plantonista'),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('teleinterconsultas_da_unidade', { p_unidade: unidadeId!, p_dias: 1 })
      if (error) throw error
      const lista = (data ?? []) as { status: string; minha: boolean }[]
      // telemedicina: chamados esperando alguém aceitar; plantonista: as suas
      // que já voltaram respondidas hoje.
      return papel === 'telemedicina'
        ? lista.filter((t) => t.status === 'aberta').length
        : lista.filter((t) => t.status === 'em_atendimento').length
    },
  })

  // Recepção: quem espera o médico (triado, atendimento ainda não começou)
  const filaMedica = useQuery({
    queryKey: ['nota-fila-medica', unidadeId],
    enabled: ativo && papel === 'recepcao',
    refetchInterval: 20_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('episodios')
        .select('id', { count: 'exact', head: true })
        .eq('unidade_id', unidadeId!)
        .eq('etapa', 'atendimento')
        .is('atendimento_iniciado_em', null)
      if (error) throw error
      return count ?? 0
    },
  })

  // Administrador: unidades que pedem atenção e chamados técnicos abertos
  // (mesmas chaves de cache das telas Plataformas e Pendências)
  const unidadesRede = useQuery({
    queryKey: ['admin-unidades'],
    enabled: papel === 'admin',
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_unidades')
      if (error) throw error
      return (data ?? []) as UnidadeRede[]
    },
  })
  const chamados = useQuery({
    queryKey: ['chamados-tecnicos', false],
    enabled: papel === 'admin',
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('chamados_tecnicos_lista', { p_incluir_resolvidos: false })
      if (error) throw error
      return (data ?? []) as ChamadoTecnico[]
    },
  })

  return {
    fila_medica: filaMedica.data,
    plataformas: unidadesRede.data?.filter((u) => avaliarUnidade(u, unidadesRede.dataUpdatedAt).estado > 0).length,
    chamados: chamados.data?.length,
    avisos: (avisos.data ?? []).filter((n) => !n.lida).length,
    triagem: triagem.data,
    farmacia: farmacia.data,
    pedidos: pedidos.data?.pedidos_acesso_pendentes,
    tele: tele.data,
  }
}
