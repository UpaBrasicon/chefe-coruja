import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

// "Tela limpa" do piloto (diagnóstico das calculadoras, F5; C6 = A): o que
// compara fontes, errata, "no livro" e tabelas longas sai da frente e fica
// recolhido aqui. Alertas que mudam a dose NÃO vêm para cá: ficam no item.

export function Evidencias({ titulo = 'Evidências e comparação entre fontes', resumo, children }: { titulo?: string; resumo?: string; children: ReactNode }) {
  return (
    <details className="group rounded-cartao border border-fio bg-superficie">
      <summary
        data-indice={titulo}
        className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-controle font-semibold text-tinta [&::-webkit-details-marker]:hidden"
      >
        <span className="flex flex-col gap-0.5">
          {titulo}
          {resumo && <span className="text-apoio font-normal text-tinta-sussurro">{resumo}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-controle border border-fio px-2.5 py-1 text-apoio font-medium text-acao">
          <span className="group-open:hidden">Mostrar</span>
          <span className="hidden group-open:inline">Recolher</span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-fio px-5 py-4 text-apoio">{children}</div>
    </details>
  )
}

/** "Ver mais" dentro de um item (notas do livro, errata, divergência). */
export function VerMais({ children, rotulo = 'Notas do livro' }: { children: ReactNode; rotulo?: string }) {
  return (
    <details className="group/vm mt-1">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-rotulo font-medium text-acao [&::-webkit-details-marker]:hidden">
        {rotulo}
        <ChevronDown className="size-3.5 transition-transform group-open/vm:rotate-180" aria-hidden />
      </summary>
      <div className="mt-1 flex flex-col gap-1 text-tinta-sussurro">{children}</div>
    </details>
  )
}
