import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

function Spinner({ className, rotulo = 'Carregando' }: { className?: string; rotulo?: string }) {
  return (
    <span role="status" className="inline-flex">
      <Loader2 className={cn('size-5 animate-spin text-tinta-sussurro', className)} aria-hidden />
      <span className="sr-only">{rotulo}</span>
    </span>
  )
}

export { Spinner }

/** Carregando com o nome do que carrega, centralizado (guia do padrão, 2.3). */
export function Carregando({ rotulo, className }: { rotulo: string; className?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-2 py-proximo text-apoio text-tinta-sussurro', className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {rotulo}
    </div>
  )
}
