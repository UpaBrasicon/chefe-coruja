import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Item 01 do kit de desempenho: enquanto a lista carrega, faixas na forma das
// linhas (a tela não pula quando os dados chegam). O leitor de tela ouve
// "Carregando…" uma vez; as faixas ficam fora dele (Skeleton é aria-hidden).
// Sob prefers-reduced-motion as faixas param de pulsar, como o resto.
export function EsqueletoLinhas({
  linhas = 4,
  rotulo = 'Carregando…',
  className,
}: {
  linhas?: number
  rotulo?: string
  className?: string
}) {
  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col gap-3 px-5 py-4', className)}>
      <span className="sr-only">{rotulo}</span>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-capsula" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className={cn('h-3.5', i % 3 === 0 ? 'w-2/3' : i % 3 === 1 ? 'w-1/2' : 'w-3/5')} />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
