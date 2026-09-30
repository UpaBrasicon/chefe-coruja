import { useQuery } from '@tanstack/react-query'
import { Building2, Droplet, FlaskConical, Hourglass, LayoutGrid, Stethoscope } from 'lucide-react'
import { useMemo } from 'react'

import { useUnidade } from '@/contexts/UnidadeContext'
import { supabase } from '@/lib/supabase'

import type { EntradaPaleta } from './fontesPaleta'

// Fontes da paleta que vêm do banco, por papel na unidade ativa (protótipo:
// fontesBusca). Tudo passa pela RLS de quem está logado; as consultas só
// rodam com a paleta aberta. Nenhuma consulta procura paciente fora do acesso.

const STATUS_ATIVOS = ['admitido', 'em_observacao', 'internado']
const TIPO_SETOR: Record<string, string> = {
  emergencia: 'Emergência', observacao: 'Observação', internacao: 'Internação',
  isolamento: 'Isolamento', uti: 'UTI', outro: 'Outro',
}
const SIT_FALTA: Record<string, string> = { registrada: 'Registrada', em_cotacao: 'Em cotação' }
const FRESCO = 30_000

export type FontesDoBanco = {
  entradas: EntradaPaleta[]
  /** A fonte de pacientes está ligada (papel plantonista) e já respondeu sem erro. */
  pacientesProntos: boolean
}

