import { lazy, Suspense } from 'react'
import { Eye, Hospital } from 'lucide-react'

import { AbasInternacao } from '@/components/plantao/AbasPlantao'
import { TituloPagina } from '@/components/monitor/Pagina'
import { Spinner } from '@/components/ui/spinner'

// Internação do médico (RT, 24/11/2026): item próprio no menu, com as abas
// Internação, Observação e Passômetro. A Evolução clínica saiu; a evolução do
// paciente fica no caderno do leito (Resumo e Evoluções).
const PacientesInternados = lazy(async () => ({ default: (await import('@/pages/plantao/secoes/PacientesInternados')).PacientesInternados }))
const PacientesObservacao = lazy(async () => ({ default: (await import('@/pages/plantao/secoes/PacientesObservacao')).PacientesObservacao }))
const Passometro = lazy(() => import('@/pages/plantao/Passometro'))

export type AbaInternacao = 'internacao' | 'observacao' | 'passometro'

export default function AreaInternacao({ aba }: { aba: AbaInternacao }) {
  return (
    <>
      <AbasInternacao />
      {aba === 'internacao' && (
        <TituloPagina icone={Hospital} titulo="Internação"
          descricao="Pacientes internados: o leito aberto tem o caderno com resumo, evoluções, prescrição e documentos." />
      )}
      {aba === 'observacao' && (
        <TituloPagina icone={Eye} titulo="Observação" descricao="Pacientes em observação, por no máximo 6 horas." />
      )}
      <Suspense fallback={<div className="flex h-40 items-center justify-center"><Spinner /></div>}>
        {aba === 'internacao' ? <PacientesInternados key="internacao" />
          : aba === 'observacao' ? <PacientesObservacao key="observacao" />
            : <Passometro key="passometro" />}
      </Suspense>
    </>
  )
}
