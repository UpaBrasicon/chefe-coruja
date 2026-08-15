import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function ToolLayout({
  title,
  description,
  children,
  className,
  referencia,
  revisadoEm,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
  referencia?: string
  revisadoEm?: string
}) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
      <div className="flex flex-col gap-1 border-t pt-3 text-xs text-muted-foreground">
        {referencia && <p>Referência: {referencia}</p>}
        {revisadoEm && <p>Selo de revisão: {revisadoEm}</p>}
        <p>Apoio à decisão clínica — não substitui o julgamento do profissional responsável.</p>
      </div>
    </div>
  )
}
