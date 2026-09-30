// Peças comuns da janela do atendimento do Pronto-Socorro (protótipo,
// valsAtendPS): tipos, rótulos dos desfechos, relógio e o painel do
// atendimento lido do servidor (painel_atendimento_ps).
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import type { CorRisco } from '@/domain/risco'
import type { Publico } from '@/domain/vitais'

export type EpFila = {
  id: string
  paciente_id: string
  setor_id: string
  cor_atual: CorRisco
  classificado_em: string
  chegada_em: string
  queixa: string
  publico: Publico | null
  prioridades_legais: string[]
  atendimento_iniciado_em: string | null
  reavaliar_em: string | null
  paciente: { nome: string; nome_social: string | null; data_nascimento: string | null } | null
}

export const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
export const hora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—'
export const nomeDe = (e: Pick<EpFila, 'paciente'>) => e.paciente?.nome_social || e.paciente?.nome || 'Paciente'
export const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

/** "45 min", "3h20". */
export function minutos(desde: string | null | undefined, agora: number) {
  if (!desde) return ''
  const min = Math.max(0, Math.round((agora - Date.parse(desde)) / 60_000))
  return min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} min`
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

// ── desfechos (protótipo DESFECHOS_PS, DESF_OBS, DESF_NOTA) ──────────────────
export const DESFECHOS = [
  { valor: 'alta', rotulo: 'Alta médica' },
  { valor: 'alta_apos_medicacao', rotulo: 'Alta após medicação' },
  { valor: 'observacao', rotulo: 'Observação' },
  { valor: 'internacao', rotulo: 'Internação' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'evasao', rotulo: 'Evasão' },
  { valor: 'alta_a_pedido', rotulo: 'Alta a pedido' },
  { valor: 'obito', rotulo: 'Óbito' },
] as const
export type Desfecho = (typeof DESFECHOS)[number]['valor']
export const rotuloDesfecho = (d: string | null | undefined) =>
  DESFECHOS.find((x) => x.valor === d)?.rotulo ?? (d === 'cancelado' ? 'Excluído' : d ?? '—')

/** Rótulo do relato (≥ 15 letras) por desfecho. */
export const RELATO: Partial<Record<Desfecho, string>> = {
  evasao: 'Como e quando foi percebida a evasão',
  alta_a_pedido: 'Riscos explicados e termo assinado pelo paciente ou responsável',
  obito: 'Circunstâncias do óbito e medidas realizadas',
}
export const NOTA: Partial<Record<Desfecho, string>> = {
  internacao: 'Ao confirmar, o paciente vai para o setor de internação escolhido; o laudo de AIH fica no prontuário.',
  observacao: 'O paciente vai para o primeiro box livre da Observação e entra no aviso de 6 horas.',
  alta_apos_medicacao: 'Exige a medicação do PS administrada (checada pela enfermagem).',
  alta: 'Exige os exames pedidos com resultado.',
}
/** Desfechos que levam os dados da alta (CID de alta, data/hora, procedimento). */
export const COM_DADOS_ALTA: Desfecho[] = ['alta', 'alta_apos_medicacao', 'alta_a_pedido', 'transferencia', 'obito', 'evasao']
/** Desfechos em que o CID de alta é exigido pelo servidor. */
export const EXIGE_CID: Desfecho[] = ['alta', 'alta_apos_medicacao', 'alta_a_pedido', 'transferencia', 'obito']

// Exames do pedido rápido (protótipo EXAMES_DISP). Nome livre também entra.
export const EXAMES_RAPIDOS = ['Hemograma completo', 'PCR', 'Ureia e creatinina', 'Sódio e potássio', 'Gasometria arterial', 'Lactato',
  'TGO / TGP', 'Troponina', 'Urina tipo I', 'Radiografia de tórax', 'ECG', 'Hemocultura']

// ── SOAP em rascunho ────────────────────────────────────────────────────────
export type Soap = { s: string; o: string; a: string; cid: string; p: string }
export const SOAP_VAZIO: Soap = { s: '', o: '', a: '', cid: '', p: '' }
export const soapVazio = (x: Soap) => !Object.values(x).some((v) => v.trim())

// ── atestado e receita de alta (estado da janela, entre as abas) ────────────
export type ItemReceita = { id: string; medicamento_id: string | null; medicamento: string; posologia: string; quantidade: string }
export type EstadoDocs = {
  atTipo: 'afastamento' | 'comparecimento'; atDias: string; atCid: boolean; atEmitidoEm: string | null
  receita: ItemReceita[]; rxEmitidaEm: string | null
}
export const DOCS_INICIAL: EstadoDocs = { atTipo: 'afastamento', atDias: '', atCid: false, atEmitidoEm: null, receita: [], rxEmitidaEm: null }

// ── painel do atendimento (servidor) ────────────────────────────────────────
export type ItemPS = {
  id: string; tipo: 'medicamento' | 'cuidado'; descricao: string; dose: string | null; via: string | null
  posologia: string | null; se_necessario: boolean; diluicao_texto: string | null; criado_em: string; autor: string | null
  suspenso_em: string | null; motivo_suspensao: string | null
  checagem: { situacao: 'feito' | 'nao_feito' | 'recusado'; em: string; por: string | null; motivo: string | null } | null
}
export type ExamePS = {
  id: string; exame: string; situacao: 'pedido' | 'resultado' | 'cancelado'; pedido_em: string; resolvido_em: string | null
  resultado: string | null; motivo_cancelamento: string | null; impresso: boolean; pedido_por: string | null
}
export type ReavPS = { id: string; tipo: 'aguardar' | 'reavaliacao'; reavaliar_em: string | null; pendencia: string | null; texto: string | null; criado_em: string; autor: string | null }
export type PainelPS = {
  reavaliar_em: string | null
  pendencias: string[]
  prescricao: ItemPS[]
  exames: ExamePS[]
  reavaliacoes: ReavPS[]
  rascunho: Partial<Soap> | null
  linha: { em: string; titulo: string; texto: string | null }[]
  medico: string | null
  setor: string | null
}

export const chavePainel = (episodioId: string) => ['painel-atendimento-ps', episodioId] as const

export function usePainelPS(episodioId: string, habilitado: boolean) {
  return useQuery({
    queryKey: chavePainel(episodioId),
    enabled: habilitado,
    refetchInterval: 30_000, // a checagem da enfermagem e os resultados chegam de fora
    queryFn: async () => {
      const { data, error } = await supabase.rpc('painel_atendimento_ps', { p_episodio: episodioId })
      if (error) throw error
      return data as unknown as PainelPS
    },
  })
}

/** Recarrega o que a janela mostra do episódio (painel, SOAP, fila, documentos). */
export function useRecarregarAtendimento(episodioId: string, pacienteId: string) {
  const qc = useQueryClient()
  return React.useCallback(() => {
    for (const k of [chavePainel(episodioId), ['atendimento', episodioId], ['fila-medica'], ['saidas-plantao'],
      ['prescricao-vigente', pacienteId], ['peso-atual', pacienteId], ['exames-pedidos'], ['agravos'], ['alergias', pacienteId]]) {
      void qc.invalidateQueries({ queryKey: k })
    }
  }, [qc, episodioId, pacienteId])
}
