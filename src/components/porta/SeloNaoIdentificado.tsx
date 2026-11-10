import { UserRoundSearch } from 'lucide-react'

import { ehNaoIdentificado, sinaisDoSelo, type PacienteMarcado } from '@/domain/naoIdentificado'

/** Paciente ainda sem identidade (lacuna 1, RT 10/11/2026): o selo e os sinais
 *  que a recepção anotou, para separar dois desconhecidos na mesma fila. */
export function SeloNaoIdentificado({ paciente }: { paciente: PacienteMarcado }) {
  if (!ehNaoIdentificado(paciente)) return null
  const sinais = sinaisDoSelo(paciente)
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 self-start rounded-capsula bg-alerta-observacao px-2.5 py-1 text-rotulo text-observacao">
      <span className="inline-flex items-center gap-1 font-semibold">
        <UserRoundSearch className="size-3.5" aria-hidden /> Não identificado
      </span>
      {sinais && <span className="min-w-0 break-words">{sinais}</span>}
    </span>
  )
}
