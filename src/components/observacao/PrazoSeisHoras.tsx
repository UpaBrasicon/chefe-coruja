// Prazo das 6 horas da observação com a barra (M2 da revisão do médico, RT
// 24/11/2026): quanto falta (ou quanto passou), a barra de 0 a 100% e até que
// horas. Os números vêm de relogioPermanencia, como antes; só a barra é nova.
import { Clock } from 'lucide-react'

import { cn } from '@/lib/utils'

import { TOM_BARRA, TOM_TEXTO, hhmm, relogioPermanencia } from './modelo'

export function PrazoSeisHoras({ entrada, prazo, agora }: { entrada: string; prazo: string; agora: number }) {
  const rel = relogioPermanencia(entrada, prazo, agora)
  return (
    <div className="flex min-w-[150px] flex-col gap-1">
      <span className={cn('flex items-center gap-1 font-semibold', TOM_TEXTO[rel.tom])}>
        <Clock className="size-3" aria-hidden /> {rel.contagem}
      </span>
      <div role="meter" aria-label="Prazo de 6 horas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rel.pct}
        className="h-1.5 w-full max-w-[160px] overflow-hidden rounded-capsula bg-trilha">
        <div className={cn('h-full rounded-capsula', TOM_BARRA[rel.tom])} style={{ width: `${rel.pct}%` }} />
      </div>
      <div className={cn('text-rotulo', rel.acima ? 'text-observacao' : 'text-tinta-sussurro')}>
        {rel.acima ? 'Definir conduta ou internar' : `até ${hhmm(prazo)}`}
      </div>
    </div>
  )
}