export function useFontesDoBanco(aberta: boolean): FontesDoBanco {
  const { unidadeAtiva, papeisDaUnidade } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const ehPlantonista = papeisDaUnidade.includes('plantonista')
  const ehGestor = papeisDaUnidade.includes('gestor')
  const ehFarm = papeisDaUnidade.includes('farmaceutico')
  const ehAdmin = papeisDaUnidade.includes('admin')

  // Plantonista: internados e em observação que a RLS de `pacientes` deixa ver
  // (setores da escala agora, porta, pedido de acesso aprovado). É a mesma
  // consulta do painel de internação.
  const pacientes = useQuery({
    queryKey: ['paleta-pacientes', unidadeId],
    enabled: aberta && ehPlantonista && !!unidadeId,
    staleTime: FRESCO,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('id, nome, nome_social, setores!pacientes_setor_id_fkey(nome, tipo)')
        .eq('unidade_id', unidadeId!)
        .eq('ativo', true)
        .not('setor_id', 'is', null)
        .order('nome')
        .limit(300)
      if (error) throw error
      return data ?? []
    },
  })

  // Leito atual de cada internação ativa (RLS: setores da escala agora).
  // Sem acesso ao leito, o paciente entra só com o setor.
  const leitos = useQuery({
    queryKey: ['paleta-leitos', unidadeId],
    enabled: aberta && ehPlantonista && !!unidadeId,
    staleTime: FRESCO,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internacoes')
        .select('paciente_id, leitos!internacoes_leito_atual_id_fkey(identificador)')
        .eq('unidade_id', unidadeId!)
        .in('status', STATUS_ATIVOS)
      if (error) throw error
      const m = new Map<string, string>()
      for (const i of data ?? []) if (i.leitos?.identificador) m.set(i.paciente_id, i.leitos.identificador)
      return m
    },
  })

  // Gestor: setores da unidade.
  const setores = useQuery({
    queryKey: ['paleta-setores', unidadeId],
    enabled: aberta && ehGestor && !!unidadeId,
    staleTime: FRESCO,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('setores')
        .select('id, nome, tipo')
        .eq('unidade_id', unidadeId!)
        .eq('ativo', true)
        .order('ordem')
      if (error) throw error
      return data ?? []
    },
  })

  // Farmacêutico: padrão de diluição vigente e faltas em aberto da unidade.
  const diluicoes = useQuery({
    queryKey: ['paleta-diluicoes'],
    enabled: aberta && ehFarm,
    staleTime: FRESCO,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diluicao')
        .select('id, principio_ativo, via, apresentacao')
        .eq('status', 'publicado')
        .order('principio_ativo')
        .limit(500)
      if (error) throw error
      return data ?? []
    },
  })
  const faltas = useQuery({
    queryKey: ['paleta-faltas', unidadeId],
    enabled: aberta && ehFarm && !!unidadeId,
    staleTime: FRESCO,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faltas_medicamento')
        .select('id, situacao, medicamento:medicamento(principio_ativo, apresentacao)')
        .eq('unidade_id', unidadeId!)
        .neq('situacao', 'reposta')
        .order('sinalizada_em', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as unknown as {
        id: string; situacao: string; medicamento: { principio_ativo: string; apresentacao: string | null } | null
      }[]
    },
  })

  // Administrador: unidades da organização, em agregado (nunca nome de paciente).
  const unidades = useQuery({
    queryKey: ['paleta-unidades'],
    enabled: aberta && ehAdmin,
    staleTime: FRESCO,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('painel_organizacao', { p_dias: 30 })
      if (error) throw error
      return data ?? []
    },
  })

  const entradas = useMemo<EntradaPaleta[]>(() => {
    const e: EntradaPaleta[] = []
    if (ehAdmin) {
      for (const u of unidades.data ?? []) {
        e.push({
          id: `unidade:${u.unidade_id}`, grupo: 'Unidades', rotulo: u.unidade_nome,
          detalhe: `${u.leitos_ocupados} de ${u.leitos} leitos`, to: '/painel', termos: u.unidade_nome, icone: Building2,
        })
      }
    }
    if (ehFarm) {
      for (const d of diluicoes.data ?? []) {
        e.push({
          id: `diluicao:${d.id}`, grupo: 'Padrão de diluição', rotulo: d.principio_ativo,
          detalhe: `${d.via} · ${d.apresentacao}`, to: '/farmacia', termos: `${d.principio_ativo} ${d.via} ${d.apresentacao}`,
          icone: FlaskConical,
        })
      }
      for (const f of faltas.data ?? []) {
        if (!f.medicamento) continue
        e.push({
          id: `falta:${f.id}`, grupo: 'Faltas abertas', rotulo: f.medicamento.principio_ativo,
          detalhe: [f.medicamento.apresentacao, SIT_FALTA[f.situacao] ?? f.situacao].filter(Boolean).join(' · '),
          to: '/farmacia', termos: `${f.medicamento.principio_ativo} ${f.medicamento.apresentacao ?? ''} falta`, icone: Droplet,
        })
      }
    }
    if (ehGestor) {
      for (const s of setores.data ?? []) {
        const tipo = TIPO_SETOR[s.tipo] ?? s.tipo
        e.push({
          id: `setor:${s.id}`, grupo: 'Setores', rotulo: s.nome, detalhe: tipo,
          to: '/unidade?aba=setores', termos: `${s.nome} ${tipo} setor`, icone: LayoutGrid,
        })
      }
    }
    if (ehPlantonista) {
      for (const p of pacientes.data ?? []) {
        const obs = p.setores?.tipo === 'observacao'
        const leito = leitos.data?.get(p.id)
        const setor = p.setores?.nome ?? ''
        const onde = leito ? `${obs ? 'Box' : 'Leito'} ${leito}` : ''
        e.push({
          id: `paciente:${p.id}`, grupo: obs ? 'Em observação' : 'Internados', rotulo: p.nome,
          detalhe: [onde, setor].filter(Boolean).join(' · '),
          // Mesmo destino do botão "Abrir" do painel: o formulário com o paciente carregado.
          to: `/plantao/internacao/formulario?paciente=${p.id}`,
          termos: `${p.nome} ${p.nome_social ?? ''} ${onde} ${leito ?? ''} ${setor}`,
          icone: obs ? Hourglass : Stethoscope, paciente: true,
        })
      }
    }
    return e
  }, [ehAdmin, ehFarm, ehGestor, ehPlantonista, unidades.data, diluicoes.data, faltas.data, setores.data, pacientes.data, leitos.data])

  return { entradas, pacientesProntos: ehPlantonista && pacientes.isSuccess }
}
