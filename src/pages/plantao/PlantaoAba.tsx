import { lazy, Suspense } from 'react'

import { AbasPlantao } from '@/components/plantao/AbasPlantao'
import { Spinner } from '@/components/ui/spinner'

// Abas Minha agenda e Prontuários do Plantão (RT, 24/11/2026): as mesmas telas
// de /agenda e /prontuarios, agora dentro do Plantão, abaixo das abas.
const AgendaGrupo = lazy(() => import('@/pages/grupos/AgendaGrupo'))
const PedidosProntuario = lazy(() => import('@/pages/prontuario/PedidosProntuario'))

export default function PlantaoAba({ aba }: { aba: 'agenda' | 'prontuarios' }) {
  return (
    <>
      <AbasPlantao />
      <Suspense fallback={<div className="flex h-40 items-center justify-center"><Spinner /></div>}>
        {aba === 'agenda' ? <AgendaGrupo /> : <PedidosProntuario />}
      </Suspense>
    </>
  )
}
