import { Baby } from 'lucide-react'

import { SEM_REFERENCIA_PEDIATRICA } from '@/clinico/ficha'

// Casco pediátrico: aparece no lugar do cálculo quando a ferramenta não tem
// fonte pediátrica declarada. Não converte o adulto para a criança.
export function SemReferenciaPediatrica({ detalhe }: { detalhe?: string }) {
  return (
    <div role="status" className="flex gap-2.5 rounded-container border border-fio bg-superficie px-4 py-3 text-corpo text-tinta">
      <Baby className="mt-0.5 size-4 shrink-0 text-tinta-apoio" aria-hidden />
      <div>
        <p className="font-medium">{SEM_REFERENCIA_PEDIATRICA}</p>
        {detalhe && <p className="mt-1 text-apoio text-tinta-sussurro">{detalhe}</p>}
      </div>
    </div>
  )
}
