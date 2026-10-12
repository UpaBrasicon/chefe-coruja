import { Users } from 'lucide-react'

import { diferenciador, type PacienteDaFila } from '@/domain/homonimos'

/** Linha com outra do mesmo nome e nascimento na fila: o selo e o que as
 *  separa (correções do portão, tarefa 8). */
export function SeloHomonimo({ paciente }: { paciente: PacienteDaFila }) {
  const dif = diferenciador(paciente)
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 self-start rounded-capsula bg-[#FEF3C7] px-2.5 py-1 text-rotulo text-atencao">
      <span className="inline-flex items-center gap-1 font-semibold">
        <Users className="size-3.5" aria-hidden /> Mesmo nome e nascimento
      </span>
      {dif && <span>{dif}</span>}
    </span>
  )
}
