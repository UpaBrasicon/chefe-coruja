import { cn } from '@/lib/utils'
import { NIVEL_RISCO, type CorRisco } from '@/domain/risco'

// Só EXIBE a cor escolhida pela enfermagem; sem cor = "sem classificação".
// Não calcula nem sugere cor (CLAUDE.md, ADR 0007).
const ESTILO: Record<CorRisco, string> = {
  vermelho: 'bg-mts-vermelho text-mts-texto',
  laranja: 'bg-mts-laranja text-mts-texto',
  amarelo: 'bg-mts-amarelo text-mts-amarelo-texto',
  verde: 'bg-mts-verde text-mts-texto',
  azul: 'bg-mts-azul text-mts-texto',
}

// Forma calma para listas (revisão do médico, RT 24/11/2026): ponto na cor da
// enfermagem + o nome da cor em texto normal. As cores são as mesmas da pílula.
const PONTO: Record<CorRisco, string> = {
  vermelho: 'bg-mts-vermelho',
  laranja: 'bg-mts-laranja',
  amarelo: 'bg-mts-amarelo',
  verde: 'bg-mts-verde',
  azul: 'bg-mts-azul',
}

export function PontoRisco({ cor, className }: { cor?: CorRisco | null; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-apoio whitespace-nowrap', cor ? 'text-tinta' : 'text-tinta-sussurro', className)}>
      <span aria-hidden className={cn('size-2.5 shrink-0 rounded-capsula', cor ? PONTO[cor] : 'ring-1 ring-fio-forte')} />
      <span className="capitalize">{cor ?? 'sem classificação'}</span>
    </span>
  )
}

export function PilulaRisco({ cor, className, detalhe = false }: { cor?: CorRisco | null; className?: string; detalhe?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[76px] items-center justify-center rounded-capsula px-2.5 py-[3px] text-rotulo font-semibold capitalize',
        cor ? ESTILO[cor] : 'bg-campo text-tinta-sussurro ring-1 ring-fio',
        className
      )}
    >
      {cor ? (detalhe ? `${cor} · ${NIVEL_RISCO[cor]}` : cor) : 'sem classificação'}
    </span>
  )
}
