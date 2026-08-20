// ─────────────────────────────────────────────────────────────────────────────
// PainelObservacoes — flowsheet de UTI
// Conceitos nas linhas, tempo nas colunas, célula colorida por flag
// (L/N/H/CRIT), com delta entre aferições.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'

import { getPainelInternacao, corDoFlag, type PainelInternacao } from '@/lib/observacao'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type Props = {
  internacaoId: string
  className?: string
}

function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatarValor(p: PainelInternacao['itens'][number]['ultimo']): string {
  if (!p) return '—'
  if (p.valor_num != null) return String(p.valor_num)
  if (p.valor_texto != null) return p.valor_texto
  return '—'
}

export function PainelObservacoes({ internacaoId, className }: Props) {
  const { data: painel, isFetching, isError } = useQuery({
    queryKey: ['painel-observacoes', internacaoId],
    enabled: !!internacaoId,
    queryFn: () => getPainelInternacao(internacaoId),
  })

  if (isError) return <p className="text-sm text-red-600">Erro ao carregar observações.</p>
  if (isFetching && !painel) return <Skeleton className="h-40 w-full" />

  const itens = painel?.itens ?? []
  if (itens.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem observações registradas nesta internação.</p>
  }

  return (
    <div className={cn('overflow-x-auto rounded-lg border', className)}>
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-medium">Conceito</th>
            <th className="px-3 py-2 text-right font-medium">Último</th>
            <th className="px-3 py-2 text-right font-medium">Hora</th>
            <th className="px-3 py-2 text-right font-medium">Δ</th>
            <th className="px-3 py-2 text-right font-medium">Referência</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.conceito_id} className="border-b last:border-0">
              <td className="px-3 py-1.5">
                <span className="font-medium capitalize">{item.nome.replace(/-/g, ' ')}</span>
                {item.unidade && <span className="ml-1 text-xs text-muted-foreground">{item.unidade}</span>}
              </td>
              <td className="px-3 py-1.5 text-right">
                {item.ultimo ? (
                  <span
                    className={cn(
                      'inline-block min-w-14 rounded-md px-2 py-0.5 text-right font-mono text-xs font-semibold',
                      corDoFlag(item.ultimo.flag)
                    )}
                  >
                    {formatarValor(item.ultimo)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-xs text-muted-foreground">
                {item.ultimo ? formatarHora(item.ultimo.aferido_em) : '—'}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-xs">
                {item.delta != null ? (
                  <span className={cn(item.delta > 0 ? 'text-red-600' : item.delta < 0 ? 'text-sky-600' : 'text-muted-foreground')}>
                    {item.delta > 0 ? '+' : ''}
                    {item.delta}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-xs text-muted-foreground">
                {item.ref_min != null || item.ref_max != null
                  ? `${item.ref_min ?? '…'} – ${item.ref_max ?? '…'}`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
