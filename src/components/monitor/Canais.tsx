import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

// A Regra do Canal, Não do Card: uma seção num painel é uma linha rotulada,
// com a marca de identidade à esquerda e a contagem à direita — não um card
// flutuando numa grade.

export function Canais({ children, rotulo }: { children: ReactNode; rotulo?: string }) {
  return (
    <nav aria-label={rotulo} className="overflow-hidden rounded-container border border-fio bg-superficie">
      {children}
    </nav>
  )
}

export type CanalProps = {
  icone: LucideIcon
  nome: string
  exemplos?: string
  contagem?: number
  unidade?: string
  corIcone?: string
  onClick: () => void
}

export function Canal({ icone: Icone, nome, exemplos, contagem, unidade, corIcone, onClick }: CanalProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-wrap items-center gap-x-3 gap-y-[3px] border-trilha px-3.5 py-[11px] text-left transition-colors hover:bg-campo md:flex-nowrap md:px-4 md:py-3 [&+&]:border-t"
    >
      <Icone className={cn('size-[17px] shrink-0', corIcone ?? 'text-tinta-apoio')} aria-hidden />
      <span className="flex-1 text-corpo font-semibold tracking-[-0.01em] whitespace-nowrap text-tinta md:flex-none">{nome}</span>
      {exemplos && (
        <span className="order-last w-full truncate pl-[29px] text-apoio text-tinta-sussurro md:order-none md:w-auto md:flex-1 md:pl-0">
          {exemplos}
        </span>
      )}
      {contagem !== undefined && (
        <span className="flex flex-none items-baseline gap-1 text-secao font-semibold tracking-[-0.02em] text-grafite tabular">
          {contagem}
          {unidade && <span className="text-rotulo font-medium tracking-normal text-tinta-sussurro">{unidade}</span>}
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-tinta-sussurro" aria-hidden />
    </button>
  )
}
