// ─────────────────────────────────────────────────────────────────────────────
// Internação do NIR (perfil NIR, pedido do RT de 24/11/2026): "equipe
// responsável por olhar as regulações de todos os pacientes (observação,
// encaminhamento, exames ou internação)". O menu do NIR fica só com esta tela
// e a Escala.
//
// • Os internados da unidade e quem está em regulação, só o resumo e o que
//   acontece na regulação; o clique abre a aba Regulação do paciente, onde o
//   NIR anexa exames, conversa com a central e abre pedido novo.
// • Os avisos do NIR (mensagem do regulador, cobrança) ficam no topo, porque o
//   menu não tem mais a tela de Avisos.
// • Revisão do perfil (NI1 a NI3 = A, RT 24/11/2026): os avisos repetidos viram
//   uma linha por pedido, com a ação e "Marcar como lidos" do grupo; quem está
//   em regulação vem primeiro (prazo vencido no topo) e o resto fica recolhido
//   em "Sem regulação"; fichas em caixa normal.
// RPCs regulacao_pacientes e regulacao_do_paciente (migration 20270421000040).
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Hospital } from 'lucide-react'
import * as React from 'react'

import { TituloPagina } from '@/components/monitor/Pagina'
import { PacientesRegulacao } from '@/components/regulacao/PacientesRegulacao'
import { Button } from '@/components/ui/button'
import { useUnidade } from '@/contexts/UnidadeContext'
import { ROTULO_ACAO, linhasDeAvisos } from '@/lib/avisosNir'
import { dataCurta } from '@/lib/indicadoresRegulacao'
import { dataIso } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import type { MinhaNotificacao } from '@/types/database'

export default function NirInternacao() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id ?? ''
  // o aviso abre o paciente do pedido na lista de baixo
  const [abrirPedido, setAbrirPedido] = React.useState<{ numero: number; vez: number } | null>(null)
  const abrir = (numero: number) => setAbrirPedido((x) => ({ numero, vez: (x?.vez ?? 0) + 1 }))
  return (
    <div className="flex w-full max-w-5xl flex-col gap-4 [&_[data-slot=badge]]:tracking-normal [&_[data-slot=badge]]:normal-case">
      <TituloPagina icone={Hospital} titulo="Internação"
        descricao="Pacientes da unidade e o que acontece na regulação de cada um. Clique no paciente para ver a regulação, anexar exames, conversar com a central ou abrir um pedido." />
      {unidadeId && <AvisosNir unidadeId={unidadeId} abrir={abrir} />}
      {unidadeId && <PacientesRegulacao unidadeId={unidadeId} modo="nir" abrirPedido={abrirPedido} />}
    </div>
  )
}

const vezes = (n: number) => (n === 1 ? '1 aviso' : `${n} avisos`)

function AvisosNir({ unidadeId, abrir }: { unidadeId: string; abrir: (numero: number) => void }) {
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
  const linhas = linhasDeAvisos(avisos.data ?? [])
  if (linhas.length === 0) return null
  const ano = dataIso().slice(0, 4)
  return (
    <section aria-label="Avisos" className="flex flex-col gap-2 rounded-cartao border border-fio bg-superficie px-4 py-3 text-apoio">
      <div className="flex flex-wrap items-center gap-2">
        <Bell className="size-4 text-atencao" aria-hidden />
        <span className="font-medium text-tinta">Avisos</span>
        {linhas.length > 1 && (
          <Button size="xs" variant="ghost" className="ml-auto" disabled={marcar.isPending}
            onClick={() => marcar.mutate(linhas.flatMap((l) => l.naoLidos))}>Marcar todos como lidos</Button>
        )}
      </div>
      <ul className="flex flex-col divide-y divide-trilha">
        {linhas.map((l) => (
          <li key={l.chave} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
            {l.numero != null && <span className="font-medium text-tinta">Regulação nº {l.numero}</span>}
            {l.numero != null && <span aria-hidden className="text-tinta-sussurro">·</span>}
            <span className={l.acao === 'evolucao' || l.acao === 'responder' ? 'text-atencao' : 'text-tinta'}>{l.motivo}</span>
            <span className="text-tinta-sussurro">
              · {l.vezes > 1 ? `${vezes(l.vezes)} desde ${dataCurta(dataIso(Date.parse(l.desde)), ano)}` : dataCurta(dataIso(Date.parse(l.ultimo)), ano)}
            </span>
            <span className="ml-auto flex gap-2">
              {l.numero != null && l.acao && <Button size="xs" variant="outline" onClick={() => abrir(l.numero!)}>{ROTULO_ACAO[l.acao]}</Button>}
              <Button size="xs" variant="ghost" disabled={marcar.isPending} onClick={() => marcar.mutate(l.naoLidos)}>Marcar como lidos</Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
