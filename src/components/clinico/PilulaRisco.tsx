import { cn } from '@/lib/utils'
import { NIVEL_RISCO, type CorRisco } from '@/domain/risco'

// Só EXIBE a cor escolhida pela enfermagem; sem cor = "sem classificação".
// Não calcula nem sugere cor (CLAUDE.md, ADR 0007).
const ESTILO: Record<CorRisco, string> = {
  vermelho: 'bg-mts-vermelho text-white',
  laranja: 'bg-mts-laranja text-white',
  amarelo: 'bg-mts-amarelo text-mts-amarelo-texto',
  verde: 'bg-mts-verde text-white',
  azul: 'bg-mts-azul text-white',
}

export function PilulaRisco({ cor, className, detalhe = false }: { cor?: CorRisco | null; className?: string; detalhe?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[76px] items-center justify-center rounded-capsula px-2.5 py-[3px] text-[12px] font-semibold capitalize',
        cor ? ESTILO[cor] : 'bg-campo text-tinta-sussurro ring-1 ring-fio',
        className
      )}
    >
      {cor ? (detalhe ? `${cor} · ${NIVEL_RISCO[cor]}` : cor) : 'sem classificação'}
    </span>
  )
}
