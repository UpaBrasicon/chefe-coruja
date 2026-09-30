import * as React from "react"

import { cn } from "@/lib/utils"

// Esqueleto: a trilha cinza da faixa, no raio do controle. Some sob
// prefers-reduced-motion junto com o resto do movimento.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-controle bg-trilha", className)}
      {...props}
    />
  )
}

export { Skeleton }
