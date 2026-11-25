// Etiquetas densas da Internação do NIR (modelo do RT, 25/11/2026): o código
// do leito e o isolamento, em mono, na lista, no dossiê e no mapa.
import type * as React from 'react'

import { etiquetaIsolamento } from '@/lib/nirPainel'
import { cn } from '@/lib/utils'

/** Código do leito em etiqueta (mono); livre em cinza. */
export function CodigoLeito({ children, livre = false }: { children: React.ReactNode; livre?: boolean }) {
  return (
    <span className={cn('shrink-0 rounded-controle border px-1 font-mono text-rotulo font-semibold',
      livre ? 'border-fio bg-campo text-tinta-sussurro' : 'border-acao/30 bg-acao/10 text-acao')}>{children}</span>
  )
}

/** Etiqueta de isolamento (mono, âmbar): "ISO · CONTATO". */
export function EtiquetaIso({ tipos }: { tipos: readonly string[] | null | undefined }) {
  const t = etiquetaIsolamento(tipos)
  if (!t) return null
  return <span className="shrink-0 rounded-controle border border-atencao/30 bg-atencao/10 px-1 font-mono text-rotulo font-semibold text-atencao">{t}</span>
}
