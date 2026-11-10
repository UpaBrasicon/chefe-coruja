// Selo de medicação controlada (lacuna 3, Portaria 344): "Controlado · B1".
// É alerta como o de alta vigilância, então fica em selo, sem as maiúsculas
// espaçadas do Badge. O título diz a substância e a receita que a lista exige.
import { Lock } from 'lucide-react'

import { ROTULO_RECEITA, rotuloSelo, type Controle } from '@/domain/controlados'
import { useControladosDoCatalogo } from '@/hooks/useControlados'
import { cn } from '@/lib/utils'

export function SeloControlado({ controle, className }: { controle: Controle; className?: string }) {
  const titulo = [controle.substancia, `lista ${controle.lista} da Portaria 344`, `para casa: ${ROTULO_RECEITA[controle.receita]}`]
    .filter(Boolean).join(' · ')
  return (
    // padrao-ok: selo de alerta (medicação controlada), como o de alta vigilância
    <span title={titulo} className={cn('inline-flex items-center gap-1 rounded-capsula bg-alerta-marca px-2 py-[2px] text-rotulo font-semibold whitespace-nowrap text-acao', className)}>
      <Lock className="size-3 shrink-0" aria-hidden />{rotuloSelo(controle.lista)}
    </span>
  )
}

/** O selo pelo id do catálogo; item sem controle não mostra nada. */
export function SeloDoMedicamento({ id, className }: { id: string | null | undefined; className?: string }) {
  const controle = useControladosDoCatalogo().data?.get(id ?? '') ?? null
  return controle ? <SeloControlado controle={controle} className={className} /> : null
}
