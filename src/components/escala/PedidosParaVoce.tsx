// ─────────────────────────────────────────────────────────────────────────────
// Pedidos para você (A4, proposta A do RT em 30/10/2026): o colega que recebe
// a passagem ou a troca aceita ou recusa aqui; aceito, o pedido vai à
// coordenação (ou já vale, na unidade sem aprovação do gestor). Lê pela RPC
// pedidos_para_mim, porque a RLS da escala não mostra o plantão do colega.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, Check, Send, X } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import type { Database } from '@/types/database'

type PedidoParaMim = Database['public']['Functions']['pedidos_para_mim']['Returns'][number]

function usePedidosParaMim(unidadeId: string | undefined) {
  return useQuery({
    queryKey: ['pedidos-para-mim', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pedidos_para_mim', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as PedidoParaMim[]
    },
  })
}

export function PedidosParaVoce({ unidadeId }: { unidadeId: string | undefined }) {
  const qc = useQueryClient()
  const pedidos = usePedidosParaMim(unidadeId)
  const [enviando, setEnviando] = React.useState<string | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)

  async function responder(p: PedidoParaMim, aceitar: boolean) {
    setEnviando(p.id); setErro(null); setAviso(null)
    try {
      if (p.tipo === 'passagem') {
        if (aceitar) {
          const { data, error } = await supabase.rpc('aceitar_passagem', { p_solicitacao: p.id })
          if (error) throw error
          setAviso(data === 'aplicada' ? 'Pronto: o plantão agora é seu.' : 'Aceito. Falta a coordenação aprovar; você recebe o aviso.')
        } else {
          const { error } = await supabase.rpc('recusar_passagem', { p_solicitacao: p.id })
          if (error) throw error
          setAviso('Passagem recusada. Quem pediu foi avisado.')
        }
      } else if (aceitar) {
        const { data, error } = await supabase.rpc('aceitar_troca', { p_troca: p.id })
        if (error) throw error
        setAviso(data === 'aplicada' ? 'Pronto: a troca já vale.' : 'Aceito. Falta a coordenação aprovar; você recebe o aviso.')
      } else {
        const { error } = await supabase.rpc('recusar_troca', { p_troca: p.id })
        if (error) throw error
        setAviso('Troca recusada. Quem pediu foi avisado.')
      }
      for (const chave of ['pedidos-para-mim', 'solicitacoes-escala', 'trocas-equipe', 'minhas-trocas', 'escala-equipe', 'escala-plantao', 'escala-plantao-mes']) {
        void qc.invalidateQueries({ queryKey: [chave] })
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível responder ao pedido.')
    } finally {
      setEnviando(null)
    }
  }

  const lista = pedidos.data ?? []
  if (lista.length === 0 && !aviso && !erro) return null
  return (
    <section aria-label="Pedidos para você" className="overflow-hidden rounded-cartao border border-atencao/40 bg-superficie">
      <div className="flex items-center gap-2 border-b border-trilha px-4 py-2.5">
        <span className="text-apoio font-semibold text-tinta">Pedidos para você</span>
        {lista.length > 0 && <span className="text-rotulo font-semibold tabular-nums text-atencao">{lista.length}</span>}
        <span className="ml-auto text-rotulo text-tinta-sussurro">Aceito, o pedido vai à coordenação.</span>
      </div>
      <ul className="flex flex-col">
        {lista.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-trilha px-4 py-2.5 text-apoio last:border-b-0">
            <span className="flex min-w-0 flex-[1_1_280px] items-start gap-2">
              {p.tipo === 'passagem' ? <Send className="mt-0.5 size-4 shrink-0 text-acao" /> : <ArrowLeftRight className="mt-0.5 size-4 shrink-0 text-acao" />}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-tinta">
                  <b className="font-medium">{p.de_nome}</b>{' '}
                  {p.tipo === 'passagem' ? <>quer passar para você o plantão de {p.recebo}.</> : <>quer trocar: você fica com {p.recebo} e passa {p.entrego}.</>}
                </span>
                {p.mensagem && <span className="text-rotulo text-tinta-sussurro">{p.mensagem}</span>}
              </span>
            </span>
            <span className="flex gap-1.5">
              <Button size="sm" disabled={enviando === p.id} onClick={() => void responder(p, true)}>
                {enviando === p.id ? <Spinner /> : <Check />} Aceitar
              </Button>
              <Button size="sm" variant="ghost" disabled={enviando === p.id} onClick={() => void responder(p, false)}>
                <X /> Recusar
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {aviso && <p role="status" className="border-t border-trilha px-4 py-2 text-apoio text-acao">{aviso}</p>}
      <MensagemErro className="mx-4 my-2" texto={erro} />
    </section>
  )
}
