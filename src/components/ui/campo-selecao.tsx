import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * Seleção nativa com a classe única do projeto (guia do padrão, 3.2). No
 * celular e no tablet abre a roda do sistema.
 */
export function CampoSelecao({ className, tamanho = 'normal', ...props }: ComponentProps<'select'> & { tamanho?: 'compacto' | 'normal' }) {
  return (
    <select
      className={cn(
        'rounded-controle border border-fio bg-campo px-2 text-apoio text-tinta disabled:opacity-45 aria-invalid:border-critico',
        tamanho === 'compacto' ? 'h-8' : 'h-9',
        className,
      )}
      {...props}
    />
  )
}
