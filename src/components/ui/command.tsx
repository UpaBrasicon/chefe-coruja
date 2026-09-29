import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"

import { cn } from "@/lib/utils"
import { SearchIcon } from "lucide-react"

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-cartao bg-superficie text-tinta",
        className
      )}
      {...props}
    />
  )
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="flex items-center gap-2.5 border-b border-trilha px-3.5">
      <SearchIcon className="size-4 shrink-0 text-tinta-sussurro" aria-hidden />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "flex h-11 w-full bg-transparent py-3 text-corpo text-tinta outline-none placeholder:text-tinta-sussurro focus-visible:shadow-none disabled:cursor-not-allowed disabled:opacity-45",
          className
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn("max-h-96 overflow-y-auto overflow-x-hidden p-1.5", className)}
      {...props}
    />
  )
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("px-3.5 py-[26px] text-center text-apoio text-tinta-sussurro", className)}
      {...props}
    />
  )
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn("overflow-hidden p-0.5 text-tinta [&_[cmdk-group-heading]]:block [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-[9px] [&_[cmdk-group-heading]]:pb-[5px] [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.07em] [&_[cmdk-group-heading]]:text-tinta-sussurro [&_[cmdk-group-heading]]:uppercase", className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-3 rounded-controle px-3 py-[9px] text-controle outline-none data-[selected=true]:bg-marca/10 data-[selected=true]:text-acao data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-45",
        className
      )}
      {...props}
    />
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("mx-1 h-px bg-trilha", className)}
      {...props}
    />
  )
}

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
}
