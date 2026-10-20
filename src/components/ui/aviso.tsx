import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type TomAviso = 'atencao' | 'critico' | 'conforme' | 'informacao' | 'marca'

// Fundo suave, borda e texto de cada tom, com os tokens dos dois temas (guia 2.1).
const TOM: Record<TomAviso, { classe: string; icone: LucideIcon }> = {
  atencao: { classe: 'border-atencao/30 bg-alerta-atencao text-atencao', icone: AlertTriangle },
  critico: { classe: 'border-critico/30 bg-alerta-critico text-critico', icone: AlertTriangle },
  conforme: { classe: 'border-conforme/30 bg-alerta-conforme text-conforme', icone: CheckCircle2 },
  informacao: { classe: 'border-fio bg-trilha text-tinta-apoio', icone: Info },
  marca: { classe: 'border-acao/30 bg-alerta-marca text-acao', icone: Info },
}

/** Aviso com tom (guia do padrão, 2.1). Para falha de ação, use MensagemErro. */
export function Aviso({ tom = 'atencao', titulo, children, acao, icone, className }: {
  tom?: TomAviso
  titulo?: ReactNode
  children?: ReactNode
  /** Botão ou link à direita. */
  acao?: ReactNode
  icone?: LucideIcon
  className?: string
}) {
  const { classe, icone: padrao } = TOM[tom]
  const Icone = icone ?? padrao
  return (
    <div role="status" className={cn('flex flex-wrap items-start gap-2.5 rounded-container border px-3.5 py-3', classe, className)}>
      <Icone className="mt-px size-4 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5 text-apoio text-pretty">
        {titulo && <span className="font-semibold">{titulo}</span>}
        {children}
      </div>
      {acao}
    </div>
  )
}
