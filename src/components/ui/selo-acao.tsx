import { ChevronDown } from 'lucide-react'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

// Selo clicável (pedido do RT de 11/11/2026, opção B, docs/frontend/CLICAVEIS-SEM-DESTAQUE.md).
// O selo que abre alguma coisa (alergias, isolamento) não pode parecer texto:
// tem fundo, borda e a seta para baixo em todos os estados. O tom diz o estado;
// a forma diz que dá para clicar.
//   critico  alarme ativo (alergia, isolamento): vermelho cheio, como antes
//   atencao  falta registro ou não verificado: âmbar claro com borda
//   neutro   sem alarme (nega alergia, sem isolamento): cinza com borda
const TOM = {
  critico: 'border-critico bg-critico font-semibold text-sobre-acao hover:bg-critico/90',
  atencao: 'border-atencao/50 bg-atencao/10 font-medium text-atencao hover:bg-atencao/20',
  neutro: 'border-fio-forte bg-trilha font-medium text-tinta-apoio hover:bg-fio',
} as const

export type TomSelo = keyof typeof TOM

export function SeloAcao({ tom = 'neutro', className, children, type = 'button', ...props }: ComponentProps<'button'> & { tom?: TomSelo }) {
  return (
    <button type={type}
      className={cn('inline-flex min-h-7 cursor-pointer items-center gap-1.5 rounded-controle border px-2.5 py-1 text-left text-apoio whitespace-normal transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao', TOM[tom], className)}
      {...props}>
      {children}
      <ChevronDown className="size-3.5 shrink-0" aria-hidden />
    </button>
  )
}
