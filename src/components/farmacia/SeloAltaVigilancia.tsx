// Selo de alta vigilância da farmácia (revisão visual 3.7): é alerta, então fica
// em selo, mas sem as maiúsculas espaçadas do Badge. Âmbar na fila e nas listas;
// vermelho onde a administração já aconteceu sem liberação.
import { AlertTriangle } from 'lucide-react'

import { cn } from '@/lib/utils'

export function SeloAltaVigilancia({ curto = false, critico = false, className }: {
  /** "AV" no lugar de "alta vigilância", para listas estreitas. */
  curto?: boolean
  critico?: boolean
  className?: string
}) {
  return (
    // padrao-ok: selo de alerta (alta vigilância), como o de alergia; status comum vai em ponto + texto
    <span title="Medicamento de alta vigilância" className={cn('inline-flex items-center gap-1 rounded-capsula px-2 py-[2px] text-rotulo font-semibold whitespace-nowrap',
      critico ? 'bg-alerta-critico text-critico' : 'bg-alerta-atencao text-atencao', className)}>
      <AlertTriangle className="size-3 shrink-0" aria-hidden />{curto ? 'AV' : 'alta vigilância'}
    </span>
  )
}
