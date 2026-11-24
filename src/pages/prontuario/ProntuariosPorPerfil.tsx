// Rota /prontuarios pelo perfil em uso (PT1, RT 24/11/2026). No perfil
// Telemedicina, só os pacientes das teleinterconsultas aceitas; nos outros, a
// tela de sempre (pedido de acesso, pacientes do plantão). Antes a tela
// escolhia pelos papéis, e quem tinha os dois via a do Médico na Telemedicina.
import * as React from 'react'

import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import PedidosProntuario from './PedidosProntuario'

const ProntuariosTele = React.lazy(() => import('@/pages/telemedicina/ProntuariosTele'))

export default function ProntuariosPorPerfil() {
  const { papelAtivo } = useUnidade()
  if (papelAtivo === 'telemedicina') {
    return (
      <React.Suspense fallback={<Spinner />}>
        <ProntuariosTele />
      </React.Suspense>
    )
  }
  return <PedidosProntuario />
}
