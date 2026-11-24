// ─────────────────────────────────────────────────────────────────────────────
// Linha do tempo do pedido de regulação (RD2 = A, RT 24/11/2026): situação,
// conversa, anexos e evoluções numa lista só, da mais recente para a mais
// antiga, com nomes legíveis. Em cima, o tempo em cada situação, com uma
// atual só. As regras ficam em src/lib/regulacaoLinhaTempo.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { History } from 'lucide-react'

import { fmtDataHora } from '@/lib/datas'
import type { StatusRegulacao } from '@/lib/regulacao'
import { textoTempos, type ItemLinhaDoTempo, type TempoStatus, type TipoItem } from '@/lib/regulacaoLinhaTempo'
import { cn } from '@/lib/utils'

const PONTO: Record<TipoItem, string> = {
  situacao: 'bg-acao', conversa: 'bg-atencao', anexo: 'bg-tinta-sussurro', evolucao: 'bg-conforme',
}

export function LinhaDoTempoPedido({ itens, tempos, statusAtual }: {
  itens: ItemLinhaDoTempo[]; tempos: TempoStatus[]; statusAtual: StatusRegulacao
}) {
  return (
    <section aria-label="Linha do tempo do pedido" className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 font-medium text-tinta"><History className="size-4" aria-hidden /> Linha do tempo</h3>
      {tempos.length > 0 && <p className="text-rotulo text-tinta-apoio">Tempo em cada status: {textoTempos(tempos, statusAtual)}</p>}
      {itens.length === 0 ? <p className="text-tinta-sussurro">Nada registrado ainda.</p> : (
        <ol className="flex flex-col">
          {itens.map((i) => (
            <li key={i.chave} className="relative flex gap-3 pb-3 last:pb-0">
              <span aria-hidden className="flex w-2 shrink-0 flex-col items-center pt-1.5">
                <span className={cn('size-2 rounded-capsula', PONTO[i.tipo])} />
                <span className="mt-1 w-px flex-1 bg-fio" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-tinta first-letter:uppercase">{i.titulo}</span>
                {i.texto && <span className="whitespace-pre-wrap text-tinta-apoio">{i.texto}</span>}
                <span className="text-rotulo text-tinta-sussurro">{fmtDataHora(i.em)} · {i.por ?? '—'}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
