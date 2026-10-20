import type { ComponentProps, MouseEvent } from 'react'

import { cn } from '@/lib/utils'

// Botão que é uma linha ou um cartão inteiro (guia do padrão, 3.1): resultado
// de busca, cartão de protocolo, "adicionar item". O conteúdo é livre, alinhado
// à esquerda; a peça só dá a forma e o estado de foco e passagem.
const VARIANTE = {
  cartao: 'flex flex-col items-start gap-0.5 rounded-container border border-fio bg-superficie px-3.5 py-2.5 hover:border-acao hover:bg-alerta-marca',
  linha: 'flex w-full items-start gap-[11px] border-b border-trilha px-3.5 py-3 last:border-0 hover:bg-alerta-marca',
  tracejado: 'flex w-full items-center gap-[7px] rounded-controle border border-dashed border-fio-forte bg-campo px-3.5 py-2.5 text-apoio text-tinta-apoio hover:border-acao hover:bg-alerta-marca hover:text-acao',
} as const

export function BotaoLinha({ variante = 'cartao', className, type = 'button', ...props }: ComponentProps<'button'> & { variante?: keyof typeof VARIANTE }) {
  return <button type={type} className={cn('text-left transition-colors disabled:cursor-not-allowed', VARIANTE[variante], className)} {...props} />
}

/**
 * Opção de uma lista suspensa (role="option" dentro de um role="listbox"): CID,
 * SIGTAP, medicamento. Não rouba o foco do campo ao clicar.
 */
export function OpcaoLista({ className, onMouseDown, ...props }: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={false}
      onMouseDown={(e: MouseEvent<HTMLButtonElement>) => { e.preventDefault(); onMouseDown?.(e) }}
      className={cn('flex w-full gap-2 border-b border-trilha px-3 py-2 text-left text-apoio last:border-0 hover:bg-trilha', className)}
      {...props}
    />
  )
}
