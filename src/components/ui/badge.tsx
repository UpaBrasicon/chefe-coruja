/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // Selo de estado (02-gramatica-visual.md): cápsula, 12px/600 caixa alta, a
  // própria cor do texto como fundo a ~8% (A Regra da Lavagem Própria).
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-capsula border border-transparent px-2 py-[3px] text-rotulo font-semibold tracking-[0.04em] uppercase whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-acao/10 text-acao",
        secondary: "bg-trilha text-tinta-apoio",
        destructive: "bg-critico/10 text-critico",
        outline: "border-fio text-tinta-apoio",
        ghost: "text-tinta-sussurro",
        success: "bg-conforme/10 text-conforme",
        warning: "bg-atencao/10 text-atencao",
        info: "bg-suprimento/10 text-suprimento",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
export type { BadgeProps }
