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
