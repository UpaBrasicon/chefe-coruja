import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Caixa de marcar com o texto ao lado (role="checkbox"). `bloqueado` mostra um
 * X e não deixa marcar (ex.: item travado por alergia).
 */
export function CaixaMarcar({ marcado, onChange, bloqueado = false, desabilitado = false, children, className, title }: {
  marcado: boolean
  onChange: (marcado: boolean) => void
  bloqueado?: boolean
  desabilitado?: boolean
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcado}
      disabled={desabilitado || bloqueado}
      title={title}
      onClick={() => onChange(!marcado)}
      className={cn('flex w-full items-start gap-[11px] text-left disabled:cursor-not-allowed', className)}
    >
      <span
        aria-hidden
        // padrao-ok: caixa de 18 px; o canto de controle (10 px) a deixaria redonda
        className={cn('mt-px grid size-[18px] shrink-0 place-items-center rounded-[5px] border',
          bloqueado ? 'border-fio bg-trilha text-tinta-sussurro' : marcado ? 'border-acao bg-acao text-sobre-acao' : 'border-fio-forte bg-campo')}
      >
        {bloqueado ? <X className="size-3" strokeWidth={3} /> : marcado ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</span>
    </button>
  )
}
