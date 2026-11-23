// Bloco de programa na consulta da UBS que começa fechado (refinamento da UBS,
// RF4 = A do RT em 23/11/2026): o pré-natal, o hiperdia e a puericultura
// ocupavam a aba Conduta inteira. Fechado, o bloco mostra uma linha de resumo
// (fase, pontos e o que já se perdeu); um clique abre o conteúdo completo.
import { ChevronRight } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export function BlocoRecolhivel({ rotulo, titulo, resumo, children, inicioAberto = false }: {
  /** nome do bloco para leitor de tela (ex.: "Pré-natal") */
  rotulo: string
  /** ícone e nome, como no cabeçalho de antes */
  titulo: React.ReactNode
  /** a linha de resumo, visível aberto ou fechado */
  resumo?: React.ReactNode
  children: React.ReactNode
  inicioAberto?: boolean
}) {
  const [aberto, setAberto] = React.useState(inicioAberto)
  const id = React.useId()
  return (
    <section aria-label={rotulo} className="flex flex-col gap-2.5 rounded-container border border-fio px-4 py-3">
      <button type="button" aria-expanded={aberto} aria-controls={id} onClick={() => setAberto((a) => !a)}
        className="-mx-1 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-controle px-1 text-left hover:bg-campo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao/40">
        <ChevronRight aria-hidden className={cn('size-4 shrink-0 text-tinta-sussurro transition-transform', aberto && 'rotate-90')} />
        {titulo}
        {resumo}
        <span className="ml-auto text-rotulo text-tinta-sussurro">{aberto ? 'fechar' : 'abrir'}</span>
      </button>
      {aberto && <div id={id} className="flex flex-col gap-2.5">{children}</div>}
    </section>
  )
}
