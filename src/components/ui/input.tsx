import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex min-h-9 w-full min-w-0 rounded-controle border border-fio bg-superficie px-3 py-[7px] text-corpo text-tinta transition-[border-color,box-shadow] outline-none placeholder:text-tinta-sussurro file:inline-flex file:border-0 file:bg-transparent file:text-apoio file:font-medium disabled:cursor-not-allowed disabled:opacity-50 md:text-apoio",
        "focus-visible:border-marca",
        "aria-invalid:border-critico/50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
