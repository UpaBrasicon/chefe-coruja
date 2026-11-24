// Dados do mapa de leitos do gestor (MapaLeitos e a gaveta do leito, PainelLeito):
// a RPC mapa_leitos_gestor (internação e observação) mais os setores com
// leitos cadastrados que ela não traz, lidos pelo status do leito.
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export type LeitoDoMapa = {
  id: string; identificador: string; status: string; ocupado: boolean; internacao_id: string | null
  /** lacuna 5 (O5): ocupado com o corpo, aguardando a liberação */
  aguardando_corpo?: boolean
  paciente_id: string | null; desde: string | null; vencidas: number; banda: number | null
}
export type SetorDoMapa = {
  id: string; nome: string; tipo: string; leitos_total: number; leitos_ocupados: number; pacientes: number; sem_leito: number; leitos: LeitoDoMapa[]
  /** setor que a RPC do mapa não traz: a ocupação vem do status do leito */
  pelo_status?: boolean
}
export type Plantonista = { perfil_id: string; nome: string; setor: string; ate: string; pacientes: number }
export type AlertaMapa = { ordem: number; leito: string; setor: string; paciente_id: string; texto: string; nota: string | null; prazo?: string; selo: string }
export type Mapa = { limite: number; setores: SetorDoMapa[]; plantonistas: Plantonista[]; alertas: AlertaMapa[] }

export const ROTULO_STATUS_LEITO: Record<string, string> = {
  livre: 'livre', ocupado: 'ocupado', reservado: 'reservado', bloqueado: 'bloqueado', higienizacao: 'em higienização',
}

/** Leitos de setores fora de internação e observação (Sala Vermelha, emergência), lidos do cadastro. */
function useSetoresPeloStatus(unidadeId: string | undefined) {
  return useQuery({
    queryKey: ['mapa-leitos-outros-setores', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('setores')
        .select('id, nome, tipo, ordem, leitos(id, identificador, status, ativo)')
        .eq('unidade_id', unidadeId!)
        .eq('ativo', true)
        .not('tipo', 'in', '(internacao,observacao)')
        .order('ordem')
      if (error) throw error
      return (data ?? [])
        .map((s): SetorDoMapa => {
          const leitos = (s.leitos ?? []).filter((l) => l.ativo).sort((a, b) => a.identificador.localeCompare(b.identificador, 'pt-BR', { numeric: true }))
          const ocupados = leitos.filter((l) => l.status === 'ocupado').length
          return {
            id: s.id, nome: s.nome, tipo: s.tipo, leitos_total: leitos.length, leitos_ocupados: ocupados, pacientes: ocupados, sem_leito: 0, pelo_status: true,
            leitos: leitos.map((l) => ({
              id: l.id, identificador: l.identificador, status: l.status, ocupado: l.status === 'ocupado', internacao_id: null,
              paciente_id: null, desde: null, vencidas: 0, banda: null,
            })),
          }
        })
        .filter((s) => s.leitos_total > 0)
    },
  })
}

/** O mapa da unidade (RPC do gestor mais os setores lidos pelo status do leito). */
export function useMapaLeitos(unidadeId: string | undefined) {
  const mapa = useQuery({
    queryKey: ['mapa-leitos-gestor', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('mapa_leitos_gestor', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as Mapa
    },
  })
  const outros = useSetoresPeloStatus(unidadeId)
  const dados = mapa.data ? { ...mapa.data, setores: [...(outros.data ?? []), ...mapa.data.setores] } : undefined
  return { carregando: mapa.isLoading, erro: mapa.error as Error | null, dados }
}

