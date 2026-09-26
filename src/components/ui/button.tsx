/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Gramática do Monitor de Cabeceira (02-gramatica-visual.md, "Botões"):
  // primário é a única cor de comando; o secundário é promovido pela borda,
  // não pelo preenchimento; peso 500 só no primário; alvo mínimo de 32px.
  "group/button inline-flex shrink-0 items-center justify-center gap-[7px] rounded-controle border border-transparent bg-clip-padding text-apoio whitespace-nowrap transition-colors duration-150 outline-none select-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-critico [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-acao font-medium text-white hover:bg-acao-pressionada",
        outline:
          "border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao aria-expanded:border-acao aria-expanded:text-acao",
        secondary:
          "bg-trilha text-tinta hover:bg-fio aria-expanded:bg-fio",
        ghost:
          "text-tinta-sussurro hover:text-acao aria-expanded:text-acao",
        destructive:
          "border-fio bg-superficie text-tinta-apoio hover:border-critico hover:text-critico",
        link: "text-acao underline-offset-4 hover:text-acao-pressionada hover:underline",
      },
      size: {
        default: "min-h-8 px-3.5 py-[7px]",
        xs: "min-h-6 gap-1 rounded-controle-sm px-2 text-rotulo [&_svg:not([class*='size-'])]:size-3",
        sm: "min-h-[30px] gap-1 rounded-controle-sm px-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "min-h-9 px-[15px] py-2",
        icon: "size-8",
        "icon-xs": "size-6 rounded-controle-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-[30px] rounded-controle-sm",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = React.ComponentProps<typeof ButtonPrimitive> &
  VariantProps<typeof buttonVariants>

function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
export type { ButtonProps }
