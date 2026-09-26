import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

/** Título de página: h1 de 24px, sempre ao lado de um azulejo de 42px com o ícone. */
export function TituloPagina({
  icone: Icone, titulo, descricao, acoes, className,
}: { icone: LucideIcon; titulo: string; descricao?: ReactNode; acoes?: ReactNode; className?: string }) {
  return (
    <header className={cn('mb-[22px] flex flex-wrap items-start gap-3.5', className)}>
      <span className="grid size-[42px] shrink-0 place-items-center rounded-controle bg-marca/10 text-acao" aria-hidden>
        <Icone className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="text-titulo leading-[1.1] font-semibold tracking-[-0.02em] text-tinta">{titulo}</h1>
        {descricao && <p className="mt-1 text-apoio text-tinta-sussurro">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  )
}

/** Trilha (migalha): cada nível é um link, o último é o lugar atual. */
export function Trilha({ niveis }: { niveis: { rotulo: string; to?: string }[] }) {
  return (
    <nav aria-label="Você está em" className="mb-3 flex flex-wrap items-center gap-1 text-apoio text-tinta-sussurro">
      {niveis.map((n, i) => (
        <span key={n.rotulo} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden>›</span>}
          {n.to ? (
            <Link to={n.to} className="text-tinta-sussurro hover:text-acao">{n.rotulo}</Link>
          ) : (
            <span aria-current="page" className="font-medium text-tinta">{n.rotulo}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

/** Título de seção (17px/600) com contagem opcional à direita. */
export function TituloSecao({ children, extra, className }: { children: ReactNode; extra?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-baseline justify-between gap-3', className)}>
      <h2 className="text-secao leading-[1.3] font-semibold tracking-[-0.01em] text-tinta">{children}</h2>
      {extra && <span className="text-apoio text-tinta-sussurro">{extra}</span>}
    </div>
  )
}

/**
 * Chip de filtro: cápsula. Ativo troca fundo para `acao` e o peso de 400 para
 * 500 — a troca de peso é parte do estado, não enfeite.
 */
export function Chip({ ativo, children, onClick, contagem }: { ativo: boolean; children: ReactNode; onClick: () => void; contagem?: number }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-capsula border px-[13px] py-[5px] text-apoio transition-colors',
        ativo ? 'border-acao bg-acao font-medium text-white' : 'border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao',
      )}
    >
      {children}
      {contagem !== undefined && <span className="tabular opacity-80">{contagem}</span>}
    </button>
  )
}

export function Chips({ children, rotulo }: { children: ReactNode; rotulo: string }) {
  return (
    <div role="group" aria-label={rotulo} className="mb-3.5 flex flex-wrap gap-2">
      {children}
    </div>
  )
}

/** Estado vazio: diz o que está vazio e por quê, nunca uma área em branco. */
export function Vazio({ icone: Icone, titulo, texto }: { icone: LucideIcon; titulo: string; texto?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-container border border-dashed border-fio bg-superficie px-6 py-10 text-center">
      <Icone className="size-6 text-tinta-sussurro" aria-hidden />
      <p className="text-corpo font-semibold text-tinta">{titulo}</p>
      {texto && <p className="max-w-md text-apoio text-tinta-sussurro">{texto}</p>}
    </div>
  )
}
