import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function ToolLayout({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
      <p className="border-t pt-3 text-xs text-muted-foreground">
        Apoio à decisão clínica — não substitui o julgamento do profissional responsável.
      </p>
    </div>
  )
}
