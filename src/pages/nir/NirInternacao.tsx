// ─────────────────────────────────────────────────────────────────────────────
// Internação do NIR (perfil NIR, pedido do RT de 24/11/2026): "equipe
// responsável por olhar as regulações de todos os pacientes (observação,
// encaminhamento, exames ou internação)". O menu do NIR fica só com esta tela
// e a Escala.
//
// • Os internados da unidade por setor e quem está em regulação, só o resumo
//   e o que acontece na regulação; o clique abre a aba Regulação do paciente,
//   onde o NIR anexa exames e conversa com a central.
// • Os avisos do NIR (mensagem do regulador, cobrança) ficam no topo, porque o
//   menu não tem mais a tela de Avisos.
// RPCs regulacao_pacientes e regulacao_do_paciente (migration 20270421000040).
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Hospital } from 'lucide-react'

import { TituloPagina } from '@/components/monitor/Pagina'
import { PacientesRegulacao } from '@/components/regulacao/PacientesRegulacao'
import { Button } from '@/components/ui/button'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import type { MinhaNotificacao } from '@/types/database'

export default function NirInternacao() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id ?? ''
  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <TituloPagina icone={Hospital} titulo="Internação"
        descricao="Pacientes da unidade por setor, com o que acontece na regulação de cada um. Clique no paciente para ver a regulação, anexar exames e conversar com a central." />
      {unidadeId && <AvisosNir unidadeId={unidadeId} />}
      {unidadeId && <PacientesRegulacao unidadeId={unidadeId} modo="nir" />}
    </div>
  )
}

function AvisosNir({ unidadeId }: { unidadeId: string }) {
  const qc = useQueryClient()
  const chave = ['minhas-notificacoes', unidadeId]
  const avisos = useQuery({
    queryKey: chave,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('minhas_notificacoes', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as MinhaNotificacao[]
    },
  })
  const marcar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('marcar_avisos_lidos', { p_unidade: unidadeId, p_ids: ids })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: chave }),
  })
  const naoLidos = (avisos.data ?? []).filter((n) => !n.lida)
  if (naoLidos.length === 0) return null
  return (
    <section aria-label="Avisos" className="flex flex-col gap-2 rounded-cartao border border-atencao/30 bg-alerta-atencao px-4 py-3 text-apoio">
      <div className="flex flex-wrap items-center gap-2">
        <Bell className="size-4 text-atencao" aria-hidden />
        <span className="font-medium text-tinta">{naoLidos.length === 1 ? '1 aviso' : `${naoLidos.length} avisos`}</span>
        <Button size="xs" variant="outline" className="ml-auto" disabled={marcar.isPending}
          onClick={() => marcar.mutate(naoLidos.map((n) => n.id))}>Marcar como lidos</Button>
      </div>
      <ul className="flex flex-col gap-1">
        {naoLidos.slice(0, 8).map((n) => (
          <li key={n.id} className="text-tinta"><span className="text-tinta-sussurro">{fmtDataHora(n.created_at)} · </span>{n.mensagem}</li>
        ))}
      </ul>
    </section>
  )
}
