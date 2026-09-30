// Caixas e chips no desenho do protótipo, para as abas do caderno.
import * as React from 'react'

import { cn } from '@/lib/utils'

/** Seção simples: rótulo em versalete e o conteúdo. */
export function Secao({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold tracking-wide text-tinta-sussurro uppercase">{titulo}</div>
        {acao}
      </div>
      {children}
    </div>
  )
}

/** Caixa do protótipo: fundo de campo, fio, cantos de 14px, sem estourar. */
export function Caixa({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('overflow-hidden rounded-[14px] border border-fio bg-campo', className)}>{children}</div>
}

/** Faixa de cabeçalho da caixa (ícone + rótulo em versalete + resumo + ação). */
export function CaixaCabeca({ icone, titulo, resumo, resumoClasse, acao }: {
  icone?: React.ReactNode; titulo: string; resumo?: React.ReactNode; resumoClasse?: string; acao?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-fio px-4 py-3">
      <span className="flex items-center gap-2 text-apoio font-semibold tracking-[0.05em] text-tinta-sussurro uppercase">
        {icone}{titulo}
      </span>
      {resumo && <span className={cn('text-apoio text-tinta-sussurro', resumoClasse)}>{resumo}</span>}
      {acao && <div className="ml-auto">{acao}</div>}
    </div>
  )
}

/** Chip de escolha do protótipo (tipo, prazo, unidade, status). */
export function Chip({ ativo, forte = false, children, onClick, disabled, role, ...resto }: {
  ativo: boolean; forte?: boolean; children: React.ReactNode; onClick: () => void; disabled?: boolean
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'>) {
  return (
    <button
      type="button"
      role={role}
      disabled={disabled}
      onClick={onClick}
      {...resto}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-capsula border px-3 py-[5px] text-apoio whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        ativo
          ? forte
            ? 'border-acao bg-acao font-medium text-white'
            : 'border-marca/35 bg-marca/10 font-medium text-acao'
          : 'border-fio bg-superficie text-tinta-apoio hover:border-marca hover:text-acao',
      )}
    >
      {children}
    </button>
  )
}
