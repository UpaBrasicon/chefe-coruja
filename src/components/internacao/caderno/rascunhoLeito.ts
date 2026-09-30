// Rascunho dos documentos do leito (pedido de exames, peso e dieta), por
// paciente: as abas do formulário de internação (pages/plantao/internacao)
// são reaproveitadas no caderno, e cada leito tem o seu rascunho — o do
// formulário é um só por médico. Mesmo mecanismo (localStorage com prazo de
// 12 h, apagado ao sair do sistema).
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { ativas, useAlergias } from '@/components/paciente/useAlergias'
import { RASCUNHO_INICIAL, type DadosPaciente, type Evolucao, type Exames } from '@/pages/plantao/internacao/rascunho'
import { carregarEnvelope, hojeLocal, idadeTexto, useRascunho } from '@/pages/plantao/shared/rascunho'

export type RascunhoLeito = { evolucao: Evolucao; exames: Exames; peso: string; dieta: string }

const INICIAL: RascunhoLeito = {
  evolucao: { tipo: 'admissao', texto: '' },
  exames: RASCUNHO_INICIAL.exames,
  peso: '',
  dieta: 'Dieta livre',
}

function carregar(chave: string): RascunhoLeito {
  const c = carregarEnvelope<Partial<RascunhoLeito>>(chave)
  if (!c) return INICIAL
  const d = c.dados
  return {
    evolucao: { ...INICIAL.evolucao, ...(d.evolucao ?? {}) },
    exames: { ...INICIAL.exames, ...(d.exames ?? {}) },
    peso: d.peso ?? '',
    dieta: d.dieta ?? INICIAL.dieta,
  }
}

/** O rascunho do leito e os dados do paciente no formato das abas do formulário. */
export function useDocumentosLeito({ pacienteId, unidadeId, perfilId, leito, setorId, diagnostico }: {
  pacienteId: string
  unidadeId?: string
  perfilId?: string
  leito: string
  setorId: string | null
  diagnostico: string
}) {
  const r = useRascunho<RascunhoLeito>(`leito:${pacienteId}`, unidadeId, perfilId, carregar)
  // mesma chave e colunas do cabeçalho do paciente: uma leitura só
  const paciente = useQuery({
    queryKey: ['cabecalho-paciente', pacienteId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('nome, nome_social, data_nascimento, sexo').eq('id', pacienteId).maybeSingle()
      if (error) throw error
      return data
    },
  })
  const alergias = useAlergias(pacienteId)
  const p = paciente.data
  const nascimento = p?.data_nascimento ? p.data_nascimento.slice(0, 10).split('-').reverse().join('/') : ''
  const hoje = hojeLocal()
  const alergiaTexto = alergias.data?.estado === 'tem'
    ? ativas(alergias.data).map((a) => a.substancia).join(', ')
    : alergias.data?.estado === 'nega' ? 'NEGA' : ''
  const dados: DadosPaciente = {
    nome: p?.nome_social || p?.nome || '',
    nascimento,
    dataAtual: hoje,
    idade: idadeTexto(nascimento, hoje),
    peso: r.dados.peso,
    alergias: alergiaTexto,
    dieta: r.dados.dieta,
    leito,
    diagnostico,
    setor_id: setorId,
    paciente_id: pacienteId,
  }
  return { ...r, dadosPaciente: dados }
}
