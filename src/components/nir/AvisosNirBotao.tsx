// Avisos do NIR no topo (NIR1, modelo do RT de 25/11/2026): o botão "Avisos"
// com os não lidos abre a lista, uma linha por pedido (NI1 = A, 24/11/2026).
// O clique na linha abre o paciente no painel e marca a linha como lida;
// "Marcar como lidos" marca todas. Substitui o cartão de avisos do topo.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import * as React from 'react'

import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { chaveAvisos, useAvisosNir } from '@/components/nir/dadosNir'
import { linhasDeAvisos } from '@/lib/avisosNir'
import { dataCurta } from '@/lib/indicadoresRegulacao'
import { dataIso } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const vezes = (n: number) => (n === 1 ? '1 aviso' : `${n} avisos`)

export function AvisosNirBotao({ unidadeId, abrirPedido }: { unidadeId: string; abrirPedido: (numero: number) => void }) {
  const qc = useQueryClient()
  const avisos = useAvisosNir(unidadeId)
  const [aberto, setAberto] = React.useState(false)
  const caixa = React.useRef<HTMLDivElement>(null)
  const marcar = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return
      const { error } = await supabase.rpc('marcar_avisos_lidos', { p_unidade: unidadeId, p_ids: ids })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: chaveAvisos(unidadeId) }),
  })
  // fecha ao clicar fora ou com Esc
  React.useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])
  const linhas = linhasDeAvisos(avisos.data ?? [])
  const naoLidos = linhas.reduce((n, l) => n + l.naoLidos.length, 0)
  const ano = dataIso().slice(0, 4)
  return (
    <div ref={caixa} className="relative">
      <Button size="sm" variant="outline" aria-expanded={aberto} aria-haspopup="dialog" onClick={() => setAberto(!aberto)}
        aria-label={naoLidos > 0 ? `Avisos, ${naoLidos} não lido${naoLidos === 1 ? '' : 's'}` : 'Avisos'}>
        <Bell aria-hidden />
        Avisos
        {naoLidos > 0 && <span className="rounded-controle bg-critico px-1.5 font-mono text-rotulo font-semibold text-sobre-acao tabular-nums">{naoLidos}</span>}
      </Button>
      {aberto && (
        <div role="dialog" aria-label="Avisos do NIR"
          className="absolute right-0 z-40 mt-1.5 flex w-[min(26rem,calc(100vw-2rem))] flex-col rounded-cartao border border-fio bg-superficie shadow-dialogo">
          <div className="flex items-center gap-2 border-b border-fio px-3.5 py-2.5">
            <span className="font-medium text-tinta">Avisos da regulação</span>
            <Button size="xs" variant="outline" className="ml-auto" disabled={marcar.isPending || linhas.length === 0}
              onClick={() => marcar.mutate(linhas.flatMap((l) => l.naoLidos))}>Marcar como lidos</Button>
          </div>
          {avisos.error ? <div className="p-3"><MensagemErro texto={(avisos.error as Error).message} /></div>
            : linhas.length === 0 ? <p className="px-3.5 py-4 text-apoio text-tinta-sussurro">Nenhum aviso não lido.</p> : (
              <div className="flex max-h-96 flex-col overflow-y-auto">
                {linhas.map((l) => (
                  <BotaoLinha key={l.chave} variante="linha" className="flex-col gap-0.5"
                    onClick={() => {
                      marcar.mutate(l.naoLidos)
                      if (l.numero != null) { abrirPedido(l.numero); setAberto(false) }
                    }}>
                    <span className="flex w-full items-baseline gap-2">
                      <span className="font-medium text-tinta">{l.numero != null ? `Regulação nº ${l.numero}` : 'Aviso'}</span>
                      <span className="ml-auto text-rotulo text-tinta-sussurro">
                        {l.vezes > 1 ? `${vezes(l.vezes)} desde ${dataCurta(dataIso(Date.parse(l.desde)), ano)}` : dataCurta(dataIso(Date.parse(l.ultimo)), ano)}
                      </span>
                    </span>
                    <span className={cn('text-apoio', l.acao === 'evolucao' || l.acao === 'responder' ? 'text-atencao' : 'text-tinta-apoio')}>{l.motivo}</span>
                  </BotaoLinha>
                ))}
              </div>
            )}
          <MensagemErro texto={marcar.error ? (marcar.error as Error).message : null} />
        </div>
      )}
    </div>
  )
}
