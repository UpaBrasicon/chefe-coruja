// Trilha do episódio (eventos ADT e transferências) e checklist de admissão,
// que antes ficavam no diálogo "Abrir leito" do painel de internação.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { History } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import type { ChecklistAdmissao as Checklist, Database } from '@/types/database'

import { diaHora } from './comum'

type ChecklistInsert = Database['public']['Tables']['checklist_admissao']['Insert']

const TIPO_EVENTO: Record<string, string> = {
  admissao: 'Admissão',
  entrada_observacao: 'Entrada em observação',
  internacao: 'Internação',
  transferencia_leito: 'Transferência de leito',
  transferencia_setor: 'Transferência de setor',
  solicitacao_alta: 'Solicitação de alta',
  alta_melhorada: 'Alta melhorada',
  alta_pedido: 'Alta a pedido',
  alta_evasao: 'Evasão',
  transferencia_externa: 'Transferência externa',
  obito: 'Óbito',
  cancelamento_alta: 'Cancelamento de alta',
  retificacao: 'Retificação',
}

export function TrilhaEpisodio({ pacienteId }: { pacienteId: string }) {
  const eventos = useQuery({
    queryKey: ['eventos-adt-paciente', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eventos_adt')
        .select('id, seq, tipo_evento, motivo, created_at, perfis!eventos_adt_autor_id_fkey(nome_completo)')
        .eq('paciente_id', pacienteId)
        .order('seq', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as { id: string; seq: number; tipo_evento: string; motivo: string | null; created_at: string; perfis: { nome_completo: string } | null }[]
    },
  })
  const transferencias = useQuery({
    queryKey: ['historico-paciente', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transferencias_paciente')
        .select('id, motivo, created_at, perfis!transferencias_paciente_transferido_por_fkey(nome_completo)')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as { id: string; motivo: string | null; created_at: string; perfis: { nome_completo: string } | null }[]
    },
  })
  const lista = eventos.data ?? []
  return (
    <details className="rounded-[14px] border border-fio bg-superficie px-4 py-3">
      <summary className="flex cursor-pointer items-center gap-2 text-apoio font-semibold tracking-[0.05em] text-tinta-sussurro uppercase">
        <History className="size-3.5" aria-hidden /> Trilha do episódio · {lista.length} {lista.length === 1 ? 'evento' : 'eventos'}
      </summary>
      <div className="mt-2.5 flex flex-col gap-1.5">
        {lista.length === 0 && <p className="text-apoio text-tinta-sussurro">Nenhum evento ADT registrado.</p>}
        {lista.map((e) => (
          <div key={e.id} className="flex items-center gap-2 text-apoio">
            <Badge variant="secondary">#{e.seq}</Badge>
            <span className="font-medium text-tinta">{TIPO_EVENTO[e.tipo_evento] ?? e.tipo_evento}</span>
            <span className="text-tinta-sussurro">{diaHora(e.created_at)} · {e.perfis?.nome_completo ?? '—'}{e.motivo ? ` · ${e.motivo}` : ''}</span>
          </div>
        ))}
        {(transferencias.data ?? []).length > 0 && (
          <>
            <span className="mt-1.5 text-[12px] font-semibold tracking-wide text-tinta-sussurro uppercase">Transferências entre setores</span>
            {(transferencias.data ?? []).map((t) => (
              <span key={t.id} className="text-apoio text-tinta-apoio">
                {diaHora(t.created_at)} · {t.perfis?.nome_completo ?? '—'} · {t.motivo || 'sem motivo'}
              </span>
            ))}
          </>
        )}
      </div>
    </details>
  )
}

const ITENS = [
  ['prescricao', 'Prescrição'],
  ['dieta', 'Dieta'],
  ['leito', 'Leito'],
  ['responsavel', 'Responsável'],
] as const

export function ChecklistAdmissao({ pacienteId, unidadeId, prontuarioAberto }: { pacienteId: string; unidadeId?: string; prontuarioAberto: boolean }) {
  const qc = useQueryClient()
  const checklist = useQuery({
    queryKey: ['checklist-admissao', pacienteId],
    enabled: prontuarioAberto,
    queryFn: async () => {
      const { data, error } = await supabase.from('checklist_admissao').select('*').eq('paciente_id', pacienteId).maybeSingle()
      if (error) throw error
      return data as Checklist | null
    },
  })
  async function alternar(campo: (typeof ITENS)[number][0]) {
    if (!unidadeId) return
    const c = checklist.data
    const patch: ChecklistInsert = { paciente_id: pacienteId, unidade_id: unidadeId, [campo]: !(c?.[campo] ?? false) }
    const { error } = await supabase.from('checklist_admissao').upsert(patch, { onConflict: 'paciente_id' })
    if (!error) void qc.invalidateQueries({ queryKey: ['checklist-admissao'] })
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-fio bg-campo px-4 py-3">
      <span className="mr-1 text-apoio font-semibold tracking-[0.05em] text-tinta-sussurro uppercase">Checklist de admissão</span>
      {ITENS.map(([campo, rotulo]) => {
        const marcado = checklist.data?.[campo] ?? false
        return (
          <button key={campo} type="button" aria-pressed={marcado} onClick={() => void alternar(campo)}
            className={`rounded-capsula border px-3 py-[5px] text-apoio font-medium transition-colors ${
              marcado ? 'border-conforme/30 bg-conforme/[0.08] text-conforme' : 'border-fio bg-superficie text-tinta-apoio hover:border-marca'}`}>
            {marcado ? '✓ ' : '○ '}{rotulo}
          </button>
        )
      })}
    </div>
  )
}
