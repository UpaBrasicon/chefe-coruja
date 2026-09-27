import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

import { textoFontes, type Ficha } from '@/clinico/ficha'
import { cn } from '@/lib/utils'

// Casco visual das ferramentas clínicas (design_handoff/telas/20). A ressalva
// âmbar e o bloco Fonte não são decoração: são o contrato clínico da tela —
// a ferramenta apresenta cálculo e referência; a decisão é do profissional.

export function ToolLayout({
  title,
  description,
  children,
  className,
  referencia,
  revisadoEm,
  ficha,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
  referencia?: string
  revisadoEm?: string
  /** ferramenta do pacote src/clinico: fonte, revisão e versão saem da ficha */
  ficha?: Ficha
}) {
  const fonte = ficha ? textoFontes(ficha) : referencia
  const revisado = ficha ? ficha.revisadoEm : revisadoEm
  return (
    <div className={cn('flex flex-col gap-[22px]', className)}>
      <header>
        <h1 className="text-titulo leading-[1.1] font-semibold tracking-[-0.02em] text-tinta">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-corpo text-tinta-sussurro">{description}</p>}
      </header>
      {children}
      <div role="note" className="flex gap-2.5 rounded-container bg-atencao/[0.08] px-4 py-3 text-apoio text-atencao">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>Apoio à decisão clínica: confira antes de prescrever. Não substitui o julgamento do profissional responsável.</p>
      </div>
      {(fonte || revisado) && (
        <section aria-label="Fonte" className="rounded-container border border-fio bg-superficie px-4 py-3">
          <h2 className="rotulo text-tinta-apoio">Fonte</h2>
          {fonte && <p className="mt-1 text-apoio text-tinta">{fonte}</p>}
          {revisado && <p className="mt-0.5 text-rotulo text-tinta-sussurro">Revisado em {revisado}</p>}
          {ficha && <p className="mt-0.5 text-rotulo text-tinta-sussurro">Versão da regra: {ficha.versao}</p>}
        </section>
      )}
    </div>
  )
}
