// Estado em ponto + texto, como na fila da recepção (revisão visual 3.2/3.3, nível
// mínimo), no lugar das pílulas: o ponto vazio aguarda, o contornado pede
// atenção, o cheio está andando ou concluído.
import { cn } from '@/lib/utils'

export type TomEstado = 'ambar' | 'verde' | 'teal' | 'cinza' | 'vermelho'

const TOM: Record<TomEstado, { texto: string; ponto: string }> = {
  ambar: { texto: 'text-atencao', ponto: 'border-atencao bg-alerta-atencao' },
  verde: { texto: 'text-conforme', ponto: 'border-conforme bg-conforme' },
  teal: { texto: 'text-acao', ponto: 'border-acao bg-acao' },
  cinza: { texto: 'text-tinta-apoio', ponto: 'border-fio-forte' },
  vermelho: { texto: 'font-medium text-critico', ponto: 'border-critico bg-alerta-critico' },
}

export function Estado({ tom, children }: { tom: TomEstado; children: React.ReactNode }) {
  const { texto, ponto } = TOM[tom]
  return (
    <span className={cn('inline-flex items-center gap-[7px] self-start text-apoio whitespace-nowrap', texto)}>
      <span aria-hidden className={cn('size-2.5 shrink-0 rounded-capsula border-2', ponto)} />
      {children}
    </span>
  )
}
