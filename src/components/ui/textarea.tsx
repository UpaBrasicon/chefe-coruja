import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-controle border border-fio bg-superficie px-3 py-2 text-corpo text-tinta transition-[border-color,box-shadow] outline-none placeholder:text-tinta-sussurro focus-visible:border-marca disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-critico/50 md:text-apoio",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
