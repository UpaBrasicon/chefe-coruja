import * as React from "react"

import { cn } from "@/lib/utils"

// Tabela na gramática do protótipo (P/index.html, "Tabelas"): cabeçalho em
// rótulo sussurrado sobre o fundo de campo, linhas separadas por fio de
// cabelo, números tabulares. A tabela vive dentro de um contêiner com borda;
// em tela estreita rola na horizontal sem perder o alinhamento das colunas.

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom border-collapse text-controle text-tinta tabular", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("bg-campo [&_tr]:border-b [&_tr]:border-fio", className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t border-fio bg-campo font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "cc-lista-linha border-b border-trilha transition-colors hover:bg-campo data-[state=selected]:bg-marca/[0.06]",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "rotulo h-auto px-3.5 py-[11px] text-left align-middle whitespace-nowrap text-tinta-sussurro",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-3.5 py-[11px] align-middle whitespace-nowrap", className)}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-3 text-apoio text-tinta-sussurro", className)}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
